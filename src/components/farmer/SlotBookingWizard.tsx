import React, { useState, useEffect } from 'react';
import { 
  Sparkles, MapPin, Clock, CheckCircle2, Calendar, ChevronRight, AlertCircle, Info, X, Scale
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { supabase } from '../../utils/supabase'; 

// Database Submission Logic
async function submitToken(
  supabaseClient: any,
  formData: {
    centre_id: string; farmer_id: string; farmer_name: string; mobile: string;
    crop_type: string; variety: string; estimated_quantity: number; total_amount: number;
    village: string; slot_date: string; slot_time: string; 
  }
) {
  let checkQuery = supabaseClient
    .from('tokens')
    .select('id, token_number, slot_date, slot_time, status, farmer_id, mobile')
    .eq('slot_date', formData.slot_date)
    .in('status', ['BOOKED', 'CHECKED_IN', 'PROCESSING']);

  if (formData.farmer_id && formData.mobile) {
    checkQuery = checkQuery.or(`farmer_id.eq.${formData.farmer_id},mobile.eq.${formData.mobile}`);
  }

  const { data: existingActiveBookings, error: checkError } = await checkQuery;
  if (checkError) console.warn('Pre-flight check notice:', checkError.message);

  if (existingActiveBookings && existingActiveBookings.length > 0) {
    throw new Error('Duplicate Booking: You already have an active slot reserved for this date. Please complete or cancel it before booking another.');
  }

  const tokenNumber = `KF-${Math.floor(10000 + Math.random() * 90000)}`;

  const { data, error } = await supabaseClient
    .from('tokens')
    .insert([{
      token_number: tokenNumber, centre_id: formData.centre_id, farmer_id: formData.farmer_id,
      farmer_name: formData.farmer_name, mobile: formData.mobile, village: formData.village,
      crop_type: formData.crop_type, variety: formData.variety, estimated_quantity: formData.estimated_quantity,
      total_amount: formData.total_amount, slot_date: formData.slot_date, slot_time: formData.slot_time, status: 'BOOKED'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export const SlotBookingWizard: React.FC = () => {
  const { centres, bookNewSlot, setActiveTabFarmer, farmer, bookings } = useKisanFlow();

  const [cropType, setCropType] = useState('Wheat (Sharbati)');
  const [variety, setVariety] = useState('Sharbati Gold');
  const [quantity, setQuantity] = useState(32);
  
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  
  const todayISO = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const [manualDate, setManualDate] = useState(todayISO);
  const [manualTime, setManualTime] = useState('');

  const [dynamicDate, setDynamicDate] = useState('Today');
  const [dynamicTime, setDynamicTime] = useState('09:00 AM');
  const [isSlotLoading, setIsSlotLoading] = useState(true);

  const recommendedCentre = centres && centres.length > 0 
    ? [...centres].sort((a, b) => (a.waitTimeMin || 0) - (b.waitTimeMin || 0))[0] 
    : centres[0];

  const getMsp = (crop: string) => {
    const c = (crop || '').toLowerCase();
    if (c.includes('wheat')) return 2275;
    if (c.includes('cotton')) return 6620;
    if (c.includes('soybean')) return 4600;
    if (c.includes('mustard')) return 5650;
    return 2183;
  };

  // AI Recommendation Logic (Untouched)
  useEffect(() => {
    function calculateNextSlot() {
      if (!recommendedCentre) return;
      setIsSlotLoading(true);
      
      try {
        const activeBookings = bookings.filter(b => 
          b.centreId === recommendedCentre.id &&
          b.status !== 'COMPLETED' && b.status !== 'NO_SHOW' && b.status !== 'CANCELLED'
        );

        const volumeByHour: Record<number, number> = {};
        activeBookings.forEach(t => {
          const match = (t.slotTime || '').match(/^(\d{1,2}):\d{2}\s*(AM|PM)?/i);
          if (match) {
            let h = parseInt(match[1], 10);
            if (match[2]?.toUpperCase() === 'PM' && h < 12) h += 12;
            if (match[2]?.toUpperCase() === 'AM' && h === 12) h = 0;
            volumeByHour[h] = (volumeByHour[h] || 0) + (Number(t.estimatedQuantity) || 30);
          }
        });

        const maxHourlyCapacity = (recommendedCentre.activeCounters || 3) * 120;
        const now = new Date();
        let targetHour = Math.max(9, now.getHours());

        while (targetHour < 17 && ((volumeByHour[targetHour] || 0) + quantity) > maxHourlyCapacity) {
          targetHour++;
        }

        if (targetHour >= 17) {
          setDynamicDate('Tomorrow');
          setDynamicTime('09:00 AM');
        } else {
          setDynamicDate('Today');
          let targetMin = targetHour === now.getHours() ? now.getMinutes() : 0;
          const remainder = 30 - (targetMin % 30);
          let finalMin = targetMin + remainder;
          let finalHour = targetHour;

          if (finalMin >= 60) {
            finalMin = 0;
            finalHour++;
          }

          if (finalHour >= 17) {
            setDynamicDate('Tomorrow');
            setDynamicTime('09:00 AM');
          } else {
            const meridian = finalHour >= 12 ? 'PM' : 'AM';
            const displayHour = finalHour > 12 ? finalHour - 12 : (finalHour === 0 ? 12 : finalHour);
            setDynamicTime(`${displayHour.toString().padStart(2, '0')}:${finalMin.toString().padStart(2, '0')} ${meridian}`);
          }
        }
      } catch (error) {
        console.error('Error calculating slot:', error);
      } finally {
        setIsSlotLoading(false);
      }
    }
    
    calculateNextSlot();
  }, [recommendedCentre?.id, recommendedCentre?.activeCounters, quantity, bookings]); 

  // 🔥 THE FIX: Dynamically checks the capacity of the SPECIFIC building you click on
  const getAvailableManualTimes = (targetCentreId: string) => {
    const times = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const isToday = manualDate === todayISO;

    const targetCentre = centres.find(c => c.id === targetCentreId) || centres[0];
    const maxHourlyCapacity = (targetCentre.activeCounters || 3) * 120;

    // Calculate the live load for THIS specific center on the selected date
    const localHourlyLoads: Record<number, number> = {};
    bookings.forEach(b => {
      const isSameDate = b.bookingDate === manualDate || (isToday && b.bookingDate === 'Today');
      if (b.centreId === targetCentreId && isSameDate && b.status !== 'COMPLETED' && b.status !== 'NO_SHOW' && b.status !== 'CANCELLED') {
        const match = (b.slotTime || '').match(/^(\d{1,2}):\d{2}\s*(AM|PM)?/i);
        if (match) {
          let h = parseInt(match[1], 10);
          if (match[2]?.toUpperCase() === 'PM' && h < 12) h += 12;
          if (match[2]?.toUpperCase() === 'AM' && h === 12) h = 0;
          localHourlyLoads[h] = (localHourlyLoads[h] || 0) + (Number(b.estimatedQuantity) || 30);
        }
      }
    });

    for (let h = 9; h <= 17; h++) {
      // 🔒 LOCK: Physically hides dropdown slots that exceed THIS building's limits
      if (((localHourlyLoads[h] || 0) + quantity) > maxHourlyCapacity) {
        continue;
      }

      for (let m = 0; m < 60; m += 30) {
        if (h === 17 && m > 0) continue; 
        if (isToday && (h < currentHour || (h === currentHour && m <= currentMin))) continue; 

        const meridian = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        times.push(`${displayHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${meridian}`);
      }
    }
    return times;
  };

  const handleBook = async (centreId: string, time: string, isManual: boolean = false, date: string = 'Today') => {
    try {
      setBookingError(null);
      setIsBooking(true);
      const finalDate = isManual ? date : dynamicDate;
      const finalTime = isManual ? time : dynamicTime;

      const createdToken = await submitToken(supabase, {
        centre_id: centreId, farmer_id: farmer?.id || `KF-${Math.floor(1000 + Math.random() * 9000)}`,
        farmer_name: farmer?.name || 'Test Farmer', mobile: farmer?.mobile || '+91 98765 43210',
        village: farmer?.village || 'Taraori', crop_type: cropType, variety: variety,
        estimated_quantity: Number(quantity), total_amount: Number(quantity) * getMsp(cropType),
        slot_date: finalDate, slot_time: finalTime
      });

      bookNewSlot({
        centreId, cropType, variety, estimatedQuantity: Number(quantity),
        bookingDate: finalDate, slotTime: finalTime, tokenNumber: createdToken?.token_number, skipDbInsert: true,
      });
    } catch (error: any) {
      setBookingError(error?.message || "Booking failed.");
    } finally {
      setIsBooking(false);
    }
  };

  if (!recommendedCentre) return null;

  return (
    <div className="space-y-4">
      {bookingError && (
        <div className="bg-rose-950/80 border-2 border-rose-500/80 rounded-2xl p-4 flex items-start gap-3 shadow-xl">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-rose-200 mb-0.5">Booking Validation Alert</p>
            <p className="text-rose-300 font-medium">{bookingError}</p>
          </div>
          <button onClick={() => setBookingError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Box 1: Crop Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            1. Crop & Procurement Details
          </span>
          <span className="text-xs text-emerald-400 font-medium">Step 1 of 2</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Crop Commodity</label>
            <select value={cropType} onChange={(e) => setCropType(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium">
              <option value="Wheat (Sharbati)">Wheat (Sharbati)</option>
              <option value="Paddy (Dhan)">Paddy (Dhan)</option>
              <option value="Cotton">Cotton (Kapas)</option>
              <option value="Soyabean">Soyabean (Yellow)</option>
              <option value="Mustard">Mustard (Sarson)</option>
              <option value="Maize">Maize (Makka)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Variety / Grade</label>
            <input type="text" value={variety} onChange={(e) => setVariety(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium" placeholder="e.g. Sharbati Gold" />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-400 font-medium">Estimated Harvest Quantity</label>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {quantity} Quintals (~{(quantity * 100).toLocaleString('en-IN')} kg)
            </span>
          </div>
          <input type="range" min="5" max="150" step="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>5 Qtl</span>
            <span>Est. Govt MSP: ₹{(quantity * getMsp(cropType)).toLocaleString('en-IN')}</span>
            <span>150 Qtl</span>
          </div>
        </div>
      </div>

      {/* Box 2: AI Recommendation */}
      <div className="bg-gradient-to-br from-emerald-950/70 via-slate-900 to-teal-950/70 border-2 border-emerald-500/60 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-emerald-300 uppercase tracking-wider block">
                AI SMART SLOT RECOMMENDATION
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Procurement Load Score: <span className="text-emerald-400 font-bold">Optimal / Low Congestion</span>
              </span>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
            RECOMMENDED
          </span>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-heading font-bold text-base text-white">
                {recommendedCentre.name}
              </h4>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{recommendedCentre.distanceKm} km distance from your farm</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase block">Expected Wait</span>
              <span className="text-emerald-400 font-extrabold text-base">~{recommendedCentre.waitTimeMin} mins</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block">Available Slot</span>
              <span className="font-bold text-amber-300">
                {isSlotLoading ? 'Calculating...' : `${dynamicDate}, ${dynamicTime}`}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block">Current Queue</span>
              <span className="font-bold text-emerald-400">{recommendedCentre.currentQueue} farmers</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block">Congestion Level</span>
              <span className="font-bold text-emerald-400">{recommendedCentre.congestion || 'LOW'}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="text-emerald-400 font-semibold block flex items-center gap-1">
              <Info className="w-3 h-3" />
              Dynamic Slot Calculation
            </span>
            <p className="text-[11px] text-slate-300 leading-snug">
              KisanFlow allocates precise time blocks based on crop volume. Larger harvests automatically reserve wider operating windows to prevent bottlenecking.
            </p>
          </div>

          <button
            onClick={() => handleBook(recommendedCentre.id, dynamicTime, false, dynamicDate)}
            disabled={isBooking || isSlotLoading}
            className={`w-full font-heading font-extrabold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${
              isBooking || isSlotLoading
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-950/50 active:scale-98 cursor-pointer'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${isBooking || isSlotLoading ? 'fill-slate-700' : 'fill-slate-950'} text-white`} />
            <span>{isBooking ? 'Processing Booking...' : 'Book Recommended Slot'}</span>
          </button>
        </div>
      </div>

      {/* Box 3: Nearby Mandis */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            All Nearby Mandi Centres
          </span>
          <button
            onClick={() => setIsCustomMode(!isCustomMode)}
            className="text-xs text-emerald-400 font-medium hover:underline"
          >
            {isCustomMode ? 'Hide Custom Pick' : 'Choose Manually'}
          </button>
        </div>

        <div className="space-y-2.5">
          {centres.map(centre => {
            const isRec = centre.id === recommendedCentre.id; 
            const isHigh = centre.congestion === 'HIGH';

            return (
              <div
                key={centre.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isRec 
                    ? 'bg-emerald-950/20 border-emerald-500/50' 
                    : isHigh
                      ? 'bg-slate-900/80 border-rose-900/40 opacity-90'
                      : 'bg-slate-800/40 border-slate-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-white">
                        {centre.name}
                      </span>
                      {isRec && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                          BEST
                        </span>
                      )}
                      {isHigh && (
                        <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                          AVOID (HIGH RUSH)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">
                      {centre.distanceKm} km away • {centre.address}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-300 block">
                      Queue: <strong className={isHigh ? 'text-rose-400' : 'text-emerald-400'}>{centre.currentQueue}</strong>
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Wait: ~{centre.waitTimeMin}m
                    </span>
                  </div>
                </div>

                {isCustomMode && (
                  <div className="mt-3 pt-3 border-t border-slate-700/40 space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block mb-1">Select Date</label>
                        <input 
                          type="date"
                          min={todayISO}
                          value={manualDate} 
                          onChange={(e) => {
                            setManualDate(e.target.value);
                            setManualTime(''); 
                          }}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block mb-1">Select Time</label>
                        <select 
                          value={manualTime} 
                          onChange={(e) => setManualTime(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="" disabled>Select an open slot</option>
                          {/* 🔥 THE FIX: Passes the exact building ID to check its specific load */}
                          {getAvailableManualTimes(centre.id).length > 0 ? (
                            getAvailableManualTimes(centre.id).map(time => (
                              <option key={time} value={time}>{time}</option>
                            ))
                          ) : (
                            <option value="" disabled>Fully Booked Today</option>
                          )}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBook(centre.id, manualTime, true, manualDate)}
                      disabled={isBooking || !manualTime}
                      className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                    >
                      {isBooking ? 'Processing...' : 'Confirm Manual Booking'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};