import React, { useEffect, useState } from 'react';
import { Mic, MicOff, X, Sparkles } from 'lucide-react';
import {
  PipecatClient,
  RTVIEvent,
} from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { BookingDraft } from '../../agent/tools';
// Reuse the exact same card component your text chat already uses:
import { BookingDraftCard } from './AgentChatDrawer'; // export it there if not already exported

interface VoiceAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceAgentDrawer: React.FC<VoiceAgentDrawerProps> = ({ isOpen, onClose }) => {
  const { farmer } = useKisanFlow();
  const [client, setClient] = useState<PipecatClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const c = new PipecatClient({
      transport: new SmallWebRTCTransport(),
      enableMic: true,
      enableCam: false,
      callbacks: {
        onConnected: () => setConnected(true),
        onDisconnected: () => setConnected(false),
        onBotTranscript: (data: any) =>
          setTranscript(prev => [...prev, { role: 'agent', text: data.text }]),
        onUserTranscript: (data: any) => {
          if (data.final) setTranscript(prev => [...prev, { role: 'user', text: data.text }]);
        },
        onServerMessage: (msg: any) => {
          if (msg?.type === 'booking_draft') setDraft(msg.draft);
          if (msg?.type === 'booking_result') {
            setDraft(null);
            setTranscript(prev => [
              ...prev,
              { role: 'agent', text: msg.message || (msg.error ?? 'Booking updated.') },
            ]);
          }
        },
      },
    });

    c.connect({
      webrtcRequestParams: { endpoint: 'http://localhost:7860/api/offer' },
      requestData: {
        farmer_id: farmer?.id,
        farmer_name: farmer?.name,
        farmer_mobile: farmer?.mobile,
        farmer_village: farmer?.village,
      },
    }).catch(err => console.error('Voice connect failed:', err));

    setClient(c);

    return () => {
      c.disconnect().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleMic = () => {
    if (!client) return;
    client.enableMic(!micOn);
    setMicOn(!micOn);
  };

  const handleConfirmTap = () => {
    if (!client || !draft) return;
    setIsConfirming(true);
    client.sendClientMessage?.({ type: 'confirm_booking_tap', draftId: draft.draftId });
    // onServerMessage 'booking_result' above clears isConfirming via draft becoming null;
    // add a fallback timeout if you want to be safe against a dropped message.
  };

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
              <span className="text-sm font-heading font-bold text-white block">Voice Assistant</span>
              <span className="text-[10px] text-emerald-400 font-medium">
                {connected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {transcript.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                  msg.role === 'user'
                    ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-sm'
                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-bl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {draft && (
            <BookingDraftCard
              draft={draft}
              isConfirming={isConfirming}
              onConfirm={handleConfirmTap}
              onCancel={() => setDraft(null)}
            />
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0 flex justify-center">
          <button
            onClick={toggleMic}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
              micOn ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};