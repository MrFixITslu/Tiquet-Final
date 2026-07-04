import React from "react";
import { Bell, Check, User, Activity, Clock, Inbox } from "lucide-react";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: number;
  createdAt: string;
}

interface NotificationDropdownProps {
  notifications: Notification[];
  onMarkRead: (id?: string) => void;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  onMarkRead,
  onClose
}) => {
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => onMarkRead()}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 hover:bg-slate-50 transition-colors relative group ${
                  !n.isRead ? "bg-indigo-50/30" : ""
                }`}
              >
                <div className="flex gap-3">
                  <div className={`mt-1 p-2 rounded-xl shrink-0 ${
                    n.type === 'assignment' ? 'bg-blue-100 text-blue-600' :
                    n.type === 'status_change' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {n.type === 'assignment' ? <User className="w-4 h-4" /> :
                     n.type === 'status_change' ? <Activity className="w-4 h-4" /> :
                     <Inbox className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!n.isRead ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <button
                          onClick={() => onMarkRead(n.id)}
                          className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all"
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 font-medium">
                      <Clock className="w-3 h-3" />
                      {new Date(n.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 px-8 text-center bg-white">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Bell className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-sm font-bold text-slate-900">All caught up!</p>
            <p className="text-xs text-slate-400 mt-1">No new notifications at the moment.</p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-100 text-center bg-slate-50/50">
        <button
          onClick={onClose}
          className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
