import { useEffect, useRef, useState } from 'react';
import {
  HiOutlineBell,
  HiOutlineCheck,
  HiOutlineTrash,
  HiOutlineX,
} from 'react-icons/hi';
import { useNotificationStore, NotificationType } from '../../stores/notification.store';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const TYPE_CONFIG: Record<NotificationType, { icon: string; color: string; bg: string }> = {
  order_new: { icon: '🟢', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  order_cancelled: { icon: '🟡', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  stock_low: { icon: '🟠', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  stock_out: { icon: '🔴', color: 'text-red-400', bg: 'bg-red-500/10' },
  shift_checkin: { icon: '🔵', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  info: { icon: 'ℹ️', color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, removeNotification } =
    useNotificationStore();

  // Đóng panel khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Đóng khi nhấn Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-all duration-200"
        aria-label="Thông báo"
        id="notification-bell"
      >
        <HiOutlineBell className="w-5 h-5" />

        {/* Badge đỏ */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-[#0c1120] border border-slate-700/60 shadow-2xl shadow-black/50 z-[90] overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 100px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40 bg-[#0a0f1e]">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Thông báo
              </h3>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-[10px] font-bold uppercase text-blue-400 hover:text-blue-300 px-2 py-1 hover:bg-blue-500/10 rounded transition-colors"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <HiOutlineCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-700/40 rounded transition-colors"
              >
                <HiOutlineX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <HiOutlineBell className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Chưa có thông báo
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Thông báo mới sẽ xuất hiện ở đây
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;

                return (
                  <div
                    key={notification.id}
                    className={`
                      group flex items-start gap-3 px-4 py-3 border-b border-slate-800/40 cursor-pointer
                      transition-all duration-150 hover:bg-slate-800/30
                      ${notification.isRead ? 'opacity-60' : ''}
                    `}
                    onClick={() => {
                      if (!notification.isRead) markAsRead(notification.id);
                    }}
                  >
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-sm ${config.bg}`}
                    >
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black text-slate-200 uppercase tracking-wide truncate">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1 font-semibold">
                        {timeAgo(notification.timestamp)}
                      </p>
                    </div>

                    {/* Delete button (visible on hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 p-1 rounded transition-all"
                      title="Xóa"
                    >
                      <HiOutlineX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-700/40 bg-[#0a0f1e]">
              <button
                onClick={() => {
                  clearAll();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-red-400 py-1.5 hover:bg-red-500/5 rounded transition-colors"
              >
                <HiOutlineTrash className="w-3.5 h-3.5" />
                Xóa tất cả thông báo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
