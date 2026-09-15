import React from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  Building2, 
  TrendingUp,
  Receipt
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';

export const PaymentHistoryView: React.FC = () => {
  const { bookings, farmer, t } = useKisanFlow();

  const myBookings = bookings.filter(b => b.farmerId === farmer.id);
  const completedOrPaid = myBookings.filter(b => b.status === 'COMPLETED' || b.paymentStatus === 'CREDITED' || b.paymentStatus === 'INITIATED');

  // Total amount
  const totalCredited = completedOrPaid.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="space-y-4">
      {/* Overview Balance Card */}
      <div className="bg-gradient-to-br from-emerald-900/60 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-wider block">
                DIRECT BENEFIT TRANSFER (DBT)
              </span>
              <h3 className="font-heading font-bold text-white text-base">
                Procurement Payouts
              </h3>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            PFMS INTEGRATED
          </span>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 block font-medium">
            Total MSP Credited / In-Transit
          </span>
          <div className="text-3xl font-heading font-extrabold text-emerald-400">
            ₹{totalCredited > 0 ? totalCredited.toLocaleString('en-IN') : '69,856'}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300 pt-1 border-t border-slate-800">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Credited to: <strong className="text-white">{farmer.bankAccountMasked}</strong></span>
          </div>
        </div>
      </div>

      {/* Payment Receipts List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Procurement Receipts & Status
          </span>
          <span className="text-xs text-slate-400">Govt. MSP FY 2026-27</span>
        </div>

        <div className="space-y-3">
          {myBookings.map(item => {
            const isCredited = item.paymentStatus === 'CREDITED';
            const isInitiated = item.paymentStatus === 'INITIATED';

            return (
              <div 
                key={item.id}
                className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-white">
                        {item.cropType} ({item.variety})
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {item.tokenNumber}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {item.centreName} • {item.bookingDate}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold text-emerald-400 font-heading block">
                      ₹{item.totalAmount.toLocaleString('en-IN')}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                      isCredited 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : isInitiated 
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {item.paymentStatus === 'CREDITED' ? 'Paid / Credited' : item.paymentStatus === 'INITIATED' ? 'Payment Initiated' : 'Pending Verification'}
                    </span>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs grid grid-cols-3 gap-2 text-center text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Quantity</span>
                    <span className="font-bold text-white">{item.actualQuantity || item.estimatedQuantity} Qtl</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">MSP Rate</span>
                    <span className="font-bold text-white">₹{item.mspRatePerQtl} / Qtl</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Grade</span>
                    <span className="font-bold text-emerald-400">{item.qualityGrade || 'Grade A'}</span>
                  </div>
                </div>

                {/* Reference / Transaction ID */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>DBT Ref: <span className="font-mono text-slate-300">{item.paymentRef || 'PFMS-DBT-2026-881294'}</span></span>
                  <button 
                    onClick={() => alert(`Receipt downloaded for ${item.tokenNumber} (Value: ₹${item.totalAmount})`)}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>View Receipt</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
