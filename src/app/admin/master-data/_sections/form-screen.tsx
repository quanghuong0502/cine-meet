import { notFound } from "next/navigation";
import { ResourceForm } from "@/components/admin/resource-form";
import { PageHeader } from "@/components/page-header";
import { resolveBackHref } from "@/lib/admin/back-href";
import { sectionFromSlug } from "@/lib/master-data-sections";
import { SECTIONS } from ".";

/** The entry screen of a master-data record: one page for every type, filled in by the section. */
export async function SectionFormScreen({ section, id, back }: { section: string; id: string | null; back?: string }) {
  const definition = sectionFromSlug(section);
  if (!definition) notFound();
  const form = await SECTIONS[definition.key].loadForm(id);
  if (!form) notFound();

  const backHref = resolveBackHref(back, `/admin/master-data?tab=${definition.key}`);

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-section p-inset">
      <PageHeader title={form.title} backHref={backHref} hideTitle />
      <ResourceForm
        itemId={id}
        fields={form.fields}
        values={form.values}
        backHref={backHref}
        saveAction={form.saveAction}
        deleteItem={id ? { id, name: form.itemName ?? form.title, removeAction: form.removeAction } : undefined}
      />
    </div>
  );
}
