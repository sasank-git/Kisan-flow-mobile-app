import React from 'react';
import { Zap, Clock, ArrowRight, Check, X, Sparkles } from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';

export const SlotRecoveryBanner: React.FC = () => {
  const { recoveryOffer, acceptRecoveryOffer, declineRecoveryOffer, t } = useKisanFlow();

  if (!recoveryOffer) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border-2 border-amber-400/80 rounded-2xl p-4 shadow-xl shadow-amber-950/30 text-white animate-pulse relative overflow-hidden my-3">
      {/* Background glow badge */}
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold flex-shrink-0 shadow-md">
          <Zap className="w-5 h-5 fill-slate-950" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI SLOT RECOVERY (USP)
            </span>
            <span className="text-xs text-amber-300 font-mono">Token {recoveryOffer.tokenNumber}</span>
          </div>

          <h4 className="font-heading font-bold text-base text-white mt-1">
            {t.earlierSlotAlert}
          </h4>
          <p className="text-xs text-slate-200 mt-1 leading-relaxed">
            Farmer #{recoveryOffer.vacatedByToken} was detected as a <strong>NO-SHOW</strong>. 
            A prime slot opened at <strong className="text-amber-300 underline font-mono">{recoveryOffer.offeredSlot}</strong> at {recoveryOffer.centreName}.
          </p>

          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-amber-500/30 text-xs">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-slate-300">Your Current: <span className="line-through text-slate-400">{recoveryOffer.originalSlot}</span></span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-emerald-400">New Slot: {recoveryOffer.offeredSlot} (~40 min wait saved!)</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={acceptRecoveryOffer}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-transform active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{t.acceptSlot}</span>
            </button>
            <button
              onClick={declineRecoveryOffer}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-1 border border-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t.keepCurrentSlot}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
