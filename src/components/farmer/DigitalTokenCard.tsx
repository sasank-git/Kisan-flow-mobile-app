import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { 
  QrCode, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Ticket,
  AlertCircle,
  Truck,
  Scale,
  Building2,
  Wheat,
  X,
  Maximize2,
  ZoomIn,
  Trash2,
  XCircle
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { supabase } from '../../utils/supabase';

interface ActiveDbToken {
  id?: string;
  token_number: string;
  centre_id: string;
  farmer_id: string;
  farmer_name: string;
  mobile: string;
  village: string;
  crop_type: string;
  variety?: string;
  slot_date: string;
  slot_time: string;
  estimated_quantity: number;
  actual_quantity?: number;
  quality_grade?: string;
  total_amount: number;
  status: 'BOOKED' | 'CHECKED_IN' | 'WEIGHED' | 'TESTED' | 'PROCESSING' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | string;
  assigned_counter?: string;
  weighbridge_number?: string;
  created_at?: string;
  checkInOtp?: string;
}

export const DigitalTokenCard: React.FC = () => {
  const { bookings, centres, farmer, checkInFarmer, cancelBooking, setActiveTabFarmer } = useKisanFlow();

  const [activeToken, setActiveToken] = useState<ActiveDbToken | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('supabase');
  const [isQrZoomed, setIsQrZoomed] = useState<boolean>(false);

  // Helper to calculate benchmark MSP if total_amount is missing or 0
  const getCropMsp = (crop: string) => {
    const c = (crop || '').toLowerCase();
    if (c.includes('wheat')) return 2275;
    if (c.includes('cotton')) return 6620;
    if (c.includes('soya') || c.includes('soybean')) return 4600;
    if (c.includes('mustard')) return 5650;
    if (c.includes('maize')) return 2090;
    return 2183;
  };

  // Derive stable 4-digit check-in OTP
  const getOtp = (tokenNum: string) => {
    const digits = tokenNum.replace(/\D/g, '');
    if (digits.length >= 4) {
      return digits.slice(-4);
    }
    return '5824';
  };

  // Fetch most recent active token (BOOKED, CHECKED_IN, WEIGHED, TESTED, PROCESSING) for currently logged-in farmer
  const fetchActiveToken = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      // Query Supabase tokens table for this farmer with active status
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('farmer_id', farmer.id)
        .in('status', ['BOOKED', 'CHECKED_IN', 'PROCESSING'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('Supabase active token query notice:', error.message);
        fallbackToLocalContext();
      } else if (data && data.length > 0) {
        const row = data[0];
        const tokenAmount = Number(row.total_amount) > 0 
          ? Number(row.total_amount) 
          : (Number(row.estimated_quantity) || 30) * getCropMsp(row.crop_type);

        const resolvedStatus = (row.status === 'PROCESSING' && row.moisture_percent !== null && row.moisture_percent !== undefined)
          ? 'TESTED'
          : (row.status === 'PROCESSING' && (row.actual_weight || row.actual_quantity))
          ? 'WEIGHED'
          : row.status;

        setActiveToken({
          id: row.id,
          token_number: row.token_number,
          centre_id: row.centre_id,
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
          total_amount: tokenAmount,
          status: resolvedStatus,
          assigned_counter: row.assigned_counter,
          weighbridge_number: row.weighbridge_number,
          created_at: row.created_at,
          checkInOtp: getOtp(row.token_number)
        });
        setDataSource('supabase');
      } else {
        // No active token found in Supabase: check local bookings as fallback
        fallbackToLocalContext();
      }
    } catch (err) {
      console.warn('Network issue fetching active token, using fallback:', err);
      fallbackToLocalContext();
    } finally {
      setIsLoading(false);
      if (showIndicator) setIsRefreshing(false);
    }
  }, [farmer.id, farmer.name, farmer.mobile, farmer.village, bookings]);

  // Fallback to local context if Supabase has no active token or network failed
  const fallbackToLocalContext = () => {
    const localActive = bookings.find(
      b => b.farmerId === farmer.id && (b.status === 'BOOKED' || b.status === 'CHECKED_IN' || b.status === 'ARRIVED' || (b.status as string) === 'WEIGHED' || (b.status as string) === 'TESTED' || b.status === 'PROCESSING')
    );

    if (localActive) {
      setActiveToken({
        id: localActive.id,
        token_number: localActive.tokenNumber,
        centre_id: localActive.centreId,
        farmer_id: localActive.farmerId,
        farmer_name: localActive.farmerName,
        mobile: localActive.mobile,
        village: localActive.village,
        crop_type: localActive.cropType,
        variety: localActive.variety,
        slot_date: localActive.bookingDate,
        slot_time: localActive.slotTime,
        estimated_quantity: localActive.estimatedQuantity,
        actual_quantity: localActive.actualQuantity,
        quality_grade: localActive.qualityGrade,
        total_amount: localActive.totalAmount,
        status: (localActive.status === 'ARRIVED' ? 'CHECKED_IN' : localActive.status) as 'BOOKED' | 'CHECKED_IN',
        assigned_counter: localActive.assignedCounter,
        weighbridge_number: localActive.weighbridgeNumber,
        createdAt: localActive.createdAt,
        checkInOtp: localActive.checkInOtp || getOtp(localActive.tokenNumber)
      });
      setDataSource('local');
    } else {
      setActiveToken(null);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchActiveToken();

    // Subscribe to real-time changes on the tokens table for this farmer
    const channel = supabase
      .channel(`active-token-channel-${farmer.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tokens',
          filter: `farmer_id=eq.${farmer.id}`
        },
        () => {
          fetchActiveToken(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmer.id, fetchActiveToken]);

  // Gate Check-In Handler: updates both Supabase and local context
  const handleGateCheckIn = async (tokenNumber: string) => {
    setIsCheckingIn(true);
    try {
      await checkInFarmer(tokenNumber);
      
      // Update Supabase directly to ensure immediate consistency
      const { error } = await supabase
        .from('tokens')
        .update({ status: 'CHECKED_IN' })
        .eq('token_number', tokenNumber);

      if (error) {
        console.warn('Notice updating token to CHECKED_IN:', error.message);
      }

      // Locally reflect checked-in status immediately
      setActiveToken(prev => prev ? { ...prev, status: 'CHECKED_IN' } : null);
    } catch (err) {
      console.error('Error during gate check-in:', err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Cancel Booking Logic - Supabase Update and State Refresh
  const handleExecuteCancel = async () => {
    if (!activeToken) return;

    setIsCancelling(true);
    try {
      // Invoke cancelBooking helper which updates Supabase (with fallback for 22P02 enum) and React state
      await cancelBooking(activeToken.token_number);

      // On success, close modal, clear active token state immediately
      setShowCancelModal(false);
      setActiveToken(null);
      window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
    } catch (err: any) {
      console.error('Unexpected error cancelling booking:', err);
      alert(err.message || 'An error occurred while cancelling your booking.');
    } finally {
      setIsCancelling(false);
    }
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="p-8 text-center bg-slate-900/90 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center animate-spin text-emerald-400">
          <RefreshCw className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-heading font-bold text-white text-base">Fetching Active Token...</h3>
          <p className="text-xs text-slate-400">Connecting to Supabase e-Gate Pass registry</p>
        </div>
      </div>
    );
  }

  // 2. Fallback UI: Empty State when no active booking exists
  if (!activeToken) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-xl relative overflow-hidden">
        {/* Decorative background aura */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700/80 mx-auto flex items-center justify-center text-slate-400 shadow-inner">
          <Ticket className="w-8 h-8 text-slate-400" />
        </div>

        <div className="space-y-2 max-w-xs mx-auto">
          <h3 className="font-heading font-bold text-lg text-white">
            No Active Gate Pass
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            No active tokens found. Book a slot to generate your gate pass
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => setActiveTabFarmer('book')}
            className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-heading font-extrabold text-sm py-3 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-98"
          >
            <Sparkles className="w-4 h-4 fill-slate-950 text-emerald-950" />
            <span>Book a Smart Slot Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Guaranteed Minimum Support Price (MSP) & Instant DBT</span>
        </div>
      </div>
    );
  }

  // 3. Dynamic Data Binding for Active Token Pass
  const centre = centres.find(c => c.id === activeToken.centre_id) || centres[0];
  const centreName = centre?.name || activeToken.centre_id;
  const isCheckedIn = activeToken.status === 'CHECKED_IN';

  return (
    <div className="space-y-4">
      {/* Real-time Status Sync Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {dataSource === 'supabase' ? 'Supabase Live Connected' : 'Local State Synced'}
          </span>
        </div>
        <button
          onClick={() => fetchActiveToken(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
          title="Refresh token from database"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Mandi Token Pass Card */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-950/20 relative">
        {/* Top Header Strip */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 px-5 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-200" />
            <div>
              <span className="font-heading font-extrabold text-xs uppercase tracking-wider block">
                Govt. Mandi Token Pass
              </span>
              <span className="text-[10px] text-emerald-100/90 font-mono">
                Ministry of Agriculture, Govt of India • e-NAM / FCI
              </span>
            </div>
          </div>
          <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
            activeToken.status === 'WEIGHED'
              ? 'bg-indigo-400 text-slate-950'
              : activeToken.status === 'TESTED'
                ? 'bg-purple-400 text-slate-950'
                : isCheckedIn 
                  ? 'bg-emerald-400 text-slate-950' 
                  : 'bg-amber-400 text-slate-950'
          }`}>
            {activeToken.status === 'WEIGHED' ? 'WEIGHED' : activeToken.status === 'TESTED' ? 'TESTED' : isCheckedIn ? 'CHECKED IN' : 'BOOKED'}
          </span>
        </div>

        {/* Token Body */}
        <div className="p-5 space-y-4">
          {/* Dynamic Token ID Big Display */}
          <div className="text-center py-2.5 bg-slate-800/40 rounded-2xl border border-slate-800/80 relative">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-medium">
              E-TOKEN NUMBER
            </span>
            <span className="font-mono text-3xl font-extrabold text-emerald-400 tracking-wider">
              {activeToken.token_number}
            </span>
            <div className="flex items-center justify-center gap-2 mt-1 text-xs text-slate-300">
              <span className="font-medium text-white">{activeToken.farmer_name}</span>
              <span>•</span>
              <span className="font-mono text-slate-400">{activeToken.farmer_id}</span>
              {activeToken.village && (
                <>
                  <span>•</span>
                  <span className="text-slate-400 truncate max-w-[100px]">{activeToken.village}</span>
                </>
              )}
            </div>
          </div>

          {/* Physically Scannable QR Code & OTP Box */}
          <div className="flex items-center justify-center gap-5 p-4 bg-white rounded-2xl shadow-inner text-slate-900">
            {/* Dynamic Scannable QR Code - Tap to Zoom */}
            <button
              type="button"
              onClick={() => setIsQrZoomed(true)}
              className="p-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl border-2 border-dashed border-emerald-500/50 hover:border-emerald-600 shadow-sm flex flex-col items-center group transition-all cursor-pointer relative"
              title="Tap to enlarge QR pass for gate scanning"
            >
              <div className="w-[124px] h-[124px] flex items-center justify-center bg-white relative">
                <QRCode
                  value={activeToken.token_number}
                  size={120}
                  level="M"
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  viewBox="0 0 120 120"
                />
                <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/10 rounded-lg flex items-center justify-center transition-colors">
                  <span className="opacity-0 group-hover:opacity-100 bg-slate-900/90 text-white text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-md transition-opacity">
                    <Maximize2 className="w-2.5 h-2.5" /> Enlarge
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1.5 text-emerald-700">
                <ZoomIn className="w-3 h-3 text-emerald-600" />
                <span className="text-[9px] font-mono font-bold tracking-wider">
                  {activeToken.token_number} • Tap to Zoom
                </span>
              </div>
            </button>

            {/* Entry OTP & Instructions */}
            <div className="flex flex-col items-center text-center space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                GATE ENTRY OTP
              </span>
              <div className="text-2xl font-black font-mono tracking-widest text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 shadow-sm">
                {activeToken.checkInOtp}
              </div>
              <p className="text-[10px] text-slate-500 max-w-[130px] leading-tight">
                Scan QR or provide OTP at Mandi Security Gate
              </p>
            </div>
          </div>

          {/* Dynamic Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Selected Mandi Centre Name */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                <Building2 className="w-3 h-3 text-emerald-400" />
                Mandi Centre
              </span>
              <span className="font-semibold text-white truncate block mt-0.5 text-xs" title={centreName}>
                {centreName}
              </span>
            </div>

            {/* Exact Time Slot */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                Reporting Slot
              </span>
              <span className="font-semibold text-emerald-300 block mt-0.5 text-xs truncate">
                {activeToken.slot_time} ({activeToken.slot_date})
              </span>
            </div>

            {/* Crop & Quantity */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                <Wheat className="w-3 h-3 text-emerald-400" />
                Crop & Quantity
              </span>
              <span className="font-semibold text-white block mt-0.5 text-xs truncate">
                {activeToken.crop_type} {activeToken.variety ? `(${activeToken.variety})` : ''}
              </span>
              <span className="text-[11px] text-emerald-400 font-mono font-medium block">
                {activeToken.estimated_quantity} Quintals
              </span>
            </div>

            {/* Calculated MSP */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                <Scale className="w-3 h-3 text-amber-400" />
                Calculated MSP Payout
              </span>
              <span className="font-semibold text-amber-300 block mt-0.5 text-xs">
                ₹{activeToken.total_amount.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Direct Bank Transfer (DBT)
              </span>
            </div>
          </div>

          {/* Assigned Counter & Weighbridge if present */}
          {(activeToken.assigned_counter || activeToken.weighbridge_number) && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs">
              {activeToken.assigned_counter && (
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <span className="text-slate-400 text-[10px]">Counter:</span>
                  <span className="font-bold text-white">{activeToken.assigned_counter}</span>
                </div>
              )}
              {activeToken.weighbridge_number && (
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <span className="text-slate-400 text-[10px]">Weighbridge:</span>
                  <span className="font-bold text-white">{activeToken.weighbridge_number}</span>
                </div>
              )}
            </div>
          )}

          {/* Check-In Action Button */}
          {!isCheckedIn ? (
            <div className="pt-2">
              <button
                onClick={() => handleGateCheckIn(activeToken.token_number)}
                disabled={isCheckingIn}
                className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-heading font-extrabold text-sm py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-98 cursor-pointer disabled:opacity-75"
              >
                <CheckCircle className="w-4 h-4 fill-slate-950 text-white" />
                <span>{isCheckingIn ? 'Verifying Gate Entry...' : 'Simulate Gate Arrival & QR Check-In'}</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-1.5">
                Simulates gate operator scanning your QR code to admit vehicle into yard.
              </p>
            </div>
          ) : (
            <div className="pt-2 flex items-center justify-between p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Admitted & In Queue</span>
              </div>
              <button
                onClick={() => setActiveTabFarmer('queue')}
                className="text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Track Live Queue</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Cancel Booking Action (Available when not completed or cancelled) */}
          {activeToken.status !== 'COMPLETED' && (
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                id="cancel-booking-btn"
                onClick={() => setShowCancelModal(true)}
                disabled={isCancelling || isCheckingIn}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Cancel Booking</span>
              </button>
              <p className="text-[10px] text-center text-slate-500 mt-1">
                Release your time slot back to other farmers if you are unable to arrive.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Tailwind CSS Cancel Booking Confirmation Modal */}
      {showCancelModal && activeToken && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="cancel-modal-title" className="font-heading font-bold text-base text-white">
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
                id="cancel-modal-keep-btn"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                No, Keep it
              </button>
              <button
                type="button"
                id="cancel-modal-confirm-btn"
                onClick={handleExecuteCancel}
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

      {/* Mobile E-Token Tap-to-Zoom Modal Dialog */}
      {isQrZoomed && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsQrZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged Mandi Gate Pass QR"
        >
          <div 
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-slate-950 text-center relative border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button (✕) */}
            <button
              onClick={() => setIsQrZoomed(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              title="Close Enlarged Pass (✕)"
              aria-label="Close"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>

            {/* Header Info */}
            <div className="mb-3 pr-8 text-left">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-block">
                Official Mandi Gate Pass
              </span>
              <h3 className="font-mono text-2xl font-black text-slate-900 tracking-tight mt-1">
                {activeToken.token_number}
              </h3>
              <p className="text-xs text-slate-600 font-medium truncate">
                {activeToken.farmer_name} • {centreName}
              </p>
            </div>

            {/* Enlarged High-Contrast QR Code in Clean White Container with Maximum Brightness */}
            <div className="p-4 bg-white rounded-2xl border-2 border-slate-900/15 shadow-md flex flex-col items-center justify-center mx-auto my-2">
              <div className="w-[230px] h-[230px] flex items-center justify-center bg-white p-1">
                <QRCode
                  value={activeToken.token_number}
                  size={220}
                  level="H"
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  viewBox="0 0 220 220"
                />
              </div>
              <span className="text-xs font-mono font-black text-slate-900 tracking-widest mt-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-300">
                TOKEN: {activeToken.token_number}
              </span>
            </div>

            {/* Entry OTP & Instructions */}
            <div className="mt-3 flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Gate Entry OTP
                </span>
                <span className="font-mono text-xl font-black text-emerald-700 tracking-widest">
                  {activeToken.checkInOtp}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-600 max-w-[150px] leading-tight">
                Slot: <strong className="text-slate-900">{activeToken.slot_time}</strong>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500 leading-snug">
              High-contrast display. Present directly to the Mandi Gate Scanner or camera.
            </p>

            {/* Explicit Close Button */}
            <button
              onClick={() => setIsQrZoomed(false)}
              className="w-full mt-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-heading font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Close Fullscreen Pass (✕)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
