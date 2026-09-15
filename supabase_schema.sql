-- =========================================================
-- KisanFlow Supabase PostgreSQL Schema
-- Run this in your Supabase Dashboard -> SQL Editor -> Run
-- =========================================================

-- 1. Create Token Status Enum
DO $$ BEGIN
    CREATE TYPE token_status AS ENUM ('BOOKED', 'CHECKED_IN', 'PROCESSING', 'COMPLETED', 'NO_SHOW', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN 
        BEGIN
            ALTER TYPE token_status ADD VALUE IF NOT EXISTS 'CANCELLED';
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
    quality_grade TEXT,
    total_amount NUMERIC(12,2) DEFAULT 0,
    status token_status NOT NULL DEFAULT 'BOOKED',
    assigned_counter TEXT,
    weighbridge_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS) & Public Policies for App Access
ALTER TABLE centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read & write for app operations
CREATE POLICY "Allow public read access on centres" 
    ON centres FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update on centres" 
    ON centres FOR ALL USING (true);

CREATE POLICY "Allow public read access on tokens" 
    ON tokens FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update/delete on tokens" 
    ON tokens FOR ALL USING (true);

-- 5. Seed Initial Centres
INSERT INTO centres (id, name, code, address, distance_km, max_daily_capacity, current_queue, active_counters, total_counters, avg_processing_time_min, congestion)
VALUES
    ('centre-a', 'Khurda Central Mandi Yard', 'A102', 'Plot 14, Mandi Bypass, Khurda Town', 4.2, 100, 18, 2, 3, 14, 'MODERATE'),
    ('centre-b', 'Jatni Sub-Mandi Procurement Point', 'B108', 'Near Station Road, Jatni, Khurda', 6.1, 80, 31, 2, 2, 22, 'HIGH'),
    ('centre-c', 'Bhubaneswar South Rural Collection Center', 'C105', 'NH-16 Agro Terminal, Info Valley', 5.0, 120, 9, 3, 4, 11, 'LOW')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    current_queue = EXCLUDED.current_queue;

-- 6. Seed Initial Tokens
INSERT INTO tokens (token_number, centre_id, farmer_id, farmer_name, mobile, village, crop_type, variety, slot_date, slot_time, estimated_quantity, status, assigned_counter, weighbridge_number, total_amount)
VALUES
    ('KF-10234', 'centre-a', 'KF-B291032', 'Bidyadhar Sahoo', '+91 94371 88201', 'Khurda Sadar', 'Paddy (Dhan)', 'Swarna', 'Today', '10:00 AM - 10:30 AM', 28.0, 'COMPLETED', 'Counter 1', 'WB-01', 61684),
    ('KF-10235', 'centre-a', 'KF-P102931', 'Pravat Nayak', '+91 98610 23419', 'Jatni Rural', 'Paddy (Dhan)', 'Pooja', 'Today', '10:30 AM - 11:00 AM', 35.0, 'COMPLETED', 'Counter 2', 'WB-02', 77105),
    ('KF-10236', 'centre-a', 'KF-D948102', 'Dillip Rout', '+91 99370 12891', 'Gopinathpur', 'Paddy (Dhan)', 'Samba Mahsuri', 'Today', '11:00 AM - 11:30 AM', 40.0, 'PROCESSING', 'Counter 1', 'WB-01', 0),
    ('KF-10237', 'centre-a', 'KF-M391029', 'Manas Das', '+91 97761 09382', 'Bajapur', 'Paddy (Dhan)', 'Swarna', 'Today', '11:00 AM - 11:30 AM', 24.5, 'CHECKED_IN', 'Counter 2', 'WB-02', 0),
    ('KF-10238', 'centre-a', 'KF-K491028', 'Kailash Behera', '+91 93380 91823', 'Kantabada', 'Paddy (Dhan)', 'MTU 1010', 'Today', '11:30 AM - 12:00 PM', 30.0, 'CHECKED_IN', NULL, NULL, 0),
    ('KF-10239', 'centre-a', 'KF-N102948', 'Niranjan Jena', '+91 98530 48192', 'Mendhasal', 'Paddy (Dhan)', 'Samba Mahsuri', 'Today', '11:30 AM - 12:00 PM', 38.0, 'CHECKED_IN', NULL, NULL, 0),
    ('KF-10240', 'centre-a', 'KF-S291048', 'Subash Pradhan', '+91 94390 19283', 'Puri Road', 'Paddy (Dhan)', 'Pooja', 'Today', '12:00 PM - 12:30 PM', 26.0, 'BOOKED', NULL, NULL, 0),
    ('KF-10241', 'centre-a', 'KF-T491029', 'Trilochan Sethi', '+91 97780 18293', 'Taraboi', 'Paddy (Dhan)', 'Swarna', 'Today', '12:00 PM - 12:30 PM', 31.0, 'BOOKED', NULL, NULL, 0),
    ('KF-10242', 'centre-a', 'KF-P591029', 'Prasanna Swain', '+91 99380 19284', 'Jatani', 'Paddy (Dhan)', 'Lalat', 'Today', '12:30 PM - 01:00 PM', 22.0, 'BOOKED', NULL, NULL, 0),
    ('KF-10243', 'centre-a', 'KF-R810241', 'Ramesh Kumar', '+91 98765 43210', 'Kantabada', 'Paddy (Dhan)', 'Samba Mahsuri', 'Today', '11:30 AM - 12:00 PM', 32.0, 'CHECKED_IN', 'Counter 1', 'WB-01', 0),
    ('KF-10230', 'centre-a', 'KF-G192039', 'Gopal Charan Das', '+91 94372 99012', 'Khurda Ward 3', 'Paddy (Dhan)', 'Swarna', 'Today', '10:30 AM - 11:00 AM', 25.0, 'NO_SHOW', NULL, NULL, 0)
ON CONFLICT (token_number) DO NOTHING;
