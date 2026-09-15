import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Sparkles, 
  PlusCircle, 
  ArrowRightLeft, 
  Check, 
  Flame, 
  TrendingDown,
  Layers,
  Users
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { supabase } from '../../utils/supabase';

interface HourlyBucket {
  hour: number;
  timeLabel: string;
  volumeQtl: number;
}

export const AiCongestionBanner: React.FC = () => {
  const { 
    isCounter3Open, 
    openExtraCounter, 
    redistributeToCentreC, 
    centres, 
    selectedCentreId,
    hourlyForecast
  } = useKisanFlow();

  // 1. Dynamic Center Context
  const centre = centres.find(c => c.id === selectedCentreId) || centres[0];
  const activeCounters = Number(centre?.activeCounters) > 0 ? Number(centre.activeCounters) : 3;
  const maxHourlyCapacity = activeCounters * 120; // 120 Qtl per counter per hour

  // 2. State for volume aggregation
  const [hourlyBuckets, setHourlyBuckets] = useState<HourlyBucket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchHourlyVolumeData() {
      if (!centre?.id) return;
      setIsLoading(true);

      try {
        // Fetch all rows from tokens table where centre_id equals active center, slot_date is 'Today', and status is NOT 'COMPLETED' or 'NO_SHOW'
        const { data: tokens, error } = await supabase
          .from('tokens')
          .select('slot_time, estimated_quantity, status')
          .eq('centre_id', centre.id)
          .eq('slot_date', 'Today')
          .not('status', 'in', '("COMPLETED","NO_SHOW")');

        if (error) {
          console.warn('Notice querying tokens for volume load:', error.message);
        }

        // Initialize hourly buckets from 09:00 to 16:00
        const buckets: Record<number, number> = {
          9: 0,
          10: 0,
          11: 0,
          12: 0,
          13: 0,
          14: 0,
          15: 0,
          16: 0
        };

        if (tokens && tokens.length > 0) {
          tokens.forEach((t: any) => {
            const timeStr = (t.slot_time || '').trim();
            const qty = Number(t.estimated_quantity) || 0;

            // Extract hour from slot_time e.g., "09:30 AM", "1:15 PM", "14:00"
            const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (match) {
              let h = parseInt(match[1], 10);
              const meridian = match[3]?.toUpperCase();

              if (meridian === 'PM' && h < 12) h += 12;
              if (meridian === 'AM' && h === 12) h = 0;

              // Clamp to active operating windows (09:00 to 16:00)
              if (h in buckets) {
                buckets[h] += qty;
              } else if (h < 9) {
                buckets[9] += qty;
              } else if (h > 16) {
                buckets[16] += qty;
              }
            } else {
              // Fallback default hour bucket
              buckets[11] += qty;
            }
          });
        }

        // Transform into sorted array of HourlyBucket objects
        const formattedBuckets: HourlyBucket[] = Object.keys(buckets).map((key) => {
          const hourNum = parseInt(key, 10);
          const displayHour = hourNum > 12 ? hourNum - 12 : hourNum;
          const meridian = hourNum >= 12 ? 'PM' : 'AM';
          const label = `${displayHour.toString().padStart(2, '0')}:00 ${meridian}`;
          return {
            hour: hourNum,
            timeLabel: label,
            volumeQtl: buckets[hourNum]
          };
        });

        if (isMounted) {
          setHourlyBuckets(formattedBuckets);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error computing volume aggregation:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    fetchHourlyVolumeData();

    // Re-fetch on global tokens update event
    const handleTokensUpdate = () => fetchHourlyVolumeData();
    window.addEventListener('kisanflow:tokens-updated', handleTokensUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('kisanflow:tokens-updated', handleTokensUpdate);
    };
  }, [centre?.id]);

  // 3. Identify Peak Load (Filtering out past hours)
  const currentHour = new Date().getHours();
  // Filter out any hourly buckets that have already passed in the real-world clock (hour < current_real_world_hour)
  const upcomingBuckets = hourlyBuckets.filter(b => b.hour >= currentHour);

  // Identify peak load among upcoming hours
  const peakBucket = upcomingBuckets.reduce((prev, current) => {
    return (current.volumeQtl > (prev?.volumeQtl || 0)) ? current : prev;
  }, upcomingBuckets[0] || null);

  const peakVolume = peakBucket?.volumeQtl || 0;
  const peakHour = peakBucket?.timeLabel || '';

  // 4. AI Operations Math
  // Required Counters = Math.ceil(Peak Volume / 120), at least activeCounters if volume is 0
  const requiredCounters = peakVolume > 0 ? Math.ceil(peakVolume / 120) : activeCounters;
  // Required Laborers = Math.ceil(Peak Volume / 10)
  const requiredLaborers = peakVolume > 0 ? Math.ceil(peakVolume / 10) : 0;
  const isOverflow = requiredCounters > activeCounters;

  // Max volume for proportional bar heights (at least maxHourlyCapacity or peakVolume for clear visual scale)
  const maxBarVolume = Math.max(maxHourlyCapacity, peakVolume, 100);

  return (
    <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/40 border-2 border-amber-500/60 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left: Congestion Alert Details */}
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider bg-rose-500 text-slate-950 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <Flame className="w-3.5 h-3.5 fill-slate-950" />
              AI CONGESTION ALERT (VOLUME-BASED)
            </span>
            
            {/* Center Capacity Info Display */}
            <div className="text-xs font-mono bg-slate-800/90 text-amber-300 border border-slate-700/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-amber-400" />
              <span>Center Capacity: <strong>{activeCounters}</strong> Counters | Max <strong>{maxHourlyCapacity}</strong> Qtl/hr</span>
            </div>
          </div>

          <h3 className="font-heading font-extrabold text-base text-white flex items-center gap-2">
            <span>Procurement Centre {centre.name} Volume Forecast</span>
            {isOverflow && (
              <span className="text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-md font-sans font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Capacity Overflow Warning
              </span>
            )}
          </h3>

          {/* Prescriptive Peak Alert Text */}
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            {peakVolume > 0 ? (
              <>
                Predicted Peak: <strong className="text-amber-400 font-bold">{peakHour}</strong>. AI Forecast predicts <strong className="text-rose-400 font-bold">{peakVolume.toLocaleString('en-IN')} Quintals</strong> of grain arriving. Recommendation: Open <strong className="text-amber-300 font-bold">{requiredCounters}</strong> {requiredCounters === 1 ? 'counter' : 'counters'} and deploy <strong className="text-emerald-400 font-bold">{requiredLaborers}</strong> yard laborers.
              </>
            ) : (
              <>
                <strong className="text-emerald-400 font-bold">No upcoming congestion predicted.</strong> All remaining operating hours are currently within standard capacity of <strong className="text-white font-semibold">{maxHourlyCapacity} Qtl/hr</strong>.
              </>
            )}
          </p>

          {/* Volume-Based Hourly Bar Chart */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Hourly Grain Volume (Quintals)</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-emerald-500" /> &lt;50%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-amber-500" /> 50%-90%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-rose-500" /> &gt;90%
                </span>
              </div>
            </div>

            <div className="flex items-end gap-2 overflow-x-auto pb-1">
              {hourlyBuckets.map((b) => {
                // Capacity percentage relative to max hourly capacity
                const capacityRatio = maxHourlyCapacity > 0 ? (b.volumeQtl / maxHourlyCapacity) : 0;
                
                // Color coding based on capacity:
                // Green (< 50% max capacity), Orange (50% - 90% capacity), Red (> 90% capacity)
                let barColor = 'bg-emerald-500';
                let textColor = 'text-emerald-400';

                if (capacityRatio > 0.9) {
                  barColor = 'bg-rose-500 shadow-lg shadow-rose-950/80';
                  textColor = 'text-rose-400';
                } else if (capacityRatio >= 0.5) {
                  barColor = 'bg-amber-500 shadow-sm shadow-amber-950/60';
                  textColor = 'text-amber-400';
                }

                // Minimum 6% bar height for visibility even with small or zero volume
                const barHeightPct = b.volumeQtl > 0 
                  ? Math.min(100, Math.max(12, (b.volumeQtl / maxBarVolume) * 100)) 
                  : 4;

                return (
                  <div key={b.hour} className="flex flex-col items-center flex-1 min-w-[54px] text-center">
                    <span className={`text-[10px] font-mono font-bold ${textColor}`}>
                      {b.volumeQtl > 0 ? `${b.volumeQtl}Q` : '0Q'}
                    </span>
                    <div className="w-full bg-slate-800/90 h-16 rounded-lg overflow-hidden flex flex-col justify-end p-0.5 mt-1 border border-slate-700/60">
                      <div
                        className={`w-full rounded transition-all duration-500 ${barColor}`}
                        style={{ height: `${barHeightPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 font-mono">
                      {b.timeLabel.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: AI Prescriptive Interventions (USP #3 & #5) */}
        <div className="bg-slate-900/90 border border-amber-500/40 p-4 rounded-2xl md:w-80 flex-shrink-0 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Sparkles className="w-4 h-4" />
            <span>Recommended AI Resource Allocation</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Required Counters:
              </span>
              <span className="font-mono font-bold text-white">
                {requiredCounters} <span className="text-slate-400 font-normal">({activeCounters} Active)</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Recommended Labor:
              </span>
              <span className="font-mono font-bold text-emerald-400">
                {requiredLaborers} Laborers
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {/* Action 1: Dynamic Counter Allocation */}
            {requiredCounters > activeCounters ? (
              <button
                onClick={() => openExtraCounter(centre.id)}
                disabled={isCounter3Open}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                  isCounter3Open
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 cursor-default'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md cursor-pointer active:scale-98'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isCounter3Open ? <Check className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                  <span>
                    {isCounter3Open
                      ? `Counter ${requiredCounters} Active (+120 Qtl/hr)`
                      : `Open Counter ${requiredCounters} (Relief)`}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono">
                  {isCounter3Open ? 'ONLINE' : 'TRIGGER'}
                </span>
              </button>
            ) : (
              <button
                disabled
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 flex items-center justify-between cursor-not-allowed opacity-90"
              >
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Capacity Optimal</span>
                </div>
                <span className="text-[10px] uppercase font-mono text-emerald-500/80">
                  OPTIMAL
                </span>
              </button>
            )}

            {/* Action 2: Multi-Centre Load Balancing (USP #5) */}
            <button
              onClick={redistributeToCentreC}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white flex items-center justify-between transition-all cursor-pointer active:scale-98"
              title="Redistribute excess grain load to neighboring low-congestion centers"
            >
              <div className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                <span>2. Shift Peak Load to Centre C</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">USP #5</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Volume balancing prevents unloader bottlenecks</span>
          </div>
        </div>
      </div>
    </div>
  );
};

