import React from 'react';
import { 
  Tractor, 
  Monitor, 
  Smartphone, 
  Columns, 
  PhoneCall, 
  Languages, 
  CheckCircle2, 
  Clock, 
  Zap, 
  RefreshCw,
  Bell,
  AlertTriangle,
  Flame,
  Sparkles,
  Lock,
  UserCheck,
  Database,
  QrCode,
  LogIn
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useKisanFlow } from '../context/KisanFlowContext';
import { Language } from '../types';
import { SupabaseModal } from './SupabaseModal';
import { NotificationDrawer } from './notifications/NotificationDrawer';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const [supabaseModalOpen, setSupabaseModalOpen] = React.useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = React.useState(false);
  const { 
    language, 
    setLanguage, 
    t, 
    viewMode, 
    setViewMode, 
    triggerQuickScenario, 
    isSimulating,
    setIvrModalOpen,
    setGateScannerOpen,
    notifications,
    isFarmerAuthenticated,
    isAdminAuthenticated,
    quickDemoLoginBoth,
    adminUser,
    farmer
  } = useKisanFlow();

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Gov Emblem Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-amber-500 flex items-center justify-center shadow-lg shadow-emerald-950/40 text-white font-bold">
            <Tractor className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-xl tracking-tight text-white">
                Kisan<span className="text-emerald-400">Flow</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Ministry of Agriculture, Govt of India
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 hidden sm:inline-flex">
                e-NAM / FCI Procurement
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Center: View Switcher */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
          <button
            onClick={() => setViewMode('DUAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'DUAL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Split view showing Farmer App and Admin Dashboard live sync side-by-side"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dual Sync</span>
            <span className="sm:hidden">Dual</span>
          </button>

          <button
            onClick={() => setViewMode('FARMER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'FARMER'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Farmer App</span>
          </button>

          <button
            onClick={() => setViewMode('ADMIN')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'ADMIN'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Admin Mandi</span>
          </button>
        </div>

        {/* Right Controls: Notifications Bell, IVR Audio Helpline, Supabase DB & Language Toggle */}
        <div className="flex items-center gap-2">
          {/* Global Notification Bell Trigger */}
          <button
            type="button"
            onClick={() => setNotificationDrawerOpen(true)}
            className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
            title="Open Notifications & Queue Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-lg animate-pulse border-2 border-slate-900">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Supabase Schema & DB Status Button */}
          <button
            onClick={() => setSupabaseModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
            title="Inspect Supabase PostgreSQL connection and copy CREATE TABLE schema"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Supabase DB</span>
          </button>

          {/* IVR Voice Simulation Button */}
          <button
            onClick={() => setIvrModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
            title="Simulate IVR audio telephone helpline for non-smartphone farmers"
          >
            <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Voice Helpline (IVR)</span>
          </button>

          {/* Standalone Login Link */}
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer"
            title="Open Dedicated Login Page"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign In</span>
          </button>

          {/* Language Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
            <Languages className="w-3.5 h-3.5 ml-2 text-slate-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-transparent text-slate-200 font-medium py-1 px-2 text-xs focus:outline-none cursor-pointer"
            >
              <option value="en" className="bg-slate-800 text-white">English</option>
              <option value="hi" className="bg-slate-800 text-white">हिंदी (Hindi)</option>
              <option value="od" className="bg-slate-800 text-white">ଓଡ଼ିଆ (Odia)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Interactive Scenario Bar for Presentation / Demo */}
      <div className="bg-slate-950/70 border-t border-slate-800/80 px-4 py-1.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="text-slate-300 font-semibold">{t.demoControls}:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setGateScannerOpen(true)}
              className="px-2.5 py-1 rounded bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold border border-emerald-400/60 shadow-sm transition-all flex items-center gap-1 cursor-pointer"
              title="Open physical webcam QR scanner for farmer gate check-in"
            >
              <QrCode className="w-3 h-3 stroke-[2.5]" />
              <span>Scan Gate QR Pass</span>
            </button>

            <button
              onClick={() => triggerQuickScenario('CHECKIN')}
              disabled={isSimulating}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 hover:border-emerald-700/60 text-slate-300 transition-colors flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>1. Gate Check-in</span>
            </button>

            <button
              onClick={() => triggerQuickScenario('NOSHOW')}
              disabled={isSimulating}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-950 hover:text-amber-300 border border-slate-700 hover:border-amber-700/60 text-slate-300 transition-colors flex items-center gap-1"
              title="Triggers USP #4: No-Show & Dynamic Slot Recovery offer"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>2. No-Show & Slot Recovery (USP)</span>
            </button>

            <button
              onClick={() => triggerQuickScenario('ADVANCE')}
              disabled={isSimulating}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-blue-950 hover:text-blue-300 border border-slate-700 hover:border-blue-700/60 text-slate-300 transition-colors flex items-center gap-1"
            >
              <Clock className="w-3 h-3 text-blue-400" />
              <span>3. Call Next Farmer</span>
            </button>

            <button
              onClick={() => triggerQuickScenario('RUSH')}
              disabled={isSimulating}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-300 border border-slate-700 hover:border-rose-700/60 text-slate-300 transition-colors flex items-center gap-1"
              title="Simulate 1 PM high congestion alert"
            >
              <Flame className="w-3 h-3 text-rose-400" />
              <span>4. Simulate 1 PM Rush</span>
            </button>

            <button
              onClick={() => triggerQuickScenario('COMPLETE')}
              disabled={isSimulating}
              className="px-2 py-1 rounded bg-emerald-700/60 hover:bg-emerald-600 text-emerald-100 border border-emerald-600/70 transition-colors flex items-center gap-1 font-medium"
              title="Complete procurement and release DBT payment"
            >
              <RefreshCw className={`w-3 h-3 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>5. Finalize & DBT Pay</span>
            </button>

            {(!isFarmerAuthenticated || !isAdminAuthenticated) && (
              <button
                onClick={quickDemoLoginBoth}
                className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-heading font-extrabold text-[11px] shadow-md flex items-center gap-1 cursor-pointer transition-all ml-1"
                title="Log into both Farmer App and Admin Mandi Portal with one click"
              >
                <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-emerald-950" />
                <span>Demo: Sign In Both</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Supabase Schema & Connection Details Modal */}
      <SupabaseModal 
        isOpen={supabaseModalOpen} 
        onClose={() => setSupabaseModalOpen(false)} 
      />

      {/* Global Notification Drawer */}
      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
      />
    </header>
  );
};
