"use client";

import { LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ListThumb } from "@/components/list-thumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RemoveResult } from "@/lib/admin/action-result";
import type { ResourceItem, ResourceLabels } from "./resource-types";

interface ResourceManagerProps {
  items: ResourceItem[];
  /** Where the entry screens live: <basePath>/new and <basePath>/<id> (for example /admin/master-data/brands). */
  basePath: string;
  /** Current search term from the URL. */
  query: string;
  labels: ResourceLabels;
  /** Without it the cards have no delete button (people are locked, not deleted). */
  removeAction?: (id: string) => Promise<RemoveResult>;
  /** The search box's placeholder and label, when it does not search by name. */
  searchLabels?: { placeholder: string; label: string };
}

/** The marker of a card: a person gets their round initials; anything else gets the shared list picture (`ListThumb`), or nothing. */
function Marker({ item }: { item: ResourceItem }) {
  if (item.avatarText && !item.imageUrl) {
    return (
      <span aria-hidden className="flex size-avatar shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted type-secondary font-semibold!">
        {item.avatarText}
      </span>
    );
  }
  return <ListThumb imageUrl={item.imageUrl} color={item.color} />;
}

const CONTROL_CLASS = "h-control rounded-xl bg-card px-inset type-body";

/**
 * Admin list for one master-data type: search, cards, delete with confirmation. Opening a card or "Add" goes to a
 * separate entry screen (a normal page) and remembers this list (tab and search) so Save can return here.
 */
export function ResourceManager({ items, basePath, query, labels, removeAction, searchLabels }: ResourceManagerProps) {
  const t = useTranslations("admin.common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(query);
  const [pendingDelete, setPendingDelete] = useState<ResourceItem | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  // Search runs on the server (the term lives in the URL), after a short pause in typing.
  useEffect(() => {
    if (term.trim() === query) return;
    const timer = setTimeout(() => {
      // Keep the other URL parameters (such as the selected tab) and only change `q`.
      const params = new URLSearchParams(searchParams.toString());
      if (term.trim()) params.set("q", term.trim());
      else params.delete("q");
      router.replace(params.size ? `${pathname}?${params}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [term, query, pathname, router, searchParams]);

  // This exact list, tab and search included: the entry screen sends the person back to it.
  const here = searchParams.size ? `${pathname}?${searchParams.toString()}` : pathname;
  const base = basePath;
  const withBack = (href: string) => `${href}?back=${encodeURIComponent(here)}`;
  const hasSearch = query !== "";

  function confirmDelete() {
    const target = pendingDelete;
    if (!target || !removeAction) return;
    startDeleting(async () => {
      const result = await removeAction(target.id);
      setPendingDelete(null);
      if (result.ok) {
        // The delete action ran revalidatePath, which refreshes this list by itself (no router.refresh()).
        toast.success(t("deleted"));
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-group">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-inset size-icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          enterKeyHint="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchLabels?.placeholder ?? t("searchPlaceholder")}
          aria-label={searchLabels?.label ?? t("searchLabel")}
          className={`${CONTROL_CLASS} pl-target`}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          mascot="bubu-sleepy"
          title={hasSearch ? t("noResultsTitle") : labels.emptyTitle}
          description={hasSearch ? t("noResultsDescription") : labels.emptyDescription}
        />
      ) : (
        <>
          <p className="type-secondary text-muted-foreground">{t("itemCount", { count: items.length })}</p>
          <ul className="grid gap-item md:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center rounded-xl border bg-card pr-inset-xs">
                <Link href={withBack(`${base}/${item.id}`)} className="flex min-h-row min-w-0 flex-1 items-center gap-item rounded-xl py-inset-sm pr-0 pl-inset-sm text-left">
                  <Marker item={item} />
                  <span className="flex min-w-0 flex-1 flex-col gap-tight">
                    <span className="truncate type-item-title">{item.title}</span>
                    {item.subtitle ? <span className="line-clamp-2 break-words type-secondary text-muted-foreground">{item.subtitle}</span> : null}
                    {item.meta?.length ? (
                      <span className="flex flex-wrap gap-tight">
                        {item.meta.map((entry) => (
                          <Badge key={entry} variant="secondary" className="h-auto max-w-full whitespace-normal py-hair text-left type-tag">
                            {entry}
                          </Badge>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </Link>
                {removeAction ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(item)}
                  aria-label={`${t("delete")}: ${item.title}`}
                  className="size-target shrink-0 text-muted-foreground"
                >
                  <Trash2 aria-hidden />
                </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Room for the floating button below, so the last item can scroll clear of it. */}
      <div aria-hidden className="h-fab-clear shrink-0" />

      {/* Primary action: a round icon-only "+" fixed at the bottom right, above the bottom menu, within thumb reach and
          out of the way of the list. The label stays for screen readers. On wide screens it starts after the sidebar. */}
      <div data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--bottom-nav-h,0px)] z-30 flex justify-end p-inset md:left-sidebar">
        <Button asChild size="icon" className="pointer-events-auto size-control-lg rounded-full shadow-menu">
          <Link href={withBack(`${base}/new`)} aria-label={labels.addButton}>
            <Plus aria-hidden className="size-icon-lg" />
          </Link>
        </Button>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="type-item-title">{t("deleteTitle", { name: pendingDelete?.title ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {isDeleting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              {isDeleting ? t("saving") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
