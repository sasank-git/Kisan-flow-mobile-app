import React, { useState } from 'react';
import { 
  Building2, 
  Activity, 
  Layers, 
  Users, 
  AlertTriangle, 
  Settings, 
  TrendingUp,
  Flame,
  Scale,
  LogOut,
  ShieldCheck,
  UserCheck,
  QrCode,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { CentreStatsCards } from './CentreStatsCards';
import { AiCongestionBanner } from './AiCongestionBanner';
import { DigitalTwinSimulation } from './DigitalTwinSimulation';
import { LiveQueueTable } from './LiveQueueTable';
import { DistrictOverview } from './DistrictOverview';
import { AdminAuth } from './AdminAuth';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    centres, 
    selectedCentreId, 
    setSelectedCentreId, 
    isAdminAuthenticated, 
    adminLogin,
    adminUser, 
    adminLogout,
    isGateScannerOpen,
    setGateScannerOpen
  } = useKisanFlow();
  
  const [activeTab, setActiveTab] = useState<'OPERATIONS' | 'DIGITAL_TWIN' | 'DISTRICT'>('OPERATIONS');

  // If officer is not authenticated, show AdminAuth matching Screenshot 2
  if (!isAdminAuthenticated) {
    return <AdminAuth />;
  }

  return (
    <div className="w-full space-y-5">
      {/* Top Centre Switcher & Officer Badge Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-3xl shadow-md">
        {/* Left: Centre Selector */}
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs text-slate-400 font-medium">Active Mandi:</span>
          <select
            value={selectedCentreId}
            onChange={(e) => setSelectedCentreId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {centres.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code}) - {c.congestion} Load
              </option>
            ))}
          </select>
        </div>

        {/* Middle: View Mode Tabs */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-2xl border border-slate-700 text-xs">
          <button
            onClick={() => setActiveTab('OPERATIONS')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              activeTab === 'OPERATIONS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Operations
          </button>
          <button
            onClick={() => setActiveTab('DIGITAL_TWIN')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              activeTab === 'DIGITAL_TWIN'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Digital Twin Model
          </button>
          <button
            onClick={() => setActiveTab('DISTRICT')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              activeTab === 'DISTRICT'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            District 28 Mandis
          </button>
        </div>

        {/* Right: Scan Gate QR Pass, Officer Profile & Logout */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Prominent Scan Gate QR Pass Action Button */}
          <button
            onClick={() => setGateScannerOpen(true)}
            className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-heading font-extrabold text-xs px-3.5 py-2 rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer shrink-0"
            title="Open camera scanner for incoming farmer E-Token gate check-in"
          >
            <QrCode className="w-4 h-4 stroke-[2.5]" />
            <span>Scan Gate QR Pass</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-2xl">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold font-mono">
              DJ
            </div>
            <div className="text-left leading-tight">
              <span className="text-xs font-bold text-white block">
                {adminUser?.name || 'Dinabandhu Jena'}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono block">
                {adminUser?.badgeNumber || 'GOV-OD-8812'} • {adminUser?.role === 'DISTRICT_NODAL' ? 'District Nodal' : 'In-Charge'}
              </span>
            </div>
          </div>

          <button
            onClick={adminLogout}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-600/40 transition-colors"
            title="Sign Out Officer Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Centre Metric Cards */}
      <CentreStatsCards />

      {/* AI Congestion Alert & Prescriptive Load Balancing Banner */}
      <AiCongestionBanner />

      {/* Dynamic View Sections */}
      {activeTab === 'OPERATIONS' && (
        <div className="space-y-5">
          <LiveQueueTable />
          <DigitalTwinSimulation />
        </div>
      )}

      {activeTab === 'DIGITAL_TWIN' && (
        <div className="space-y-5">
          <DigitalTwinSimulation />
          <LiveQueueTable />
        </div>
      )}

      {activeTab === 'DISTRICT' && (
        <div className="space-y-5">
          <DistrictOverview />
          <LiveQueueTable />
        </div>
      )}
    </div>
  );
};
