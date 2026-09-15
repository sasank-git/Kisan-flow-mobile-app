import React, { useState } from 'react';
import { 
  PhoneCall, 
  PhoneOff, 
  Mic, 
  Volume2, 
  X, 
  Languages, 
  CheckCircle2, 
  Hash, 
  Sparkles,
  Play
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';

export const IvrHelplineModal: React.FC = () => {
  const { ivrModalOpen, setIvrModalOpen, farmer, bookNewSlot } = useKisanFlow();
  const [callStep, setCallStep] = useState<'IDLE' | 'CALLING' | 'CONNECTED_LANG' | 'ENTERED_ID' | 'SLOT_ANNOUNCED' | 'BOOKED'>('IDLE');
  const [selectedLang, setSelectedLang] = useState<'Hindi' | 'English' | 'Odia'>('English');
  const [inputFarmerId, setInputFarmerId] = useState(farmer.id);

  if (!ivrModalOpen) return null;

  const startCall = () => {
    setCallStep('CALLING');
    setTimeout(() => {
      setCallStep('CONNECTED_LANG');
    }, 1200);
  };

  const selectLanguage = (lang: 'Hindi' | 'English' | 'Odia') => {
    setSelectedLang(lang);
    setCallStep('ENTERED_ID');
  };

  const confirmId = () => {
    setCallStep('SLOT_ANNOUNCED');
  };

  const confirmIvrBooking = () => {
    bookNewSlot({
      centreId: 'centre-c',
      cropType: 'Paddy',
      variety: 'Samba Mahsuri',
      estimatedQuantity: 32,
      bookingDate: 'Tomorrow',
      slotTime: '11:30 AM',
    });
    setCallStep('BOOKED');
  };

  const hangUp = () => {
    setCallStep('IDLE');
    setIvrModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-emerald-200" />
            <div>
              <h3 className="font-heading font-bold text-sm">
                KisanFlow IVR Voice Helpline
              </h3>
              <span className="text-[10px] text-emerald-100 font-mono">
                Toll-Free 1800-180-1551 (Non-Smartphone Flow)
              </span>
            </div>
          </div>
          <button 
            onClick={hangUp}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {callStep === 'IDLE' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                <Volume2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-lg text-white">
                  Dial Toll-Free 1800-180-1551
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Accessible from any basic keypad mobile without internet. Supports multilingual IVR voice menu.
                </p>
              </div>
              <button
                onClick={startCall}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Simulate Farmer Call</span>
              </button>
            </div>
          )}

          {callStep === 'CALLING' && (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto animate-ping">
                <PhoneCall className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-slate-300">Connecting to Mandi IVR Server...</p>
            </div>
          )}

          {callStep === 'CONNECTED_LANG' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                <p className="text-xs text-slate-200 italic">
                  "Namaskar! KisanFlow Swagat Karta Hai. Kripya Bhasha Chunein."
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-xs text-slate-400 block font-medium">Select Language (Press 1, 2, or 3):</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => selectLanguage('English')}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-emerald-950 hover:border-emerald-500 border border-slate-700 text-xs font-semibold text-white"
                  >
                    1. English
                  </button>
                  <button
                    onClick={() => selectLanguage('Hindi')}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-emerald-950 hover:border-emerald-500 border border-slate-700 text-xs font-semibold text-white"
                  >
                    2. हिंदी
                  </button>
                  <button
                    onClick={() => selectLanguage('Odia')}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-emerald-950 hover:border-emerald-500 border border-slate-700 text-xs font-semibold text-white"
                  >
                    3. ଓଡ଼ିଆ
                  </button>
                </div>
              </div>
            </div>
          )}

          {callStep === 'ENTERED_ID' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                <p className="text-xs text-slate-200 italic">
                  "Please enter or confirm your 8-digit Farmer ID followed by hash."
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">Farmer ID Input:</label>
                <div className="flex items-center gap-2 bg-slate-800 p-2.5 rounded-xl border border-slate-700 font-mono text-emerald-400 font-bold text-sm">
                  <Hash className="w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={inputFarmerId}
                    onChange={(e) => setInputFarmerId(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none w-full"
                  />
                </div>
              </div>

              <button
                onClick={confirmId}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Farmer ID</span>
              </button>
            </div>
          )}

          {callStep === 'SLOT_ANNOUNCED' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/40 flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                <p className="text-xs text-slate-200 leading-relaxed">
                  "Verified, Shri Ramesh Kumar. Based on current Mandi traffic, your optimal slot is <strong>Tomorrow, 11:30 AM at Centre C</strong>. Press 1 to confirm."
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800 text-xs text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Centre:</span>
                  <span className="font-semibold text-white">Centre C — Ludhiana FCI Hub</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recommended Time:</span>
                  <span className="font-bold text-amber-300">Tomorrow at 11:30 AM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Predicted Congestion:</span>
                  <span className="font-bold text-emerald-400">Low (~22 min wait)</span>
                </div>
              </div>

              <button
                onClick={confirmIvrBooking}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <span>[Press 1] Confirm Booking & Send SMS Token</span>
              </button>
            </div>
          )}

          {callStep === 'BOOKED' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto font-bold">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-heading font-bold text-base text-white">
                Booking Confirmed via Voice IVR!
              </h4>
              <p className="text-xs text-slate-300 max-w-xs mx-auto">
                "Your slot is confirmed. An SMS token with 4-digit OTP has been dispatched to your mobile number +91 98765 43210."
              </p>
              <button
                onClick={hangUp}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                End Call
              </button>
            </div>
          )}

          {/* End Call Button */}
          {callStep !== 'IDLE' && callStep !== 'BOOKED' && (
            <div className="pt-2 border-t border-slate-800 flex justify-center">
              <button
                onClick={hangUp}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 rounded-full text-xs font-semibold"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Hang Up</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
