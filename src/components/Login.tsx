import React, { useState } from 'react';
import { 
  Smartphone, 
  Building2, 
  ArrowLeft,
  Languages
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useKisanFlow } from '../context/KisanFlowContext';
import { FarmerAuth } from './farmer/FarmerAuth';
import { AdminAuth } from './admin/AdminAuth';
import { Language } from '../types';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useKisanFlow();

  // Initial role based on previous selection or default to farmer
  const initialRole = (() => {
    try {
      const saved = localStorage.getItem('kisanflow_role');
      if (saved === 'admin') return 'admin';
    } catch {}
    return 'farmer';
  })();

  const [activePortal, setActivePortal] = useState<'farmer' | 'admin'>(initialRole);

  return (
    <div className="w-screen min-h-screen bg-[#060a12] text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-x-hidden selection:bg-emerald-500 selection:text-white">
      {/* Background ambient accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 z-20 pb-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Live Mandi Portal</span>
        </button>

        {/* Portal View Switcher matching user's two views */}
        <div className="flex items-center bg-[#0d1527] p-1 rounded-2xl border border-slate-800 shadow-lg text-xs">
          <button
            type="button"
            onClick={() => setActivePortal('farmer')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
              activePortal === 'farmer'
                ? 'bg-[#10b981] text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile Farmer Login</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePortal('admin')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
              activePortal === 'admin'
                ? 'bg-[#10b981] text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Admin Web Login</span>
          </button>
        </div>

        {/* Language selector in top bar */}
        <div className="hidden sm:inline-flex items-center gap-1.5 bg-[#0d1527] border border-slate-800 px-3 py-1.5 rounded-full text-xs">
          <Languages className="w-3.5 h-3.5 text-emerald-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent text-slate-200 font-semibold focus:outline-none text-xs cursor-pointer"
          >
            <option value="en" className="bg-slate-900 text-white">English</option>
            <option value="hi" className="bg-slate-900 text-white">हिंदी (Hindi)</option>
            <option value="od" className="bg-slate-900 text-white">ଓଡ଼ିଆ (Odia)</option>
          </select>
        </div>
      </div>

      {/* Main Content Area: Displays exact UI matching the selected screenshot */}
      <div className="flex-1 flex items-center justify-center z-10 w-full">
        {activePortal === 'farmer' ? (
          <FarmerAuth onSuccess={() => navigate('/')} />
        ) : (
          <AdminAuth onSuccess={() => navigate('/')} />
        )}
      </div>

      {/* Bottom spacer / copyright */}
      <div className="w-full text-center text-[11px] text-slate-600 py-3 z-10">
        KisanFlow • Ministry of Agriculture & Farmers Welfare, Govt of India
      </div>
    </div>
  );
};
