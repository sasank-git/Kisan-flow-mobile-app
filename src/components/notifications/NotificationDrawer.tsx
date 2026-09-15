import React from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  Clock, 
  Sparkles, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';
import { NotificationItem } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const { 
    notifications, 
    markNotificationRead, 
    markAllNotificationsRead, 
    clearAllNotifications, 
    deleteNotification,
    setActiveTabFarmer 
  } = useKisanFlow();

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'turn_alert':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'recovery':
        return <AlertCircle className="w-4 h-4 text-teal-400" />;
      case 'smart_arrival':
        return <Clock className="w-4 h-4 text-sky-400" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getBadgeStyle = (type: NotificationItem['type'], read: boolean) => {
    if (read) {
      return 'bg-slate-800 text-slate-400 border-slate-700/60';
    }
    switch (type) {
      case 'turn_alert':
        return 'bg-amber-950/70 text-amber-300 border-amber-500/40 shadow-sm';
      case 'payment':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-sm';
      case 'recovery':
        return 'bg-teal-950/70 text-teal-300 border-teal-500/40 shadow-sm';
      default:
        return 'bg-slate-800 text-slate-200 border-slate-700';
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    markNotificationRead(notif.id);
    if (notif.type === 'payment') {
      setActiveTabFarmer('payments');
      onClose();
    } else if (notif.type === 'turn_alert' || notif.type === 'recovery') {
      setActiveTabFarmer('queue');
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md h-full bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-extrabold text-base text-white">
                  Notifications
                </h3>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold">
                    {unreadCount} unread
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
                    All caught up
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Real-time queue & DBT payout alerts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close Notifications"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Bar (Mark all read & Clear all) */}
        {notifications.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-medium text-[11px] cursor-pointer"
              title="Mark all notifications as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>

            <button
              type="button"
              onClick={clearAllNotifications}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-rose-400 transition-colors font-medium text-[11px] cursor-pointer"
              title="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>
        )}

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                <Bell className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-heading font-bold text-sm text-slate-300">
                  No Notifications Yet
                </p>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Real-time alerts for gate check-ins, queue movements, and DBT bank payouts will appear here automatically.
                </p>
              </div>
            </div>
          ) : (
            notifications.map((notif) => {
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                    notif.read 
                      ? 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700 opacity-80' 
                      : 'bg-slate-900 border-slate-700/80 hover:border-emerald-500/50 shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${getBadgeStyle(notif.type, notif.read)}`}>
                        {getNotificationIcon(notif.type)}
                      </div>
                      
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs font-bold truncate ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                            {notif.title}
                          </h4>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                          )}
                        </div>

                        <p className={`text-xs leading-relaxed ${notif.read ? 'text-slate-400' : 'text-slate-200'}`}>
                          {notif.message}
                        </p>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
                          <Clock className="w-3 h-3" />
                          <span>{notif.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity rounded-md hover:bg-slate-800 shrink-0"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer info */}
        <div className="px-5 py-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            e-NAM / FCI Live Pulse
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
