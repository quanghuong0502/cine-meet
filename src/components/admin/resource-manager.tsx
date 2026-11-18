"use client";

import { LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
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

/** The round marker of a card: the logo when there is one (and it loads), else the colour, with initials if given; nothing when it has none of them. */
function Marker({ item }: { item: ResourceItem }) {
  const [failed, setFailed] = useState(false);
  const showImage = item.imageUrl && !failed;
  // Nothing to show (no picture, colour or initials): no empty circle.
  if (!showImage && !item.color && !item.avatarText) return null;
  return (
    <span
      aria-hidden
      className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border type-secondary font-semibold! ${showImage ? "bg-white" : "bg-muted"}`}
      style={!showImage && item.color ? { backgroundColor: item.color } : undefined}
    >
      {showImage ? (
        <Image src={item.imageUrl as string} alt="" width={40} height={40} unoptimized onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        item.avatarText
      )}
    </span>
  );
}

const CONTROL_CLASS = "h-control rounded-xl bg-card px-4 type-body";

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
    <div className="flex flex-1 flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          enterKeyHint="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchLabels?.placeholder ?? t("searchPlaceholder")}
          aria-label={searchLabels?.label ?? t("searchLabel")}
          className={`${CONTROL_CLASS} pl-11`}
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
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center rounded-xl border bg-card pr-2">
                <Link href={withBack(`${base}/${item.id}`)} className="flex min-h-row min-w-0 flex-1 items-center gap-3 rounded-xl py-3 pr-0 pl-3 text-left">
                  <Marker item={item} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate type-item-title">{item.title}</span>
                    {item.subtitle ? <span className="line-clamp-2 break-words type-secondary text-muted-foreground">{item.subtitle}</span> : null}
                    {item.meta?.length ? (
                      <span className="flex flex-wrap gap-1">
                        {item.meta.map((entry) => (
                          <Badge key={entry} variant="secondary" className="h-auto max-w-full whitespace-normal py-0.5 text-left type-tag">
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

      {/* Room for the fixed button below, so the last item can scroll clear of it. */}
      <div aria-hidden className="h-[calc(var(--spacing-control)+2.5rem)] shrink-0" />

      {/* Primary action: fixed above the bottom menu (not inside the flow), so it stays in thumb reach, at the same
          place whether the list is empty, short or long. On wide screens it starts after the sidebar. */}
      <div data-bottom-fixed className="pointer-events-none fixed inset-x-0 bottom-[var(--bottom-nav-h,0px)] z-30 px-4 md:left-64">
        <Button asChild size="cta" className="pointer-events-auto mx-auto flex max-w-sm">
          <Link href={withBack(`${base}/new`)}>
            <Plus aria-hidden />
            {labels.addButton}
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
