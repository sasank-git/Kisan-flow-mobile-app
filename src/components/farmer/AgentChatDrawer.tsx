import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, CheckCircle2, MapPin, Calendar, Scale } from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { createAgentSession, AgentChatMessage } from '../../agent/orchestrator';
import { BookingDraft } from '../../agent/tools';

const CHAT_STORAGE_KEY = (farmerId: string) => `kisanflow_chat_${farmerId}`;
const CHAT_HISTORY_KEY = (farmerId: string) => `kisanflow_chat_history_${farmerId}`;

const defaultGreeting = (name?: string): AgentChatMessage => ({
  role: 'agent',
  text: `Namaste ${name?.split(' ')[0] || ''}! I can help you check mandi wait times, recommend the best centre, or book a slot. What do you need?`,
});

const loadHistory = (farmerId: string) => {
  try {
    const saved = localStorage.getItem(CHAT_HISTORY_KEY(farmerId));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

interface AgentChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentChatDrawer: React.FC<AgentChatDrawerProps> = ({ isOpen, onClose }) => {
  const { farmer, centres, bookings, bookNewSlot } = useKisanFlow();

  const [messages, setMessages] = useState<AgentChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY(farmer.id));
      if (saved) return JSON.parse(saved);
    } catch {}
    return [defaultGreeting(farmer?.name)];
  });

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [confirmingDraftId, setConfirmingDraftId] = useState<string | null>(null);

  const sessionRef = useRef(
    createAgentSession({ farmer, centres, bookings, bookNewSlot }, loadHistory(farmer.id))
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Re-create session when underlying farmer identity changes (e.g. fresh
    // login) — reloads that farmer's saved history instead of starting blank.
    sessionRef.current = createAgentSession(
      { farmer, centres, bookings, bookNewSlot },
      loadHistory(farmer.id)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmer?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  // Persist UI transcript + Gemini-internal history on every change.
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY(farmer.id), JSON.stringify(messages));
      localStorage.setItem(CHAT_HISTORY_KEY(farmer.id), JSON.stringify(sessionRef.current.getHistory()));
    } catch {}
  }, [messages, farmer.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsThinking(true);

    try {
      const reply = await sessionRef.current.send(text);
      setMessages(prev => [...prev, reply]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'agent', text: `Sorry, something went wrong: ${err?.message || 'unknown error'}` },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleConfirmDraft = async (draft: BookingDraft) => {
    setConfirmingDraftId(draft.draftId);
    try {
      const reply = await sessionRef.current.confirmDraft(draft.draftId);
      setMessages(prev => [...prev, reply]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'agent', text: `Booking failed: ${err?.message || 'unknown error'}` },
      ]);
    } finally {
      setConfirmingDraftId(null);
    }
  };

  const handleCancelDraft = () => {
    setMessages(prev => [
      ...prev,
      { role: 'agent', text: 'No problem, I\'ve cancelled that draft. Let me know if you want to try a different slot.' },
    ]);
  };

  const handleNewChat = () => {
    sessionRef.current.reset();
    const greeting = defaultGreeting(farmer?.name);
    setMessages([greeting]);
    try {
      localStorage.setItem(CHAT_STORAGE_KEY(farmer.id), JSON.stringify([greeting]));
      localStorage.setItem(CHAT_HISTORY_KEY(farmer.id), JSON.stringify([]));
    } catch {}
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full sm:max-w-md h-[85vh] sm:h-[80vh] bg-slate-950 border-t sm:border-2 border-emerald-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-heading font-bold text-white block">KisanFlow Assistant</span>
              <span className="text-[10px] text-emerald-400 font-medium">Online • AI Powered</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 px-2 py-1 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              New Chat
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                  msg.role === 'user'
                    ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-sm'
                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-bl-sm'
                }`}
              >
                {msg.text}

                {msg.draft && (
                  <BookingDraftCard
                    draft={msg.draft}
                    isConfirming={confirmingDraftId === msg.draft.draftId}
                    onConfirm={() => handleConfirmDraft(msg.draft!)}
                    onCancel={handleCancelDraft}
                  />
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-400">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about slots, wait times, MSP..."
              disabled={isThinking}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isThinking || !input.trim()}
              className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 flex items-center justify-center shrink-0 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};