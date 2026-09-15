export type Language = 'en' | 'hi' | 'od';

export type QueueStage = 
  | 'BOOKED'
  | 'CHECKED_IN'
  | 'ARRIVED'
  | 'IN_QUEUE'
  | 'WEIGHING'
  | 'WEIGHED'
  | 'QUALITY_CHECK'
  | 'TESTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';

export type CongestionLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface FarmerProfile {
  id: string;
  name: string;
  mobile: string;
  aadhaarDummy: string;
  village: string;
  panchayat: string;
  district: string;
  state: string;
  preferredLang: Language;
  landSizeAcres: number;
  bankName: string;
  bankAccountMasked: string;
  ifsc: string;
}

export interface ProcurementCentre {
  id: string;
  code: string;
  name: string;
  address: string;
  district: string;
  distanceKm: number;
  currentQueue: number;
  waitTimeMin: number;
  maxDailyCapacity: number;
  todayBooked: number;
  todayArrived: number;
  todayProcessing: number;
  todayCompleted: number;
  todayWaiting: number;
  todayNoShow: number;
  congestion: CongestionLevel;
  activeCounters: number;
  totalCounters: number;
  lat: number;
  lng: number;
  isOpen: boolean;
}

export interface SlotBooking {
  id: string;
  tokenNumber: string; // e.g. KF-10243
  farmerId: string;
  farmerName: string;
  mobile: string;
  village: string;
  centreId: string;
  centreName: string;
  cropType: string;
  variety: string;
  estimatedQuantity: number; // in Quintals
  actualQuantity?: number;
  actualWeight?: number;
  moisturePercent?: number;
  finalPayout?: number;
  bookingDate: string;
  slotTime: string;
  status: QueueStage;
  queuePosition?: number;
  predictedWaitMin: number;
  qualityGrade?: 'Grade A' | 'Grade B' | 'Standard';
  mspRatePerQtl: number;
  totalAmount: number;
  paymentStatus: 'PENDING' | 'INITIATED' | 'CREDITED';
  paymentRef?: string;
  checkInOtp: string;
  assignedCounter?: string;
  weighbridgeNumber?: string;
  createdAt: string;
  checkInTime?: string;
  completedTime?: string;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: 'reminder' | 'status' | 'smart_arrival' | 'turn_alert' | 'payment' | 'recovery';
  read: boolean;
  actionUrl?: string;
}

export interface SlotRecoveryOffer {
  id: string;
  targetFarmerId: string;
  tokenNumber: string;
  centreId: string;
  centreName: string;
  vacatedByToken: string;
  originalSlot: string;
  offeredSlot: string;
  expiresInSeconds: number;
  active: boolean;
}

export interface HourlyForecast {
  timeSlot: string; // e.g. "10:00 AM"
  expectedFarmers: number;
  capacity: number;
  congestion: CongestionLevel;
  alert?: boolean;
}

export interface GrievanceTicket {
  id: string;
  farmerId: string;
  farmerName: string;
  category: 'Quantity Discrepancy' | 'Payment Delay' | 'Slot Issue' | 'Centre Facility';
  details: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED';
  filedAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  designation: string;
  centreId: string;
  centreName: string;
  role: 'CENTRE_OFFICER' | 'WEIGHBRIDGE_OPERATOR' | 'DISTRICT_NODAL';
  badgeNumber: string;
  lastLogin: string;
}

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

