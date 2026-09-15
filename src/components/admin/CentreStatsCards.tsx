import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Scale, 
  Activity, 
  TrendingUp,
  UserX,
  Database,
  RefreshCw,
  Check
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { supabase } from '../../utils/supabase';

interface TokenStatusCounts {
  booked: number;
  arrived: number;
  waiting: number;
  processing: number;
  completed: number;
  noShow: number;
}

export const CentreStatsCards: React.FC = () => {
  const { centres, selectedCentreId, bookings } = useKisanFlow();
  const centre = centres.find(c => c.id === selectedCentreId) || centres[0];

  const [supabaseCounts, setSupabaseCounts] = useState<TokenStatusCounts | null>(null);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastFetchedTime, setLastFetchedTime] = useState<string>('');

  // Async function to fetch live token counts from Supabase tokens table
  const fetchTokenCountsFromSupabase = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('status, centre_id');

      if (error) {
        // Table not yet created or connection restricted
        console.warn('Supabase query notice:', error.message);
        setDbStatus('offline');
        return;
      }

      if (data && Array.isArray(data)) {
        setDbStatus('connected');
        const centreTokens = selectedCentreId 
          ? data.filter(t => !t.centre_id || t.centre_id === selectedCentreId)
          : data;

        const booked = centreTokens.filter(t => t.status === 'BOOKED').length;
        const arrived = centreTokens.filter(t => t.status === 'CHECKED_IN').length;
        const processing = centreTokens.filter(t => t.status === 'PROCESSING').length;
        const completed = centreTokens.filter(t => t.status === 'COMPLETED').length;
        const noShow = centreTokens.filter(t => t.status === 'NO_SHOW').length;
        const waiting = arrived; // Checked in and waiting for counter/weighing

        setSupabaseCounts({
          booked,
          arrived,
          waiting,
          processing,
          completed,
          noShow
        });
        setLastFetchedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.warn('Error querying Supabase tokens table:', err);
      setDbStatus('offline');
    } finally {
      setIsRefreshing(false);
    }
  };

  // useEffect hook to fetch data on component mount and on centre change
  useEffect(() => {
    fetchTokenCountsFromSupabase();

    // Set up 10-second polling for live sync
    const interval = setInterval(fetchTokenCountsFromSupabase, 10000);
    return () => clearInterval(interval);
  }, [selectedCentreId]);

  // Use live Supabase counts when available, falling back smoothly to context data
  const bookedCount = supabaseCounts !== null ? supabaseCounts.booked : centre.todayBooked;
  const arrivedCount = supabaseCounts !== null ? supabaseCounts.arrived : centre.todayArrived;
  const processingCount = supabaseCounts !== null ? supabaseCounts.processing : centre.todayProcessing;
  const completedCount = supabaseCounts !== null ? supabaseCounts.completed : centre.todayCompleted;
  const waitingCount = supabaseCounts !== null ? supabaseCounts.waiting : centre.todayWaiting;
  const noShowCount = supabaseCounts !== null ? supabaseCounts.noShow : centre.todayNoShow;

  // Capacity load %
  const loadPercentage = Math.min(100, Math.round((arrivedCount / centre.maxDailyCapacity) * 100));

  return (
    <div className="space-y-3">
      {/* Top Banner: Centre Name, Supabase Live Status, & Live Load */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/40">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading font-extrabold text-lg text-white">
                {centre.name}
              </h2>
              <span className="font-mono text-xs text-slate-400">
                [CENTRE #{centre.code}]
              </span>

              {/* Supabase Connection Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border bg-slate-800/80">
                <Database className="w-3 h-3 text-emerald-400" />
                {dbStatus === 'connected' ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Supabase Live ({supabaseCounts ? 'Synced' : 'Connected'})
                  </span>
                ) : dbStatus === 'connecting' ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Connecting Supabase...
                  </span>
                ) : (
                  <span className="text-slate-400" title="Run supabase_schema.sql in Supabase SQL editor to create tables">
                    Supabase Client Ready
                  </span>
                )}
                <button
                  onClick={fetchTokenCountsFromSupabase}
                  disabled={isRefreshing}
                  className="hover:text-white transition-colors ml-1"
                  title="Refresh from Supabase tokens table"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-0.5">
              Target Daily Capacity: <strong className="text-white">{centre.maxDailyCapacity} Farmers/Day</strong> • Active Counters: <strong className="text-emerald-400">{centre.activeCounters} of {centre.totalCounters}</strong>
              {lastFetchedTime && <span className="text-[10px] text-slate-500 ml-2">(Updated: {lastFetchedTime})</span>}
            </p>
          </div>
        </div>

        {/* Load Gauge Indicator */}
        <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              CURRENT LOAD
            </span>
            <span className={`font-mono font-extrabold text-lg ${
              loadPercentage >= 85 ? 'text-rose-400' : loadPercentage >= 65 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {loadPercentage}%
            </span>
          </div>
          <div className="w-14 h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                loadPercentage >= 85 ? 'bg-rose-500' : loadPercentage >= 65 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${loadPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metric Cards Grid (Sourced from Supabase tokens table) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Booked */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Booked</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-white mt-1">
            {bookedCount}
          </div>
          <span className="text-[10px] text-slate-500">
            {supabaseCounts ? 'tokens [BOOKED]' : 'Slots reserved'}
          </span>
        </div>

        {/* Arrived */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Arrived</span>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-emerald-400 mt-1">
            {arrivedCount}
          </div>
          <span className="text-[10px] text-slate-500">
            {supabaseCounts ? 'tokens [CHECKED_IN]' : 'Gate check-ins'}
          </span>
        </div>

        {/* Waiting */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Waiting</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-amber-300 mt-1">
            {waitingCount}
          </div>
          <span className="text-[10px] text-slate-500">In physical queue</span>
        </div>

        {/* Processing */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Processing</span>
            <Scale className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-indigo-300 mt-1">
            {processingCount}
          </div>
          <span className="text-[10px] text-slate-500">
            {supabaseCounts ? 'tokens [PROCESSING]' : 'At weigh & test'}
          </span>
        </div>

        {/* Completed */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-teal-300 mt-1">
            {completedCount}
          </div>
          <span className="text-[10px] text-slate-500">
            {supabaseCounts ? 'tokens [COMPLETED]' : 'Procured & DBT paid'}
          </span>
        </div>

        {/* No-Show */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>No-Show</span>
            <UserX className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-rose-400 mt-1">
            {noShowCount}
          </div>
          <span className="text-[10px] text-emerald-400">
            {supabaseCounts ? 'tokens [NO_SHOW]' : 'Slots auto-recovered'}
          </span>
        </div>
      </div>
    </div>
  );
};
