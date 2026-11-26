"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const PENDING_RESET_MS = 4000;

/**
 * The tab that was just tapped counts as current at once, instead of waiting for the server to answer (the path only changes
 * after the new page arrives, so the highlight would lag the tap). Cleared as soon as the path changes or if navigation stalls.
 */
export function useOptimisticPath(): { current: string; markPending: (href: string) => void } {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const active = pending && pending.from === pathname ? pending.href : null;

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setPending(null), PENDING_RESET_MS);
    return () => clearTimeout(id);
  }, [active]);

  return {
    current: active ?? pathname,
    markPending: (href) => setPending(href === pathname ? null : { href, from: pathname }),
  };
}
