import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  FarmerProfile, 
  ProcurementCentre, 
  SlotBooking, 
  NotificationItem, 
  SlotRecoveryOffer, 
  HourlyForecast, 
  QueueStage, 
  Language,
  GrievanceTicket,
  AdminUser,
  FarmerTokenData
} from '../types';
import { 
  initialFarmer, 
  initialCentres, 
  initialBookings, 
  initialHourlyForecast, 
  initialNotifications 
} from '../data/initialData';
import { translations } from '../utils/translations';
import { supabase } from '../utils/supabase';

interface KisanFlowContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (typeof translations)['en'];
  viewMode: 'DUAL' | 'FARMER' | 'ADMIN';
  setViewMode: (mode: 'DUAL' | 'FARMER' | 'ADMIN') => void;
  farmer: FarmerProfile;
  centres: ProcurementCentre[];
  selectedCentreId: string;
  setSelectedCentreId: (id: string) => void;
  bookings: SlotBooking[];
  notifications: NotificationItem[];
  recoveryOffer: SlotRecoveryOffer | null;
  hourlyForecast: HourlyForecast[];
  grievances: GrievanceTicket[];
  isCounter3Open: boolean;
  isSimulating: boolean;
  activeTabFarmer: 'home' | 'book' | 'token' | 'queue' | 'payments' | 'grievance';
  setActiveTabFarmer: (tab: 'home' | 'book' | 'token' | 'queue' | 'payments' | 'grievance') => void;
  selectedTokenFarmer: FarmerTokenData | null;
  setSelectedTokenFarmer: (token: FarmerTokenData | null) => void;
  ivrModalOpen: boolean;
  setIvrModalOpen: (open: boolean) => void;
  isGateScannerOpen: boolean;
  setGateScannerOpen: (open: boolean) => void;
  scannerTargetToken: string | null;
  openGateScanner: (targetToken?: string | null) => void;
  closeGateScanner: () => void;

  // Authentication states & actions
  isFarmerAuthenticated: boolean;
  isAdminAuthenticated: boolean;
  adminUser: AdminUser | null;
  farmerLogin: (mobile: string, otp: string) => void;
  farmerRegister: (profile: FarmerProfile) => void;
  farmerLogout: () => void;
  adminLogin: (officerId: string, password: string, centreId: string, role: AdminUser['role']) => void;
  adminLogout: () => void;
  quickDemoLoginBoth: () => void;
  
  // Actions
  bookNewSlot: (data: {
    centreId: string;
    cropType: string;
    variety: string;
    estimatedQuantity: number;
    bookingDate: string;
    slotTime: string;
    tokenNumber?: string;
    skipDbInsert?: boolean;
  }) => SlotBooking;
  checkInFarmer: (tokenId: string) => void;
  advanceFarmerStage: (tokenId: string, nextStage: QueueStage) => void;
  markNoShow: (tokenId: string) => void;
  cancelBooking: (tokenNumber: string) => Promise<void>;
  refreshBookings: () => Promise<void>;
  updateTokenStatus: (tokenNumber: string, status: string) => void;
  acceptRecoveryOffer: () => void;
  declineRecoveryOffer: () => void;
  completeProcurementModal: (tokenId: string, actualQuantity: number, grade: 'Grade A' | 'Grade B' | 'Standard', customPayout?: number, moisture?: number) => void;
  openExtraCounter: (centreId: string) => void;
  redistributeToCentreC: () => void;
  submitGrievance: (category: GrievanceTicket['category'], details: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearAllNotifications: () => void;
  deleteNotification: (id: string) => void;
  triggerQuickScenario: (scenario: 'CHECKIN' | 'NOSHOW' | 'ADVANCE' | 'RUSH' | 'COMPLETE') => void;
}

const KisanFlowContext = createContext<KisanFlowContextType | undefined>(undefined);

export const KisanFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [viewMode, setViewMode] = useState<'DUAL' | 'FARMER' | 'ADMIN'>('DUAL');
  const [farmer, setFarmer] = useState<FarmerProfile>(initialFarmer);
  const [centres, setCentres] = useState<ProcurementCentre[]>(initialCentres);
  const [selectedCentreId, setSelectedCentreId] = useState<string>('centre-a');
  const [bookings, setBookings] = useState<SlotBooking[]>(initialBookings);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [recoveryOffer, setRecoveryOffer] = useState<SlotRecoveryOffer | null>(null);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecast[]>(initialHourlyForecast);
  const [grievances, setGrievances] = useState<GrievanceTicket[]>([]);
  const [isCounter3Open, setIsCounter3Open] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTabFarmer, setActiveTabFarmer] = useState<'home' | 'book' | 'token' | 'queue' | 'payments' | 'grievance'>('home');
  const [selectedTokenFarmer, setSelectedTokenFarmer] = useState<FarmerTokenData | null>(null);
  const [ivrModalOpen, setIvrModalOpen] = useState(false);
  const [isGateScannerOpen, setGateScannerOpen] = useState(false);
  const [scannerTargetToken, setScannerTargetToken] = useState<string | null>(null);

  const openGateScanner = (targetToken?: string | null) => {
    setScannerTargetToken(targetToken || null);
    setGateScannerOpen(true);
  };

  const closeGateScanner = () => {
    setGateScannerOpen(false);
    setScannerTargetToken(null);
  };

  // Authentication states
  const [isFarmerAuthenticated, setIsFarmerAuthenticated] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // Sound chime synthesizer
  const playChime = (type: 'notification' | 'alert' | 'success') => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'notification') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'alert') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(349.23, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      }
    } catch {
      // AudioContext might be blocked until user interaction
    }
  };

  // Add notification
  const addNotification = (title: string, message: string, type: NotificationItem['type']) => {
    const newItem: NotificationItem = {
      id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: 'Just now',
      title,
      message,
      type,
      read: false,
    };
    setNotifications(prev => [newItem, ...prev]);
    playChime(type === 'turn_alert' || type === 'recovery' ? 'alert' : 'notification');
  };

  // Keep latest farmer and bookings accessible in realtime listeners without stale closures
  const farmerRef = useRef(farmer);
  farmerRef.current = farmer;

  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;

  // Track recent notified events to prevent duplicate audio/notifications on rapid bursts
  const notifiedEventsRef = useRef<Set<string>>(new Set());

  // Keep latest centres accessible in realtime listeners without stale closures
  const centresRef = useRef(centres);
  centresRef.current = centres;

  // Sync initial tokens and centres, calculating dynamic center queues based on real active tokens
  const loadSupabaseData = useCallback(async () => {
    try {
      // 1. Fetch all rows from centres table
      const { data: centresDbData, error: centresError } = await supabase
        .from('centres')
        .select('*');

      if (centresError) {
        console.warn("Notice fetching centres from Supabase:", centresError.message);
      }

      // 2. Query tokens table to get active tokens ('BOOKED', 'CHECKED_IN', 'PROCESSING')
      const { data: tokensData, error: tokensError } = await supabase
        .from('tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (tokensError) {
        console.error("Supabase tokens query error:", tokensError);
      }

      // Count active tokens per center
      const activeCountByCentre: Record<string, number> = {};
      if (tokensData && tokensData.length > 0) {
        tokensData.forEach((token: any) => {
          const status = (token.status || '').toUpperCase();
          if (status === 'BOOKED' || status === 'CHECKED_IN' || status === 'PROCESSING') {
            const centreId = token.centre_id;
            if (centreId) {
              activeCountByCentre[centreId] = (activeCountByCentre[centreId] || 0) + 1;
            }
          }
        });
      }

      // 3. Map over fetched centres (or initialCentres if table empty/inaccessible) and dynamically calculate queue metrics
      const baseCentres = (centresDbData && centresDbData.length > 0)
        ? centresDbData.map((dbRow: any) => {
            const existing = initialCentres.find(c => c.id === dbRow.id) || initialCentres[0];
            return {
              ...existing,
              id: dbRow.id,
              name: dbRow.name || existing.name,
              address: dbRow.address || existing.address,
              district: dbRow.district || existing.district,
              code: dbRow.code || existing.code,
              distanceKm: dbRow.distance_km ?? existing.distanceKm,
              maxDailyCapacity: dbRow.max_daily_capacity ?? existing.maxDailyCapacity,
              todayBooked: dbRow.today_booked ?? existing.todayBooked,
              todayArrived: dbRow.today_arrived ?? existing.todayArrived,
              todayProcessing: dbRow.today_processing ?? existing.todayProcessing,
              todayCompleted: dbRow.today_completed ?? existing.todayCompleted,
              todayWaiting: dbRow.today_waiting ?? existing.todayWaiting,
              todayNoShow: dbRow.today_no_show ?? existing.todayNoShow,
              activeCounters: Number(dbRow.active_counters) > 0 ? Number(dbRow.active_counters) : existing.activeCounters,
              totalCounters: Number(dbRow.total_counters) > 0 ? Number(dbRow.total_counters) : existing.totalCounters,
              isOpen: dbRow.is_open ?? existing.isOpen,
            };
          })
        : initialCentres;

      const updatedCentres: ProcurementCentre[] = baseCentres.map((centre) => {
        // Dynamic active queue count
        const liveActiveQueue = activeCountByCentre[centre.id] ?? 0;
        
        // Dynamic congestion: > 25 HIGH, > 10 MODERATE, else LOW
        const congestionLevel: 'LOW' | 'MODERATE' | 'HIGH' =
          liveActiveQueue > 25 ? 'HIGH' : liveActiveQueue > 10 ? 'MODERATE' : 'LOW';

        // Dynamic wait time: (currentQueue * 15) / active_counters
        const activeCounters = Math.max(1, centre.activeCounters || 1);
        const dynamicWaitTime = Math.round((liveActiveQueue * 15) / activeCounters);

        return {
          ...centre,
          currentQueue: liveActiveQueue,
          congestion: congestionLevel,
          waitTimeMin: dynamicWaitTime,
          todayWaiting: liveActiveQueue,
        };
      });

      setCentres(updatedCentres);

      // 4. Map tokens to SlotBooking state
      if (!tokensError && tokensData && tokensData.length > 0) {
        const mappedBookings: SlotBooking[] = tokensData.map((row: any) => {
          const targetCentre = updatedCentres.find(c => c.id === row.centre_id);
          const centreName = targetCentre 
            ? targetCentre.name 
            : row.centre_id === 'centre-b' 
              ? 'Centre B — Nashik Wholesale Market (Maharashtra)' 
              : row.centre_id === 'centre-c' 
                ? 'Centre C — Ludhiana FCI Hub (Punjab)' 
                : 'Centre A — Karnal Central Yard (Haryana)';

          return {
            id: row.id || `b-${Date.now()}`,
            tokenNumber: row.token_number,
            farmerId: row.farmer_id || 'KF-FARMER',
            farmerName: row.farmer_name || 'Farmer',
            mobile: row.mobile || '',
            village: row.village || 'Taraori',
            centreId: row.centre_id || 'centre-a',
            centreName,
            cropType: row.crop_type || 'Wheat (Sharbati)',
            variety: row.variety || 'Sharbati Gold',
            estimatedQuantity: Number(row.estimated_quantity) || 30,
            bookingDate: row.slot_date || 'Today',
            slotTime: row.slot_time || '10:00 AM',
            status: ((row.status === 'CHECKED_IN' ? 'ARRIVED' : row.status) === 'PROCESSING' || row.status === 'PROCESSING')
              ? (row.moisture_percent !== undefined && row.moisture_percent !== null ? 'TESTED' : (row.actual_weight || row.actual_quantity ? 'WEIGHED' : 'PROCESSING'))
              : (row.status === 'CHECKED_IN' ? 'ARRIVED' : row.status) as any,
            queuePosition: 1,
            predictedWaitMin: targetCentre ? targetCentre.waitTimeMin : 15,
            actualQuantity: row.actual_quantity ? Number(row.actual_quantity) : undefined,
            qualityGrade: row.quality_grade,
            mspRatePerQtl: 2183,
            totalAmount: Number(row.total_amount) || 0,
            paymentStatus: row.status === 'COMPLETED' ? 'CREDITED' : 'PENDING',
            checkInOtp: `${Math.floor(1000 + Math.random() * 9000)}`,
            assignedCounter: row.assigned_counter,
            weighbridgeNumber: row.weighbridge_number,
            createdAt: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
          };
        });

        // Preserve any cancelled or locally progressed bookings from prev state
        setBookings(prev => {
          const merged = mappedBookings.map(mb => {
            const existing = prev.find(p => p.tokenNumber === mb.tokenNumber || p.id === mb.id);
            if (!existing) return mb;
            if ((existing.status === 'WEIGHED' || existing.status === 'TESTED') && mb.status === 'PROCESSING') {
              return { ...mb, status: existing.status };
            }
            return mb;
          });
          const cancelledExtra = prev.filter(b => b.status === 'CANCELLED' && !merged.some(m => m.tokenNumber === b.tokenNumber));
          return [...merged, ...cancelledExtra];
        });
      }
    } catch (error) {
      console.warn("Notice loading bookings from Supabase:", error);
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    await loadSupabaseData();
  }, [loadSupabaseData]);

  const updateTokenStatus = useCallback((tokenNumber: string, status: string) => {
    setBookings(prev => prev.map(b => {
      if (b.tokenNumber === tokenNumber || b.id === tokenNumber) {
        return {
          ...b,
          status: status as any,
        };
      }
      return b;
    }));
  }, []);

  useEffect(() => {
    loadSupabaseData();

    window.addEventListener('kisanflow:tokens-updated', loadSupabaseData);

    // Global real-time Supabase listener on tokens table for instant alerts across all tabs
    const channel = supabase
      .channel('kisanflow-context-global-tokens')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, (payload: any) => {
        const currentFarmer = farmerRef.current;
        const currentBookings = bookingsRef.current;
        const record = payload.new || payload.old || {};
        const eventType = payload.eventType;

        if (record && (eventType === 'UPDATE' || eventType === 'INSERT')) {
          const status = (record.status || '').toUpperCase();
          const tokenNumber = record.token_number || '';
          const farmerId = record.farmer_id || '';
          const centreId = record.centre_id || '';
          const eventKey = `${tokenNumber}-${status}-${record.updated_at || Date.now()}`;

          // Condition 1: PROCESSING status for logged-in farmer
          if (status === 'PROCESSING' && farmerId === currentFarmer.id) {
            const dedupeKey = `proc-${tokenNumber}`;
            if (!notifiedEventsRef.current.has(dedupeKey)) {
              notifiedEventsRef.current.add(dedupeKey);
              const counterInfo = record.assigned_counter ? ` at ${record.assigned_counter}` : '';
              const weighInfo = record.weighbridge_number ? ` (${record.weighbridge_number})` : '';
              addNotification(
                'Gate & Counter Call',
                `Your turn has arrived! Please proceed to the assigned weighbridge${counterInfo || weighInfo}.`,
                'turn_alert'
              );
            }
          }

          // Condition 2: COMPLETED status for logged-in farmer
          else if (status === 'COMPLETED' && farmerId === currentFarmer.id) {
            const dedupeKey = `comp-${tokenNumber}`;
            if (!notifiedEventsRef.current.has(dedupeKey)) {
              notifiedEventsRef.current.add(dedupeKey);
              const formattedAmt = record.total_amount 
                ? `₹${Number(record.total_amount).toLocaleString('en-IN')}` 
                : '₹64,268';
              addNotification(
                'Procurement Completed',
                `Procurement complete. DBT Payment of ${formattedAmt} has been initiated directly to your Aadhaar-linked bank account.`,
                'payment'
              );
            }
          }

          // Condition 3: NO_SHOW for another farmer at the same centre where current farmer is CHECKED_IN
          else if (status === 'NO_SHOW' && farmerId !== currentFarmer.id) {
            const dedupeKey = `noshow-${tokenNumber}-${centreId}`;
            if (!notifiedEventsRef.current.has(dedupeKey)) {
              notifiedEventsRef.current.add(dedupeKey);
              // Check if logged-in farmer has an active CHECKED_IN (or ARRIVED) booking in this centre
              const hasCheckedInBooking = currentBookings.some(
                b => b.farmerId === currentFarmer.id && 
                     b.centreId === centreId && 
                     (b.status === 'ARRIVED' || (b.status as string) === 'CHECKED_IN')
              );

              if (hasCheckedInBooking) {
                addNotification(
                  'Queue Movement Update',
                  'Queue Update: A slot ahead of you opened up. Your estimated wait time has been reduced!',
                  'recovery'
                );
              }
            }
          }
        }

        // Re-sync bookings
        loadSupabaseData();
      })
      .subscribe();

    return () => {
      window.removeEventListener('kisanflow:tokens-updated', loadSupabaseData);
      supabase.removeChannel(channel);
    };
  }, []);

  const t = translations[language];

  // Book new slot
  const bookNewSlot = (data: {
    centreId: string;
    cropType: string;
    variety: string;
    estimatedQuantity: number;
    bookingDate: string;
    slotTime: string;
    tokenNumber?: string;
    skipDbInsert?: boolean;
  }): SlotBooking => {
    const centre = centres.find(c => c.id === data.centreId) || centres[0];
    const tokenNumber = data.tokenNumber || `KF-${Math.floor(10000 + Math.random() * 90000)}`;
    const getCropMsp = (crop: string) => {
      const c = (crop || '').toLowerCase();
      if (c.includes('wheat')) return 2275;
      if (c.includes('cotton')) return 6620;
      if (c.includes('soya') || c.includes('soybean')) return 4600;
      if (c.includes('mustard')) return 5650;
      if (c.includes('maize')) return 2090;
      return 2183;
    };
    const mspRate = getCropMsp(data.cropType);
    const totalAmount = data.estimatedQuantity * mspRate;

    const newBooking: SlotBooking = {
      id: `b-${Date.now()}`,
      tokenNumber,
      farmerId: farmer.id,
      farmerName: farmer.name,
      mobile: farmer.mobile,
      village: farmer.village,
      centreId: centre.id,
      centreName: centre.name,
      cropType: data.cropType,
      variety: data.variety,
      estimatedQuantity: data.estimatedQuantity,
      bookingDate: data.bookingDate,
      slotTime: data.slotTime,
      status: 'BOOKED',
      queuePosition: centre.currentQueue + 1,
      predictedWaitMin: Math.max(15, (centre.currentQueue + 1) * 3.5),
      mspRatePerQtl: mspRate,
      totalAmount,
      paymentStatus: 'PENDING',
      checkInOtp: `${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: 'Just now',
    };

    setBookings(prev => [newBooking, ...prev]);
    
    // Background async insert to Supabase tokens table (only if not already inserted by submitToken)
    if (!data.skipDbInsert) {
      supabase.from('tokens').insert([{
        token_number: tokenNumber,
        centre_id: data.centreId,
        farmer_id: farmer.id,
        farmer_name: farmer.name,
        mobile: farmer.mobile,
        village: farmer.village,
        crop_type: data.cropType,
        variety: data.variety,
        slot_date: data.bookingDate,
        slot_time: data.slotTime,
        estimated_quantity: data.estimatedQuantity,
        total_amount: totalAmount,
        status: 'BOOKED'
      }]).then(
        ({ error }) => {
          if (error) console.warn('Supabase token booking sync notice:', error.message);
        },
        () => {}
      );
    }

    // Update centre stats
    setCentres(prev => prev.map(c => {
      if (c.id === data.centreId) {
        return {
          ...c,
          todayBooked: c.todayBooked + 1,
          currentQueue: c.currentQueue + 1,
        };
      }
      return c;
    }));

    addNotification(
      'Slot Booked Successfully!',
      `Digital Token ${tokenNumber} issued for ${centre.name} at ${data.slotTime}.`,
      'reminder'
    );

    setActiveTabFarmer('token');
    return newBooking;
  };

  // Farmer QR Check-In
  const checkInFarmer = async (tokenId: string) => {
    setBookings(prev => prev.map(b => {
      if (b.tokenNumber === tokenId || b.id === tokenId) {
        return {
          ...b,
          status: 'ARRIVED',
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return b;
    }));

    // Update Supabase
    try {
      const { error } = await supabase
        .from('tokens')
        .update({ status: 'CHECKED_IN' })
        .eq('token_number', tokenId);

      if (error) {
        console.error("Supabase Action Error:", error);
      }
    } catch (error) {
      console.error("Supabase Action Error:", error);
    }

    // Update centre
    setCentres(prev => prev.map(c => {
      if (c.id === selectedCentreId) {
        return {
          ...c,
          todayArrived: c.todayArrived + 1,
          todayWaiting: c.todayWaiting + 1,
        };
      }
      return c;
    }));

    addNotification(
      'Arrival Confirmed at Gate',
      `Token ${tokenId} verified. You are now entered into the live Mandi queue.`,
      'status'
    );
    window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
  };

  // Advance Farmer Stage (Admin action)
  const advanceFarmerStage = async (tokenId: string, nextStage: QueueStage) => {
    setBookings(prev => prev.map(b => {
      if (b.tokenNumber === tokenId || b.id === tokenId) {
        return {
          ...b,
          status: nextStage,
          ...(nextStage === 'WEIGHING' || nextStage === 'WEIGHED' ? { assignedCounter: 'Counter 1', weighbridgeNumber: 'WB-01' } : {}),
          ...(nextStage === 'PROCESSING' || nextStage === 'TESTED' ? { assignedCounter: isCounter3Open ? 'Counter 3' : 'Counter 2' } : {})
        };
      }
      return b;
    }));

    // Update Supabase with database enum compliant status (PostgreSQL token_status)
    const stageStr = String(nextStage);
    const dbStatus = (stageStr === 'WEIGHING' || stageStr === 'WEIGHED' || stageStr === 'TESTED' || stageStr === 'QUALITY_CHECK')
      ? 'PROCESSING'
      : (stageStr === 'ARRIVED' ? 'CHECKED_IN' : (stageStr === 'PAID' ? 'COMPLETED' : stageStr));

    try {
      const { error } = await supabase
        .from('tokens')
        .update({ 
          status: dbStatus,
          assigned_counter: (nextStage === 'PROCESSING' || nextStage === 'TESTED') ? (isCounter3Open ? 'Counter 3' : 'Counter 2') : 'Counter 1',
          weighbridge_number: (nextStage === 'WEIGHING' || nextStage === 'WEIGHED') ? 'WB-01' : undefined
        })
        .eq('token_number', tokenId);

      if (error) {
        console.warn("Supabase Action Warning:", error.message);
      }
    } catch (error) {
      console.warn("Supabase Action Notice:", error);
    }

    // Check if logged in farmer's token
    const myToken = bookings.find(b => (b.tokenNumber === tokenId || b.id === tokenId) && b.farmerId === farmer.id);
    if (myToken) {
      if (nextStage === 'WEIGHING') {
        addNotification(
          "You're Called to Weighbridge!",
          `Please proceed to Weighbridge Station WB-01 with your vehicle.`,
          'turn_alert'
        );
      } else if (nextStage === 'QUALITY_CHECK') {
        addNotification(
          'Quality Inspection Ongoing',
          `Moisture & grain purity test in progress at Lab Counter.`,
          'status'
        );
      } else if (nextStage === 'PROCESSING') {
        addNotification(
          'Procurement Processing Active',
          `Procurement officer is verifying documents at Desk 1.`,
          'turn_alert'
        );
      }
    }
    window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
  };

  // Dynamic No-Show Detection & Slot Recovery (Key USP #4)
  const markNoShow = async (tokenId: string) => {
    let vacatedSlotTime = '10:30 AM';
    let vacatedCentreName = 'Centre A — Karnal Central Yard (Haryana)';

    setBookings(prev => prev.map(b => {
      if (b.tokenNumber === tokenId || b.id === tokenId) {
        vacatedSlotTime = b.slotTime;
        vacatedCentreName = b.centreName;
        return {
          ...b,
          status: 'NO_SHOW',
        };
      }
      return b;
    }));

    // Update Supabase
    try {
      const { error } = await supabase
        .from('tokens')
        .update({ status: 'NO_SHOW' })
        .eq('token_number', tokenId);

      if (error) {
        console.warn("Supabase Notice in markNoShow:", error.message);
      }
    } catch (error) {
      console.warn("Notice in markNoShow:", error);
    }

    // Update centre metrics
    setCentres(prev => prev.map(c => {
      if (c.code === 'A102' || c.id === 'centre-a') {
        return {
          ...c,
          todayNoShow: c.todayNoShow + 1,
          currentQueue: Math.max(0, c.currentQueue - 1),
        };
      }
      return c;
    }));

    // Find candidate farmer for slot recovery: Ramesh Kumar (KF-10243) currently booked at 11:30 AM
    const targetFarmerBooking = bookings.find(b => b.farmerId === farmer.id && (b.status === 'BOOKED' || b.status === 'ARRIVED'));
    if (targetFarmerBooking) {
      const offer: SlotRecoveryOffer = {
        id: `offer-${Date.now()}`,
        targetFarmerId: farmer.id,
        tokenNumber: targetFarmerBooking.tokenNumber,
        centreId: targetFarmerBooking.centreId,
        centreName: vacatedCentreName,
        vacatedByToken: tokenId,
        originalSlot: targetFarmerBooking.slotTime,
        offeredSlot: vacatedSlotTime,
        expiresInSeconds: 120,
        active: true,
      };

      setRecoveryOffer(offer);
      addNotification(
        '⚡ Earlier Slot Opportunity Available!',
        `Farmer ${tokenId} did not show up. Move your appointment from ${targetFarmerBooking.slotTime} to ${vacatedSlotTime} to save ~40 mins!`,
        'recovery'
      );
    }
    window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
  };

  // Farmer / Self-Service Slot Cancellation
  const cancelBooking = async (tokenNumber: string) => {
    // 1. Update Supabase: try setting status to CANCELLED
    const { error } = await supabase
      .from('tokens')
      .update({ status: 'CANCELLED' as any })
      .eq('token_number', tokenNumber);

    if (error) {
      // If Postgres enum 'token_status' in remote Supabase does not have 'CANCELLED' (22P02)
      if (
        error.code === '22P02' ||
        error.message?.includes('token_status') ||
        error.message?.includes('invalid input value')
      ) {
        // Fallback: delete the token row from Supabase to free the slot cleanly
        const { error: delError } = await supabase
          .from('tokens')
          .delete()
          .eq('token_number', tokenNumber);

        if (delError) {
          console.error("Supabase fallback deletion error on cancellation:", delError);
          throw delError;
        }
      } else {
        console.error("Supabase Action Error cancelling token:", error);
        throw error;
      }
    }

    // 2. Instantly update local React bookings state
    setBookings(prev => prev.map(b => {
      if (b.tokenNumber === tokenNumber || b.id === tokenNumber) {
        return {
          ...b,
          status: 'CANCELLED',
        };
      }
      return b;
    }));

    // 3. Decrement queue & booked count on the relevant centre
    setCentres(prev => prev.map(c => {
      if (c.id === selectedCentreId || c.code === 'A102') {
        return {
          ...c,
          todayBooked: Math.max(0, c.todayBooked - 1),
          currentQueue: Math.max(0, c.currentQueue - 1),
        };
      }
      return c;
    }));

    addNotification(
      'Slot Cancelled',
      `Your booking for token ${tokenNumber} has been successfully cancelled. The slot has been released.`,
      'status'
    );

    // Notify listeners / real-time channels
    window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
  };

  // Accept slot recovery offer
  const acceptRecoveryOffer = () => {
    if (!recoveryOffer) return;
    const newSlotTime = recoveryOffer.offeredSlot;

    setBookings(prev => prev.map(b => {
      if (b.farmerId === farmer.id && b.tokenNumber === recoveryOffer.tokenNumber) {
        return {
          ...b,
          slotTime: newSlotTime,
          queuePosition: 2,
          predictedWaitMin: 10,
        };
      }
      return b;
    }));

    setRecoveryOffer(null);
    playChime('success');
    addNotification(
      'Slot Rescheduled Earlier!',
      `Your slot is updated to ${newSlotTime}. Queue position advanced to #2!`,
      'status'
    );
  };

  const declineRecoveryOffer = () => {
    setRecoveryOffer(null);
  };

  // Complete Procurement Modal
  const completeProcurementModal = async (
    tokenId: string, 
    actualQuantity: number, 
    grade: 'Grade A' | 'Grade B' | 'Standard',
    customPayout?: number,
    moisture?: number
  ) => {
    const mspRate = grade === 'Grade A' ? 2203 : 2183;
    const finalAmount = customPayout !== undefined ? customPayout : Math.round(actualQuantity * mspRate);
    const dbtRef = `PFMS-DBT-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    setBookings(prev => prev.map(b => {
      if (b.tokenNumber === tokenId || b.id === tokenId) {
        return {
          ...b,
          status: 'COMPLETED',
          actualQuantity,
          actualWeight: actualQuantity,
          moisturePercent: moisture,
          finalPayout: finalAmount,
          qualityGrade: grade,
          mspRatePerQtl: mspRate,
          totalAmount: finalAmount,
          paymentStatus: 'CREDITED',
          paymentRef: dbtRef,
          completedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return b;
    }));

    // Update Supabase
    try {
      const { error } = await supabase
        .from('tokens')
        .update({
          status: 'COMPLETED',
          actual_quantity: actualQuantity,
          actual_weight: actualQuantity,
          moisture_percent: moisture,
          final_payout: finalAmount,
          quality_grade: grade,
          total_amount: finalAmount,
        })
        .eq('token_number', tokenId);

      if (error) {
        console.warn("Supabase Notice during token completion:", error.message);
      }
    } catch (error) {
      console.warn("Notice during token completion:", error);
    }

    setCentres(prev => prev.map(c => {
      if (c.code === 'A102' || c.id === 'centre-a') {
        return {
          ...c,
          todayCompleted: c.todayCompleted + 1,
          todayProcessing: Math.max(0, c.todayProcessing - 1),
          currentQueue: Math.max(0, c.currentQueue - 1),
        };
      }
      return c;
    }));

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }

    playChime('success');

    // Notify farmer if it was their booking
    const completedBooking = bookings.find(b => b.tokenNumber === tokenId || b.id === tokenId);
    if (completedBooking && completedBooking.farmerId === farmer.id) {
      addNotification(
        'Procurement Completed & Payment Credited!',
        `₹${finalAmount.toLocaleString('en-IN')} has been transferred via DBT (${dbtRef}) for ${actualQuantity} Quintals.`,
        'payment'
      );
      // Keep LiveTracker mounted so farmer can review final Paid step and exit manually
    }
  };

  // Open Extra Counter (Relieve 1 PM peak congestion)
  const openExtraCounter = (centreId: string) => {
    setIsCounter3Open(true);
    setCentres(prev => prev.map(c => {
      if (c.id === centreId || c.code === 'A102') {
        return {
          ...c,
          activeCounters: Math.min(c.totalCounters, c.activeCounters + 1),
          congestion: 'LOW',
          waitTimeMin: Math.round(c.waitTimeMin * 0.6),
        };
      }
      return c;
    }));

    addNotification(
      'Counter 3 Activated',
      'Additional weighing & document counter opened to absorb peak arrivals.',
      'status'
    );
  };

  // Multi-Centre Load Balancing (Key USP #5)
  const redistributeToCentreC = () => {
    setCentres(prev => prev.map(c => {
      if (c.id === 'centre-a') {
        return {
          ...c,
          currentQueue: Math.max(8, c.currentQueue - 8),
          congestion: 'LOW',
          waitTimeMin: 28,
        };
      }
      if (c.id === 'centre-c') {
        return {
          ...c,
          currentQueue: c.currentQueue + 8,
          todayBooked: c.todayBooked + 8,
          congestion: 'LOW',
        };
      }
      return c;
    }));

    addNotification(
      'AI Smart Load Balancing Executed',
      '8 scheduled farmers redirected to Centre C (Ludhiana FCI Hub), equalizing national queue load.',
      'status'
    );
  };

  // Grievance filing
  const submitGrievance = (category: GrievanceTicket['category'], details: string) => {
    const newGrievance: GrievanceTicket = {
      id: `GRV-${Math.floor(10000 + Math.random() * 90000)}`,
      farmerId: farmer.id,
      farmerName: farmer.name,
      category,
      details,
      status: 'SUBMITTED',
      filedAt: 'Just now',
    };
    setGrievances(prev => [newGrievance, ...prev]);
    addNotification(
      'Grievance Registered',
      `Ticket #${newGrievance.id} submitted. Government Mandi Nodal Officer assigned.`,
      'status'
    );
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Farmer Authentication Handlers
  const farmerLogin = (mobile: string, otp: string) => {
    setIsFarmerAuthenticated(true);
    try {
      localStorage.setItem('kisanflow_role', 'farmer');
    } catch {}
    addNotification('Farmer Verified', `Welcome back, ${farmer.name}!`, 'status');
    playChime('success');
  };

  const farmerRegister = (newProfile: FarmerProfile) => {
    setFarmer(newProfile);
    setIsFarmerAuthenticated(true);
    try {
      localStorage.setItem('kisanflow_role', 'farmer');
    } catch {}
    addNotification('Registration Complete', `New Farmer ID: ${newProfile.id} generated!`, 'status');
    playChime('success');
    confetti({ particleCount: 50, spread: 60 });
  };

  const farmerLogout = () => {
    setIsFarmerAuthenticated(false);
    try {
      if (localStorage.getItem('kisanflow_role') === 'farmer') {
        localStorage.removeItem('kisanflow_role');
      }
    } catch {}
  };

  // Admin Authentication Handlers
  const adminLogin = (officerId: string, password: string, centreId: string, role: AdminUser['role']) => {
    const centre = centres.find(c => c.id === centreId) || centres[0];
    const user: AdminUser = {
      id: officerId,
      name: officerId === 'OFFICER-A102' ? 'Rajendra Singh' : 'Central Nodal Officer',
      designation: role === 'DISTRICT_NODAL' ? 'Regional Nodal Director (Northern Zone)' : 'Central Procurement In-Charge',
      centreId: centre.id,
      centreName: centre.name,
      role,
      badgeNumber: 'GOI-AGRI-8812',
      lastLogin: 'Today, 09:30 AM'
    };
    setAdminUser(user);
    setSelectedCentreId(centre.id);
    setIsAdminAuthenticated(true);
    try {
      localStorage.setItem('kisanflow_role', 'admin');
    } catch {}
    playChime('success');
  };

  const adminLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminUser(null);
    try {
      if (localStorage.getItem('kisanflow_role') === 'admin') {
        localStorage.removeItem('kisanflow_role');
      }
    } catch {}
  };

  const quickDemoLoginBoth = () => {
    setIsFarmerAuthenticated(true);
    adminLogin('OFFICER-A102', 'admin123', 'centre-a', 'CENTRE_OFFICER');
  };

  // Quick Scenario Triggers for Judging / Demo Presentation
  const triggerQuickScenario = async (scenario: 'CHECKIN' | 'NOSHOW' | 'ADVANCE' | 'RUSH' | 'COMPLETE') => {
    // If not authenticated, authenticate automatically so demo flows effortlessly
    if (!isFarmerAuthenticated || !isAdminAuthenticated) {
      quickDemoLoginBoth();
    }

    setIsSimulating(true);
    setTimeout(() => setIsSimulating(false), 800);

    if (scenario === 'CHECKIN') {
      // 1. Gate Check-in: Finds the next 'BOOKED' token and updates it to 'CHECKED_IN'
      try {
        const { data: bookedRows, error: fetchError } = await supabase
          .from('tokens')
          .select('*')
          .eq('status', 'BOOKED')
          .order('created_at', { ascending: true })
          .limit(1);

        if (fetchError) {
          console.warn("Supabase Notice during quick scenario checkin fetch:", fetchError.message);
        }

        const candidate = (bookedRows && bookedRows[0]) || bookings.find(b => b.status === 'BOOKED') || bookings.find(b => b.tokenNumber === 'KF-10243');
        const tokenNum = candidate?.token_number || candidate?.tokenNumber || 'KF-10243';
        const tokenId = candidate?.id;

        const updateQuery = tokenId
          ? supabase.from('tokens').update({ status: 'CHECKED_IN' }).eq('id', tokenId)
          : supabase.from('tokens').update({ status: 'CHECKED_IN' }).eq('token_number', tokenNum);

        const { error: updateError } = await updateQuery;
        if (updateError) {
          console.warn("Supabase Notice during quick scenario checkin update:", updateError.message);
        }

        await checkInFarmer(tokenNum);
      } catch (error) {
        console.warn("Notice during quick scenario checkin:", error);
      }
    } else if (scenario === 'NOSHOW') {
      // 2. No-Show & Slot Recovery: Finds a delayed 'BOOKED' token, updates it to 'NO_SHOW', and logs the slot recovery
      try {
        const { data: bookedRows, error: fetchError } = await supabase
          .from('tokens')
          .select('*')
          .eq('status', 'BOOKED')
          .order('created_at', { ascending: true })
          .limit(1);

        if (fetchError) {
          console.warn("Supabase Notice during quick scenario noshow fetch:", fetchError.message);
        }

        const candidate = (bookedRows && bookedRows[0]) || bookings.find(b => b.status === 'BOOKED') || bookings.find(b => b.tokenNumber === 'KF-10230');
        const tokenNum = candidate?.token_number || candidate?.tokenNumber || 'KF-10230';
        const tokenId = candidate?.id;

        const updateQuery = tokenId
          ? supabase.from('tokens').update({ status: 'NO_SHOW' }).eq('id', tokenId)
          : supabase.from('tokens').update({ status: 'NO_SHOW' }).eq('token_number', tokenNum);

        const { error: updateError } = await updateQuery;
        if (updateError) {
          console.warn("Supabase Notice during quick scenario noshow update:", updateError.message);
        }

        await markNoShow(tokenNum);
      } catch (error) {
        console.warn("Notice during quick scenario noshow:", error);
      }
    } else if (scenario === 'ADVANCE') {
      // 3. Call Next Farmer: Finds the next 'CHECKED_IN' token and updates it to 'PROCESSING', assigning it to an active counter
      try {
        const { data: checkedRows, error: fetchError } = await supabase
          .from('tokens')
          .select('*')
          .eq('status', 'CHECKED_IN')
          .order('created_at', { ascending: true })
          .limit(1);

        if (fetchError) {
          console.warn("Supabase Notice during quick scenario advance fetch:", fetchError.message);
        }

        const candidate = (checkedRows && checkedRows[0]) || bookings.find(b => b.status === 'ARRIVED' || (b.status as any) === 'CHECKED_IN') || bookings[0];
        const tokenNum = candidate?.token_number || candidate?.tokenNumber || 'KF-10243';
        const tokenId = candidate?.id;
        const assignedCounter = isCounter3Open ? 'Counter 3' : 'Counter 1';

        const updateQuery = tokenId
          ? supabase.from('tokens').update({ 
              status: 'PROCESSING', 
              assigned_counter: assignedCounter,
              weighbridge_number: 'WB-01'
            }).eq('id', tokenId)
          : supabase.from('tokens').update({ 
              status: 'PROCESSING', 
              assigned_counter: assignedCounter,
              weighbridge_number: 'WB-01'
            }).eq('token_number', tokenNum);

        const { error: updateError } = await updateQuery;
        if (updateError) {
          console.warn("Supabase Notice during quick scenario advance update:", updateError.message);
        }

        await advanceFarmerStage(tokenNum, 'PROCESSING');
      } catch (error) {
        console.warn("Notice during quick scenario advance:", error);
      }
    } else if (scenario === 'RUSH') {
      // 4. Simulate 1 PM Rush: sets high congestion and alerts
      try {
        setCentres(prev => prev.map(c => c.id === 'centre-a' ? { ...c, congestion: 'HIGH', currentQueue: 28, waitTimeMin: 75 } : c));
        addNotification('High Congestion Peak', 'Arrival rate exceeded 30 farmers/hr at Centre A.', 'turn_alert');

        const { error } = await supabase
          .from('centres')
          .update({ congestion: 'HIGH', current_queue: 28 })
          .eq('id', 'centre-a');

        if (error) {
          console.warn("Supabase Notice during quick scenario rush update:", error.message);
        }
      } catch (error) {
        console.warn("Notice during quick scenario rush:", error);
      }
    } else if (scenario === 'COMPLETE') {
      // 5. Finalize & DBT Pay: Finds a 'PROCESSING' token and updates it to 'COMPLETED', adding a mock final weight and payment amount
      try {
        const { data: procRows, error: fetchError } = await supabase
          .from('tokens')
          .select('*')
          .eq('status', 'PROCESSING')
          .order('created_at', { ascending: true })
          .limit(1);

        if (fetchError) {
          console.warn("Supabase Notice during quick scenario complete fetch:", fetchError.message);
        }

        const candidate = (procRows && procRows[0]) 
          || bookings.find(b => b.status === 'PROCESSING') 
          || bookings.find(b => b.status === 'WEIGHING') 
          || bookings.find(b => b.status === 'ARRIVED') 
          || bookings[0];

        const tokenNum = candidate?.token_number || candidate?.tokenNumber || 'KF-10243';
        const tokenId = candidate?.id;
        const estQty = Number(candidate?.estimated_quantity || candidate?.estimatedQuantity) || 32;
        const actualQty = Math.round((estQty + 0.2) * 100) / 100;
        const mspRate = 2203;
        const totalAmount = Math.round(actualQty * mspRate);

        const updateQuery = tokenId
          ? supabase.from('tokens').update({
              status: 'COMPLETED',
              actual_quantity: actualQty,
              quality_grade: 'Grade A',
              total_amount: totalAmount
            }).eq('id', tokenId)
          : supabase.from('tokens').update({
              status: 'COMPLETED',
              actual_quantity: actualQty,
              quality_grade: 'Grade A',
              total_amount: totalAmount
            }).eq('token_number', tokenNum);

        const { error: updateError } = await updateQuery;
        if (updateError) {
          console.warn("Supabase Notice during quick scenario complete update:", updateError.message);
        }

        await completeProcurementModal(tokenNum, actualQty, 'Grade A');
      } catch (error) {
        console.error("Supabase Action Error:", error);
      }
    }

    window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
  };

  return (
    <KisanFlowContext.Provider
      value={{
        language,
        setLanguage,
        t,
        viewMode,
        setViewMode,
        farmer,
        centres,
        selectedCentreId,
        setSelectedCentreId,
        bookings,
        notifications,
        recoveryOffer,
        hourlyForecast,
        grievances,
        isCounter3Open,
        isSimulating,
        activeTabFarmer,
        setActiveTabFarmer,
        selectedTokenFarmer,
        setSelectedTokenFarmer,
        ivrModalOpen,
        setIvrModalOpen,
        isGateScannerOpen,
        setGateScannerOpen,
        scannerTargetToken,
        openGateScanner,
        closeGateScanner,
        isFarmerAuthenticated,
        isAdminAuthenticated,
        adminUser,
        farmerLogin,
        farmerRegister,
        farmerLogout,
        adminLogin,
        adminLogout,
        quickDemoLoginBoth,
        bookNewSlot,
        checkInFarmer,
        advanceFarmerStage,
        markNoShow,
        cancelBooking,
        refreshBookings,
        updateTokenStatus,
        acceptRecoveryOffer,
        declineRecoveryOffer,
        completeProcurementModal,
        openExtraCounter,
        redistributeToCentreC,
        submitGrievance,
        markNotificationRead,
        markAllNotificationsRead,
        clearAllNotifications,
        deleteNotification,
        triggerQuickScenario,
      }}
    >
      {children}
    </KisanFlowContext.Provider>
  );
};

export const useKisanFlow = () => {
  const context = useContext(KisanFlowContext);
  if (!context) {
    throw new Error('useKisanFlow must be used within a KisanFlowProvider');
  }
  return context;
};
