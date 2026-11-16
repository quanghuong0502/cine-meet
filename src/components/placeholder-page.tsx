import { EmptyState } from "@/components/empty-state";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** Temporary body for routes whose feature is built in a later sprint. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <EmptyState title="Đang phát triển" description={description} mascot="bubu-sleepy" />
    </div>
  );
}
