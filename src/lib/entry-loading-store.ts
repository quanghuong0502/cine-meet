import { useSyncExternalStore } from "react";

/**
 * True while the loading screen of an entry screen (a master-data record) is up. Its path already counts as an entry screen, which
 * hides the bottom bar, but the person is still looking at the list they tapped in, so the bar stays until the entry screen arrives.
 */
let holding = false;
const listeners = new Set<() => void>();

export function setHoldingBottomBar(value: boolean) {
  if (holding === value) return;
  holding = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHoldingBottomBar(): boolean {
  return useSyncExternalStore(subscribe, () => holding, () => false);
}
