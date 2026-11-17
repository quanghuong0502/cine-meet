import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ResourceManager } from "@/components/admin/resource-manager";
import type { ResourceField, ResourceItem } from "@/components/admin/resource-types";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { MASTER_DATA_SECTIONS, type MasterDataSectionKey } from "@/lib/master-data-sections";
import { brandService } from "@/services/master-data/brand.service";
import type { SectionDefinition } from "./types";

/** Translates a key under the section's own namespace, `admin.<key>`. */
export type SectionT = (key: string, values?: Record<string, string | number>) => string;

export interface SectionContext {
  t: SectionT;
  locale: string;
  /** Brands as select options (loaded when the section depends on a brand). */
  brandOptions: { value: string; label: string }[];
  brandNames: Map<string, string>;
}

interface SectionConfig<Doc extends { _id: { toString(): string } }> {
  key: MasterDataSectionKey;
  service: {
    list(options: { q?: string }): Promise<Doc[]>;
    getById(id: string): Promise<Doc | null>;
  };
  saveAction: (previous: SaveState, formData: FormData) => Promise<SaveState>;
  removeAction: (id: string) => Promise<RemoveResult>;
  /** The section can only hold records once a brand exists (branches, food and drinks). */
  needsBrand?: boolean;
  fields: (context: SectionContext) => ResourceField[];
  item: (doc: Doc, context: SectionContext) => Omit<ResourceItem, "id">;
  /** Starting form values by field name, all strings. */
  values: (doc: Doc) => Record<string, string>;
  name: (doc: Doc) => string;
}

/** `price` as VND money, in the language in use. */
export function formatVnd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

/** YYYY-MM-DD as a day in the language in use (the string has no time zone, so no shifting). */
export function formatDay(value: string, locale: string, dateStyle: "medium" | "short" = "medium"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { timeZone: "UTC", dateStyle }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

/** "valid from – to" for items with an optional validity window; undefined when it is always valid. */
export function formatValidity(from: string | null | undefined, to: string | null | undefined, context: SectionContext): string | undefined {
  if (!from && !to) return undefined;
  return context.t("validity", {
    from: from ? formatDay(from, context.locale, "short") : "…",
    to: to ? formatDay(to, context.locale, "short") : "…",
  });
}

async function buildContext(key: MasterDataSectionKey, needsBrand: boolean): Promise<SectionContext> {
  const t = (await getTranslations(`admin.${key}` as "admin.brands")) as unknown as SectionT;
  const locale = await getLocale();
  const brands = needsBrand ? await brandService.list({}) : [];
  return {
    t,
    locale,
    brandOptions: brands.map((brand) => ({ value: brand._id.toString(), label: brand.name })),
    brandNames: new Map(brands.map((brand) => [brand._id.toString(), brand.name])),
  };
}

/**
 * Builds the list tab and the entry screen of one master-data type from a small description of it, so a new type
 * only states its fields and how a record looks as a card. Strings come from `admin.<key>.*` in the message files.
 */
export function createSection<Doc extends { _id: { toString(): string } }>(config: SectionConfig<Doc>): SectionDefinition {
  const { key } = config;
  const slug = MASTER_DATA_SECTIONS.find((section) => section.key === key)?.slug ?? key;

  return {
    async List({ q }) {
      const context = await buildContext(key, config.needsBrand ?? false);
      const { t } = context;

      if (config.needsBrand && context.brandOptions.length === 0) {
        const tc = await getTranslations("admin.masterData");
        return (
          <EmptyState
            mascot="bubu-sleepy"
            title={tc("needBrand.title")}
            description={tc("needBrand.description")}
            action={
              <Button asChild size="pill">
                <Link href="/admin/master-data?tab=brands">{tc("needBrand.button")}</Link>
              </Button>
            }
          />
        );
      }

      const docs = await config.service.list({ q });
      return (
        <ResourceManager
          section={slug}
          query={q}
          labels={{ addButton: t("addButton"), emptyTitle: t("emptyTitle"), emptyDescription: t("emptyDescription") }}
          items={docs.map((doc) => ({ id: doc._id.toString(), ...config.item(doc, context) }))}
          removeAction={config.removeAction}
        />
      );
    },

    async loadForm(id) {
      const context = await buildContext(key, config.needsBrand ?? false);
      if (config.needsBrand && context.brandOptions.length === 0) return null;
      const doc = id ? await config.service.getById(id) : null;
      if (id && !doc) return null;

      return {
        title: context.t(doc ? "editTitle" : "createTitle"),
        fields: config.fields(context),
        values: doc ? config.values(doc) : {},
        itemName: doc ? config.name(doc) : undefined,
        saveAction: config.saveAction,
        removeAction: config.removeAction,
      };
    },
  };
}
