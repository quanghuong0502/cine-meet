import { notFound } from "next/navigation";
import { ResourceForm } from "@/components/admin/resource-form";
import { PageHeader } from "@/components/page-header";
import { resolveBackHref } from "@/lib/admin/back-href";
import { MASTER_DATA_SECTIONS, type MasterDataSectionKey } from "@/lib/master-data-sections";
import { SECTIONS } from ".";

export function isSectionKey(value: string): value is MasterDataSectionKey {
  return MASTER_DATA_SECTIONS.some((section) => section.key === value);
}

/** The entry screen of a master-data record: one page for every type, filled in by the section. */
export async function SectionFormScreen({ section, id, back }: { section: string; id: string | null; back?: string }) {
  if (!isSectionKey(section)) notFound();
  const form = await SECTIONS[section].loadForm(id);
  if (!form) notFound();

  const backHref = resolveBackHref(back, `/admin/master-data?tab=${section}`);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <PageHeader title={form.title} backHref={backHref} />
      <ResourceForm
        itemId={id}
        fields={form.fields}
        values={form.values}
        backHref={backHref}
        itemName={form.itemName}
        saveAction={form.saveAction}
        removeAction={id ? form.removeAction : undefined}
      />
    </div>
  );
}
