"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { LoadingState } from "@/components/loading-state";

/**
 * Loading screens of the app, built around ONE full-screen splash.
 *
 * First time the app opens (cold start, or right after signing in), the splash covers everything and stays
 * until the shell and the first page are ready. It lives in the root layout and is a single element, so the
 * route loaders that swap places underneath it (root, layout, page) never make the picture blink.
 * After that, moving between pages only shows a loader in the content area and keeps header and bottom bar.
 */

interface Store {
  /** The splash is done: the app shell has been shown and no route loader is pending. */
  opened: boolean;
  /** A layout of the app (user, admin) or an error page has been shown. */
  markerSeen: boolean;
  /** Route loaders currently on screen during the first open. */
  covering: number;
  listeners: Set<() => void>;
}

// On `globalThis` so a hot reload in dev cannot reset it in the middle of a session; it is lost only on a page reload.
const store = ((globalThis as { __appLoading?: Store }).__appLoading ??= {
  opened: false,
  markerSeen: false,
  covering: 0,
  listeners: new Set(),
});

const SPLASH_GIVE_UP_MS = 15_000;
// Pages outside the app shell (no splash there).
const AUTH_PATHS = ["/login", "/change-password"];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function emit() {
  store.listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function setOpened(value: boolean) {
  if (store.opened === value) return;
  store.opened = value;
  emit();
}

function openWhenIdle() {
  // Deferred: when one route loader hands over to the next (nested routes, React strict mode in dev) the new one
  // mounts in the same tick, so the count is not zero yet.
  setTimeout(() => {
    if (store.markerSeen && store.covering === 0) setOpened(true);
  }, 0);
}

function useSplashVisible(): boolean {
  const pathname = usePathname();
  const opened = useSyncExternalStore(
    subscribe,
    () => store.opened,
    () => false,
  );
  return !opened && !isAuthPath(pathname);
}

/** In the root layout. The full-screen cover of the first open; see the note at the top of the file. */
export function BootSplash() {
  const pathname = usePathname();
  const visible = useSplashVisible();

  useEffect(() => {
    // Back on a sign-in page (signed out): the next entry to the app is a first open again.
    if (!isAuthPath(pathname)) return;
    store.markerSeen = false;
    setOpened(false);
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    // Never trap the screen under the splash if something went wrong.
    const id = setTimeout(() => setOpened(true), SPLASH_GIVE_UP_MS);
    return () => clearTimeout(id);
  }, [visible]);

  return visible ? <LoadingState fullScreen className="fixed inset-0 z-50 bg-background" /> : null;
}

/** `app/loading.tsx`: shows Bubu itself only when the splash is not covering the screen. */
export function RootLoading() {
  const splashVisible = useSplashVisible();
  return splashVisible ? null : <LoadingState fullScreen />;
}

/**
 * Put once in each layout of the app (user, admin) and on the not-found and error pages: tells the splash the
 * shell is on screen. Also covers a first page so fast that no route loader ever showed.
 */
export function AppOpenedMarker() {
  useEffect(() => {
    store.markerSeen = true;
    openWhenIdle();
  }, []);
  return null;
}

interface RouteLoadingProps {
  /** What shows in the content area once the app is open (default: Bubu). */
  inline?: ReactNode;
}

/** Loader of a route inside an app shell: nothing during the first open (the splash covers), then only the content area. */
export function RouteLoading({ inline = <LoadingState /> }: RouteLoadingProps) {
  // Decided once per mount: it must not switch while it is showing.
  const [underSplash] = useState(() => !store.opened);

  useEffect(() => {
    if (!underSplash) return;
    store.covering += 1;
    return () => {
      store.covering -= 1;
      openWhenIdle();
    };
  }, [underSplash]);

  return underSplash ? null : inline;
}
