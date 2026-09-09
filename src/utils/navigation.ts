import { useRouter, type Href } from 'expo-router';

/**
 * Purpose: typed-route escape hatch for stack paths Expo has not regenerated yet.
 * Inputs: an in-app path string.
 * Outputs: Href for router.push / replace.
 * Side effects: none.
 * Design decisions: keeps screens free of `as never` scatter; not a navigation controller.
 */
export function appHref(path: string): Href {
  return path as Href;
}

type LeaveRouter = Pick<ReturnType<typeof useRouter>, 'canGoBack' | 'back' | 'replace'>;

/**
 * Purpose: leave a stack/modal screen without calling back() on an empty history.
 * Inputs: Expo Router instance.
 * Outputs: none.
 * Side effects: pops the stack, or replaces Today when there is nowhere to go.
 * Design decisions: deep links and first-launch compose/edit otherwise sit on an empty stack.
 */
export function leaveScreen(router: LeaveRouter): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/(tabs)');
}
