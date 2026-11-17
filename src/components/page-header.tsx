import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Omit it on a screen whose content already starts with its own title: the bar then holds only the back button. */
  title?: string;
  /** Where the back button goes. Every inner screen (not a tab) sets this: see `BackButton`. */
  backHref?: string;
  description?: string;
}

/**
 * Title of a screen. A tab screen shows a large title that scrolls with the page. An inner screen (with a back button) is a
 * navigation bar like iOS: a smaller title that stays at the top while the page scrolls, so back is always one tap away.
 * Every page puts it first inside a `p-4` container: the bar cancels that padding (negative margins) to reach the screen edges.
 */
export function PageHeader({ title, backHref, description }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex gap-2",
        backHref
          ? "sticky top-0 z-20 -mx-4 -mt-4 items-center bg-background/95 px-4 py-1 backdrop-blur"
          : "items-start",
      )}
    >
      {backHref ? <BackButton href={backHref} /> : null}
      {title || description ? (
        <div className={cn("flex min-w-0 flex-col gap-0.5", !backHref && "pt-1.5")}>
          {title ? <h1 className={cn("font-semibold", backHref ? "truncate text-xl" : "text-2xl")}>{title}</h1> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
    </header>
  );
}
