import { EntryLoading } from "@/components/admin/entry-loading";

/** Opening the Catalog page: its real title and tabs show at once and only the list area is the loader (see `EntryLoading`). */
export default function MasterDataLoading() {
  return <EntryLoading holdBar={false} />;
}
