import React from 'react';
import { 
  Building, 
  TrendingDown, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  BarChart3, 
  Layers, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { districtCentresSummary } from '../../data/initialData';
import { useKisanFlow } from '../../context/KisanFlowContext';

export const DistrictOverview: React.FC = () => {
  const { setSelectedCentreId } = useKisanFlow();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold border border-teal-500/40">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-white">
              National & Regional Agri-Command Overview (e-NAM / FCI Network)
            </h3>
            <p className="text-xs text-slate-400">
              Aggregated live status across registered Mandi procurement yards and central FCI terminals
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-emerald-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
          Total National Network Load Today: <strong>24,810 Farmers</strong>
        </span>
      </div>

      {/* Hero Comparative Impact Metric (Slide 14 & 20) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-800/80 to-teal-950/60 border border-emerald-500/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold flex-shrink-0 shadow-lg shadow-emerald-950/50">
            <TrendingDown className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block">
              AVERAGE FARMER WAITING TIME REDUCTION
            </span>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="text-3xl font-heading font-extrabold text-white">
                38 MIN <span className="text-xs text-slate-400 font-normal">avg wait</span>
              </span>
              <span className="text-sm text-slate-400 line-through font-mono">
                94 MIN (Previous Manual)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              *Simulation / prototype benchmark demonstrated across active peak seasons
            </p>
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl text-center flex-shrink-0">
          <span className="text-2xl font-extrabold text-emerald-400 font-mono block">
            ↓ 59.5%
          </span>
          <span className="text-[10px] text-emerald-200 font-semibold uppercase">
            Waiting Time Saved
          </span>
        </div>
      </div>

      {/* Grid of District Mandi Centres (Slide 17) */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Centre Health Matrix (28 District Hubs)
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {districtCentresSummary.map((item) => {
            const isHigh = item.status === 'HIGH';
            const isLow = item.status === 'LOW';

            return (
              <div
                key={item.code}
                onClick={() => {
                  if (item.code === 'A01') setSelectedCentreId('centre-a');
                  if (item.code === 'A02') setSelectedCentreId('centre-b');
                  if (item.code === 'A03') setSelectedCentreId('centre-c');
                }}
                className="p-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-white">
                    {item.code}
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    isHigh ? 'bg-rose-500' : isLow ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                </div>
                <span className="text-xs font-semibold text-slate-200 block truncate">
                  {item.name}
                </span>
                <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                  <span>Load: <strong className={isHigh ? 'text-rose-400' : 'text-emerald-400'}>{item.load}</strong></span>
                  <span>{item.farmers} Farmers</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
