"use client";

import { AddIcon, MinusIcon, TrashBinMinimalisticIcon } from "@solar-icons/react/line-duotone";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatVnd } from "@/lib/money";
import { comboPrice, type DiscountType } from "@/services/pricing/combo-price";
import type { ComboFieldConfig } from "./resource-types";

interface Line {
  itemId: string;
  quantity: number;
}

const MAX_QUANTITY = 20;

function parseLines(text: string): Line[] {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const { itemId, quantity } = (entry ?? {}) as Partial<Line>;
      return typeof itemId === "string" && typeof quantity === "number" ? [{ itemId, quantity }] : [];
    });
  } catch {
    return [];
  }
}

interface ComboItemsFieldProps {
  config: ComboFieldConfig;
  /** The brand picked in the form; items of other brands are not offered (and not saved). */
  brandId: string | undefined;
  /** The saved or typed items as the JSON text the form sends. */
  initialItems: string;
  initialDiscountType: string;
  initialDiscountValue: string;
  /** Error code for the discount ("out_of_range"), already translated by the caller. */
  discountError?: string;
  invalid: boolean;
}

/**
 * The "items in the combo" part of the combo form: pick the brand's items with a quantity each, add a discount (in dong or percent),
 * and see the price it works out to (the sum of the items minus the discount; the server computes the same number from the same rule).
 * It writes three hidden/real inputs the form sends: `items` (JSON), `discountType`, `discountValue`.
 */
export function ComboItemsField({ config, brandId, initialItems, initialDiscountType, initialDiscountValue, discountError, invalid }: ComboItemsFieldProps) {
  const { labels, catalog, locale } = config;
  const [lines, setLines] = useState<Line[]>(() => parseLines(initialItems));
  const [type, setType] = useState<DiscountType>(initialDiscountType === "percent" ? "percent" : "amount");
  const [value, setValue] = useState(initialDiscountValue);
  // Changing the brand hides the other brand's items; they come back if the brand is switched back.
  const [adding, setAdding] = useState(0);

  const byId = new Map(catalog.map((item) => [item.id, item]));
  const visible = lines.filter((line) => byId.get(line.itemId)?.brandId === brandId);
  const addable = catalog.filter((item) => item.brandId === brandId && !visible.some((line) => line.itemId === item.id));

  const numeric = value.trim() === "" ? 0 : Number(value);
  const result = comboPrice(
    visible.map((line) => ({ price: byId.get(line.itemId)?.price ?? 0, quantity: line.quantity })),
    { type, value: Number.isFinite(numeric) ? numeric : 0 },
  );

  const setQuantity = (itemId: string, quantity: number) =>
    setLines((current) => current.map((line) => (line.itemId === itemId ? { ...line, quantity: Math.min(MAX_QUANTITY, Math.max(1, quantity)) } : line)));
  const label = (item: { name: string; size?: string }) => (item.size ? `${item.name} (${item.size})` : item.name);

  return (
    <div className="flex flex-col gap-group">
      <input type="hidden" name="items" value={JSON.stringify(visible)} />

      {visible.length > 0 ? (
        <ul className="flex flex-col gap-stack">
          {visible.map((line) => {
            const item = byId.get(line.itemId);
            if (!item) return null;
            return (
              <li key={line.itemId} className="flex flex-col gap-stack rounded-xl border bg-card p-inset-sm">
                <div className="flex items-start justify-between gap-stack">
                  <div className="flex min-w-0 flex-col">
                    <span className="type-item-title break-words">{label(item)}</span>
                    <span className="type-secondary text-muted-foreground tabular-nums">{formatVnd(item.price, locale)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${labels.remove}: ${label(item)}`}
                    className="-mt-tight -mr-tight size-target shrink-0 text-muted-foreground"
                    onClick={() => setLines((current) => current.filter((entry) => entry.itemId !== line.itemId))}
                  >
                    <TrashBinMinimalisticIcon aria-hidden />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-stack">
                  <div className="flex items-center gap-stack">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={labels.decrease}
                      disabled={line.quantity <= 1}
                      className="size-target rounded-full"
                      onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                    >
                      <MinusIcon aria-hidden />
                    </Button>
                    <span className="min-w-stepper text-center type-item-title tabular-nums" aria-live="polite">
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={labels.increase}
                      disabled={line.quantity >= MAX_QUANTITY}
                      className="size-target rounded-full"
                      onClick={() => setQuantity(line.itemId, line.quantity + 1)}
                    >
                      <AddIcon aria-hidden />
                    </Button>
                  </div>
                  <span className="type-body font-medium! tabular-nums">{formatVnd(item.price * line.quantity, locale)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={`rounded-xl border border-dashed px-inset py-inset-sm type-secondary ${invalid ? "border-destructive text-destructive" : "text-muted-foreground"}`}>
          {brandId ? labels.empty : labels.chooseBrand}
        </p>
      )}

      {/* Picking an item adds it; `key` resets the select so the next pick starts from the placeholder again. */}
      <Select
        key={adding}
        disabled={!brandId || addable.length === 0}
        onValueChange={(itemId) => {
          setLines((current) => [...current, { itemId, quantity: 1 }]);
          setAdding((n) => n + 1);
        }}
      >
        <SelectTrigger aria-label={labels.add} className="h-control w-full rounded-xl bg-card px-inset type-body">
          <SelectValue placeholder={brandId && addable.length === 0 ? labels.allAdded : labels.addPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {addable.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {label(item)} · {formatVnd(item.price, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-stack">
        <Select name="discountType" value={type} onValueChange={(next) => setType(next === "percent" ? "percent" : "amount")}>
          <SelectTrigger aria-label={labels.discountType} className="h-control w-1/2 rounded-xl bg-card px-inset type-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="amount">{labels.amount}</SelectItem>
            <SelectItem value="percent">{labels.percent}</SelectItem>
          </SelectContent>
        </Select>
        {type === "amount" ? (
          <MoneyInput
            name="discountValue"
            placeholder="0"
            aria-label={labels.discountValue}
            aria-invalid={Boolean(discountError) || undefined}
            value={value}
            onValueChange={setValue}
            className="h-control w-1/2 rounded-xl bg-card px-inset type-body"
          />
        ) : (
        <Input
          name="discountValue"
          type="number"
          inputMode="numeric"
          step="1"
          min={0}
          max={type === "percent" ? 100 : undefined}
          placeholder="0"
          aria-label={labels.discountValue}
          aria-invalid={Boolean(discountError) || undefined}
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-control w-1/2 rounded-xl bg-card px-inset type-body tabular-nums"
        />
        )}
      </div>
      {discountError ? (
        <p role="alert" className="-mt-stack type-secondary text-destructive">
          {discountError}
        </p>
      ) : null}

      <dl className="flex flex-col gap-tight rounded-xl border bg-card p-inset type-body tabular-nums">
        <div className="flex justify-between gap-item">
          <dt className="text-muted-foreground">{labels.subtotal}</dt>
          <dd>{formatVnd(result.subtotal, locale)}</dd>
        </div>
        <div className="flex justify-between gap-item">
          <dt className="text-muted-foreground">{labels.discount}</dt>
          <dd>{result.discount > 0 ? `−${formatVnd(result.discount, locale)}` : formatVnd(0, locale)}</dd>
        </div>
        <div className="flex justify-between gap-item font-semibold">
          <dt>{labels.price}</dt>
          <dd className="text-primary-text">{formatVnd(result.price, locale)}</dd>
        </div>
      </dl>
    </div>
  );
}
