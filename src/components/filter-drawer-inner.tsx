"use client";

import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { FilterDrawerProps } from "@/components/filter-drawer";

export function FilterDrawerInner({ open, onOpenChange, title, children, footer }: FilterDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle className="type-heading">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex min-h-0 flex-col gap-group overflow-x-hidden overflow-y-auto overscroll-contain px-inset pb-inset">
          {children}
        </div>
        <DrawerFooter>{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
