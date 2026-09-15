import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  User, 
  ArrowRight, 
  Sparkles, 
  ChevronDown,
  Award
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { AdminUser } from '../../types';

interface AdminAuthProps {
  onSuccess?: () => void;
}

export const AdminAuth: React.FC<AdminAuthProps> = ({ onSuccess }) => {
  const { adminLogin, centres, selectedCentreId, setViewMode } = useKisanFlow();

  const [officerId, setOfficerId] = useState('OFFICER-A102');
  const [password, setPassword] = useState('admin123');
  const [selectedCentre, setSelectedCentre] = useState(selectedCentreId || 'centre-a');
  const [role, setRole] = useState<AdminUser['role']>('CENTRE_OFFICER');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId.trim() || !password.trim()) {
      setErrorMessage('Please enter official ID and security passcode');
      return;
    }
    try {
      localStorage.setItem('kisanflow_role', 'admin');
    } catch {
      // Safe fallback
    }
    adminLogin(officerId, password, selectedCentre, role);
    setViewMode('ADMIN');
    onSuccess?.();
  };

  const handleQuickDemo = () => {
    try {
      localStorage.setItem('kisanflow_role', 'admin');
    } catch {
      // Safe fallback
    }
    adminLogin('OFFICER-A102', 'admin123', selectedCentre || 'centre-a', 'CENTRE_OFFICER');
    setViewMode('ADMIN');
    onSuccess?.();
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 py-4 select-none">
      {/* Top Emblem Card matching Screenshot 2 */}
      <div className="bg-[#0c1322] border border-slate-800/80 rounded-[28px] p-6 text-center shadow-xl relative overflow-hidden">
        {/* Emblem Badge with Building Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-400 flex items-center justify-center mx-auto text-slate-950 shadow-lg shadow-emerald-500/20 mb-3">
          <Building2 className="w-7 h-7 text-slate-950" />
        </div>

        {/* Pill Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider mb-2.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>GOVERNMENT MANDI COMMAND PORTAL</span>
        </div>

        {/* Title */}
        <h2 className="font-heading font-extrabold text-2xl text-white tracking-tight">
          Procurement Officer In-Charge Login
        </h2>

        {/* Subtitle */}
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
          Ministry of Agriculture, Govt of India • e-NAM / FCI Procurement Gateway
        </p>
      </div>

      {/* Main Login Box matching Screenshot 2 */}
      <div className="bg-[#0c1322] border border-slate-800/80 rounded-[28px] p-6 sm:p-7 shadow-2xl space-y-4">
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Centre Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Select Mandi Procurement Center
            </label>
            <div className="relative">
              <select
                value={selectedCentre}
                onChange={(e) => setSelectedCentre(e.target.value)}
                className="w-full bg-[#131d33] border border-slate-700/80 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium cursor-pointer shadow-inner appearance-none pr-9"
              >
                {centres.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code}) - {c.congestion.toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Operating Authority / Role */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Operating Authority / Role
            </label>
            <div className="grid grid-cols-3 gap-2 text-center">
              <button
                type="button"
                onClick={() => setRole('CENTRE_OFFICER')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  role === 'CENTRE_OFFICER'
                    ? 'bg-[#10b981] text-white shadow-md shadow-emerald-950/40'
                    : 'bg-[#131d33] text-slate-400 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                Centre Head
              </button>
              <button
                type="button"
                onClick={() => setRole('WEIGHBRIDGE_OPERATOR')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  role === 'WEIGHBRIDGE_OPERATOR'
                    ? 'bg-[#10b981] text-white shadow-md shadow-emerald-950/40'
                    : 'bg-[#131d33] text-slate-400 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                Weighbridge
              </button>
              <button
                type="button"
                onClick={() => setRole('DISTRICT_NODAL')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  role === 'DISTRICT_NODAL'
                    ? 'bg-[#10b981] text-white shadow-md shadow-emerald-950/40'
                    : 'bg-[#131d33] text-slate-400 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                District Admin
              </button>
            </div>
          </div>

          {/* Officer ID */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Official Government ID / Email
            </label>
            <div className="flex items-center bg-[#131d33] border border-slate-700/80 rounded-xl px-4 py-3 text-white text-xs shadow-inner focus-within:border-emerald-500">
              <User className="w-4 h-4 text-slate-400 mr-2.5 flex-shrink-0" />
              <input
                type="text"
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                placeholder="OFFICER-A102"
                className="bg-transparent focus:outline-none w-full text-white font-mono font-bold text-xs"
                required
              />
            </div>
          </div>

          {/* Security Passcode */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Security Passcode
            </label>
            <div className="flex items-center bg-[#131d33] border border-slate-700/80 rounded-xl px-4 py-3 text-white text-xs shadow-inner focus-within:border-emerald-500">
              <Lock className="w-4 h-4 text-slate-400 mr-2.5 flex-shrink-0" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-transparent focus:outline-none w-full text-white font-mono text-xs tracking-widest"
                required
              />
            </div>
          </div>

          {/* Submit Button with Emerald to Indigo/Blue Gradient */}
          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-[#10b981] via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-heading font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all active:scale-[0.99]"
          >
            <span>Authorize & Open Command Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Secondary Quick Demo Login Button */}
        <button
          type="button"
          onClick={handleQuickDemo}
          className="w-full py-3 bg-[#15213b] hover:bg-[#1a2948] text-emerald-400 border border-slate-700/60 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>One-Click Login as Officer A102 (Demo)</span>
        </button>
      </div>

      {/* Footer Security Badge matching Screenshot 2 */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center pt-2">
        <Award className="w-3.5 h-3.5 text-amber-500" />
        <span>FCI Standard Protocol • 256-bit Encrypted Session</span>
      </div>
    </div>
  );
};
