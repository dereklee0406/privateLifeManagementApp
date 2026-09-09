import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

/**
 * Purpose: open Today/compose (or a reminder path) when a local notification is tapped.
 * Inputs: none (OS notification response).
 * Outputs: none.
 * Side effects: expo-router navigation from notification data.url.
 * Design decisions: native-only so web Metro never loads expo-notifications.
 */
export function NotificationObserver() {
  useEffect(() => {
    const redirect = (url: unknown) => {
      if (typeof url === 'string' && url.startsWith('/')) {
        router.push(url as `/compose`);
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) {
      redirect(last.notification.request.content.data?.url);
    }
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification.request.content.data?.url);
    });
    return () => sub.remove();
  }, []);
  return null;
}
