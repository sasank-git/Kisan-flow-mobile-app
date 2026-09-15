import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Scale, 
  FlaskConical, 
  FileText, 
  CreditCard, 
  UserX, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Database,
  Plus,
  Check,
  QrCode,
  Building2,
  X,
  Percent,
  Coins,
  ShieldCheck,
  ArrowRight,
  Info
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { SlotBooking } from '../../types';
import { ProcurementCompleteModal } from './ProcurementCompleteModal';

export interface SupabaseToken {
  id: string;
  token_number: string;
  centre_id?: string;
  farmer_id: string;
  farmer_name: string;
  mobile: string;
  village: string;
  crop_type: string;
  variety?: string;
  slot_date: string;
  slot_time: string;
  estimated_quantity: number;
  actual_quantity?: number | null;
  actual_weight?: number | null;
  moisture_percent?: number | null;
  final_payout?: number | null;
  quality_grade?: string | null;
  total_amount: number;
  status: string;
  assigned_counter?: string | null;
  weighbridge_number?: string | null;
  created_at?: string;
}

export interface DbtCalculationData {
  token: SupabaseToken;
  actualWeight: number;
  commodityMsp: number;
  baseValue: number;
  moisturePercent: number;
  excessMoisture: number;
  deductionPercent: number;
  deductionAmount: number;
  finalPayout: number;
}

export const getCommodityMsp = (cropType: string): number => {
  const crop = (cropType || '').toLowerCase();
  if (crop.includes('wheat')) return 2275;
  if (crop.includes('cotton')) return 6620;
  if (crop.includes('soya') || crop.includes('soybean')) return 4600;
  if (crop.includes('mustard')) return 5650;
  if (crop.includes('maize')) return 2090;
  if (crop.includes('paddy') || crop.includes('dhan') || crop.includes('rice')) return 2183;
  return 2183;
};

export const LiveQueueTable: React.FC = () => {
  const { 
    selectedCentreId, 
    centres, 
    advanceFarmerStage, 
    markNoShow, 
    checkInFarmer, 
    completeProcurementModal, 
    isCounter3Open, 
    openGateScanner,
    refreshBookings
  } = useKisanFlow();

  const currentCentre = centres.find(c => c.id === selectedCentreId) || centres[0];

  // State populated strictly from Supabase database
  const [tokens, setTokens] = useState<SupabaseToken[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [filterStage, setFilterStage] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookingForPay, setSelectedBookingForPay] = useState<SlotBooking | null>(null);

  // Modal 1: Weighbridge Modal State
  const [weighModalToken, setWeighModalToken] = useState<SupabaseToken | null>(null);
  const [actualWeightInput, setActualWeightInput] = useState<string>('');
  const [isSubmittingWeigh, setIsSubmittingWeigh] = useState<boolean>(false);

  // Modal 2: Quality Assay Modal State
  const [assayModalToken, setAssayModalToken] = useState<SupabaseToken | null>(null);
  const [moistureInput, setMoistureInput] = useState<string>('12.0');
  const [isSubmittingAssay, setIsSubmittingAssay] = useState<boolean>(false);

  // Modal 3: Finalize & DBT Dynamic Calculation Modal State
  const [dbtModalData, setDbtModalData] = useState<DbtCalculationData | null>(null);
  const [isExecutingDbt, setIsExecutingDbt] = useState<boolean>(false);

  // Fetch real tokens from Supabase tokens table
  const fetchTokens = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch error for live queue:', error.message);
        setFetchError(error.message);
      } else if (data) {
        // Update state with fetched database rows, safely preserving locally progressed physical stages
        setTokens(prev => {
          return data.map(dbRow => {
            const existing = prev.find(p => p.token_number === dbRow.token_number || p.id === dbRow.id);

            // Derive stage from DB row attributes when status is PROCESSING
            let resolvedStatus = dbRow.status;
            if (dbRow.status === 'PROCESSING') {
              if (dbRow.moisture_percent !== undefined && dbRow.moisture_percent !== null) {
                resolvedStatus = 'TESTED';
              } else if ((dbRow.actual_weight !== undefined && dbRow.actual_weight !== null && Number(dbRow.actual_weight) > 0) ||
                         (dbRow.actual_quantity !== undefined && dbRow.actual_quantity !== null && Number(dbRow.actual_quantity) > 0)) {
                resolvedStatus = 'WEIGHED';
              }
            }

            if (!existing) return { ...dbRow, status: resolvedStatus };

            // Retain local progression for WEIGHED / TESTED if DB status hasn't caught up
            const isAdvancedLocally = 
              (existing.status === 'WEIGHED' && (dbRow.status === 'CHECKED_IN' || dbRow.status === 'PROCESSING')) ||
              (existing.status === 'TESTED' && (dbRow.status === 'WEIGHED' || dbRow.status === 'PROCESSING' || dbRow.status === 'CHECKED_IN'));

            return {
              ...dbRow,
              actual_weight: existing.actual_weight ?? dbRow.actual_weight ?? dbRow.actual_quantity,
              moisture_percent: existing.moisture_percent ?? dbRow.moisture_percent,
              final_payout: existing.final_payout ?? dbRow.final_payout,
              status: isAdvancedLocally ? existing.status : resolvedStatus,
            };
          });
        });
        setFetchError(null);
      }
    } catch (err: any) {
      console.error('Exception fetching tokens:', err);
      setFetchError(err?.message || 'Error connecting to Supabase');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and subscribe to realtime updates
  useEffect(() => {
    fetchTokens();

    const channel = supabase
      .channel('live-queue-tokens-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        () => {
          fetchTokens();
        }
      )
      .subscribe();

    const handleExternalUpdate = () => {
      fetchTokens();
    };
    window.addEventListener('kisanflow:tokens-updated', handleExternalUpdate);

    // Secondary 4s refresh interval
    const interval = setInterval(() => {
      fetchTokens();
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('kisanflow:tokens-updated', handleExternalUpdate);
      clearInterval(interval);
    };
  }, [fetchTokens]);

  // Seed sample database records if table is initially empty
  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      const sampleTokens = [
        // Centre A - Karnal Central Yard (Haryana)
        { token_number: 'KF-10243', centre_id: 'centre-a', farmer_id: 'KF-R810241', farmer_name: 'Ramesh Kumar', mobile: '+91 98120 44921', village: 'Taraori', crop_type: 'Wheat (Sharbati)', variety: 'Sharbati Gold', slot_date: 'Today', slot_time: '11:30 AM - 12:00 PM', estimated_quantity: 32, status: 'BOOKED', total_amount: 72800 },
        { token_number: 'KF-10237', centre_id: 'centre-a', farmer_id: 'KF-H391029', farmer_name: 'Harpreet Singh', mobile: '+91 98140 23419', village: 'Samrala', crop_type: 'Paddy (Dhan)', variety: 'Basmati 1121', slot_date: 'Today', slot_time: '11:00 AM - 11:30 AM', estimated_quantity: 35, status: 'CHECKED_IN', assigned_counter: 'Counter 2', weighbridge_number: 'WB-02', total_amount: 77105 },
        { token_number: 'KF-10236', centre_id: 'centre-a', farmer_id: 'KF-B948102', farmer_name: 'Balasaheb Patil', mobile: '+91 98220 31892', village: 'Lasalgaon', crop_type: 'Soyabean', variety: 'JS-335', slot_date: 'Today', slot_time: '11:00 AM - 11:30 AM', estimated_quantity: 40, actual_weight: 40.5, actual_quantity: 40.5, status: 'PROCESSING', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 184000 },
        { token_number: 'KF-10238', centre_id: 'centre-a', farmer_id: 'KF-D491028', farmer_name: 'Dilip Patel', mobile: '+91 98250 82103', village: 'Unjha', crop_type: 'Cotton', variety: 'Shankar-6', slot_date: 'Today', slot_time: '11:30 AM - 12:00 PM', estimated_quantity: 25, actual_weight: 25.0, actual_quantity: 25.0, moisture_percent: 11.5, quality_grade: 'Grade A', status: 'PROCESSING', assigned_counter: 'Counter 2', weighbridge_number: 'WB-02', total_amount: 165500 },
        { token_number: 'KF-10234', centre_id: 'centre-a', farmer_id: 'KF-V291032', farmer_name: 'Vikramaditya Chouhan', mobile: '+91 98260 59281', village: 'Sanwer', crop_type: 'Wheat (Sharbati)', variety: 'Lok-1', slot_date: 'Today', slot_time: '10:00 AM - 10:30 AM', estimated_quantity: 28, actual_weight: 28.0, actual_quantity: 28.0, moisture_percent: 11.0, final_payout: 64268, status: 'COMPLETED', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 64268 },
        { token_number: 'KF-10235', centre_id: 'centre-a', farmer_id: 'KF-V102931', farmer_name: 'Venkatesh Rao', mobile: '+91 98480 19283', village: 'Tenali', crop_type: 'Cotton', variety: 'Bt Cotton Long Staple', slot_date: 'Today', slot_time: '10:30 AM - 11:00 AM', estimated_quantity: 30, actual_weight: 30.0, actual_quantity: 30.0, moisture_percent: 11.0, final_payout: 210600, status: 'COMPLETED', assigned_counter: 'Counter 2', weighbridge_number: 'WB-02', total_amount: 210600 },
        { token_number: 'KF-10240', centre_id: 'centre-a', farmer_id: 'KF-J291048', farmer_name: 'Jagdish Meena', mobile: '+91 98290 77210', village: 'Ramganj Mandi', crop_type: 'Soyabean', variety: 'JS-9560', slot_date: 'Today', slot_time: '12:00 PM - 12:30 PM', estimated_quantity: 26, status: 'BOOKED', total_amount: 119600 },
        { token_number: 'KF-10230', centre_id: 'centre-a', farmer_id: 'KF-G192039', farmer_name: 'Gurinder Brar', mobile: '+91 98150 99012', village: 'Rampura Phul', crop_type: 'Wheat (Sharbati)', variety: 'PBW-550', slot_date: 'Today', slot_time: '10:30 AM - 11:00 AM', estimated_quantity: 30, status: 'NO_SHOW', total_amount: 68250 },

        // Centre B - Nashik Wholesale Market (Maharashtra)
        { token_number: 'KF-20101', centre_id: 'centre-b', farmer_id: 'KF-S910249', farmer_name: 'Sanjay Pawar', mobile: '+91 98231 10294', village: 'Niphad', crop_type: 'Soyabean', variety: 'JS-335', slot_date: 'Today', slot_time: '11:00 AM - 11:30 AM', estimated_quantity: 35, status: 'BOOKED', total_amount: 161000 },
        { token_number: 'KF-20102', centre_id: 'centre-b', farmer_id: 'KF-B820194', farmer_name: 'Baburao Shinde', mobile: '+91 98224 55901', village: 'Dindori', crop_type: 'Onion (Garva)', variety: 'Garva Red', slot_date: 'Today', slot_time: '11:30 AM - 12:00 PM', estimated_quantity: 45, status: 'CHECKED_IN', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 99000 },
        { token_number: 'KF-20103', centre_id: 'centre-b', farmer_id: 'KF-P739102', farmer_name: 'Prakash Deshmukh', mobile: '+91 98239 88123', village: 'Yeola', crop_type: 'Wheat (Sharbati)', variety: 'Lok-1', slot_date: 'Today', slot_time: '10:30 AM - 11:00 AM', estimated_quantity: 28, actual_weight: 28.5, actual_quantity: 28.5, status: 'PROCESSING', assigned_counter: 'Counter 2', weighbridge_number: 'WB-02', total_amount: 64268 },
        { token_number: 'KF-20104', centre_id: 'centre-b', farmer_id: 'KF-V930182', farmer_name: 'Vilas More', mobile: '+91 98221 44102', village: 'Sinnar', crop_type: 'Maize (Makka)', variety: 'African Tall', slot_date: 'Today', slot_time: '10:00 AM - 10:30 AM', estimated_quantity: 32, status: 'COMPLETED', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 66880 },
        { token_number: 'KF-20105', centre_id: 'centre-b', farmer_id: 'KF-D102948', farmer_name: 'Dnyaneshwar Gite', mobile: '+91 98233 77419', village: 'Chandwad', crop_type: 'Soyabean', variety: 'JS-9560', slot_date: 'Today', slot_time: '12:00 PM - 12:30 PM', estimated_quantity: 40, actual_weight: 40.0, actual_quantity: 40.0, moisture_percent: 13.0, quality_grade: 'Grade B', status: 'PROCESSING', total_amount: 184000 },

        // Centre C - Ludhiana FCI Hub (Punjab)
        { token_number: 'KF-30101', centre_id: 'centre-c', farmer_id: 'KF-J192039', farmer_name: 'Jaswinder Sandhu', mobile: '+91 98151 22901', village: 'Jagraon', crop_type: 'Paddy (Basmati)', variety: 'Basmati 1121', slot_date: 'Today', slot_time: '11:00 AM - 11:30 AM', estimated_quantity: 50, status: 'BOOKED', total_amount: 110150 },
        { token_number: 'KF-30102', centre_id: 'centre-c', farmer_id: 'KF-M819203', farmer_name: 'Manpreet Dhillon', mobile: '+91 98144 88203', village: 'Khanna', crop_type: 'Wheat (Sharbati)', variety: 'PBW-550', slot_date: 'Today', slot_time: '11:30 AM - 12:00 PM', estimated_quantity: 42, status: 'CHECKED_IN', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 95550 },
        { token_number: 'KF-30103', centre_id: 'centre-c', farmer_id: 'KF-S201948', farmer_name: 'Sukhdev Gill', mobile: '+91 98155 33419', village: 'Samrala', crop_type: 'Paddy (Dhan)', variety: 'PR-126', slot_date: 'Today', slot_time: '10:30 AM - 11:00 AM', estimated_quantity: 38, actual_weight: 38.0, actual_quantity: 38.0, status: 'PROCESSING', assigned_counter: 'Counter 2', weighbridge_number: 'WB-02', total_amount: 83714 },
        { token_number: 'KF-30104', centre_id: 'centre-c', farmer_id: 'KF-A391028', farmer_name: 'Amrik Singh', mobile: '+91 98140 11982', village: 'Doraha', crop_type: 'Wheat (Sharbati)', variety: 'HD-2967', slot_date: 'Today', slot_time: '10:00 AM - 10:30 AM', estimated_quantity: 30, status: 'COMPLETED', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 68250 },
        { token_number: 'KF-30105', centre_id: 'centre-c', farmer_id: 'KF-N102948', farmer_name: 'Navjot Cheema', mobile: '+91 98147 66521', village: 'Raikot', crop_type: 'Mustard (Sarson)', variety: 'Pusa Bold', slot_date: 'Today', slot_time: '12:00 PM - 12:30 PM', estimated_quantity: 25, actual_weight: 25.0, actual_quantity: 25.0, moisture_percent: 11.0, quality_grade: 'Grade A', status: 'PROCESSING', total_amount: 141250 }
      ];

      // Ensure every token seeded uses an enum-compatible status string for PostgreSQL token_status
      const enumSafeTokens = sampleTokens.map(t => ({
        ...t,
        status: (t.status === 'WEIGHED' || t.status === 'TESTED' || t.status === 'WEIGHING' || t.status === 'QUALITY_CHECK') ? 'PROCESSING' : t.status,
      }));

      const { error } = await supabase.from('tokens').upsert(enumSafeTokens, { onConflict: 'token_number' });
      if (error) {
        console.warn("Supabase Notice during seed:", error.message);
      }
      await fetchTokens();
    } catch (err: any) {
      console.warn("Notice during seed operation:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  // 1. Gate Check-in for row (kept for fallback)
  const handleCheckIn = async (token: SupabaseToken) => {
    // Immediate UI update
    setTokens(prev => prev.map(t => (t.id === token.id || t.token_number === token.token_number) ? {
      ...t,
      status: 'CHECKED_IN',
    } : t));

    try {
      const updateQuery = token.id
        ? supabase.from('tokens').update({ status: 'CHECKED_IN' }).eq('id', token.id)
        : supabase.from('tokens').update({ status: 'CHECKED_IN' }).eq('token_number', token.token_number);

      const { error } = await updateQuery;
      if (error) {
        console.error("Supabase Action Error:", error);
      }
      checkInFarmer(token.token_number);
      await fetchTokens();
      if (refreshBookings) {
        await refreshBookings();
      }
      window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
    } catch (error) {
      console.error("Supabase Action Error:", error);
      fetchTokens();
    }
  };

  // 2. Weigh Action: prevent immediate status change, open Weighbridge Modal
  const handleWeigh = (token: SupabaseToken) => {
    setWeighModalToken(token);
    const baseline = token.actual_weight ?? token.actual_quantity ?? token.estimated_quantity ?? 30;
    setActualWeightInput(String(baseline));
  };

  // Submit Weighbridge Modal: Update { actual_weight: input, status: 'WEIGHED' }
  const handleSubmitWeigh = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!weighModalToken) return;

    const weightNum = parseFloat(actualWeightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      alert('Please enter a valid gross weight in Quintals.');
      return;
    }

    setIsSubmittingWeigh(true);
    const currentToken = weighModalToken;

    // Immediately update local token state array so UI instantly re-renders with 'WEIGHED'
    setTokens(prev => prev.map(t => (t.token_number === currentToken.token_number || t.id === currentToken.id) ? {
      ...t,
      actual_weight: weightNum,
      actual_quantity: weightNum,
      status: 'WEIGHED',
      weighbridge_number: t.weighbridge_number || 'WB-01',
    } : t));

    try {
      // Ensure the modal's submit handler successfully executes:
      // await supabase.from('tokens').update({ actual_weight: input, status: 'WEIGHED' }).eq('token_number', token.token_number);
      const { error } = await supabase
        .from('tokens')
        .update({ 
          actual_weight: weightNum, 
          status: 'WEIGHED' 
        })
        .eq('token_number', currentToken.token_number);

      if (error) {
        console.warn("Supabase Action Warning updating weigh status:", error.message);
        // Resilient fallback if PostgreSQL enum doesn't contain 'WEIGHED' yet
        if (error.code === '22P02' || error.message?.includes('token_status') || error.code === 'PGRST204') {
          await supabase.from('tokens').update({
            actual_quantity: weightNum,
            status: 'PROCESSING'
          }).eq(currentToken.id ? 'id' : 'token_number', currentToken.id || currentToken.token_number);
        }
      }

      // CRITICAL: Immediately after the Supabase update succeeds, you MUST call the parent component's refresh function
      // (e.g., fetchTokens(), or context refresh) or update the local token state array so the UI instantly re-renders the row with the new 'WEIGHED' status.
      await fetchTokens();
      if (refreshBookings) {
        await refreshBookings();
      }
      advanceFarmerStage(currentToken.token_number, 'WEIGHED');
      window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
    } catch (err) {
      console.error("Error submitting weighbridge data:", err);
    } finally {
      setIsSubmittingWeigh(false);
      setWeighModalToken(null);
    }
  };

  // 3. Quality Assay Action: open Quality Assay modal
  const handleQualityAssay = (token: SupabaseToken) => {
    setAssayModalToken(token);
    const baseline = token.moisture_percent !== undefined && token.moisture_percent !== null 
      ? String(token.moisture_percent) 
      : '12.0';
    setMoistureInput(baseline);
  };

  // Submit Quality Assay Modal: Update { moisture_percent: input, status: 'TESTED' }
  const handleSubmitAssay = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!assayModalToken) return;

    const moistureNum = parseFloat(moistureInput);
    if (isNaN(moistureNum) || moistureNum < 0 || moistureNum > 40) {
      alert('Please enter a valid moisture content between 0% and 40%.');
      return;
    }

    setIsSubmittingAssay(true);
    const currentToken = assayModalToken;
    const grade = moistureNum <= 12 ? 'Grade A' : 'Grade B';

    // Immediate UI update
    setTokens(prev => prev.map(t => (t.id === currentToken.id || t.token_number === currentToken.token_number) ? {
      ...t,
      moisture_percent: moistureNum,
      quality_grade: grade,
      status: 'TESTED',
    } : t));

    try {
      const updateData: Record<string, any> = {
        moisture_percent: moistureNum,
        quality_grade: grade,
        status: 'TESTED',
      };

      const updateQuery = currentToken.id
        ? supabase.from('tokens').update(updateData).eq('id', currentToken.id)
        : supabase.from('tokens').update(updateData).eq('token_number', currentToken.token_number);

      const { error } = await updateQuery;
      if (error) {
        console.warn("Supabase Action Warning updating assay status:", error.message);
        // Resilient fallback if PostgreSQL enum doesn't contain 'TESTED' yet
        if (error.code === '22P02' || error.message?.includes('token_status') || error.code === 'PGRST204') {
          await supabase.from('tokens').update({
            quality_grade: grade,
            status: 'PROCESSING'
          }).eq(currentToken.id ? 'id' : 'token_number', currentToken.id || currentToken.token_number);
        }
      }

      await fetchTokens();
      if (refreshBookings) {
        await refreshBookings();
      }
      advanceFarmerStage(currentToken.token_number, 'TESTED');
      window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
    } catch (err) {
      console.error("Error submitting assay data:", err);
    } finally {
      setIsSubmittingAssay(false);
      setAssayModalToken(null);
    }
  };

  // Process Action for row (Call to Document & Verification Counter)
  const handleProcess = async (token: SupabaseToken) => {
    const counter = isCounter3Open ? 'Counter 3' : 'Counter 1';
    
    // Immediate UI update
    setTokens(prev => prev.map(t => (t.id === token.id || t.token_number === token.token_number) ? {
      ...t,
      status: 'PROCESSING',
      assigned_counter: counter,
    } : t));

    try {
      const updateQuery = token.id
        ? supabase.from('tokens').update({ status: 'PROCESSING', assigned_counter: counter }).eq('id', token.id)
        : supabase.from('tokens').update({ status: 'PROCESSING', assigned_counter: counter }).eq('token_number', token.token_number);

      const { error } = await updateQuery;
      if (error) {
        console.error("Supabase Action Error:", error);
      }
      advanceFarmerStage(token.token_number, 'PROCESSING');
    } catch (error) {
      console.error("Supabase Action Error:", error);
      fetchTokens();
    }
  };

  // 4. Dynamic Price Calculation Engine & Finalize Step
  // Base Value = actual_weight * commodity_MSP
  // Deduction = 0. If moisture_percent > 12, apply 1% price deduction for every 1% excess moisture
  // Final Payout = Base Value - Deduction
  const handleFinalizeDBT = (token: SupabaseToken) => {
    const actualWeight = Number(token.actual_weight ?? token.actual_quantity ?? token.estimated_quantity ?? 30);
    const commodityMsp = getCommodityMsp(token.crop_type);
    const baseValue = actualWeight * commodityMsp;
    const moisturePercent = Number(token.moisture_percent !== undefined && token.moisture_percent !== null 
      ? token.moisture_percent 
      : 12.0);

    let deduction = 0;
    let excessMoisture = 0;
    let deductionPercent = 0;

    if (moisturePercent > 12) {
      excessMoisture = Math.round((moisturePercent - 12) * 10) / 10;
      deductionPercent = excessMoisture; // 1% deduction per 1% excess moisture
      deduction = baseValue * (deductionPercent / 100);
    }

    const finalPayout = Math.max(0, Math.round(baseValue - deduction));

    setDbtModalData({
      token,
      actualWeight,
      commodityMsp,
      baseValue: Math.round(baseValue),
      moisturePercent,
      excessMoisture,
      deductionPercent,
      deductionAmount: Math.round(deduction),
      finalPayout,
    });
  };

  // Confirm and Execute DBT Payout: Update { final_payout: calculatedValue, status: 'COMPLETED' }
  const handleConfirmDBT = async () => {
    if (!dbtModalData) return;
    const { token, actualWeight, finalPayout, moisturePercent } = dbtModalData;
    setIsExecutingDbt(true);

    const calculatedValue = finalPayout;
    const grade = (token.quality_grade as any) || (moisturePercent <= 12 ? 'Grade A' : 'Grade B');

    // Immediate UI update
    setTokens(prev => prev.map(t => (t.id === token.id || t.token_number === token.token_number) ? {
      ...t,
      actual_weight: actualWeight,
      actual_quantity: actualWeight,
      moisture_percent: moisturePercent,
      final_payout: calculatedValue,
      total_amount: calculatedValue,
      status: 'COMPLETED',
      quality_grade: grade,
    } : t));

    try {
      const updates: Record<string, any> = {
        actual_weight: actualWeight,
        actual_quantity: actualWeight,
        moisture_percent: moisturePercent,
        final_payout: calculatedValue,
        total_amount: calculatedValue,
        status: 'COMPLETED',
        quality_grade: grade,
      };

      const updateQuery = token.id
        ? supabase.from('tokens').update(updates).eq('id', token.id)
        : supabase.from('tokens').update(updates).eq('token_number', token.token_number);

      const { error } = await updateQuery;
      if (error) {
        console.warn("Supabase Action Warning updating final payout:", error.message);
        // Fallback for minimal column schema
        await supabase.from('tokens').update({
          status: 'COMPLETED',
          actual_quantity: actualWeight,
          total_amount: calculatedValue,
        }).eq(token.id ? 'id' : 'token_number', token.id || token.token_number);
      }

      await completeProcurementModal(token.token_number, actualWeight, grade, calculatedValue, moisturePercent);
      window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
    } catch (error) {
      console.error("Supabase Action Error during DBT settlement:", error);
      fetchTokens();
    } finally {
      setIsExecutingDbt(false);
      setDbtModalData(null);
    }
  };

  // 5. Mark token as No-Show in Supabase
  const handleMarkNoShow = async (token: SupabaseToken) => {
    // Immediate UI update
    setTokens(prev => prev.map(t => (t.id === token.id || t.token_number === token.token_number) ? { ...t, status: 'NO_SHOW' } : t));

    try {
      const updateQuery = token.id
        ? supabase.from('tokens').update({ status: 'NO_SHOW' }).eq('id', token.id)
        : supabase.from('tokens').update({ status: 'NO_SHOW' }).eq('token_number', token.token_number);

      const { error } = await updateQuery;
      if (error) {
        console.error("Supabase Action Error:", error);
      }
      markNoShow(token.token_number);
    } catch (error) {
      console.error("Supabase Action Error:", error);
      fetchTokens();
    }
  };

  // Generic stage advance helper
  const handleAdvanceStage = async (
    token: SupabaseToken, 
    nextStage: 'WEIGHING' | 'QUALITY_CHECK' | 'PROCESSING' | 'COMPLETED',
    stationCounter?: string,
    stationWeighbridge?: string
  ) => {
    const dbStatus = nextStage === 'WEIGHING' || nextStage === 'QUALITY_CHECK' || nextStage === 'PROCESSING'
      ? 'PROCESSING'
      : nextStage === 'COMPLETED'
      ? 'COMPLETED'
      : 'CHECKED_IN';

    const updates: Record<string, any> = {
      status: dbStatus
    };
    if (stationCounter) updates.assigned_counter = stationCounter;
    if (stationWeighbridge) updates.weighbridge_number = stationWeighbridge;

    // Immediate UI update
    setTokens(prev => prev.map(t => (t.id === token.id || t.token_number === token.token_number) ? { 
      ...t, 
      status: nextStage,
      assigned_counter: stationCounter || t.assigned_counter,
      weighbridge_number: stationWeighbridge || t.weighbridge_number
    } : t));

    try {
      const updateQuery = token.id
        ? supabase.from('tokens').update(updates).eq('id', token.id)
        : supabase.from('tokens').update(updates).eq('token_number', token.token_number);

      const { error } = await updateQuery;
      if (error) {
        console.error("Supabase Action Error:", error);
      }
      advanceFarmerStage(token.token_number, nextStage);
    } catch (error) {
      console.error("Supabase Action Error:", error);
      fetchTokens();
    }
  };

  // Open DBT payment modal
  const handleOpenPayment = (token: SupabaseToken) => {
    const bookingModel: SlotBooking = {
      id: token.id || `b-${token.token_number}`,
      tokenNumber: token.token_number,
      farmerId: token.farmer_id || 'KF-FARMER',
      farmerName: token.farmer_name,
      mobile: token.mobile || '',
      village: token.village || '',
      centreId: token.centre_id || 'centre-a',
      centreName: token.centre_id === 'centre-b' ? 'Centre B — Nashik Wholesale Market (Maharashtra)' : token.centre_id === 'centre-c' ? 'Centre C — Ludhiana FCI Hub (Punjab)' : 'Centre A — Karnal Central Yard (Haryana)',
      cropType: token.crop_type,
      variety: token.variety || 'Standard',
      estimatedQuantity: Number(token.estimated_quantity) || 30,
      actualQuantity: token.actual_quantity ? Number(token.actual_quantity) : undefined,
      bookingDate: token.slot_date,
      slotTime: token.slot_time,
      status: token.status as any,
      queuePosition: 1,
      predictedWaitMin: 10,
      qualityGrade: (token.quality_grade as ('Grade A' | 'Grade B' | 'Standard')) || undefined,
      mspRatePerQtl: 2183,
      totalAmount: Number(token.total_amount) || 0,
      paymentStatus: token.status === 'COMPLETED' ? 'CREDITED' : 'PENDING',
      checkInOtp: '4190',
      assignedCounter: token.assigned_counter || 'Counter 1',
      weighbridgeNumber: token.weighbridge_number || 'WB-01',
      createdAt: token.created_at ? new Date(token.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'
    };
    setSelectedBookingForPay(bookingModel);
  };

  // Filter directly over the fetched Supabase tokens by selected Mandi Hub, query, and stage
  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      // 1. Filter by selected Mandi Centre ID (Karnal, Nashik, or Ludhiana)
      const tokenCentre = t.centre_id || 'centre-a';
      if (tokenCentre !== selectedCentreId) {
        return false;
      }

      // 2. Search query filter
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const matchesSearch = 
          (t.token_number || '').toLowerCase().includes(query) ||
          (t.farmer_name || '').toLowerCase().includes(query) ||
          (t.village || '').toLowerCase().includes(query) ||
          (t.mobile || '').includes(query) ||
          (t.crop_type || '').toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      // 3. Stage filter
      if (filterStage === 'ALL') return true;

      // Normalizing stages for filtering
      if (filterStage === 'ARRIVED') {
        return t.status === 'ARRIVED' || t.status === 'CHECKED_IN';
      }
      if (filterStage === 'PROCESSING') {
        return t.status === 'PROCESSING' || t.status === 'WEIGHING' || t.status === 'QUALITY_CHECK';
      }
      return t.status === filterStage;
    });
  }, [tokens, selectedCentreId, searchQuery, filterStage]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      {/* Table Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              Procurement Live Queue & Operations
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 font-mono font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                <Database className="w-2.5 h-2.5" /> Supabase Synced
              </span>
            </h3>
            <span className="text-xs bg-slate-800 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded-full border border-slate-700">
              {filteredTokens.length} Hub Records
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
            <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Active Yard:</span>
            <span className="text-emerald-300 font-bold bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 font-mono text-[11px]">
              {currentCentre?.name || selectedCentreId}
            </span>
          </p>
        </div>

        {/* Search, Filter & Refresh bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              openGateScanner(null);
            }}
            className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-heading font-extrabold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer shrink-0"
            title="Open camera scanner for incoming farmer gate pass verification"
          >
            <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Scan Gate QR Pass</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search token or farmer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800/90 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44"
            />
          </div>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Stages</option>
            <option value="BOOKED">Booked</option>
            <option value="ARRIVED">Checked In / Arrived</option>
            <option value="WEIGHING">At Weighbridge</option>
            <option value="WEIGHED">Weighed</option>
            <option value="QUALITY_CHECK">Quality Lab</option>
            <option value="TESTED">Tested (Assay)</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="NO_SHOW">No-Show</option>
          </select>

          <button
            onClick={() => fetchTokens()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Refresh records from Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && tokens.length === 0 && (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
          <p className="text-xs font-mono">Querying Supabase tokens table...</p>
        </div>
      )}

      {/* Error state */}
      {fetchError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Supabase Notice: {fetchError}</span>
          </div>
          <button
            onClick={() => fetchTokens()}
            className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-white rounded-lg text-[11px] font-semibold"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* Empty State with instant database seeder */}
      {!isLoading && tokens.length === 0 && (
        <div className="py-10 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl space-y-3 p-6">
          <Database className="w-8 h-8 text-emerald-400/60 mx-auto" />
          <div>
            <h4 className="text-sm font-bold text-white">No Tokens in Supabase Database</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              The <code className="text-emerald-400">tokens</code> table currently has 0 rows. Click below to populate initial database records (Ramesh Kumar, Manas Das, Dillip Rout, etc.).
            </p>
          </div>
          <button
            onClick={handleSeedDatabase}
            disabled={isSeeding}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isSeeding ? 'Seeding Database...' : 'Seed Database Tokens Now'}</span>
          </button>
        </div>
      )}

      {/* Queue Table - Strictly mapping over Supabase state */}
      {tokens.length > 0 && filteredTokens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Token #</th>
                <th className="py-3 px-3">Farmer Details</th>
                <th className="py-3 px-3">Commodity & Qtl</th>
                <th className="py-3 px-3">Slot / Wait</th>
                <th className="py-3 px-3">Status / Stage</th>
                <th className="py-3 px-3">Assigned Station</th>
                <th className="py-3 px-3 text-right">Mandi Officer Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredTokens.map((t) => {
                const rawStatus = (t.status || 'BOOKED').trim();
                const status: 'BOOKED' | 'CHECKED_IN' | 'WEIGHED' | 'TESTED' | 'COMPLETED' | 'NO_SHOW' | string = 
                  rawStatus === 'ARRIVED' ? 'CHECKED_IN'
                  : rawStatus === 'WEIGHING' ? (t.actual_weight ? 'WEIGHED' : 'CHECKED_IN')
                  : rawStatus === 'QUALITY_CHECK' ? 'WEIGHED'
                  : rawStatus === 'PROCESSING' ? (t.moisture_percent !== undefined && t.moisture_percent !== null ? 'TESTED' : t.actual_weight ? 'WEIGHED' : 'CHECKED_IN')
                  : rawStatus;

                const isWeighed = status === 'WEIGHED';
                const isTested = status === 'TESTED';
                const isCompleted = status === 'COMPLETED';
                const isNoShow = status === 'NO_SHOW';
                const isCheckedIn = status === 'CHECKED_IN';
                const isBooked = status === 'BOOKED';

                return (
                  <tr 
                    key={t.id || t.token_number} 
                    className={`hover:bg-slate-800/40 transition-colors ${
                      status === 'PROCESSING' || isWeighed || isTested ? 'bg-emerald-950/20' : ''
                    }`}
                  >
                    {/* Token Number */}
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400">{t.token_number}</span>
                        {t.farmer_name === 'Ramesh Kumar' && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-bold border border-emerald-500/30">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Farmer Details */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-white block">{t.farmer_name}</span>
                      <span className="text-[10px] text-slate-400 block">{t.village} • {t.mobile}</span>
                    </td>

                    {/* Commodity & Quantity */}
                    <td className="py-3 px-3">
                      <span className="text-white block font-medium">{t.crop_type}</span>
                      <span className="text-[10px] text-emerald-400 block font-mono font-bold">
                        {t.actual_weight 
                          ? `${t.actual_weight} Qtl (Weighed)` 
                          : t.actual_quantity 
                            ? `${t.actual_quantity} Qtl (Weighed)` 
                            : `${t.estimated_quantity} Qtl (Est)`}
                      </span>
                      {t.moisture_percent !== undefined && t.moisture_percent !== null && (
                        <span className={`text-[10px] block font-mono font-medium ${Number(t.moisture_percent) > 12 ? 'text-amber-400' : 'text-teal-400'}`}>
                          Moisture: {t.moisture_percent}% {Number(t.moisture_percent) > 12 ? `(+${Math.round((Number(t.moisture_percent) - 12) * 10) / 10}%)` : '(Normal)'}
                        </span>
                      )}
                      {t.final_payout && (
                        <span className="text-[10px] text-emerald-300 block font-mono font-semibold">
                          Payout: ₹{Number(t.final_payout).toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>

                    {/* Slot Time */}
                    <td className="py-3 px-3">
                      <span className="text-amber-300 font-semibold block">{t.slot_time}</span>
                      <span className="text-[10px] text-slate-400 block">
                        {isCompleted ? 'Finished' : t.slot_date || 'Today'}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                        isCompleted 
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' 
                          : isWeighed
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono'
                            : isTested
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono'
                              : status === 'PROCESSING' 
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse'
                                : isNoShow
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : isCheckedIn
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {status}
                      </span>
                    </td>

                    {/* Assigned Station */}
                    <td className="py-3 px-3 text-[11px] font-mono text-slate-400">
                      {t.assigned_counter || t.weighbridge_number || 'Queue Lane 1'}
                    </td>

                    {/* Action Controls - Strict State Machine */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* 1. Strictly status === 'BOOKED' -> Verify Gate Pass (Action: Opens QR Scanner modal, updates to CHECKED_IN ONLY on scan callback) */}
                        {status === 'BOOKED' && (
                          <button
                            id={`btn-verify-gate-${t.token_number}`}
                            onClick={() => {
                              openGateScanner(t.token_number);
                            }}
                            className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                            title={`Open QR Scanner to verify Gate Pass for ${t.token_number}`}
                          >
                            <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                            <span>Verify Gate Pass</span>
                          </button>
                        )}

                        {/* 2. Strictly status === 'CHECKED_IN' -> Weigh (Action: Opens Weight Modal, updates to WEIGHED) */}
                        {status === 'CHECKED_IN' && (
                          <button
                            id={`btn-weigh-${t.token_number}`}
                            onClick={() => handleWeigh(t)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                            title={`Open Weighbridge Gross Weight Modal for ${t.token_number}`}
                          >
                            <Scale className="w-3 h-3" />
                            <span>Weigh</span>
                          </button>
                        )}

                        {/* 3. Strictly status === 'WEIGHED' -> Quality Assay (Action: Opens Moisture Modal, updates to TESTED) */}
                        {status === 'WEIGHED' && (
                          <button
                            id={`btn-quality-assay-${t.token_number}`}
                            onClick={() => handleQualityAssay(t)}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                            title={`Open Quality Assay Laboratory Modal for ${t.token_number}`}
                          >
                            <FlaskConical className="w-3 h-3" />
                            <span>Quality Assay</span>
                          </button>
                        )}

                        {/* 4. Strictly status === 'TESTED' -> Finalize & DBT (Action: Opens Payout Modal, updates to COMPLETED) */}
                        {status === 'TESTED' && (
                          <button
                            id={`btn-finalize-dbt-${t.token_number}`}
                            onClick={() => handleFinalizeDBT(t)}
                            className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                            title={`Calculate dynamic MSP payout and open DBT settlement confirmation for ${t.token_number}`}
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Finalize & DBT</span>
                          </button>
                        )}

                        {/* 5. Completed Badge */}
                        {status === 'COMPLETED' && (
                          <span 
                            id={`badge-completed-${t.token_number}`}
                            className="text-teal-400 font-bold flex items-center gap-1 text-[11px] bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/30"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>₹{Number(t.final_payout || t.total_amount || 0).toLocaleString('en-IN')} Paid</span>
                          </span>
                        )}

                        {/* 6. No-Show Button: Only render if status === 'BOOKED' or status === 'CHECKED_IN' */}
                        {(status === 'BOOKED' || status === 'CHECKED_IN') && (
                          <button
                            id={`btn-no-show-${t.token_number}`}
                            onClick={() => handleMarkNoShow(t)}
                            className="px-2 py-1 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-600/50 rounded-lg text-[11px] transition-colors cursor-pointer"
                            title="Mark no-show and auto-recover slot for waiting farmers"
                          >
                            <UserX className="w-3 h-3" />
                            <span className="hidden lg:inline ml-1">No-Show</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State for Selected Mandi Hub */}
      {tokens.length > 0 && filteredTokens.length === 0 && (
        <div className="py-12 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl space-y-3 p-6">
          <Building2 className="w-8 h-8 text-emerald-400/70 mx-auto" />
          <div>
            <h4 className="text-sm font-bold text-white">
              No Tokens for {currentCentre?.name || selectedCentreId}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              {searchQuery || filterStage !== 'ALL'
                ? 'No tokens match your search keyword or selected stage in this Mandi facility.'
                : `Currently no farmers are registered for ${currentCentre?.name || 'this yard'}. You can seed sample multi-hub records into Supabase.`}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={handleSeedDatabase}
              disabled={isSeeding}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isSeeding ? 'Seeding Multi-Hub Records...' : 'Seed Sample Tokens for All Mandis'}</span>
            </button>
            {(searchQuery || filterStage !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterStage('ALL');
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Weighbridge Gross Weight Capture Modal */}
      {weighModalToken && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-white text-base">Weighbridge Measurement</h3>
                  <p className="text-xs text-slate-400">Physical Gross Weight Data Capture</p>
                </div>
              </div>
              <button
                onClick={() => setWeighModalToken(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Token Details Card */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Token Number:</span>
                  <span className="font-mono font-bold text-emerald-400">{weighModalToken.token_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Farmer:</span>
                  <span className="text-white font-medium">{weighModalToken.farmer_name} ({weighModalToken.village})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Commodity:</span>
                  <span className="text-white font-medium">{weighModalToken.crop_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated Baseline:</span>
                  <span className="font-mono text-amber-300 font-bold">{weighModalToken.estimated_quantity} Qtl</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Weighbridge Lane:</span>
                  <span className="text-indigo-300 font-mono font-semibold">{weighModalToken.weighbridge_number || 'WB-01 (Electronic)'}</span>
                </div>
              </div>

              {/* Input */}
              <form onSubmit={handleSubmitWeigh} className="space-y-4">
                <div>
                  <label htmlFor="actual-weight-input" className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Actual Gross Weight (Quintals) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="actual-weight-input"
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="1000"
                      required
                      autoFocus
                      value={actualWeightInput}
                      onChange={(e) => setActualWeightInput(e.target.value)}
                      className="w-full bg-slate-950 border border-indigo-500/50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3.5 py-2.5 text-white font-mono text-lg font-bold placeholder-slate-600 focus:outline-none"
                      placeholder="Enter gross quintals..."
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-400 font-mono">
                      Qtl
                    </span>
                  </div>
                </div>

                {/* Quick Adjustment Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setActualWeightInput(String(weighModalToken.estimated_quantity))}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    Est: {weighModalToken.estimated_quantity}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseFloat(actualWeightInput) || weighModalToken.estimated_quantity;
                      setActualWeightInput((Math.round((current + 0.5) * 100) / 100).toFixed(2));
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-[11px] font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    +0.5 Qtl
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseFloat(actualWeightInput) || weighModalToken.estimated_quantity;
                      setActualWeightInput((Math.round((current + 1.0) * 100) / 100).toFixed(2));
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-[11px] font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    +1.0 Qtl
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseFloat(actualWeightInput) || weighModalToken.estimated_quantity;
                      setActualWeightInput((Math.max(0.1, Math.round((current - 1.0) * 100) / 100)).toFixed(2));
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-[11px] font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    -1.0 Qtl
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>On submit, saves physical gross weight to database and advances token status to <strong>WEIGHED</strong>.</span>
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setWeighModalToken(null)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingWeigh}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-950/50 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSubmittingWeigh ? 'Updating...' : 'Submit & Advance to WEIGHED'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Quality Assay Modal */}
      {assayModalToken && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-white text-base">Quality Assay & Lab Test</h3>
                  <p className="text-xs text-slate-400">Grain Moisture Content Analysis</p>
                </div>
              </div>
              <button
                onClick={() => setAssayModalToken(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Token Details Card */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Token Number:</span>
                  <span className="font-mono font-bold text-emerald-400">{assayModalToken.token_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Farmer:</span>
                  <span className="text-white font-medium">{assayModalToken.farmer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Commodity:</span>
                  <span className="text-white font-medium">{assayModalToken.crop_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Weighed Gross:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {assayModalToken.actual_weight ?? assayModalToken.actual_quantity ?? assayModalToken.estimated_quantity} Quintals
                  </span>
                </div>
              </div>

              {/* Input */}
              <form onSubmit={handleSubmitAssay} className="space-y-4">
                <div>
                  <label htmlFor="moisture-percent-input" className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Moisture Content (%) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="moisture-percent-input"
                      type="number"
                      step="0.1"
                      min="0"
                      max="40"
                      required
                      autoFocus
                      value={moistureInput}
                      onChange={(e) => setMoistureInput(e.target.value)}
                      className="w-full bg-slate-950 border border-purple-500/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-white font-mono text-lg font-bold placeholder-slate-600 focus:outline-none"
                      placeholder="e.g. 12.0"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-400 font-mono">
                      %
                    </span>
                  </div>
                </div>

                {/* Quick Moisture Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 mr-1">Standards:</span>
                  <button
                    type="button"
                    onClick={() => setMoistureInput('11.0')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg text-[11px] font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    11.0% (Dry)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoistureInput('12.0')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg text-[11px] font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    12.0% (Standard Limit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoistureInput('13.5')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-[11px] font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    13.5% (+1.5% Excess)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoistureInput('15.0')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-[11px] font-mono border border-slate-700 transition-colors cursor-pointer"
                  >
                    15.0% (+3.0% Excess)
                  </button>
                </div>

                {/* Dynamic Moisture Analysis Card */}
                {(() => {
                  const val = parseFloat(moistureInput);
                  if (isNaN(val)) return null;
                  const isExcess = val > 12;
                  const excess = Math.round((val - 12) * 10) / 10;
                  return (
                    <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                      isExcess 
                        ? 'bg-amber-950/20 border-amber-500/30 text-amber-300' 
                        : 'bg-teal-950/20 border-teal-500/30 text-teal-300'
                    }`}>
                      <div className="font-semibold flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5" />
                        <span>
                          {isExcess 
                            ? `Excess Moisture Detected (+${excess}%)` 
                            : 'Standard Moisture Compliance (≤12.0%)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {isExcess 
                          ? `1% price deduction applies for every 1% excess moisture (${excess}% deduction will apply to base MSP during DBT settlement).`
                          : '12.0% is the standard acceptable limit. Full 100% MSP payout without deduction applies.'}
                      </p>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAssayModalToken(null)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAssay}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-950/50 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSubmittingAssay ? 'Saving Assay...' : 'Submit & Advance to TESTED'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Dynamic Price Calculation & Final Summary DBT Modal */}
      {dbtModalData && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl p-6 relative">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-white text-base">Direct Benefit Transfer (DBT) Settlement</h3>
                  <p className="text-xs text-slate-400">Dynamic MSP & Moisture Deduction Calculation Engine</p>
                </div>
              </div>
              <button
                onClick={() => setDbtModalData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Prominent Verification Question */}
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 text-center">
                <p className="text-xs text-emerald-300 font-semibold tracking-wide uppercase">Final Verification</p>
                <h4 className="font-heading font-extrabold text-white text-lg mt-1">
                  Calculated Payout: <span className="text-emerald-400 font-mono">₹{dbtModalData.finalPayout.toLocaleString('en-IN')}</span>. Initiate DBT Transfer?
                </h4>
              </div>

              {/* Beneficiary & Commodity Summary */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Beneficiary Farmer:</span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    {dbtModalData.token.farmer_name}
                    <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                      <ShieldCheck className="w-2.5 h-2.5" /> Verified
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Token & Village:</span>
                  <span className="text-slate-300 font-mono">{dbtModalData.token.token_number} • {dbtModalData.token.village}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Commodity:</span>
                  <span className="text-slate-300 font-medium">{dbtModalData.token.crop_type}</span>
                </div>
              </div>

              {/* Transparent Breakdown Formula */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Actual Gross Weight:</span>
                  <span className="text-white font-bold">{dbtModalData.actualWeight} Quintals</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans">Govt Procurement MSP:</span>
                  <span className="text-emerald-400 font-bold">₹{dbtModalData.commodityMsp.toLocaleString('en-IN')} / Qtl</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800 pt-1.5">
                  <span className="text-slate-300 font-sans font-semibold">Base Value (Weight × MSP):</span>
                  <span className="text-white font-bold">₹{dbtModalData.baseValue.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center border-t border-slate-800 pt-1.5 text-xs">
                  <span className="text-slate-400 font-sans">Assayed Moisture:</span>
                  <span className={dbtModalData.moisturePercent > 12 ? 'text-amber-400 font-bold' : 'text-teal-400 font-bold'}>
                    {dbtModalData.moisturePercent}% (Standard Limit: 12.0%)
                  </span>
                </div>

                {dbtModalData.moisturePercent > 12 ? (
                  <div className="flex justify-between items-center text-amber-400">
                    <span className="font-sans">Excess Moisture Deduction ({dbtModalData.deductionPercent}%):</span>
                    <span className="font-bold">-₹{dbtModalData.deductionAmount.toLocaleString('en-IN')}</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-teal-400">
                    <span className="font-sans">Deduction (Acceptable Moisture):</span>
                    <span className="font-bold">₹0</span>
                  </div>
                )}

                <div className="flex justify-between items-center border-t-2 border-emerald-500/40 pt-2 text-sm">
                  <span className="text-white font-sans font-bold">Final Calculated Payout:</span>
                  <span className="text-emerald-400 font-extrabold text-base">₹{dbtModalData.finalPayout.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDbtModalData(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isExecutingDbt}
                  onClick={handleConfirmDBT}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isExecutingDbt ? 'Transferring...' : 'Initiate DBT Transfer'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for recording weight and payment */}
      <ProcurementCompleteModal
        booking={selectedBookingForPay}
        onClose={() => setSelectedBookingForPay(null)}
        onSuccess={() => fetchTokens()}
      />
    </div>
  );
};
