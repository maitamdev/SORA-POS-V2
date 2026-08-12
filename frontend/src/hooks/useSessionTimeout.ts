import { useEffect, useRef, useState } from 'react';
import {
  defaultOperationSettings,
  normalizeOperationSettings,
  settingsAPI,
  subscribeOperationSettings,
} from '../services/settings.api';
import { useAuthStore } from '../stores/auth.store';
import { usePOSStore } from '../stores/pos.store';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'keydown',
  'touchstart',
  'wheel',
];

/** Logs the current session out after the configured idle period. */
export const useSessionTimeout = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const setOperationSettings = usePOSStore((state) => state.setOperationSettings);
  const [sessionLockMinutes, setSessionLockMinutes] = useState(
    defaultOperationSettings.sessionLockMinutes
  );
  const timeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const applySettings = (value: unknown) => {
      const nextSettings = normalizeOperationSettings(value);
      setSessionLockMinutes(nextSettings.sessionLockMinutes);
      setOperationSettings(nextSettings);
    };

    const unsubscribe = subscribeOperationSettings(applySettings);
    settingsAPI
      .getOperation()
      .then((response) => applySettings(response.data.data.settings))
      .catch(() => applySettings(defaultOperationSettings));

    return unsubscribe;
  }, [isAuthenticated, setOperationSettings]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const clearTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const scheduleLogout = () => {
      clearTimer();
      timeoutRef.current = window.setTimeout(
        () => logout(),
        sessionLockMinutes * 60 * 1000
      );
    };

    const handleActivity = () => {
      // Pointer movement is intentionally not listened to. These events are
      // enough to keep a live operator session active without resetting a
      // timer on every mousemove frame.
      const now = Date.now();
      if (now - lastActivityRef.current < 1000) return;
      lastActivityRef.current = now;
      scheduleLogout();
    };

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleActivity));
    scheduleLogout();

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      clearTimer();
    };
  }, [isAuthenticated, logout, sessionLockMinutes]);
};
