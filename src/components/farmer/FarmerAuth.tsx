import React, { useState } from 'react';
import { 
  Tractor, 
  KeyRound, 
  ShieldCheck, 
  ArrowRight, 
  UserPlus, 
  Sparkles, 
  CheckCircle2, 
  Languages, 
  ChevronDown
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { FarmerProfile, Language } from '../../types';

interface FarmerAuthProps {
  onSuccess?: () => void;
}

export const FarmerAuth: React.FC<FarmerAuthProps> = ({ onSuccess }) => {
  const { 
    farmerLogin, 
    farmerRegister, 
    farmer, 
    language, 
    setLanguage, 
    setViewMode 
  } = useKisanFlow();

  // Mode: LOGIN, OTP, REGISTER
  const [authMode, setAuthMode] = useState<'LOGIN' | 'OTP' | 'REGISTER'>('LOGIN');
  const [mobileNumber, setMobileNumber] = useState('9876543210');
  const [otpValue, setOtpValue] = useState(['4', '8', '2', '1']);
  const [errorMessage, setErrorMessage] = useState('');

  // New Farmer Registration form state
  const [regName, setRegName] = useState('Pradeep Jena');
  const [regMobile, setRegMobile] = useState('+91 98120 44921');
  const [regAadhaar, setRegAadhaar] = useState('XXXX-XXXX-7124');
  const [regVillage, setRegVillage] = useState('Banki');
  const [regDistrict, setRegDistrict] = useState('Cuttack');
  const [regLand, setRegLand] = useState(4.5);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileNumber.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    setErrorMessage('');
    setAuthMode('OTP');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = otpValue.join('');
    if (entered.length < 4) {
      setErrorMessage('Please enter the 4-digit OTP.');
      return;
    }
    try {
      localStorage.setItem('kisanflow_role', 'farmer');
    } catch {
      // Safe fallback
    }
    farmerLogin(`+91 ${mobileNumber}`, entered);
    setViewMode('FARMER');
    onSuccess?.();
  };

  const handleInstantDemoLogin = () => {
    try {
      localStorage.setItem('kisanflow_role', 'farmer');
    } catch {
      // Safe fallback
    }
    farmerLogin(farmer.mobile, '4821');
    setViewMode('FARMER');
    onSuccess?.();
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    // --- NEW VALIDATION LOGIC ---
    if (regName.trim().length < 3) {
      setErrorMessage('Please enter a valid full name (min 3 characters).');
      return;
    }

    const mobileDigits = regMobile.replace(/\D/g, ''); 
    const isValidIndianMobile = /^[6-9]\d{9}$/.test(mobileDigits.slice(-10));
    if (!isValidIndianMobile || mobileDigits.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    // Govt ID Validation: Exactly 12 chars, no all-zeros
    const cleanGovtId = regAadhaar.replace(/[-\s]/g, ''); // Strip spaces and hyphens
    if (cleanGovtId.length !== 12) {
      setErrorMessage('Govt ID must be exactly 12 characters.');
      return;
    }
    if (/^0+$/.test(cleanGovtId)) {
      setErrorMessage('Govt ID cannot be all zeros.');
      return;
    }

    if (regVillage.trim().length < 2) {
      setErrorMessage('Please enter a valid village name.');
      return;
    }

    if (regLand <= 0) {
      setErrorMessage('Please enter a valid land size greater than 0.');
      return;
    }

    // Clear error if all validations pass
    setErrorMessage('');
    // ---------------------------

    const newProfile: FarmerProfile = {
      id: `KF-R${Math.floor(100000 + Math.random() * 900000)}`,
      name: regName,
      mobile: regMobile,
      aadhaarDummy: regAadhaar,
      village: regVillage,
      panchayat: 'Nilokheri',
      district: regDistrict,
      state: 'Odisha',
      preferredLang: language,
      landSizeAcres: regLand,
      bankName: 'Punjab National Bank (DBT Verified)',
      bankAccountMasked: 'PUNB0001092 - A/C **3918',
      ifsc: 'PUNB0001092',
    };
    try {
      localStorage.setItem('kisanflow_role', 'farmer');
    } catch {
      // Safe fallback
    }
    farmerRegister(newProfile);
    setViewMode('FARMER');
    onSuccess?.();
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-4 py-2 select-none">
      {/* Top Welcome Card */}
      <div className="bg-gradient-to-b from-[#107048] via-[#0b5437] to-[#073c27] p-6 rounded-[28px] text-white text-center shadow-2xl relative overflow-hidden border border-emerald-500/20">
        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center mx-auto mb-3.5 shadow-inner">
          <Tractor className="w-8 h-8 text-emerald-200" />
        </div>
        <h1 className="font-heading font-extrabold text-2xl text-white tracking-tight">
          KisanFlow
        </h1>
        <p className="text-xs text-emerald-100/90 mt-1 max-w-[240px] mx-auto leading-relaxed">
          Smart Procurement & Dynamic Queue Management System
        </p>
        <div className="mt-3.5 inline-flex items-center gap-1.5 bg-black/25 backdrop-blur-md px-4 py-1.5 rounded-full border border-emerald-400/25 text-xs text-emerald-100 font-medium">
          <Languages className="w-3.5 h-3.5 text-emerald-300" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent text-emerald-100 font-semibold focus:outline-none text-xs cursor-pointer"
          >
            <option value="en" className="bg-slate-900 text-white">English</option>
            <option value="hi" className="bg-slate-900 text-white">हिंदी (Hindi)</option>
            <option value="od" className="bg-slate-900 text-white">ଓଡ଼ିଆ (Odia)</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-emerald-300 pointer-events-none" />
        </div>
      </div>

      {/* Main Authentication Box */}
      <div className="bg-[#0c1322] border border-slate-800/80 rounded-[28px] p-6 shadow-2xl space-y-4">
        {/* Segmented Tab Pill */}
        <div className="flex bg-[#121c2e] p-1.5 rounded-2xl border border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthMode('LOGIN');
              setErrorMessage('');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-heading font-bold text-xs transition-all cursor-pointer ${
              authMode === 'LOGIN' || authMode === 'OTP'
                ? 'bg-[#10b981] text-white shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Farmer Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('REGISTER');
              setErrorMessage('');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-heading font-bold text-xs transition-all cursor-pointer ${
              authMode === 'REGISTER'
                ? 'bg-[#10b981] text-white shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            New Registration
          </button>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        {/* STEP 1: Enter Mobile Number */}
        {authMode === 'LOGIN' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-200 block mb-2">
                Enter Registered Mobile Number
              </label>
              <div className="flex items-center bg-[#141e32] border border-slate-700/80 rounded-xl px-4 py-3.5 text-white text-xs font-mono focus-within:border-emerald-500 shadow-inner">
                <span className="text-slate-300 font-bold text-sm tracking-wider mr-2">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="bg-transparent focus:outline-none w-full text-white font-bold text-base tracking-wider"
                  required
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1.5 block">
                Linked to your PM-KISAN / e-NAM National Registry
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#10b981] hover:bg-emerald-500 text-white font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all active:scale-[0.99]"
            >
              <span>Get 4-Digit Login OTP</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: Verify OTP */}
        {authMode === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div 
              onClick={() => setOtpValue(['4', '8', '2', '1'])}
              className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between cursor-pointer hover:bg-amber-950/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Simulated SMS OTP: <strong>4821</strong></span>
              </div>
              <span className="text-[11px] text-amber-300 underline font-semibold">Auto-fill</span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-slate-300 font-semibold">
                  Enter 4-Digit OTP
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Sent to +91 {mobileNumber}</span>
              </div>
              <div className="flex justify-center gap-3">
                {otpValue.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const nextVal = [...otpValue];
                      nextVal[idx] = e.target.value.replace(/\D/g, '').slice(0, 1);
                      setOtpValue(nextVal);
                    }}
                    className="w-12 h-12 text-center text-xl font-mono font-black bg-[#141e32] border-2 border-emerald-500/50 focus:border-emerald-400 rounded-xl text-white focus:outline-none shadow-sm"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#10b981] hover:bg-emerald-500 text-white font-heading font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all active:scale-[0.99]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify & Access Farmer Portal</span>
            </button>

            <div className="flex justify-between items-center text-[11px] pt-1">
              <button
                type="button"
                onClick={() => setAuthMode('LOGIN')}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                Change Number
              </button>
              <button
                type="button"
                onClick={() => alert('New OTP 4821 resent!')}
                className="text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                Resend OTP in 30s
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Register New Farmer Profile */}
        {authMode === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                Full Farmer Name
              </label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full bg-[#141e32] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  className="w-full bg-[#141e32] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">
                  Aadhaar / Govt ID
                </label>
                <input
                  type="text"
                  value={regAadhaar}
                  onChange={(e) => setRegAadhaar(e.target.value)}
                  className="w-full bg-[#141e32] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">
                  Village
                </label>
                <input
                  type="text"
                  value={regVillage}
                  onChange={(e) => setRegVillage(e.target.value)}
                  className="w-full bg-[#141e32] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">
                  Land Size (Acres)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={regLand}
                  onChange={(e) => setRegLand(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#141e32] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#10b981] hover:bg-emerald-500 text-white font-heading font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer mt-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Farmer ID & Register</span>
            </button>
          </form>
        )}

        {/* Secondary Instant Demo Login Button */}
        <button
          type="button"
          onClick={handleInstantDemoLogin}
          className="w-full py-3 bg-[#162238] hover:bg-[#1b2b46] text-emerald-400 border border-slate-700/60 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Instant Demo Login (Ramesh Kumar - Odisha)</span>
        </button>
      </div>

      {/* Govt security footnote */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center pt-1">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Secured via Ministry of Agriculture & Farmers Welfare, Govt of India</span>
      </div>
    </div>
  );
};