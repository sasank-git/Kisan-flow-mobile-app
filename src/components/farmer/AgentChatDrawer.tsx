import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, CheckCircle2, MapPin, Calendar, Scale, Mic, MicOff } from 'lucide-react';
import { PipecatClient } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { createAgentSession, AgentChatMessage, GeminiContent } from '../../agent/orchestrator';
import { BookingDraft, registerExternalDraft } from '../../agent/tools';

const CHAT_MESSAGES_KEY = (farmerId: string) => `kisanflow_chat_messages_${farmerId}`;
const CHAT_HISTORY_KEY = (farmerId: string) => `kisanflow_chat_history_${farmerId}`;
const VOICE_ENDPOINT = 'http://localhost:7860/api/offer';

const defaultGreeting = (name?: string): AgentChatMessage => ({
  role: 'agent',
  text: `Namaste ${name?.split(' ')[0] || ''}! I can help you check mandi wait times, recommend the best centre, or book a slot. Type or tap the mic to talk.`,
});

function loadMessages(farmerId: string): AgentChatMessage[] {
  try {
    const saved = localStorage.getItem(CHAT_MESSAGES_KEY(farmerId));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadGeminiHistory(farmerId: string): GeminiContent[] {
  try {
    const saved = localStorage.getItem(CHAT_HISTORY_KEY(farmerId));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

interface AgentChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentChatDrawer: React.FC<AgentChatDrawerProps> = ({ isOpen, onClose }) => {
  const { farmer, centres, bookings, bookNewSlot } = useKisanFlow();

  const [messages, setMessages] = useState<AgentChatMessage[]>(() => {
    const saved = loadMessages(farmer.id);
    return saved.length > 0 ? saved : [defaultGreeting(farmer?.name)];
  });
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [confirmingDraftId, setConfirmingDraftId] = useState<string | null>(null);

  // --- Voice mode state (NEW) -------------------------------------------
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [botSpeaking, setBotSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0); // 0..1, drives the listening circle
  const voiceClientRef = useRef<PipecatClient | null>(null);
  const botAudioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Polls the mic's AnalyserNode every frame and turns volume into a 0..1 level.
  const startLevelLoop = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setMicLevel(Math.min(1, avg / 100)); // 100 is an eyeballed ceiling, tweak if too sensitive
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const stopLevelLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setMicLevel(0);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  const sessionRef = useRef(
    createAgentSession({ farmer, centres, bookings, bookNewSlot }, loadGeminiHistory(farmer.id))
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedMessages = loadMessages(farmer.id);
    const savedHistory = loadGeminiHistory(farmer.id);
    setMessages(savedMessages.length > 0 ? savedMessages : [defaultGreeting(farmer?.name)]);
    sessionRef.current = createAgentSession({ farmer, centres, bookings, bookNewSlot }, savedHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmer?.id]);

  useEffect(() => {
    if (!farmer?.id) return;
    localStorage.setItem(CHAT_MESSAGES_KEY(farmer.id), JSON.stringify(messages));
    localStorage.setItem(CHAT_HISTORY_KEY(farmer.id), JSON.stringify(sessionRef.current.getHistory()));
  }, [messages, farmer?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking, voiceConnecting]);

  // Disconnect voice session on unmount/close, so mic doesn't stay hot.
  useEffect(() => {
    if (!isOpen && voiceClientRef.current) {
      voiceClientRef.current.disconnect().catch(() => {});
      voiceClientRef.current = null;
      stopLevelLoop();
      setVoiceMode(false);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking || voiceMode) return;

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
      { role: 'agent', text: "No problem, I've cancelled that draft. Let me know if you want to try a different slot." },
    ]);
  };

  const handleClearChat = () => {
    const greeting = [defaultGreeting(farmer?.name)];
    setMessages(greeting);
    sessionRef.current.reset();
    localStorage.removeItem(CHAT_MESSAGES_KEY(farmer.id));
    localStorage.removeItem(CHAT_HISTORY_KEY(farmer.id));
  };

  // --- Voice mode handlers (NEW) -----------------------------------------
  const startVoice = async () => {
    setVoiceConnecting(true);
    try {
      const c = new PipecatClient({
        transport: new SmallWebRTCTransport(),
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => setVoiceConnecting(false),
          onDisconnected: () => {
            setVoiceMode(false);
            setVoiceConnecting(false);
            setBotSpeaking(false);
            stopLevelLoop();
          },
          onBotTranscript: (data: any) => {
            if (data?.text) setMessages(prev => [...prev, { role: 'agent', text: data.text }]);
          },
          onUserTranscript: (data: any) => {
            if (data?.final && data?.text) {
              setMessages(prev => [...prev, { role: 'user', text: data.text }]);
            }
          },
          onBotStartedSpeaking: () => setBotSpeaking(true),
          onBotStoppedSpeaking: () => setBotSpeaking(false),
          // NEW: attach the bot's outgoing audio track so it's actually audible.
          // Callback name / track shape varies by @pipecat-ai/client-js version —
          // if this doesn't fire, check node_modules/@pipecat-ai/client-js/dist/*.d.ts
          // for the real event (often onTrackStarted(track, participant) or similar).
          onTrackStarted: (track: MediaStreamTrack, participant?: any) => {
            if (track.kind === 'audio' && participant?.local !== true && botAudioRef.current) {
              botAudioRef.current.srcObject = new MediaStream([track]);
              botAudioRef.current.play().catch(() => {});
            }
          },
          onServerMessage: (msg: any) => {
            if (msg?.type === 'booking_draft') {
              // NEW: register this voice-originated draft into tools.ts's
              // own pendingDrafts store, so tapping Confirm can go through
              // the exact same confirmDraft() path as text bookings —
              // no data channel round-trip to bot.py needed at all.
              registerExternalDraft(msg.draft);
              setMessages(prev => [
                ...prev,
                { role: 'agent', text: `Here's what I'd book — check the details below.`, draft: msg.draft },
              ]);
            }
            if (msg?.type === 'booking_result') {
              setMessages(prev => [
                ...prev,
                { role: 'agent', text: msg.message || msg.error || 'Booking updated.' },
              ]);
            }
          },
        },
      });

      await c.connect({
        webrtcRequestParams: { endpoint: VOICE_ENDPOINT },
        requestData: {
          farmer_id: farmer?.id,
          farmer_name: farmer?.name,
          farmer_mobile: farmer?.mobile,
          farmer_village: farmer?.village,
        },
      });

      voiceClientRef.current = c;
      setVoiceMode(true);

      // NEW: independent Web Audio analyser on the mic, purely for the
      // listening-circle visual — doesn't touch pipecat's own audio pipeline.
      // getLocalAudioTrack() name may differ by client-js version; if it
      // errors, fall back to navigator.mediaDevices.getUserMedia({audio:true}).
      try {
        const localTrack = (c as any).localAudioTrack?.() ?? (c as any).getLocalAudioTrack?.();
        const stream = localTrack ? new MediaStream([localTrack]) : await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        startLevelLoop();
      } catch (e) {
        console.warn('Mic level analyser unavailable, listening indicator will be static:', e);
      }
    } catch (err: any) {
      console.error('Voice connect failed:', err);
      setMessages(prev => [
        ...prev,
        { role: 'agent', text: `Couldn't start voice mode: ${err?.message || 'connection failed'}` },
      ]);
      setVoiceConnecting(false);
    }
  };

  const stopVoice = async () => {
    if (voiceClientRef.current) {
      await voiceClientRef.current.disconnect().catch(() => {});
      voiceClientRef.current = null;
    }
    stopLevelLoop();
    setBotSpeaking(false);
    setVoiceMode(false);
  };

  const toggleVoice = () => {
    if (voiceMode) stopVoice();
    else startVoice();
  };

  // NOTE: voice drafts now confirm through the exact same path as text —
  // sessionRef.current.confirmDraft() below — since registerExternalDraft()
  // already put this draft into tools.ts's own store when it arrived.
  // The old data-channel round-trip to bot.py (sendClientMessage /
  // on_client_message) is no longer used for confirmation at all.

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md h-[85vh] sm:h-[80vh] bg-slate-950 border-t sm:border-2 border-emerald-500/40 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-heading font-bold text-white block">KisanFlow Assistant</span>
              <span className="text-[10px] text-emerald-400 font-medium">
                {voiceMode ? 'Voice mode • Listening' : voiceConnecting ? 'Connecting voice...' : 'Online • AI Powered'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleClearChat} className="text-[10px] text-slate-500 hover:text-slate-300 font-medium">
              Clear
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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

          {(isThinking || voiceConnecting) && (
            <div className="flex justify-start">
              <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-400">{voiceConnecting ? 'Connecting...' : 'Thinking...'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Hidden element that actually plays the bot's TTS audio back */}
        <audio ref={botAudioRef} autoPlay className="hidden" />

        {voiceMode && (
          <div className="flex flex-col items-center justify-center py-3 gap-1.5 border-t border-slate-800 bg-slate-900/60">
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Outer pulse rings — scale with live mic level */}
              <div
                className="absolute inset-0 rounded-full bg-emerald-500/20 transition-transform duration-75"
                style={{ transform: `scale(${1 + micLevel * 0.9})` }}
              />
              <div
                className="absolute inset-0 rounded-full bg-emerald-500/30 transition-transform duration-100"
                style={{ transform: `scale(${1 + micLevel * 0.5})` }}
              />
              <div
                className={`relative w-11 h-11 rounded-full flex items-center justify-center shadow-lg ${
                  botSpeaking ? 'bg-sky-500' : 'bg-emerald-500'
                }`}
              >
                <Mic className="w-5 h-5 text-slate-950" />
              </div>
            </div>
            <span className="text-[10px] font-medium text-slate-400">
              {botSpeaking ? 'Speaking...' : 'Listening...'}
            </span>
          </div>
        )}

        <div className="p-3 border-t border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleVoice}
              disabled={voiceConnecting}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${
                voiceMode ? 'bg-rose-500 text-white' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
              }`}
              aria-label={voiceMode ? 'Stop voice' : 'Start voice'}
            >
              {voiceMode ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={voiceMode ? 'Voice mode active — tap mic to type instead' : 'Ask about slots, wait times, MSP...'}
              disabled={isThinking || voiceMode}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isThinking || voiceMode || !input.trim()}
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

export const BookingDraftCard: React.FC<{
  draft: BookingDraft;
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ draft, isConfirming, onConfirm, onCancel }) => {
  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/40 space-y-2.5">
      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        Review Booking
      </span>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-slate-200">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{draft.centreName}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <Scale className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{draft.quantity} Quintals — {draft.cropType} ({draft.variety})</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{draft.date}, {draft.time}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={isConfirming}
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isConfirming}
          className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
        >
          {isConfirming ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Booking...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirm Booking
            </>
          )}
        </button>
      </div>
    </div>
  );
};