"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * The tab that was just tapped counts as current at once, instead of waiting for the server to answer (the path only changes
 * after the new page arrives, so the highlight would lag the tap). The tap is forgotten as soon as the path changes.
 */
export function useOptimisticPath(): { current: string; markPending: (href: string) => void } {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const current = pending && pending.from === pathname ? pending.href : pathname;
  return { current, markPending: (href) => setPending({ href, from: pathname }) };
}
