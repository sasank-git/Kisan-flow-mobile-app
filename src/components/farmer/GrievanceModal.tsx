import React, { useState } from 'react';
import { HelpCircle, Send, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { GrievanceTicket } from '../../types';

export const GrievanceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { submitGrievance, grievances } = useKisanFlow();
  const [category, setCategory] = useState<GrievanceTicket['category']>('Quantity Discrepancy');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) return;
    submitGrievance(category, details);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDetails('');
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative">
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-heading font-bold text-sm text-white">
              Farmer Grievance & Helpdesk
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {submitted ? (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="font-heading font-bold text-white text-base">Grievance Filed!</h4>
              <p className="text-xs text-slate-400">
                Ticket generated. A Mandi nodal officer has been notified.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Issue Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GrievanceTicket['category'])}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Quantity Discrepancy">Weighbridge / Quantity Discrepancy</option>
                  <option value="Payment Delay">DBT / Payment Delay</option>
                  <option value="Slot Issue">Slot Booking / Cancellation Issue</option>
                  <option value="Centre Facility">Mandi Facility / Staff Behavior</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Issue Description
                </label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Explain your issue (e.g. Weighbridge moisture deduction query)..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Grievance Ticket</span>
              </button>
            </form>
          )}

          {grievances.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Your Recent Grievance Tickets
              </span>
              {grievances.map(g => (
                <div key={g.id} className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">{g.category}</span>
                    <span className="text-[10px] text-slate-400">{g.id} • {g.filedAt}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                    {g.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
