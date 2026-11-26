import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ResourceManager } from "@/components/admin/resource-manager";
import type { ResourceField, ResourceItem } from "@/components/admin/resource-types";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { RemoveResult, SaveState } from "@/lib/admin/action-result";
import { MASTER_DATA_SECTIONS, type MasterDataSectionKey } from "@/lib/master-data-sections";
import { getBrandOptions } from "@/services/master-data/brand-options";
import type { SectionDefinition } from "./types";

/** Translates a key under the section's own namespace, `admin.<key>`. */
export type SectionT = (key: string, values?: Record<string, string | number>) => string;

export interface SectionContext {
  t: SectionT;
  /** Shared admin strings (`admin.common`): the on/off switch label, the "off" badge. */
  tc: SectionT;
  /** Brands that are switched off: left out of the brand pick-list unless the record being edited already uses one. */
  inactiveBrandIds: Set<string>;
  locale: string;
  /** Brands as select options (loaded when the section depends on a brand). */
  brandOptions: { value: string; label: string }[];
  brandNames: Map<string, string>;
}

interface SectionConfig<Doc extends { _id: { toString(): string } }, Extra extends object> {
  key: MasterDataSectionKey;
  service: {
    list(options: { q?: string }): Promise<Doc[]>;
    getById(id: string): Promise<Doc | null>;
  };
  saveAction: (previous: SaveState, formData: FormData) => Promise<SaveState>;
  removeAction: (id: string) => Promise<RemoveResult>;
  /** The section can only hold records once a brand exists (branches, food and drinks). */
  needsBrand?: boolean;
  /** More data the fields and cards need (other lists as select options and names), loaded once per request. */
  loadExtra?: (context: SectionContext) => Promise<Extra>;
  fields: (context: SectionContext & Extra) => ResourceField[];
  item: (doc: Doc, context: SectionContext & Extra) => Omit<ResourceItem, "id">;
  /** Starting form values by field name, all strings. */
  values: (doc: Doc) => Record<string, string>;
  /** Starting values of a NEW record (for example the "active" switch starts on). */
  defaults?: Record<string, string>;
  name: (doc: Doc) => string;
}

export { formatVnd } from "@/lib/money";

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

async function buildBaseContext(key: MasterDataSectionKey, needsBrand: boolean): Promise<SectionContext> {
  const [t, tc, locale, brands] = await Promise.all([
    getTranslations(`admin.${key}` as "admin.brands") as unknown as Promise<SectionT>,
    getTranslations("admin.common") as unknown as Promise<SectionT>,
    getLocale(),
    needsBrand ? getBrandOptions() : Promise.resolve([]),
  ]);
  return {
    t,
    tc,
    inactiveBrandIds: new Set(brands.filter((brand) => !brand.active).map((brand) => brand.id)),
    locale,
    brandOptions: brands.map((brand) => ({ value: brand.id, label: brand.name })),
    brandNames: new Map(brands.map((brand) => [brand.id, brand.name])),
  };
}

/**
 * Builds the list tab and the entry screen of one master-data type from a small description of it, so a new type
 * only states its fields and how a record looks as a card. Strings come from `admin.<key>.*` in the message files.
 */
export function createSection<Doc extends { _id: { toString(): string } }, Extra extends object = object>(
  config: SectionConfig<Doc, Extra>,
): SectionDefinition {
  const { key } = config;
  async function buildContext(): Promise<SectionContext & Extra> {
    const base = await buildBaseContext(key, config.needsBrand ?? false);
    return { ...base, ...(config.loadExtra ? await config.loadExtra(base) : ({} as Extra)) };
  }
  const slug = MASTER_DATA_SECTIONS.find((section) => section.key === key)?.slug ?? key;

  return {
    async List({ q }) {
      // The list query does not depend on the context, so both run at the same time.
      const [context, docs] = await Promise.all([buildContext(), config.service.list({ q })]);
      const { t } = context;

      if (config.needsBrand && context.brandOptions.length === 0) {
        const tc = await getTranslations("admin.masterData");
        return (
          <EmptyState
            mascot="bubu-sleepy"
            className="flex-1 justify-center"
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

      return (
        <ResourceManager
          basePath={`/admin/master-data/${slug}`}
          query={q}
          labels={{ addButton: t("addButton"), emptyTitle: t("emptyTitle"), emptyDescription: t("emptyDescription") }}
          items={docs.map((doc) => ({ id: doc._id.toString(), ...config.item(doc, context) }))}
          removeAction={config.removeAction}
        />
      );
    },

    async loadForm(id) {
      const [context, doc] = await Promise.all([buildContext(), id ? config.service.getById(id) : Promise.resolve(null)]);
      if (config.needsBrand && context.brandOptions.length === 0) return null;
      if (id && !doc) return null;

      const values = doc ? config.values(doc) : (config.defaults ?? {});
      // A switched-off brand cannot be picked for a new record, but a record that already uses it keeps showing it.
      const brandOptions = context.brandOptions.filter((option) => !context.inactiveBrandIds.has(option.value) || option.value === values.brandId);
      return {
        title: context.t(doc ? "editTitle" : "createTitle"),
        fields: config.fields({ ...context, brandOptions }),
        values,
        itemName: doc ? config.name(doc) : undefined,
        saveAction: config.saveAction,
        removeAction: config.removeAction,
      };
    },
  };
}
