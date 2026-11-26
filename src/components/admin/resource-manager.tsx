"use client";

import { AddIcon, CloseIcon, LoaderIcon, RoundedMagnifierIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { LazyConfirmDialog } from "@/components/lazy-dialogs";
import { ListThumb } from "@/components/list-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RemoveResult } from "@/lib/admin/action-result";
import { cn } from "@/lib/utils";
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
  return <ListThumb imageUrl={item.imageUrl} color={item.color} shape={item.imageShape} />;
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
  const [syncedQuery, setSyncedQuery] = useState(query);
  const [searching, startSearch] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<ResourceItem | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setTerm(query);
  }

  // Search runs on the server (the term lives in the URL), after a short pause in typing.
  useEffect(() => {
    if (term.trim() === query) return;
    const timer = setTimeout(() => {
      // Keep the other URL parameters (such as the selected tab) and only change `q`.
      const params = new URLSearchParams(searchParams.toString());
      if (term.trim()) params.set("q", term.trim());
      else params.delete("q");
      startSearch(() => {
        router.replace(params.size ? `${pathname}?${params}` : pathname);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, query, pathname, router, searchParams]);

  function clearSearch() {
    setTerm("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    startSearch(() => {
      router.replace(params.size ? `${pathname}?${params}` : pathname);
    });
  }

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
      {/* Search and "add" share one row: the add button is a round icon-only "+" (the label stays for screen readers),
          so the list needs no row or fixed bar of its own. */}
      <div className="flex items-center gap-item">
        <div className="relative min-w-0 flex-1">
          {searching ? (
            <LoaderIcon className="pointer-events-none absolute top-1/2 left-inset size-icon-sm -translate-y-1/2 text-muted-foreground motion-safe:animate-spin" aria-hidden />
          ) : (
            <RoundedMagnifierIcon className="pointer-events-none absolute top-1/2 left-inset size-icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden />
          )}
          <Input
            type="search"
            enterKeyHint="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={searchLabels?.placeholder ?? t("searchPlaceholder")}
            aria-label={searchLabels?.label ?? t("searchLabel")}
            className={cn(CONTROL_CLASS, "pl-target", term && "pr-target")}
          />
          {term ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearSearch}
              aria-label={t("clearSearch")}
              className="absolute top-1/2 right-hair size-target -translate-y-1/2 text-muted-foreground"
            >
              <CloseIcon aria-hidden />
            </Button>
          ) : null}
        </div>
        <Button asChild size="icon" className="size-control shrink-0 rounded-full">
          <Link href={withBack(`${base}/new`)} aria-label={labels.addButton}>
            <AddIcon aria-hidden />
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          mascot="bubu-sleepy"
          className="flex-1 justify-center"
          title={hasSearch ? t("noResultsTitle") : labels.emptyTitle}
          description={hasSearch ? t("noResultsDescription") : labels.emptyDescription}
          action={
            hasSearch ? (
              <Button type="button" variant="outline" size="pill" onClick={clearSearch}>
                {t("clearSearch")}
              </Button>
            ) : (
              <Button asChild size="pill">
                <Link href={withBack(`${base}/new`)}>
                  <AddIcon aria-hidden />
                  {labels.addButton}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="type-secondary text-muted-foreground tabular-nums">{t("itemCount", { count: items.length })}</p>
          <ul className="grid gap-item md:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="list-card-cv flex min-w-0 items-center gap-stack rounded-xl border bg-card pr-inset-xs">
                <Link
                  href={withBack(`${base}/${item.id}`)}
                  prefetch={false}
                  className="flex min-h-row min-w-0 flex-1 items-center gap-item rounded-xl py-inset-sm pr-inset-xs pl-inset-sm text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/80"
                >
                  <Marker item={item} />
                  <span className="flex min-w-0 flex-1 flex-col gap-tight">
                    <span className="truncate type-item-title">{item.title}</span>
                    {item.subtitle ? <span className="line-clamp-2 break-words type-secondary text-muted-foreground">{item.subtitle}</span> : null}
                    {item.meta?.length ? (
                      <span className="flex flex-wrap gap-tight">
                        {item.meta.map((entry) => (
                          <Badge key={entry} variant="secondary" className="max-w-full whitespace-normal text-left">
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
                    className="size-target shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <TrashBinMinimalisticIcon aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {pendingDelete !== null ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
          title={t("deleteTitle", { name: pendingDelete.title })}
          description={t("deleteDescription")}
          tone="destructive"
          icon={<TrashBinMinimalisticIcon aria-hidden />}
          confirmLabel={t("delete")}
          pending={isDeleting}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
