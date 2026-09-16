import React, { useState } from 'react';
import { 
  Tractor, 
  Calendar, 
  Clock, 
  MapPin, 
  QrCode, 
  Users, 
  CreditCard, 
  HelpCircle, 
  ChevronRight, 
  Sparkles,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  TrendingUp,
  PhoneCall
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { SlotRecoveryBanner } from './SlotRecoveryBanner';
import { GrievanceModal } from './GrievanceModal';
import { FloatingAgentButton } from './FloatingAgentButton';

export const FarmerHome: React.FC = () => {
  const { farmer, bookings, centres, setActiveTabFarmer, t, setIvrModalOpen } = useKisanFlow();
  const [grievanceOpen, setGrievanceOpen] = useState(false);

  // Active booking (exclude COMPLETED and CANCELLED)
  const activeBooking = bookings.find(
    b => b.farmerId === farmer.id && b.status !== 'COMPLETED' && b.status !== 'CANCELLED'
  );

  return (
    <div className="space-y-4">
      {/* Slot Recovery Banner (USP #4 Dynamic No-Show Recovery) */}
      <SlotRecoveryBanner />
      <FloatingAgentButton />

      {/* Farmer Profile Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950/40 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/20">
                REGISTERED PRODUCER
              </span>
              <span className="text-[10px] text-emerald-200 font-mono">
                {farmer.id}
              </span>
            </div>
            <h2 className="font-heading font-extrabold text-xl text-white mt-1">
              {farmer.name}
            </h2>
            <p className="text-xs text-emerald-100/90 mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-300" />
              <span>{farmer.village}, {farmer.district}, {farmer.state}</span>
              <span>•</span>
              <span>{farmer.landSizeAcres} Acres</span>
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <Tractor className="w-6 h-6 text-emerald-200" />
          </div>
        </div>

        {/* Current Active Token Strip */}
        {activeBooking && (
          <div className="mt-4 pt-3 border-t border-emerald-600/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-200 block uppercase font-medium">
                Active Slot Token
              </span>
              <span className="font-mono-code font-bold text-sm text-white">
                {activeBooking.tokenNumber} ({activeBooking.slotTime})
              </span>
            </div>
            <button
              onClick={() => setActiveTabFarmer('token')}
              className="px-3 py-1.5 rounded-xl bg-white text-emerald-900 text-xs font-bold flex items-center gap-1 hover:bg-emerald-50 transition-colors shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show QR Token</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Upcoming Slot Card */}
      {activeBooking && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {t.upcomingSlot}
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeBooking.status === 'ARRIVED' || activeBooking.status === 'IN_QUEUE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {activeBooking.status}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-heading font-bold text-base text-white">
                {activeBooking.centreName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeBooking.cropType} • {activeBooking.estimatedQuantity} Quintals
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Queue Wait</span>
              <span className="text-emerald-400 font-extrabold text-sm">
                ~{activeBooking.predictedWaitMin} mins
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setActiveTabFarmer('queue')}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Track Live Queue</span>
            </button>
            <button
              onClick={() => setActiveTabFarmer('token')}
              className="py-2.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Mandi E-Token Pass</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Action Grid (PDF Slide 1 Wireframe) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setActiveTabFarmer('book')}
          className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group shadow-md"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-sm text-white group-hover:text-emerald-300">
            {t.bookSlot}
          </h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            AI slot recommendation based on load
          </p>
        </button>

        <button
          onClick={() => setActiveTabFarmer('queue')}
          className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group shadow-md"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-sm text-white group-hover:text-blue-300">
            {t.liveQueue}
          </h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            Current turn #{activeBooking?.queuePosition || 7} • 32m wait
          </p>
        </button>

        <button
          onClick={() => setActiveTabFarmer('payments')}
          className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group shadow-md"
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-amber-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-sm text-white group-hover:text-amber-300">
            {t.payments}
          </h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            PFMS DBT status & payment receipts
          </p>
        </button>

        <button
          onClick={() => setGrievanceOpen(true)}
          className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group shadow-md"
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-purple-500/20">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h4 className="font-heading font-bold text-sm text-white group-hover:text-purple-300">
            Help & Grievance
          </h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
            File dispute or query to Nodal Officer
          </p>
        </button>
      </div>

      {/* Official Government Procurement Notice (PDF Slide 16 & 27) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-md space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
          <FileCheck className="w-4 h-4" />
          <span>Govt. of India e-NAM & FCI Procurement Season 2026</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          National Procurement Season 2026 is operational across all central e-NAM mandis and FCI hubs. Official Benchmark MSP: <strong>Wheat (Sharbati) ₹2,275 / Qtl</strong>, <strong>Paddy (Dhan) ₹2,183 - ₹2,203 / Qtl</strong>, <strong>Cotton ₹6,620 - ₹7,020 / Qtl</strong>, <strong>Soyabean ₹4,600 / Qtl</strong>. Payments directly credited via DBT to verified Aadhaar-linked bank accounts within 24-48 hours.
        </p>
      </div>

      {/* Grievance Modal */}
      <GrievanceModal isOpen={grievanceOpen} onClose={() => setGrievanceOpen(false)} />
    </div>
  );
};
