import React, { useState } from 'react';
import { 
  X, 
  Scale, 
  CheckCircle2, 
  CreditCard, 
  Sparkles, 
  Building2, 
  FileText 
} from 'lucide-react';
import { SlotBooking } from '../../types';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { supabase } from '../../utils/supabase';

interface Props {
  booking: SlotBooking | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProcurementCompleteModal: React.FC<Props> = ({ booking, onClose, onSuccess }) => {
  const { completeProcurementModal } = useKisanFlow();
  
  const [actualQuantity, setActualQuantity] = useState<number>(booking?.estimatedQuantity || 32);
  const [qualityGrade, setQualityGrade] = useState<'Grade A' | 'Grade B' | 'Standard'>('Grade A');
  const [moisturePercent, setMoisturePercent] = useState<number>(13.2);

  if (!booking) return null;

  const mspRate = qualityGrade === 'Grade A' ? 2203 : 2183;
  const baseValue = actualQuantity * mspRate;
  const excessMoisture = moisturePercent > 12 ? Math.round((moisturePercent - 12) * 10) / 10 : 0;
  const deduction = excessMoisture > 0 ? baseValue * (excessMoisture / 100) : 0;
  const totalPayout = Math.max(0, Math.round(baseValue - deduction));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updateData = {
        status: 'COMPLETED',
        actual_quantity: actualQuantity,
        actual_weight: actualQuantity,
        moisture_percent: moisturePercent,
        final_payout: totalPayout,
        quality_grade: qualityGrade,
        total_amount: totalPayout,
      };

      const updateQuery = booking.id
        ? supabase.from('tokens').update(updateData).eq('id', booking.id)
        : supabase.from('tokens').update(updateData).eq('token_number', booking.tokenNumber);

      const { error } = await updateQuery;
      if (error) {
        console.warn("Supabase Action Warning in ProcurementCompleteModal:", error.message);
        // Fallback for minimal schema
        await supabase.from('tokens').update({
          status: 'COMPLETED',
          actual_quantity: actualQuantity,
          quality_grade: qualityGrade,
          total_amount: totalPayout,
        }).eq(booking.id ? 'id' : 'token_number', booking.id || booking.tokenNumber);
      }
    } catch (error) {
      console.error("Supabase Action Error:", error);
    }

    completeProcurementModal(booking.tokenNumber, actualQuantity, qualityGrade, totalPayout, moisturePercent);
    window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
    onSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-200" />
            <div>
              <h3 className="font-heading font-bold text-sm">
                Finalize Procurement & Authorize DBT Payment
              </h3>
              <span className="text-[10px] text-emerald-100 font-mono">
                Token {booking.tokenNumber} • {booking.farmerName}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Farmer / Commodity</span>
              <span className="font-bold text-white text-sm">{booking.farmerName} ({booking.farmerId})</span>
              <span className="text-slate-400 block mt-0.5">{booking.cropType} - {booking.variety}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">Estimated Declared</span>
              <span className="font-bold text-emerald-400 text-sm">{booking.estimatedQuantity} Qtl</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Actual Net Weighed (Qtl)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={actualQuantity}
                onChange={(e) => setActualQuantity(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Moisture Reading (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={moisturePercent}
                onChange={(e) => setMoisturePercent(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 font-semibold block mb-1">
              Quality Grade Classification
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Grade A', 'Grade B', 'Standard'] as const).map(grade => (
                <button
                  type="button"
                  key={grade}
                  onClick={() => setQualityGrade(grade)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    qualityGrade === grade
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Payout Calculation Box */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span>MSP Rate Applied:</span>
              <span className="font-mono font-bold text-white">₹{mspRate} / Quintal</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span>Gross Weighed Weight:</span>
              <span className="font-mono font-bold text-white">{actualQuantity} Quintals</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span>Base Value (Weight × MSP):</span>
              <span className="font-mono font-bold text-white">₹{Math.round(baseValue).toLocaleString('en-IN')}</span>
            </div>
            {excessMoisture > 0 ? (
              <div className="flex justify-between items-center text-xs text-amber-400">
                <span>Moisture Deduction ({excessMoisture}% excess &gt; 12%):</span>
                <span className="font-mono font-bold">-₹{Math.round(deduction).toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center text-xs text-teal-400">
                <span>Moisture Deduction (Compliant ≤ 12%):</span>
                <span className="font-mono font-bold">₹0</span>
              </div>
            )}
            <div className="pt-2 border-t border-emerald-500/30 flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-300 uppercase">Final Calculated DBT Payout:</span>
              <span className="text-xl font-heading font-extrabold text-emerald-400">
                ₹{totalPayout.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 text-slate-950 font-heading font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 fill-slate-950 text-white" />
              <span>Authorize PFMS DBT Transfer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
