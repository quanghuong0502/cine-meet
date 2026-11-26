---
trigger: always_on
description: Core cinema room standards, physical coordinate single-source-of-truth, 3D iPhone PWA constraints, and finalized product decisions for Seatmate.
---

# Seatmate — Cinema Room, Scoring & 3D Rules

Before making any changes to seat layouts, auditorium settings, cinema dimensions, seat scoring/Heatmap, or the 3D room viewer, **read [`docs/cinema-room-3d-standards.md`](../../docs/cinema-room-3d-standards.md) first** for the full real-world Vietnam/international cinema standards, formulas, and architecture.

## Non-Negotiable Technical Invariants

1. **Single Physical Source of Truth (`src/lib/seat-layout/physical.ts`)**:
   - Both `src/services/seat-score.ts` and `src/lib/seat-layout/scene.ts` MUST derive all metre coordinates (`x`, `z`, `widthM`, `screen.*`, aisles, margins, entrances) exclusively from `buildPhysicalRoom()`.
   - Never multiply raw 2D layout units (`seat.x * seatPitchM`, `seat.y * rowPitchM`) separately in scoring or 3D, or Heatmap and 3D will drift.
2. **Real-World Standards Baseline (`src/lib/seat-layout/dimensions.ts` & `physical.ts`)**:
   - All defaults follow **TCVN 5577:2012**, **QCVN 06:2022/BXD**, **ISO 7250-1**, **UNIC Handbook**, **Neufert**, **IBC**, **SMPTE EG 18**, **THX**, and **Ferco/Figueras**: `seatPitchM = 0.55 m`, `stepHeightM = 0.15 m`, `aisleWidthM = 1.20 m`, `horizontalAisleWidthM = 1.20 m`, `rowPitch = { tight: 0.95, standard: 1.10, vip: 1.45, bed: 1.70 }`, `screenMount = { low: 1.20, mid: 1.70, high: 2.25 }` (VN multiplex calibration, editable in `/admin/settings/cinema-dimensions`), `screenTilt = { flat: 0, slight: 5, tilted: 10 }` (pivoted around `centerZ = 0`), `RECLINE_EYE_DROP_M = { upright: 0, slight: 0.03, deep: 0.08 }`, exit doors `1.30 m × 2.10 m`, ceiling `≥ maxFloorY + 3.0 m`.
   - Row A (`rowIndex = 0`) MUST stay flush on the front floor (`floorHeight = 0 m`) even when `stadiumFromRow = 1` so `screenMount` reflects true screen height above row A.
   - Any new field added to `cinemaDimensionDefaultsSchema` MUST include `.default(...)` so legacy `SystemSetting["cinemaDimensions"]` documents remain valid.
3. **3D Architectural Accuracy (`scene.ts` & `room-3d-scene.ts`)**:
   - Floor slabs (`floorSlabs`) must bridge horizontal cross-aisles continuously and extend the last row's floor to `backWallZ`.
   - Multi-step rises (`stepsPerRow >= 2`) must subdivide into real intermediate aisle stairs (`aisleSteps`) and LED nosing lights (`aisleLights`), omitted on rows filled by `aisleFills`.
   - High-back chairs follow Ferco/Figueras heights (`standard ~1.02 m`, `vip ~1.06 m`, `recliner ~1.08–1.10 m`, `bed ~0.83 m`). Tilted screens render with an enclosed angled housing (`buildScreenHousingGeometry`) flush to `frontWallZ`.
   - Seated audience silhouettes (`buildAudienceGeometry(reclineDeg, eyeDropM)`) must keep hips on the compressed cushion (`0.42 m`), tilt spine/neck/head along `reclineDeg` to exact crown `1.22 m - eyeDropM` (never double-subtract `eyeDropM` in `updateAudience`), lower `-0.16 m` on `bed` seats, and place **2** silhouettes (`±seatPitchM / 2`) on couple seats (`span === 2`).
4. **iPhone Standalone PWA WebGL Constraints**:
   - Keep `three` lazy-loaded (`next/dynamic({ ssr: false })` + dynamic `import()` inside `useEffect`).
   - Keep `antialias: false`, `powerPreference: "default"`, `dpr <= 2`, `touch-action: none`, `EDGE_GUARD_PX = 20`, **on-demand rendering** (no permanent rAF loop), `webglcontextlost`/`restored` handling, `InstancedMesh` batching, `createPortal` + `mountTo()` zero-reload fullscreen with dual PWA exit controls (`env(safe-area-inset-*)`), 2-finger pinch-zoom in both orbit (from any angle) & seat POV, `oklch`/`oklab` parsing in `cssToHex`, and `forceContextLoss()` on `dispose()`.

## Finalized Product/UI Decisions (Do Not Revert)

- Do **NOT** re-add `screenCurved`, `rowCurve`, `stadiumFromRow`, or per-room `dimensions` numeric overrides to the auditorium editor form (`settings-panel.tsx`). Keep `screenTilt` (`Thẳng (0°)` / `Úp nhẹ (5°)` / `Úp vừa (10°)`) directly below `screenMount`.
- Do **NOT** add railings/barriers behind horizontal cross-aisles in 3D.
- Do **NOT** show viewer/front-person height controls (`showHeightControls`) in the Admin auditorium editor (user view only).
- Do **NOT** use `"Scope"` or `"IMAX"` in `screenShape` UI labels (`Rộng` / `Chuẩn` / `Vuông`).
- `sideAisles` stays toggle chips (default off) and always counts toward full room width when enabled.
- Defaults: `DEFAULT_STEPS_PER_ROW = 1`, `stadiumFromRow: 1`, `screen.shape: "scope"`, `screen.tilt: "flat"`.
- Never modify or commit untracked `docs/agy-web-bridge-guideline.md` or `scripts/bridge-server.js`.

## Verification Notes

- Run `npm run typecheck && npx eslint src/ && npx vitest run src/lib/seat-layout/ src/components/seat-map/seat-map.test.ts src/design-tokens.test.ts` (use `npx eslint src/` to avoid unrelated lint errors in untracked `scripts/bridge-server.js`).
- Next.js 16 Turbopack `npm run build` may hang inside the sandbox; run it alone with `BypassSandbox: true` when verifying builds.
