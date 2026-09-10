import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useLock } from '../../controller/LockProvider';
import { leaveScreen } from '../../utils/navigation';

/**
 * Purpose: Android hardware back pops the stack (or exits at root) and never unlocks Halo.
 * Inputs: Expo Router + lock session.
 * Outputs: none (null view).
 * Side effects: BackHandler while mounted; leaveScreen when history exists.
 * Design decisions: locked session consumes back so the gate cannot be dismissed. A stack
 *   entry is popped via leaveScreen and the event is consumed (no double-pop). Empty
 *   history returns false so Android can leave the app from the root tabs.
 */
export function AndroidBackBridge() {
  const router = useRouter();
  const { locked } = useLock();

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (locked) {
        return true;
      }
      if (router.canGoBack()) {
        leaveScreen(router);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [locked, router]);

  return null;
}
