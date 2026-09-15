import React, { useState } from 'react';
import { 
  Home, 
  Calendar, 
  QrCode, 
  Users, 
  CreditCard, 
  Bell, 
  PhoneCall, 
  Sparkles, 
  LogOut,
  Tractor,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { FarmerHome } from './FarmerHome';
import { SlotBookingWizard } from './SlotBookingWizard';
import { DigitalTokenCard } from './DigitalTokenCard';
import { LiveQueueView } from './LiveQueueView';
import { PaymentHistoryView } from './PaymentHistoryView';
import { IvrHelplineModal } from './IvrHelplineModal';
import { NotificationDrawer } from '../notifications/NotificationDrawer';
import { FarmerAuth } from './FarmerAuth';

export const FarmerApp: React.FC = () => {
  const navigate = useNavigate();
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const { 
    activeTabFarmer, 
    setActiveTabFarmer, 
    t, 
    notifications, 
    viewMode,
    setIvrModalOpen,
    isFarmerAuthenticated,
    farmerLogin,
    farmerLogout,
    farmer
  } = useKisanFlow();

  const unreadNotifs = notifications.filter(n => !n.read).length;

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="w-full h-full bg-slate-950 overflow-hidden flex flex-col relative pb-safe">
        {/* If NOT Authenticated: Show Mobile Farmer Sign In matching Screenshot 1 */}
        {!isFarmerAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-auto">
            <FarmerAuth />
          </div>
        ) : (
          <>
            {/* Farmer App Top Header */}
            <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-extrabold text-xs shadow-sm">
                  KF
                </div>
                <div>
                  <span className="font-heading font-bold text-sm text-white block">
                    {farmer.name}
                  </span>
                  <span className="text-[10px] text-emerald-400 block font-medium">
                    {farmer.id} • {farmer.village}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIvrModalOpen(true)}
                  className="p-1.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors relative"
                  title="Voice Helpline (IVR for non-smartphone)"
                >
                  <PhoneCall className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setNotificationDrawerOpen(true)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors relative cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifs > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white font-extrabold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                      {unreadNotifs}
                    </span>
                  )}
                </button>

                <button
                  onClick={farmerLogout}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                  title="Logout / Switch Farmer Profile"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Main Screen Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
              {activeTabFarmer === 'home' && <FarmerHome />}
              {activeTabFarmer === 'book' && <SlotBookingWizard />}
              {activeTabFarmer === 'token' && <DigitalTokenCard />}
              {activeTabFarmer === 'queue' && <LiveQueueView />}
              {activeTabFarmer === 'payments' && <PaymentHistoryView />}
            </div>

            {/* Fixed Mobile Bottom Navigation Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-2 flex items-center justify-around z-30">
              <button
                onClick={() => setActiveTabFarmer('home')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  activeTabFarmer === 'home' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Home className="w-4 h-4" />
                <span className="text-[10px]">Home</span>
              </button>

              <button
                onClick={() => setActiveTabFarmer('book')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  activeTabFarmer === 'book' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px]">Book Slot</span>
              </button>

              <button
                onClick={() => setActiveTabFarmer('token')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  activeTabFarmer === 'token' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span className="text-[10px]">E-Token</span>
              </button>

              <button
                onClick={() => setActiveTabFarmer('queue')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  activeTabFarmer === 'queue' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="text-[10px]">Live Queue</span>
              </button>

              <button
                onClick={() => setActiveTabFarmer('payments')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  activeTabFarmer === 'payments' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[10px]">Payouts</span>
              </button>
            </div>
          </>
        )}

        {/* Global IVR Helpline Modal */}
        <IvrHelplineModal />

        {/* Global Notification Drawer */}
        <NotificationDrawer
          isOpen={notificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
        />
      </div>
    </div>
  );
};
