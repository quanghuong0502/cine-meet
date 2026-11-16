import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** Temporary body for routes whose feature is built in a later sprint. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Đang phát triển</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
