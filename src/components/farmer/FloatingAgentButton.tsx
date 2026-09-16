import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AgentChatDrawer } from './AgentChatDrawer';

export const FloatingAgentButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-400 shadow-2xl shadow-emerald-950/50 flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6 text-slate-950" fill="currentColor" />
      </button>

      <AgentChatDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};