"use client";

import { LoaderIcon, RestartIcon } from "@solar-icons/react/line-duotone";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCinemaDimensionsAction } from "@/app/admin/settings/cinema-dimensions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_CINEMA_DIMENSIONS,
  DIMENSION_BOUNDS,
  type CinemaDimensionDefaults,
} from "@/lib/seat-layout/dimensions.defaults";

interface Props {
  initial: CinemaDimensionDefaults;
}

const INPUT_CLASS = "h-control rounded-xl bg-background px-inset type-body tabular-nums";

interface NumFieldProps {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  step: string;
  unit?: string;
  onChange: (next: string) => void;
}

function DecimalField({ id, label, value, min, max, step, unit, onChange }: NumFieldProps) {
  return (
    <div className="flex flex-col gap-item">
      <div className="flex items-baseline justify-between gap-tight">
        <Label htmlFor={id} className="text-muted-foreground">
          {label}
        </Label>
        {unit ? <span className="type-secondary text-muted-foreground">{unit}</span> : null}
      </div>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  );
}

type Draft = Record<string, string>;

function toDraft(d: CinemaDimensionDefaults): Draft {
  return {
    seatPitchM: String(d.seatPitchM),
    stepHeightM: String(d.stepHeightM),
    aisleWidthM: String(d.aisleWidthM),
    horizontalAisleWidthM: String(d.horizontalAisleWidthM),
    rowPitchTight: String(d.rowPitch.tight),
    rowPitchStandard: String(d.rowPitch.standard),
    rowPitchVip: String(d.rowPitch.vip),
    rowPitchBed: String(d.rowPitch.bed),
    mountLow: String(d.screenMount.low),
    mountMid: String(d.screenMount.mid),
    mountHigh: String(d.screenMount.high),
    aspectScope: String(d.screenAspect.scope),
    aspectStandard: String(d.screenAspect.standard),
    aspectSquare: String(d.screenAspect.square),
    distNearRatio: String(d.screenDistance.near.ratio),
    distNearMin: String(d.screenDistance.near.minM),
    distMedRatio: String(d.screenDistance.medium.ratio),
    distMedMin: String(d.screenDistance.medium.minM),
    distFarRatio: String(d.screenDistance.far.ratio),
    distFarMin: String(d.screenDistance.far.minM),
  };
}

function fromDraft(draft: Draft): CinemaDimensionDefaults {
  const num = (k: string) => Number(draft[k]);
  return {
    seatPitchM: num("seatPitchM"),
    stepHeightM: num("stepHeightM"),
    aisleWidthM: num("aisleWidthM"),
    horizontalAisleWidthM: num("horizontalAisleWidthM"),
    rowPitch: {
      tight: num("rowPitchTight"),
      standard: num("rowPitchStandard"),
      vip: num("rowPitchVip"),
      bed: num("rowPitchBed"),
    },
    screenMount: {
      low: num("mountLow"),
      mid: num("mountMid"),
      high: num("mountHigh"),
    },
    screenAspect: {
      scope: num("aspectScope"),
      standard: num("aspectStandard"),
      square: num("aspectSquare"),
    },
    screenDistance: {
      near: { ratio: num("distNearRatio"), minM: num("distNearMin") },
      medium: { ratio: num("distMedRatio"), minM: num("distMedMin") },
      far: { ratio: num("distFarRatio"), minM: num("distFarMin") },
    },
  };
}

export function CinemaDimensionsForm({ initial }: Props) {
  const t = useTranslations("admin.cinemaDimensions");
  const tc = useTranslations("admin.common");
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [pending, startSaving] = useTransition();

  const set = (key: string) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

  function resetToStandards() {
    setDraft(toDraft(DEFAULT_CINEMA_DIMENSIONS));
    toast.info(t("resetNotice"));
  }

  function save() {
    startSaving(async () => {
      const result = await saveCinemaDimensionsAction(fromDraft(draft));
      if (result.ok) {
        toast.success(result.rescored > 0 ? t("savedWithRescore", { count: result.rescored }) : tc("saved"));
      } else {
        toast.error(result.error === "validation" ? t("validationError") : tc("errors.unknown"));
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-group">
      <p className="type-secondary text-muted-foreground">{t("intro")}</p>

      <Card>
        <CardHeader>
          <CardTitle className="type-item-title">{t("sections.general")}</CardTitle>
          <CardDescription>{t("sections.generalHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-field sm:grid-cols-2">
          <DecimalField id="dim-seat-pitch" label={t("fields.seatPitchM")} value={draft.seatPitchM} step="0.01" unit="m" {...DIMENSION_BOUNDS.seatPitchM} onChange={set("seatPitchM")} />
          <DecimalField id="dim-step-height" label={t("fields.stepHeightM")} value={draft.stepHeightM} step="0.01" unit="m" {...DIMENSION_BOUNDS.stepHeightM} onChange={set("stepHeightM")} />
          <DecimalField id="dim-aisle-width" label={t("fields.aisleWidthM")} value={draft.aisleWidthM} step="0.05" unit="m" {...DIMENSION_BOUNDS.aisleWidthM} onChange={set("aisleWidthM")} />
          <DecimalField id="dim-h-aisle-width" label={t("fields.horizontalAisleWidthM")} value={draft.horizontalAisleWidthM} step="0.05" unit="m" {...DIMENSION_BOUNDS.horizontalAisleWidthM} onChange={set("horizontalAisleWidthM")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="type-item-title">{t("sections.rowPitch")}</CardTitle>
          <CardDescription>{t("sections.rowPitchHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-field sm:grid-cols-2">
          <DecimalField id="dim-rp-tight" label={t("fields.rowPitchTight")} value={draft.rowPitchTight} step="0.05" unit="m" {...DIMENSION_BOUNDS.rowPitchM} onChange={set("rowPitchTight")} />
          <DecimalField id="dim-rp-std" label={t("fields.rowPitchStandard")} value={draft.rowPitchStandard} step="0.05" unit="m" {...DIMENSION_BOUNDS.rowPitchM} onChange={set("rowPitchStandard")} />
          <DecimalField id="dim-rp-vip" label={t("fields.rowPitchVip")} value={draft.rowPitchVip} step="0.05" unit="m" {...DIMENSION_BOUNDS.rowPitchM} onChange={set("rowPitchVip")} />
          <DecimalField id="dim-rp-bed" label={t("fields.rowPitchBed")} value={draft.rowPitchBed} step="0.05" unit="m" {...DIMENSION_BOUNDS.rowPitchM} onChange={set("rowPitchBed")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="type-item-title">{t("sections.screen")}</CardTitle>
          <CardDescription>{t("sections.screenHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-group">
          <div className="grid grid-cols-1 gap-field sm:grid-cols-2 md:grid-cols-3">
            <DecimalField id="dim-mount-low" label={t("fields.mountLow")} value={draft.mountLow} step="0.05" unit="m" {...DIMENSION_BOUNDS.screenBottomM} onChange={set("mountLow")} />
            <DecimalField id="dim-mount-mid" label={t("fields.mountMid")} value={draft.mountMid} step="0.05" unit="m" {...DIMENSION_BOUNDS.screenBottomM} onChange={set("mountMid")} />
            <DecimalField id="dim-mount-high" label={t("fields.mountHigh")} value={draft.mountHigh} step="0.05" unit="m" {...DIMENSION_BOUNDS.screenBottomM} onChange={set("mountHigh")} />
          </div>
          <div className="grid grid-cols-1 gap-field sm:grid-cols-2 md:grid-cols-3">
            <DecimalField id="dim-aspect-scope" label={t("fields.aspectScope")} value={draft.aspectScope} step="0.01" unit=":1" {...DIMENSION_BOUNDS.screenAspect} onChange={set("aspectScope")} />
            <DecimalField id="dim-aspect-std" label={t("fields.aspectStandard")} value={draft.aspectStandard} step="0.01" unit=":1" {...DIMENSION_BOUNDS.screenAspect} onChange={set("aspectStandard")} />
            <DecimalField id="dim-aspect-sq" label={t("fields.aspectSquare")} value={draft.aspectSquare} step="0.01" unit=":1" {...DIMENSION_BOUNDS.screenAspect} onChange={set("aspectSquare")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="type-item-title">{t("sections.screenDistance")}</CardTitle>
          <CardDescription>{t("sections.screenDistanceHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-field">
          <div className="grid grid-cols-2 gap-field">
            <DecimalField id="dim-dist-near-r" label={t("fields.distNearRatio")} value={draft.distNearRatio} step="0.02" unit="×W" {...DIMENSION_BOUNDS.screenDistanceRatio} onChange={set("distNearRatio")} />
            <DecimalField id="dim-dist-near-m" label={t("fields.distNearMin")} value={draft.distNearMin} step="0.1" unit="m" {...DIMENSION_BOUNDS.screenDistanceM} onChange={set("distNearMin")} />
          </div>
          <div className="grid grid-cols-2 gap-field">
            <DecimalField id="dim-dist-med-r" label={t("fields.distMedRatio")} value={draft.distMedRatio} step="0.02" unit="×W" {...DIMENSION_BOUNDS.screenDistanceRatio} onChange={set("distMedRatio")} />
            <DecimalField id="dim-dist-med-m" label={t("fields.distMedMin")} value={draft.distMedMin} step="0.1" unit="m" {...DIMENSION_BOUNDS.screenDistanceM} onChange={set("distMedMin")} />
          </div>
          <div className="grid grid-cols-2 gap-field">
            <DecimalField id="dim-dist-far-r" label={t("fields.distFarRatio")} value={draft.distFarRatio} step="0.02" unit="×W" {...DIMENSION_BOUNDS.screenDistanceRatio} onChange={set("distFarRatio")} />
            <DecimalField id="dim-dist-far-m" label={t("fields.distFarMin")} value={draft.distFarMin} step="0.1" unit="m" {...DIMENSION_BOUNDS.screenDistanceM} onChange={set("distFarMin")} />
          </div>
        </CardContent>
      </Card>

      <div aria-hidden className="h-save-clear shrink-0" />

      <div data-save-bar className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-inset pt-group pb-(--inset-bottom) md:left-sidebar">
        <div className="mx-auto flex max-w-form flex-wrap items-center gap-stack">
          <Button
            type="button"
            variant="outline"
            size="cta"
            disabled={pending}
            onClick={resetToStandards}
            className="pointer-events-auto w-auto flex-auto bg-background px-inset-sm"
          >
            <RestartIcon aria-hidden />
            {t("reset")}
          </Button>
          <Button type="button" size="cta" disabled={pending} onClick={save} className="pointer-events-auto w-auto flex-auto px-inset">
            {pending ? (
              <>
                <LoaderIcon className="motion-safe:animate-spin" aria-hidden />
                {tc("saving")}
              </>
            ) : (
              tc("save")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
