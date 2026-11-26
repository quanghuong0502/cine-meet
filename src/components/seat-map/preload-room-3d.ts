let preloaded = false;

/**
 * Warms both the React 3D view wrapper and the Three.js scene chunk in parallel when the user
 * hovers, focuses, or starts touching the 3D toggle — eliminating the 2-hop dynamic import waterfall.
 */
export function preloadRoom3D(): void {
  if (preloaded) return;
  preloaded = true;
  void import("@/components/seat-map/room-3d-view").catch(() => {
    preloaded = false;
  });
  void import("@/components/seat-map/room-3d-scene").catch(() => {
    preloaded = false;
  });
}
