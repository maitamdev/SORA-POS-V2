import { useEffect, useRef, useState } from 'react';
import {
  HiOutlineBell,
  HiOutlineCheck,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineShoppingBag,
  HiOutlineBan,
  HiOutlineExclamationCircle,
  HiOutlineXCircle,
  HiOutlineUser,
  HiOutlineInformationCircle,
} from 'react-icons/hi';
import { useNotificationStore, NotificationType } from '../../stores/notification.store';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const TYPE_CONFIG: Record<NotificationType, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  order_new: { icon: HiOutlineShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  order_cancelled: { icon: HiOutlineBan, color: 'text-amber-600', bg: 'bg-amber-50' },
  stock_low: { icon: HiOutlineExclamationCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
  stock_out: { icon: HiOutlineXCircle, color: 'text-red-600', bg: 'bg-red-50' },
  shift_checkin: { icon: HiOutlineUser, color: 'text-blue-600', bg: 'bg-blue-50' },
  info: { icon: HiOutlineInformationCircle, color: 'text-slate-600', bg: 'bg-slate-100' },
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
    const handleClickOutside = (e: any) => {
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
    const handleEsc = (e: any) => {
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
        className="relative w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-all duration-200"
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
          className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 z-[90] overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 100px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
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
                  className="text-[10px] font-bold uppercase text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <HiOutlineCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <HiOutlineX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <HiOutlineBell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Chưa có thông báo
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
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
                      group flex items-start gap-3 px-4 py-3 border-b border-slate-100 cursor-pointer
                      transition-all duration-150 hover:bg-slate-50
                      ${notification.isRead ? 'opacity-60' : ''}
                    `}
                    onClick={() => {
                      if (!notification.isRead) markAsRead(notification.id);
                    }}
                  >
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-sm ${config.color} ${config.bg}`}
                    >
                      <config.icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide truncate">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                        {timeAgo(notification.timestamp)}
                      </p>
                    </div>

                    {/* Delete button (visible on hover) */}
                    <button
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded transition-all"
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
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => {
                  clearAll();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-red-600 py-1.5 hover:bg-red-50 rounded transition-colors"
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
