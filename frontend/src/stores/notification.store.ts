import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type NotificationType = 'order_new' | 'order_cancelled' | 'stock_low' | 'stock_out' | 'shift_checkin' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const MAX_NOTIFICATIONS = 50;

const TYPE_ICONS: Record<NotificationType, string> = {
  order_new: '🟢',
  order_cancelled: '🟡',
  stock_low: '🟠',
  stock_out: '🔴',
  shift_checkin: '🔵',
  info: 'ℹ️',
};

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;

  addNotification: (type: NotificationType, title: string, message: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (type, title, message) => {
        const newNotification: Notification = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          type,
          title,
          message,
          timestamp: new Date().toISOString(),
          isRead: false,
        };

        set((state) => {
          const updated = [newNotification, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.isRead).length,
          };
        });

        // Hiện toast popup ngay lập tức
        const icon = TYPE_ICONS[type] || 'ℹ️';
        toast(
          `${icon} ${title}\n${message}`,
          {
            duration: 5000,
            style: {
              background: '#0f172a',
              color: '#f8fafc',
              borderRadius: '0px',
              border: '1px solid #1e293b',
              fontSize: '13px',
              maxWidth: '400px',
              whiteSpace: 'pre-line',
            },
          }
        );
      },

      markAsRead: (id) => {
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.isRead).length,
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id);
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.isRead).length,
          };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },
    }),
    {
      name: 'sora-pos-notifications',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, MAX_NOTIFICATIONS),
        unreadCount: state.unreadCount,
      }),
    }
  )
);
