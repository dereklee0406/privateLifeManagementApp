import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Purpose: honor OS Reduce Motion so Halo can skip decorative motion.
 * Inputs: none (system accessibility).
 * Outputs: true when she asked the OS to reduce motion.
 * Side effects: subscribes to accessibility changes.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) {
        setReduce(value);
      }
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
