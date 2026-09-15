import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Building2, 
  Calendar, 
  Clock, 
  ChevronRight, 
  Sparkles, 
  RefreshCw, 
  Inbox, 
  Layers
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { LiveQueueTracker, FarmerTokenData } from './LiveQueueTracker';
import { SlotRecoveryBanner } from './SlotRecoveryBanner';
import { supabase } from '../../utils/supabase';

export const LiveQueueView: React.FC = () => {
  const { farmer, centres, bookings, setActiveTabFarmer } = useKisanFlow();

  const [tokens, setTokens] = useState<FarmerTokenData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Clean Master-Detail State: default null shows the "My Bookings" list
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const isManualBackRef = useRef(false);

  // Derive selected token object when a token_number is chosen
  const selectedToken = useMemo(() => {
    if (!selectedTokenId) return null;
    return tokens.find(t => t.token_number === selectedTokenId) || null;
  }, [tokens, selectedTokenId]);

  // Explicit back navigation handler
  const handleBackToAllBookings = useCallback(() => {
    isManualBackRef.current = true;
    setSelectedTokenId(null);
  }, []);

  // Handler to update a token in the parent list when mutated in detail view
  const handleUpdateToken = useCallback((updatedToken: FarmerTokenData) => {
    setTokens(prev => prev.map(t => t.token_number === updatedToken.token_number ? updatedToken : t));
  }, []);

  // Selection handler for booking card
  const handleSelectToken = useCallback((tokenNumber: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    isManualBackRef.current = false;
    setSelectedTokenId(tokenNumber);
  }, []);

  // Helper to get MSP for calculation if needed
  const getCropMsp = (crop: string) => {
    const c = (crop || '').toLowerCase();
    if (c.includes('wheat')) return 2275;
    if (c.includes('cotton')) return 6620;
    if (c.includes('soya') || c.includes('soybean')) return 4600;
    if (c.includes('mustard')) return 5650;
    if (c.includes('maize')) return 2090;
    return 2183;
  };

  // Helper to map centre name
  const resolveCentreName = (centreId: string) => {
    const found = centres.find(c => c.id === centreId);
    return found ? found.name : centreId || 'Central Mandi Yard';
  };

  // Fallback to local context bookings if Supabase is offline or empty
  const fallbackToLocalBookings = useCallback(() => {
    const local = bookings.filter(b => b.farmerId === farmer.id);
    if (local.length > 0) {
      const mapped: FarmerTokenData[] = local.map(b => ({
        id: b.id,
        token_number: b.tokenNumber,
        centre_id: b.centreId,
        centre_name: b.centreName,
        farmer_id: b.farmerId,
        farmer_name: b.farmerName,
        mobile: b.mobile,
        village: b.village,
        crop_type: b.cropType,
        variety: b.variety,
        slot_date: b.bookingDate,
        slot_time: b.slotTime,
        estimated_quantity: b.estimatedQuantity,
        actual_quantity: b.actualQuantity,
        quality_grade: b.qualityGrade,
        total_amount: b.totalAmount,
        status: b.status,
        assigned_counter: b.assignedCounter,
        weighbridge_number: b.weighbridgeNumber,
        created_at: b.createdAt,
        predictedWaitMin: b.predictedWaitMin // Added wait time here
      }));
      setTokens(mapped);
    } else {
      setTokens([]);
    }
  }, [farmer.id, bookings]);

  // Query Supabase tokens table for all records associated with logged-in farmer_id, ordered by date descending
  const fetchFarmerTokens = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('farmer_id', farmer.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase farmer tokens query notice:', error.message);
        fallbackToLocalBookings();
      } else if (data && data.length > 0) {
        const mappedTokens: FarmerTokenData[] = data.map(row => {
          const centreName = resolveCentreName(row.centre_id);
          const totalAmt = Number(row.total_amount) > 0 
            ? Number(row.total_amount) 
            : (Number(row.estimated_quantity) || 30) * getCropMsp(row.crop_type);

          // Get the dynamic wait time from the context's synced centres
          const targetCentre = centres.find(c => c.id === row.centre_id);
          const dynamicWait = targetCentre ? targetCentre.waitTimeMin : 15;

          // Check if local context marked this token cancelled or progressed
          const contextMatch = bookings.find(b => b.tokenNumber === row.token_number || b.id === row.token_number);
          let effectiveStatus = (contextMatch?.status === 'CANCELLED' || row.status === 'CANCELLED')
            ? 'CANCELLED'
            : (contextMatch?.status as string) || row.status;

          if (effectiveStatus === 'PROCESSING' || row.status === 'PROCESSING') {
            if (row.moisture_percent !== null && row.moisture_percent !== undefined) {
              effectiveStatus = 'TESTED';
            } else if (row.actual_weight || row.actual_quantity) {
              effectiveStatus = 'WEIGHED';
            }
          }

          return {
            id: row.id,
            token_number: row.token_number,
            centre_id: row.centre_id,
            centre_name: centreName,
            farmer_id: row.farmer_id,
            farmer_name: row.farmer_name || farmer.name,
            mobile: row.mobile || farmer.mobile,
            village: row.village || farmer.village,
            crop_type: row.crop_type || 'Wheat (Sharbati)',
            variety: row.variety || '',
            slot_date: row.slot_date || 'Today',
            slot_time: row.slot_time || '11:30 AM - 12:00 PM',
            estimated_quantity: Number(row.estimated_quantity) || 30,
            actual_quantity: row.actual_quantity ? Number(row.actual_quantity) : undefined,
            quality_grade: row.quality_grade,
            total_amount: totalAmt,
            status: effectiveStatus,
            assigned_counter: row.assigned_counter,
            weighbridge_number: row.weighbridge_number,
            created_at: row.created_at,
            predictedWaitMin: dynamicWait, // Added dynamic wait time here
          };
        });

        // Also merge any bookings from context for this farmer that aren't in Supabase data (e.g. purged/fallback)
        const dbTokenNums = new Set(data.map((r: any) => r.token_number));
        const extraFarmerBookings = bookings
          .filter(b => (b.farmerId === farmer.id || b.mobile === farmer.mobile) && !dbTokenNums.has(b.tokenNumber))
          .map(b => ({
            id: b.id,
            token_number: b.tokenNumber,
            centre_id: b.centreId,
            centre_name: b.centreName,
            farmer_id: b.farmerId,
            farmer_name: b.farmerName,
            mobile: b.mobile,
            village: b.village,
            crop_type: b.cropType,
            variety: b.variety,
            slot_date: b.bookingDate,
            slot_time: b.slotTime,
            estimated_quantity: b.estimatedQuantity,
            actual_quantity: b.actualQuantity,
            quality_grade: b.qualityGrade,
            total_amount: b.totalAmount,
            status: b.status,
            assigned_counter: b.assignedCounter,
            weighbridge_number: b.weighbridgeNumber,
            created_at: b.createdAt,
            predictedWaitMin: b.predictedWaitMin, // Added wait time here
          }));

        setTokens([...mappedTokens, ...extraFarmerBookings]);
      } else {
        const localFarmerBookings = bookings.filter(b => b.farmerId === farmer.id);
        if (localFarmerBookings.length > 0) {
          fallbackToLocalBookings();
        } else {
          setTokens([]);
        }
      }
    } catch (err) {
      console.warn('Network issue fetching farmer tokens, checking local fallback:', err);
      fallbackToLocalBookings();
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [farmer.id, farmer.name, farmer.mobile, farmer.village, centres, bookings, fallbackToLocalBookings]);

  // Initial fetch and Realtime Supabase Subscription
  useEffect(() => {
    fetchFarmerTokens();

    const channel = supabase
      .channel(`farmer-tokens-listener-${farmer.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens', filter: `farmer_id=eq.${farmer.id}` },
        () => {
          fetchFarmerTokens(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmer.id]); 

  // Listen to context tokens updated event to immediately refresh
  useEffect(() => {
    const handleTokensUpdated = () => {
      fetchFarmerTokens(false);
    };
    window.addEventListener('kisanflow:tokens-updated', handleTokensUpdated);
    return () => {
      window.removeEventListener('kisanflow:tokens-updated', handleTokensUpdated);
    };
  }, [fetchFarmerTokens]);

  // Keep tokens status in sync with global context bookings array
  useEffect(() => {
    if (bookings.length > 0) {
      setTokens(prev => {
        let changed = false;
        const next = prev.map(t => {
          const matchingBooking = bookings.find(b => b.tokenNumber === t.token_number || b.id === t.token_number);
          if (matchingBooking && matchingBooking.status !== t.status) {
            changed = true;
            return { ...t, status: matchingBooking.status };
          }
          return t;
        });
        return changed ? next : prev;
      });
    }
  }, [bookings]);

  // Helper for dynamic status badge styling
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED':
      case 'PAID':
        return (
          <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border bg-teal-950/80 text-teal-300 border-teal-500/50 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            COMPLETED
          </span>
        );
      case 'TESTED':
        return (
          <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border bg-purple-950/80 text-purple-300 border-purple-500/50 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            TESTED
          </span>
        );
      case 'WEIGHED':
        return (
          <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border bg-indigo-950/80 text-indigo-300 border-indigo-500/50 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            WEIGHED
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border bg-amber-950/80 text-amber-300 border-amber-500/50 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            PROCESSING
          </span>
        );
      case 'CHECKED_IN':
      case 'ARRIVED':
        return (
          <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-300 border-emerald-500/50 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            CHECKED_IN
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border bg-rose-950/80 text-rose-300 border-rose-500/50 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            NO_SHOW
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border bg-red-500/20 text-red-400 border-red-500/50 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border bg-sky-950/80 text-sky-300 border-sky-500/50 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            BOOKED
          </span>
        );
    }
  };

  // If a booking is currently selected, render the Detail View (LiveQueueTracker)
  if (selectedTokenId !== null && selectedToken) {
    return (
      <LiveQueueTracker
        token={selectedToken}
        onBack={handleBackToAllBookings}
        onUpdateToken={handleUpdateToken}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Slot Recovery Banner if available */}
      <SlotRecoveryBanner />

      {/* Header with Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
              My Bookings
            </h3>
            <span className="text-xs bg-slate-800 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded-full border border-slate-700">
              {tokens.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Select any booking to track live yard position & timeline
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchFarmerTokens(true)}
          disabled={isRefreshing}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
          title="Refresh Bookings List"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 animate-pulse space-y-3">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-5 bg-slate-800 rounded w-1/2" />
              <div className="h-3 bg-slate-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State: If no tokens found in database */}
      {!isLoading && tokens.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
            <Inbox className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h4 className="font-heading font-extrabold text-base text-white">
              No upcoming bookings found
            </h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              You do not have any scheduled procurement slots yet. Reserve your slot now to avoid long Mandi wait times.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveTabFarmer('book')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-heading font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Book Slot</span>
            </button>
          </div>
        </div>
      )}

      {/* Master List of Compact Booking Cards */}
      {!isLoading && tokens.length > 0 && (
        <div className="space-y-3">
          {tokens.map((item) => {
            const isCancelled = item.status === 'CANCELLED';
            return (
              <div
                key={item.token_number}
                onClick={(e) => handleSelectToken(item.token_number, e)}
                role="button"
                tabIndex={0}
                className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer group shadow-lg relative overflow-hidden ${
                  isCancelled
                    ? 'bg-slate-900/60 border-red-500/25 hover:border-red-500/45 opacity-90'
                    : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 hover:shadow-emerald-950/20 active:scale-[0.99]'
                }`}
              >
                {/* Mandi Centre & Dynamic Status Badge */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className={`w-4 h-4 shrink-0 ${isCancelled ? 'text-slate-500' : 'text-emerald-400'}`} />
                    <span className={`text-xs font-heading font-bold truncate ${isCancelled ? 'text-slate-300' : 'text-white'}`}>
                      {item.centre_name}
                    </span>
                  </div>
                  {renderStatusBadge(item.status)}
                </div>

                {/* Token Number & Crop Type / Estimated Quantity */}
                <div className="flex items-baseline justify-between gap-2 border-t border-slate-800/80 pt-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">
                      Token Number
                    </span>
                    <span className={`font-mono text-sm sm:text-base font-extrabold tracking-wide ${
                      isCancelled ? 'text-red-400/90 line-through decoration-red-500/50' : 'text-emerald-400'
                    }`}>
                      {item.token_number}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">
                      Crop & Quantity
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {item.crop_type} • <strong className={isCancelled ? 'text-slate-300' : 'text-white'}>{item.estimated_quantity} Qtl</strong>
                    </span>
                  </div>
                </div>

                {/* Scheduled Date & Time Slot + Drill-down affordance */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {item.slot_date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.slot_time}
                    </span>
                  </div>

                  <div className={`flex items-center gap-1 text-[11px] font-bold group-hover:translate-x-0.5 transition-transform ${
                    isCancelled ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    <span>{isCancelled ? 'View Status' : 'Track Queue'}</span>
                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};