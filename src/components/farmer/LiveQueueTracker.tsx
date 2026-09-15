import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  ArrowRight,
  Users, 
  Clock, 
  CheckCircle2, 
  Scale, 
  FlaskConical, 
  FileText, 
  CreditCard,
  Sparkles,
  Building2,
  Calendar,
  QrCode,
  AlertCircle,
  Truck,
  Check,
  Trash2,
  RefreshCw,
  XCircle,
  Receipt
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { supabase } from '../../utils/supabase';
import { SlotRecoveryBanner } from './SlotRecoveryBanner';

export interface FarmerTokenData {
  id?: string | number;
  token_number: string;
  centre_id: string;
  centre_name?: string;
  farmer_id: string;
  farmer_name?: string;
  mobile?: string;
  village?: string;
  crop_type: string;
  variety?: string;
  slot_date: string;
  slot_time: string;
  estimated_quantity: number;
  actual_quantity?: number;
  actual_weight?: number;
  moisture_percent?: number;
  final_payout?: number;
  quality_grade?: string;
  total_amount?: number;
  status: string;
  assigned_counter?: string;
  weighbridge_number?: string;
  created_at?: string;
  checkInOtp?: string;
}

interface LiveQueueTrackerProps {
  token: FarmerTokenData;
  onBack: () => void;
  onUpdateToken?: (updatedToken: FarmerTokenData) => void;
}

function parseSlotHour(timeStr?: string): number {
  if (!timeStr) return new Date().getHours();
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const meridian = match[3]?.toUpperCase();
    if (meridian === 'PM' && h < 12) h += 12;
    if (meridian === 'AM' && h === 12) h = 0;
    return h;
  }
  return new Date().getHours();
}

/**
 * Dynamic active step calculation function:
 * Evaluates both token.status and queue state (waitTimeOrPosition)
 * to dynamically route between real-world physical states.
 */
export const calculateActiveStep = (status?: string, waitTimeOrPosition: number = 0): number => {
  const s = (status || '').toUpperCase().trim();
  const waitOrPos = typeof waitTimeOrPosition === 'number' ? waitTimeOrPosition : 0;

  // 0: Slot Booked (Completed upon booking)
  // 1: Gate Entry (Waiting to check in)
  if (status === 'BOOKED' || s === 'BOOKED') return 1; 

  // 2 & 3: Dynamic Queueing Logic
  if (status === 'CHECKED_IN' || s === 'CHECKED_IN' || s === 'ARRIVED') {
    // If they have a wait time/position > 0, they are in the Yard Queue (Index 2)
    // If their wait is 0 (it's their turn), they are at the Weighbridge (Index 3)
    return waitOrPos > 0 ? 2 : 3; 
  }

  // Explicit queue states if present in db or legacy logs
  if (s === 'IN_QUEUE') return 2;
  if (s === 'WEIGHING') return 3;

  // 4: Quality Test (Waiting for assay after being weighed)
  if (status === 'WEIGHED' || s === 'WEIGHED' || s === 'QUALITY_CHECK') return 4; 

  // 5: Procurement (Waiting for final signoff after quality test)
  if (status === 'TESTED' || s === 'TESTED' || s === 'PROCESSING') return 5; 

  // 6: Paid / Completed
  if (status === 'COMPLETED' || status === 'PAID' || s === 'COMPLETED' || s === 'PAID') return 6; 

  return 0; // Fallback
};

export const LiveQueueTracker: React.FC<LiveQueueTrackerProps> = ({ token: initialToken, onBack, onUpdateToken }) => {
  const { centres, bookings, cancelBooking, refreshBookings, updateTokenStatus, setActiveTabFarmer } = useKisanFlow();
  const [token, setToken] = useState<FarmerTokenData>(initialToken);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [livePosition, setLivePosition] = useState<number | null>(null);
  const [simulatedWait, setSimulatedWait] = useState<number | null>(null);

  useEffect(() => {
    setToken(initialToken);
  }, [initialToken]);

  // Synchronize with context bookings for live state transitions
  useEffect(() => {
    const matchingBooking = bookings.find(b => b.tokenNumber === token.token_number);
    if (matchingBooking) {
      setToken(prev => ({
        ...prev,
        status: matchingBooking.status,
        actual_quantity: matchingBooking.actualQuantity ?? prev.actual_quantity,
        actual_weight: matchingBooking.actualWeight ?? prev.actual_weight,
        moisture_percent: matchingBooking.moisturePercent ?? prev.moisture_percent,
        quality_grade: matchingBooking.qualityGrade ?? prev.quality_grade,
        assigned_counter: matchingBooking.assignedCounter ?? prev.assigned_counter,
        weighbridge_number: matchingBooking.weighbridgeNumber ?? prev.weighbridge_number,
        total_amount: matchingBooking.totalAmount ?? prev.total_amount,
        final_payout: matchingBooking.totalAmount ?? prev.final_payout ?? prev.total_amount,
      }));
    }
  }, [bookings, token.token_number]);

  // Find corresponding centre name
  const centre = centres.find(c => c.id === token.centre_id);
  const centreName = token.centre_name || centre?.name || 'Mandi Yard';

  // Dynamic Queue Position & Discrete Event Simulation (Waterfall Dispatcher) Wait Time
  useEffect(() => {
    if (!token || !token.centre_id) return;
    if (token.status === 'CANCELLED') {
      setLivePosition(null);
      setSimulatedWait(null);
      return;
    }

    async function fetchLivePositionAndSimulation() {
      try {
        // Step 1: Fetch Preceding Queue:
        // Query all tokens ahead of the current user (status IN 'BOOKED', 'CHECKED_IN', ordered by created_at ascending)
        const { data: queueTokens, error } = await supabase
          .from('tokens')
          .select('token_number, created_at, status, slot_date, slot_time, estimated_quantity, centre_id')
          .eq('centre_id', token.centre_id)
          .eq('slot_date', token.slot_date || 'Today')
          .in('status', ['BOOKED', 'CHECKED_IN'])
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('Error fetching live queue tokens for simulation:', error.message);
          const centreBookings = bookings.filter(b => b.centreId === token.centre_id && (b.status === 'BOOKED' || b.status === 'CHECKED_IN'));
          const myIdx = centreBookings.findIndex(b => b.tokenNumber === token.token_number);
          if (myIdx >= 0) {
            setLivePosition(myIdx + 1);
            setSimulatedWait(myIdx * 15);
          } else {
            setLivePosition(1);
            setSimulatedWait(0);
          }
          return;
        }

        if (queueTokens) {
          const currentInDb = queueTokens.find((t: any) => t.token_number === token.token_number);
          let currentCreatedAt = 0;
          if (currentInDb?.created_at) {
            currentCreatedAt = new Date(currentInDb.created_at).getTime();
          } else if (token.created_at && !isNaN(new Date(token.created_at).getTime())) {
            currentCreatedAt = new Date(token.created_at).getTime();
          } else {
            currentCreatedAt = Date.now();
          }

          // Filter tokens ahead of the current user (created_at older/earlier than current user's token)
          const precedingTokens = queueTokens
            .filter((t: any) => {
              if (t.token_number === token.token_number) return false;
              if (!t.created_at) return false;
              const tTime = new Date(t.created_at).getTime();
              return tTime < currentCreatedAt;
            })
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          const queuePosition = precedingTokens.length + 1;
          setLivePosition(queuePosition);

          // Step 2: Determine Dynamic Counters:
          // Check total quintal volume of the current hour block
          const currentHour = parseSlotHour(token.slot_time);
          const currentHourTokens = queueTokens.filter(
            (t: any) => parseSlotHour(t.slot_time) === currentHour
          );
          const totalHourlyVolume = currentHourTokens.reduce(
            (sum: number, t: any) => sum + (Number(t.estimated_quantity) || 30),
            0
          );

          const activeCountersCount = Number(centre?.activeCounters) > 0 ? Number(centre.activeCounters) : 3;
          // dynamicCounters = Math.max(center.activeCounters, Math.ceil(totalHourlyVolume / 120))
          const dynamicCounters = Math.max(
            1,
            Math.max(activeCountersCount, Math.ceil(totalHourlyVolume / 120))
          );

          // Step 3: The Simulator Logic (Waterfall Dispatcher):
          // Initialize an array representing the busy time of each counter:
          let counterTimes = new Array(dynamicCounters).fill(0);

          // Loop through each preceding token
          precedingTokens.forEach((precToken: any) => {
            const qty = Number(precToken.estimated_quantity) > 0 
              ? Number(precToken.estimated_quantity) 
              : 30;
            // Calculate that specific token's processing time: (token.estimated_quantity / 30) * 15 (in minutes)
            let processTime = (qty / 30) * 15;

            // Find the counter that will be free the earliest
            let earliestCounterIdx = counterTimes.indexOf(Math.min(...counterTimes));

            // Add the processing time to that counter
            if (earliestCounterIdx !== -1) {
              counterTimes[earliestCounterIdx] += processTime;
            }
          });

          // Step 4: Extract Wait Time:
          // After the loop finishes, the current user's wait time is the moment the next counter becomes available
          const computedEstimatedWait = Math.round(Math.min(...counterTimes));
          setSimulatedWait(computedEstimatedWait);
        }
      } catch (err) {
        console.warn('Error calculating discrete event simulation wait:', err);
      }
    }

    fetchLivePositionAndSimulation();

    // Supabase real-time listener for live queue updates
    const channel = supabase
      .channel(`live-queue-${token.token_number}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens', filter: `centre_id=eq.${token.centre_id}` },
        () => {
          fetchLivePositionAndSimulation();
        }
      )
      .subscribe();

    const handleTokensUpdated = () => {
      fetchLivePositionAndSimulation();
    };
    window.addEventListener('kisanflow:tokens-updated', handleTokensUpdated);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('kisanflow:tokens-updated', handleTokensUpdated);
    };
  }, [token.token_number, token.centre_id, token.slot_date, token.created_at, token.status, token.slot_time, centre?.activeCounters]);

  const executeCancel = async () => {
    setIsCancelling(true);
    try {
      // 1. Update Supabase tokens table
      const { error: dbError } = await supabase
        .from('tokens')
        .update({ status: 'CANCELLED' as any })
        .eq('token_number', token.token_number);

      if (dbError) {
        console.warn('Direct Supabase update notice, falling back to cancelBooking:', dbError.message);
      }

      // 2. Call cancelBooking helper (handles fallback and context state)
      await cancelBooking(token.token_number);

      // 3. Mutate global context state directly to avoid stale state across views
      updateTokenStatus(token.token_number, 'CANCELLED');

      // 4. Force parent / context to pull fresh data from the database
      await refreshBookings();

      // 5. Update local state and parent tracker state
      const updated: FarmerTokenData = { ...token, status: 'CANCELLED' };
      setToken(updated);
      if (onUpdateToken) {
        onUpdateToken(updated);
      }

      setShowCancelModal(false);
      window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      alert(err.message || 'An error occurred while cancelling your booking.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleViewReceiptAndExit = () => {
    if (onBack) {
      onBack();
    }
    setActiveTabFarmer('payments');
  };

  // 7-step timeline: Slot Booked, Gate Entry, In Yard Queue, Weighbridge, Quality Test, Procurement, Paid
  const stages = [
    { key: 'BOOKED', label: 'Slot Booked', icon: Clock, desc: 'Slot confirmed in central registry' },
    { key: 'CHECKED_IN', label: 'Gate Entry', icon: CheckCircle2, desc: 'Vehicle admitted & pass verified' },
    { key: 'IN_QUEUE', label: 'In Yard Queue', icon: Users, desc: 'Waiting in regulated holding bay' },
    { key: 'WEIGHING', label: 'Weighbridge', icon: Scale, desc: 'Gross & tare weight measurement' },
    { key: 'QUALITY_CHECK', label: 'Quality Test', icon: FlaskConical, desc: 'Moisture & foreign matter assay' },
    { key: 'PROCESSING', label: 'Procurement', icon: FileText, desc: 'MSP verification & counter signoff' },
    { key: 'COMPLETED', label: 'Paid (DBT)', icon: CreditCard, desc: 'Direct DBT payment credited to bank' },
  ];

  const queueWaitTime = simulatedWait !== null 
    ? simulatedWait 
    : (livePosition !== null && livePosition > 1 ? Math.max(0, (livePosition - 1) * 15) : (centre?.waitTimeMin ?? 0));

  const effectiveStatus = React.useMemo(() => {
    const raw = (token.status || '').toUpperCase().trim();
    
    if (token.moisture_percent !== undefined && token.moisture_percent !== null && raw !== 'COMPLETED' && raw !== 'PAID') {
      return 'TESTED';
    }
    if (raw === 'PROCESSING') {
      if ((token.actual_weight !== undefined && token.actual_weight !== null && Number(token.actual_weight) > 0) ||
          (token.actual_quantity !== undefined && token.actual_quantity !== null && Number(token.actual_quantity) > 0)) {
        return 'WEIGHED';
      }
    }
    return raw;
  }, [token.status, token.moisture_percent, token.actual_weight, token.actual_quantity]);
  const getActiveIndex = () => {
    const s = String(effectiveStatus).toUpperCase().trim();
    if (s === 'BOOKED') return 0;
    if (s === 'CHECKED_IN' || s === 'ARRIVED') return (queueWaitTime > 0) ? 2 : 3;
    if (s === 'WEIGHED') return 4;
    if (s === 'TESTED' || s === 'QUALITY_CHECKED' || s === 'QUALITY_TESTED' || s === 'PROCESSING') return 5; 
    if (s === 'COMPLETED' || s === 'PAID') return 6;
    return 0;
  };
  const activeStepIndex = getActiveIndex();

  const status = effectiveStatus;
  const isCancelled = status === 'CANCELLED';
  const isTokenCompleted = status === 'COMPLETED' || status === 'PAID';
  const isProcessing = status === 'PROCESSING' || status === 'TESTED';

  // Dynamic Wait Math: Discrete Event Simulation (Waterfall Dispatcher) result
  const estimatedWait = queueWaitTime;

  // Progress percentage
  const progressPercent = isCancelled
    ? 100
    : isTokenCompleted 
      ? 100 
      : Math.max(15, Math.min(95, Math.round(((activeStepIndex + 1) / stages.length) * 100)));

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'CANCELLED':
        return {
          bg: 'bg-red-500/20 text-red-400 border border-red-500/50',
          dot: 'bg-red-500',
          label: 'CANCELLED'
        };
      case 'COMPLETED':
      case 'PAID':
        return {
          bg: 'bg-teal-950/80 text-teal-300 border-teal-500/50',
          dot: 'bg-teal-400',
          label: 'PAID (DBT)'
        };
      case 'TESTED':
        return {
          bg: 'bg-purple-950/80 text-purple-300 border-purple-500/50',
          dot: 'bg-purple-400 animate-pulse',
          label: 'QUALITY TESTED'
        };
      case 'WEIGHED':
        return {
          bg: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50',
          dot: 'bg-indigo-400 animate-pulse',
          label: 'WEIGHED'
        };
      case 'PROCESSING':
        return {
          bg: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
          dot: 'bg-amber-400 animate-pulse',
          label: 'PROCESSING'
        };
      case 'CHECKED_IN':
      case 'ARRIVED':
        return {
          bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50',
          dot: 'bg-emerald-400',
          label: 'CHECKED IN'
        };
      case 'NO_SHOW':
        return {
          bg: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
          dot: 'bg-rose-400',
          label: 'NO SHOW'
        };
      default:
        return {
          bg: 'bg-sky-950/80 text-sky-300 border-sky-500/50',
          dot: 'bg-sky-400',
          label: 'BOOKED'
        };
    }
  };

  const statusBadge = getStatusBadge(status);
  const currentProcessingBooking = bookings.find(b => b.status === 'PROCESSING') || bookings[0];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Prominent Back Navigation Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBack();
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 font-bold text-xs border border-slate-700/80 shadow-md transition-all active:scale-95 cursor-pointer group"
          title="Return to list of all bookings"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 stroke-[2.5]" />
          <span>← Back to All Bookings</span>
        </button>

        <span className="text-[11px] text-slate-400 font-mono">
          Token: <strong className="text-white">{token.token_number}</strong>
        </span>
      </div>

      {/* Slot Recovery Banner if applicable */}
      <SlotRecoveryBanner />

      {/* Selected Token Overview Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 relative overflow-hidden">
        {/* Mandi & Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Mandi Facility Queue
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-white mt-1">
              {centreName}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
              <span className="text-emerald-300 font-medium">
                {token.crop_type}
                {token.variety ? ` (${token.variety})` : ''}
              </span>
              <span>•</span>
              <span>{token.estimated_quantity} Quintals</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {token.slot_date} • {token.slot_time}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border flex items-center gap-1.5 font-mono ${statusBadge.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
              {statusBadge.label}
            </span>
            <span className="text-xs font-mono font-bold bg-slate-800 text-emerald-400 px-3 py-1 rounded-full border border-slate-700">
              {token.token_number}
            </span>
          </div>
        </div>

        {/* Big Highlight: Queue Position & Predictive Waiting Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/70 p-4 rounded-2xl border border-slate-700/60 text-center relative overflow-hidden flex flex-col justify-center min-w-0">
            <span className={`text-[11px] font-semibold block uppercase tracking-wider ${isCancelled ? 'text-slate-500' : 'text-slate-400'}`}>
              {isCancelled ? 'YOUR POSITION' : isTokenCompleted ? 'STATUS' : 'YOUR POSITION'}
            </span>
            <div className={`mt-1 font-extrabold font-heading ${isCancelled ? 'text-3xl sm:text-4xl text-slate-500' : isTokenCompleted ? 'text-sm sm:text-lg text-emerald-400' : 'text-3xl sm:text-4xl text-emerald-400'}`}>
              {isCancelled ? (
                'N/A'
              ) : isTokenCompleted ? (
                <span className="flex items-center justify-center gap-1.5 text-sm sm:text-base md:text-lg font-black tracking-tight text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">COMPLETED</span>
                </span>
              ) : livePosition !== null ? (
                `#${livePosition}`
              ) : (
                '#1'
              )}
            </div>
            <span className={`text-[11px] mt-1 block truncate ${isCancelled ? 'text-slate-500' : 'text-slate-400'}`}>
              {isCancelled 
                ? 'No longer in queue'
                : isTokenCompleted 
                  ? 'Procurement settled' 
                  : livePosition === 1
                    ? 'Next in Line — proceed to gate'
                    : livePosition !== null
                      ? `${Math.max(0, livePosition - 1)} vehicles ahead in yard`
                      : 'Awaiting gate arrival'}
            </span>
          </div>

          <div className="bg-slate-800/70 p-4 rounded-2xl border border-slate-700/60 text-center relative overflow-hidden flex flex-col justify-center min-w-0">
            <span className={`text-[11px] font-semibold block uppercase tracking-wider flex items-center justify-center gap-1 ${isCancelled ? 'text-slate-500' : 'text-slate-400'}`}>
              <Clock className={`w-3.5 h-3.5 ${isCancelled ? 'text-slate-500' : 'text-amber-400'}`} />
              ESTIMATED WAIT
            </span>
            <div className={`text-3xl sm:text-4xl font-extrabold font-heading mt-1 ${isCancelled ? 'text-slate-500' : 'text-amber-300'}`}>
              {isCancelled ? (
                'N/A'
              ) : isTokenCompleted ? (
                '0 MIN'
              ) : livePosition === 1 ? (
                <span className="text-xl sm:text-2xl font-bold text-emerald-400">Next in Line</span>
              ) : (
                <>
                  {estimatedWait} <span className="text-base sm:text-lg font-medium text-amber-400">MIN</span>
                </>
              )}
            </div>
            <span className={`text-[11px] mt-1 block flex items-center justify-center gap-1 ${isCancelled ? 'text-slate-500' : 'text-emerald-400'}`}>
              {isCancelled ? (
                'Slot released'
              ) : livePosition === 1 ? (
                'Admittance ready'
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  AI waterfall simulation
                </>
              )}
            </span>
          </div>
        </div>

        {/* Assigned Counter / Yard Info if admitted */}
        {!isCancelled && (token.assigned_counter || token.weighbridge_number) && (
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>Assigned Counter:</span>
              <strong className="text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700 font-mono">
                {token.assigned_counter || 'Counter 1'}
              </strong>
            </div>
            {token.weighbridge_number && (
              <div className="text-slate-400 text-[11px]">
                Weighbridge: <strong className="text-emerald-300">{token.weighbridge_number}</strong>
              </div>
            )}
          </div>
        )}

        {/* Currently Processing Yard Banner */}
        {!isCancelled && (
          <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">Yard Active Processing:</span>
              <span className="font-mono font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded border border-emerald-600/40">
                {currentProcessingBooking?.tokenNumber || 'KF-10236'}
              </span>
            </div>
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              {currentProcessingBooking?.cropType}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Overall Queue Progress</span>
            <span className={`font-mono font-semibold ${isCancelled ? 'text-red-400' : 'text-emerald-400'}`}>
              {isCancelled ? 'Cancelled (Slot Released)' : `${progressPercent}% Complete`}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/50">
            <div 
              className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                isCancelled 
                  ? 'bg-red-500/60' 
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step-by-Step Live Journey Timeline */}
        <div className="pt-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
            Procurement Process Timeline
          </span>

          <div className="space-y-2">
            {/* Prominent Red Step Override when status is CANCELLED */}
            {isCancelled && (
              <div className="flex items-center justify-between p-3 rounded-xl border border-red-500 bg-red-950/30 shadow-md text-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 flex items-center justify-center font-bold shrink-0">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-red-300 block text-xs">
                      Booking Cancelled
                    </span>
                    <span className="text-[10px] text-red-400/90">
                      This slot has been released. You are no longer in the queue.
                    </span>
                  </div>
                </div>
                <span className="text-red-400 font-bold text-[11px] px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 shrink-0">
                  Voided
                </span>
              </div>
            )}

            {/* Prominent Success State UI when status is COMPLETED or PAID */}
            {!isCancelled && isTokenCompleted && (
              <div 
                id="procurement-completed-success-card"
                className="p-4 rounded-2xl border border-emerald-500/60 bg-emerald-950/40 shadow-xl shadow-emerald-950/40 space-y-3 relative overflow-hidden animate-in zoom-in-95 duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center font-bold shrink-0 shadow-inner">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-extrabold text-white text-sm">
                        Procurement & DBT Payment Completed
                      </span>
                      <span className="text-[10px] font-mono font-extrabold bg-emerald-500/25 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/50">
                        PAID VIA DBT
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200/90 mt-1 leading-relaxed">
                      Physical procurement and quality assays are complete. DBT settlement has been transferred directly to your bank account.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-800/50 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Final Weight</span>
                    <span className="font-bold text-white font-mono text-xs sm:text-sm">
                      {token.actual_quantity || token.actual_weight || token.estimated_quantity} Qtl
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">DBT Payout</span>
                    <span className="font-bold text-emerald-400 font-mono text-xs sm:text-sm">
                      ₹{Number(token.final_payout || token.total_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Assay Grade</span>
                    <span className="font-bold text-purple-300 font-mono text-xs sm:text-sm">
                      {token.quality_grade || 'Grade A'} {token.moisture_percent ? `• ${token.moisture_percent}% M` : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {stages.map((step, index) => {
              const isCompleted = isTokenCompleted ? true : index < activeStepIndex;
              const isActive = !isTokenCompleted && index === activeStepIndex;
              const isPending = !isTokenCompleted && index > activeStepIndex;
              const Icon = step.icon;

              return (
                <div 
                  key={step.key} 
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                    isCancelled
                      ? 'opacity-40 grayscale bg-slate-900/40 text-slate-600 border border-slate-800/40'
                      : isActive 
                        ? 'bg-emerald-950/60 border border-emerald-500/80 shadow-md shadow-emerald-950/50 text-white ring-1 ring-emerald-500/30' 
                        : isCompleted
                          ? 'bg-emerald-950/25 text-slate-200 border border-emerald-900/40'
                          : 'bg-slate-900/60 text-slate-500 border border-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold shrink-0 transition-colors ${
                      isCancelled
                        ? 'bg-slate-800/50 text-slate-600'
                        : isActive 
                          ? 'bg-emerald-500 text-slate-950 shadow-sm animate-pulse' 
                          : isCompleted 
                            ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-300' 
                            : 'bg-slate-800 text-slate-600'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <span className={`font-semibold block ${
                        isCancelled 
                          ? 'text-slate-600' 
                          : isActive 
                            ? 'text-white font-bold' 
                            : isCompleted 
                              ? 'text-slate-200' 
                              : 'text-slate-500'
                      }`}>
                        {step.label}
                      </span>
                      <span className={`text-[10px] ${
                        isCancelled 
                          ? 'text-slate-600' 
                          : isActive 
                            ? 'text-emerald-300/90' 
                            : isCompleted 
                              ? 'text-slate-400' 
                              : 'text-slate-600'
                      }`}>
                        {step.desc}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {!isCancelled && isCompleted && (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {index === 6 && isTokenCompleted ? 'Settled (Paid)' : 'Completed'}
                      </span>
                    )}
                    {!isCancelled && isActive && (
                      <span className="text-emerald-400 font-extrabold text-[11px] flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Active
                      </span>
                    )}
                    {!isCancelled && isPending && (
                      <span className="text-slate-600 text-[11px] font-medium">
                        Pending
                      </span>
                    )}
                    {isCancelled && (
                      <span className="text-slate-600 text-[11px] italic">
                        Dismissed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons: View Digital Receipt & Exit OR Cancel Booking & Show E-Token Pass */}
        {status !== 'CANCELLED' && (
          isTokenCompleted ? (
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                id="view-receipt-and-exit-btn"
                onClick={handleViewReceiptAndExit}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:from-emerald-600 active:to-teal-600 text-slate-950 font-heading font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-950/50 inline-flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>View Digital Receipt & Exit</span>
                <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                type="button"
                id="cancel-tracker-booking-btn"
                onClick={() => setShowCancelModal(true)}
                disabled={isCancelling}
                className="w-full sm:w-auto px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Cancel Booking</span>
              </button>

              <button
                type="button"
                id="show-etoken-gatepass-btn"
                onClick={() => setActiveTabFarmer('token')}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Show E-Token Gate Pass</span>
              </button>
            </div>
          )
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {showCancelModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-tracker-modal-title"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="cancel-tracker-modal-title" className="font-heading font-bold text-base text-white">
                  Cancel Booking?
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to cancel this booking? This action cannot be undone and you will lose your spot in the queue.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                No, Keep it
              </button>
              <button
                type="button"
                onClick={executeCancel}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-rose-950/50 flex items-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Canceling...</span>
                  </>
                ) : (
                  <span>Yes, Cancel Booking</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
