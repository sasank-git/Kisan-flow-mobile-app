import React, { useState } from 'react';
import { 
  Database, 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Server, 
  CheckCircle2, 
  AlertCircle,
  Play,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../utils/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  if (!isOpen) return null;

  const sqlSchema = `-- =========================================================
-- KisanFlow Supabase PostgreSQL Schema
-- Run this in your Supabase Dashboard -> SQL Editor -> Run
-- =========================================================

-- 1. Create Token Status Enum
DO $$ BEGIN
    CREATE TYPE token_status AS ENUM ('BOOKED', 'CHECKED_IN', 'PROCESSING', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'WEIGHED', 'TESTED');
EXCEPTION
    WHEN duplicate_object THEN 
        BEGIN
            ALTER TYPE token_status ADD VALUE IF NOT EXISTS 'CANCELLED';
            ALTER TYPE token_status ADD VALUE IF NOT EXISTS 'WEIGHED';
            ALTER TYPE token_status ADD VALUE IF NOT EXISTS 'TESTED';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END;
END $$;

-- 2. Create Centres Table
CREATE TABLE IF NOT EXISTS centres (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    distance_km NUMERIC(5,2) DEFAULT 0,
    max_daily_capacity INTEGER DEFAULT 100,
    current_queue INTEGER DEFAULT 0,
    active_counters INTEGER DEFAULT 2,
    total_counters INTEGER DEFAULT 3,
    avg_processing_time_min INTEGER DEFAULT 14,
    congestion TEXT DEFAULT 'MODERATE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Tokens Table
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_number TEXT NOT NULL UNIQUE,
    centre_id TEXT REFERENCES centres(id) ON DELETE SET NULL,
    farmer_id TEXT NOT NULL,
    farmer_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    village TEXT,
    crop_type TEXT NOT NULL,
    variety TEXT,
    slot_date TEXT NOT NULL,
    slot_time TEXT NOT NULL,
    estimated_quantity NUMERIC(10,2) DEFAULT 0,
    actual_quantity NUMERIC(10,2),
    actual_weight NUMERIC(10,2),
    moisture_percent NUMERIC(5,2),
    final_payout NUMERIC(12,2),
    quality_grade TEXT,
    total_amount NUMERIC(12,2) DEFAULT 0,
    status token_status NOT NULL DEFAULT 'BOOKED',
    assigned_counter TEXT,
    weighbridge_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Schema Migrations if table already exists
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS actual_weight NUMERIC(10,2);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS moisture_percent NUMERIC(5,2);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS final_payout NUMERIC(12,2);

-- 4. Enable Row Level Security (RLS) & Public Policies
ALTER TABLE centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on centres" ON centres FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update on centres" ON centres FOR ALL USING (true);
CREATE POLICY "Allow public read access on tokens" ON tokens FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update/delete on tokens" ON tokens FOR ALL USING (true);

-- 5. Seed National Procurement Hubs
INSERT INTO centres (id, name, code, address, distance_km, max_daily_capacity, current_queue, active_counters, total_counters, avg_processing_time_min, congestion)
VALUES
    ('centre-a', 'Karnal Central Yard (Haryana)', 'KRN-01', 'GT Road Agro Terminal, Karnal', 4.2, 150, 18, 3, 4, 14, 'MODERATE'),
    ('centre-b', 'Nashik Wholesale Market (Maharashtra)', 'NSK-02', 'Lasalgaon APMC Complex, Nashik', 6.1, 140, 31, 2, 3, 20, 'HIGH'),
    ('centre-c', 'Ludhiana FCI Hub (Punjab)', 'LDH-03', 'FCI Regional Grain Terminal, GT Road, Ludhiana', 5.0, 180, 9, 4, 5, 11, 'LOW')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    address = EXCLUDED.address,
    max_daily_capacity = EXCLUDED.max_daily_capacity,
    current_queue = EXCLUDED.current_queue,
    active_counters = EXCLUDED.active_counters,
    total_counters = EXCLUDED.total_counters,
    congestion = EXCLUDED.congestion;

-- 6. Seed Pan-India Diverse Commodity Tokens
INSERT INTO tokens (token_number, centre_id, farmer_id, farmer_name, mobile, village, crop_type, variety, slot_date, slot_time, estimated_quantity, status, assigned_counter, weighbridge_number, total_amount)
VALUES
    ('KF-10243', 'centre-a', 'KF-R810241', 'Ramesh Kumar', '+91 98120 44921', 'Taraori', 'Wheat (Sharbati)', 'Sharbati Gold', 'Today', '11:30 AM - 12:00 PM', 32.0, 'CHECKED_IN', 'Counter 1', 'WB-01', 72800),
    ('KF-10237', 'centre-a', 'KF-H391029', 'Harpreet Singh', '+91 98140 23419', 'Samrala', 'Paddy (Dhan)', 'Basmati 1121', 'Today', '11:00 AM - 11:30 AM', 35.0, 'CHECKED_IN', 'Counter 2', 'WB-02', 77105),
    ('KF-10236', 'centre-a', 'KF-B948102', 'Balasaheb Patil', '+91 98220 31892', 'Lasalgaon', 'Soyabean', 'JS-335', 'Today', '11:00 AM - 11:30 AM', 40.0, 'PROCESSING', 'Counter 1', 'WB-01', 184000),
    ('KF-10238', 'centre-a', 'KF-D491028', 'Dilip Patel', '+91 98250 82103', 'Unjha', 'Cotton', 'Shankar-6', 'Today', '11:30 AM - 12:00 PM', 25.0, 'CHECKED_IN', 'Counter 2', 'WB-02', 165500),
    ('KF-10234', 'centre-a', 'KF-V291032', 'Vikramaditya Chouhan', '+91 98260 59281', 'Sanwer', 'Wheat (Sharbati)', 'Lok-1', 'Today', '10:00 AM - 10:30 AM', 28.0, 'COMPLETED', 'Counter 1', 'WB-01', 64268),
    ('KF-10235', 'centre-a', 'KF-V102931', 'Venkatesh Rao', '+91 98480 19283', 'Tenali', 'Cotton', 'Bt Cotton Long Staple', 'Today', '10:30 AM - 11:00 AM', 30.0, 'COMPLETED', 'Counter 2', 'WB-02', 210600),
    ('KF-10240', 'centre-a', 'KF-J291048', 'Jagdish Meena', '+91 98290 77210', 'Ramganj Mandi', 'Soyabean', 'JS-9560', 'Today', '12:00 PM - 12:30 PM', 26.0, 'BOOKED', NULL, NULL, 119600),
    ('KF-10230', 'centre-a', 'KF-G192039', 'Gurinder Brar', '+91 98150 99012', 'Rampura Phul', 'Wheat (Sharbati)', 'PBW-550', 'Today', '10:30 AM - 11:00 AM', 30.0, 'NO_SHOW', NULL, NULL, 68250)
ON CONFLICT (token_number) DO UPDATE SET
    centre_id = EXCLUDED.centre_id,
    farmer_id = EXCLUDED.farmer_id,
    farmer_name = EXCLUDED.farmer_name,
    mobile = EXCLUDED.mobile,
    village = EXCLUDED.village,
    crop_type = EXCLUDED.crop_type,
    variety = EXCLUDED.variety,
    slot_date = EXCLUDED.slot_date,
    slot_time = EXCLUDED.slot_time,
    estimated_quantity = EXCLUDED.estimated_quantity,
    status = EXCLUDED.status,
    assigned_counter = EXCLUDED.assigned_counter,
    weighbridge_number = EXCLUDED.weighbridge_number,
    total_amount = EXCLUDED.total_amount;`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const seedSampleData = async () => {
    setIsSeeding(true);
    setSeedStatus('Seeding national records into Supabase tokens table...');
    try {
      const sampleTokens = [
        { token_number: 'KF-10243', centre_id: 'centre-a', farmer_id: 'KF-R810241', farmer_name: 'Ramesh Kumar', mobile: '+91 98120 44921', village: 'Taraori', crop_type: 'Wheat (Sharbati)', variety: 'Sharbati Gold', slot_date: 'Today', slot_time: '11:30 AM - 12:00 PM', estimated_quantity: 32, status: 'CHECKED_IN', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 72800 },
        { token_number: 'KF-10237', centre_id: 'centre-a', farmer_id: 'KF-H391029', farmer_name: 'Harpreet Singh', mobile: '+91 98140 23419', village: 'Samrala', crop_type: 'Paddy (Dhan)', variety: 'Basmati 1121', slot_date: 'Today', slot_time: '11:00 AM - 11:30 AM', estimated_quantity: 35, status: 'CHECKED_IN', assigned_counter: 'Counter 2', weighbridge_number: 'WB-02', total_amount: 77105 },
        { token_number: 'KF-10236', centre_id: 'centre-a', farmer_id: 'KF-B948102', farmer_name: 'Balasaheb Patil', mobile: '+91 98220 31892', village: 'Lasalgaon', crop_type: 'Soyabean', variety: 'JS-335', slot_date: 'Today', slot_time: '11:00 AM - 11:30 AM', estimated_quantity: 40, status: 'PROCESSING', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 184000 },
        { token_number: 'KF-10238', centre_id: 'centre-a', farmer_id: 'KF-D491028', farmer_name: 'Dilip Patel', mobile: '+91 98250 82103', village: 'Unjha', crop_type: 'Cotton', variety: 'Shankar-6', slot_date: 'Today', slot_time: '11:30 AM - 12:00 PM', estimated_quantity: 25, status: 'CHECKED_IN', assigned_counter: 'Counter 2', weighbridge_number: 'WB-02', total_amount: 165500 },
        { token_number: 'KF-10234', centre_id: 'centre-a', farmer_id: 'KF-V291032', farmer_name: 'Vikramaditya Chouhan', mobile: '+91 98260 59281', village: 'Sanwer', crop_type: 'Wheat (Sharbati)', variety: 'Lok-1', slot_date: 'Today', slot_time: '10:00 AM - 10:30 AM', estimated_quantity: 28, status: 'COMPLETED', assigned_counter: 'Counter 1', weighbridge_number: 'WB-01', total_amount: 64268 },
        { token_number: 'KF-10235', centre_id: 'centre-a', farmer_id: 'KF-V102931', farmer_name: 'Venkatesh Rao', mobile: '+91 98480 19283', village: 'Tenali', crop_type: 'Cotton', variety: 'Bt Cotton Long Staple', slot_date: 'Today', slot_time: '10:30 AM - 11:00 AM', estimated_quantity: 30, status: 'COMPLETED', assigned_counter: 'Counter 2', weighbridge_number: 'WB-02', total_amount: 210600 },
        { token_number: 'KF-10240', centre_id: 'centre-a', farmer_id: 'KF-J291048', farmer_name: 'Jagdish Meena', mobile: '+91 98290 77210', village: 'Ramganj Mandi', crop_type: 'Soyabean', variety: 'JS-9560', slot_date: 'Today', slot_time: '12:00 PM - 12:30 PM', estimated_quantity: 26, status: 'BOOKED', total_amount: 119600 },
        { token_number: 'KF-10230', centre_id: 'centre-a', farmer_id: 'KF-G192039', farmer_name: 'Gurinder Brar', mobile: '+91 98150 99012', village: 'Rampura Phul', crop_type: 'Wheat (Sharbati)', variety: 'PBW-550', slot_date: 'Today', slot_time: '10:30 AM - 11:00 AM', estimated_quantity: 30, status: 'NO_SHOW', total_amount: 68250 }
      ];

      const { error } = await supabase.from('tokens').upsert(sampleTokens, { onConflict: 'token_number' });
      if (error) {
        setSeedStatus(`Note: ${error.message}. Please run the SQL schema first.`);
      } else {
        setSeedStatus('Successfully seeded demo tokens into Supabase!');
      }
    } catch (err: any) {
      setSeedStatus(`Notice: ${err.message || 'Run schema SQL first'}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-heading flex items-center gap-2">
                Supabase Backend & Database Schema
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  PostgreSQL Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                PostgreSQL schema for <code className="text-emerald-400">centres</code> & <code className="text-emerald-400">tokens</code> tables with status enum.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Connection Details */}
          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Supabase Project URL:</span>
              <span className="font-mono text-emerald-400 font-semibold truncate max-w-[280px]">
                https://wcojyyqiueuxwvzblrxz.supabase.co
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Environment Config:</span>
              <span className="font-mono text-slate-300">
                .env (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Enum Specification:</span>
              <span className="font-mono text-amber-300 font-bold">
                ('BOOKED', 'CHECKED_IN', 'PROCESSING', 'COMPLETED', 'NO_SHOW')
              </span>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Schema SQL'}</span>
              </button>

              <button
                onClick={seedSampleData}
                disabled={isSeeding}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin text-emerald-400' : ''}`} />
                <span>Seed Records via SDK</span>
              </button>
            </div>

            <a
              href="https://supabase.com/dashboard/project/wcojyyqiueuxwvzblrxz/sql"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-medium underline"
            >
              <span>Open Supabase SQL Editor</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {seedStatus && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-emerald-300 flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{seedStatus}</span>
            </div>
          )}

          {/* SQL Editor Code Block */}
          <div>
            <div className="flex items-center justify-between pb-1.5 text-slate-400 font-medium text-[11px]">
              <span>SQL DDL Schema (Run once in Supabase Dashboard):</span>
              <span>PostgreSQL 15+</span>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 leading-relaxed scrollbar-thin">
              {sqlSchema}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            supabase_schema.sql saved in root directory
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
