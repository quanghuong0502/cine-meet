import type { ReactNode } from "react";
import { BackButton } from "@/components/back-button";

interface PageHeaderProps {
  /** Omit when the page content already provides a heading. */
  title?: string;
  /** Destination of the back button on an inner screen. */
  backHref?: string;
  description?: string;
  /** One trailing action on the bar (only shown together with `backHref`), e.g. "report a problem". */
  children?: ReactNode;
}

/** Inner screens get a sticky back bar with a concise visible title so people never lose context when scrolling. */
export function PageHeader({ title, backHref, description, children }: PageHeaderProps) {
  return (
    <header
      className={
        backHref
          ? "sticky top-0 z-20 -mx-inset -mt-inset flex items-center gap-stack bg-background/98 px-inset py-0"
          : "sr-only"
      }
    >
      {backHref ? <BackButton href={backHref} /> : null}
      {title ? <h1 className={backHref ? "min-w-0 flex-1 truncate type-heading" : "sr-only"}>{title}</h1> : null}
      {description ? <p className="sr-only">{description}</p> : null}
      {backHref && children ? <div className="ml-auto shrink-0">{children}</div> : null}
    </header>
  );
}
