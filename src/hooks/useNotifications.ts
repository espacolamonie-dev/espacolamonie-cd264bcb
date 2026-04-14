import { useState, useCallback } from "react";

export interface CrmNotification {
  id: string;
  title: string;
  body: string;
  icon: string;
  url: string;
  tag: string;
  timestamp: Date;
  read: boolean;
}

let notificationId = 0;
const listeners = new Set<() => void>();
let notifications: CrmNotification[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function addNotification(n: Omit<CrmNotification, "id" | "timestamp" | "read">) {
  // Deduplicate by tag
  if (notifications.some((existing) => existing.tag === n.tag)) return;

  notifications = [
    { ...n, id: String(++notificationId), timestamp: new Date(), read: false },
    ...notifications,
  ].slice(0, 50); // Keep max 50
  notify();
}

export function markAllRead() {
  notifications = notifications.map((n) => ({ ...n, read: true }));
  notify();
}

export function clearNotifications() {
  notifications = [];
  notify();
}

export function useNotifications() {
  const [, setTick] = useState(0);

  const subscribe = useCallback(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  // Subscribe on first render
  useState(() => {
    const unsub = subscribe();
    return unsub;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAllRead,
    clearNotifications,
  };
}
