# Pixelist UI Kit 2026 (Screenshot-Accurate Source of Truth)

This file is now the canonical UI spec for the app and is aligned to the provided screenshot.
Any future UI change should follow this document first.

## 1) Visual Direction

- Style: Clean enterprise dashboard with soft depth, strong information hierarchy, low-noise surfaces.
- Mood: Light, crisp, technical, operational.
- Layout principle: Fixed shell (left sidebar + top bar), content grid in modular rows.
- Density: Medium-compact (no oversized cards, no excessive whitespace).

## 2) Design Tokens (Aligned to Screenshot)

### Colors

- `--bg-app`: `#F3F6FA`
- `--bg-sidebar`: `#F7F9FC`
- `--bg-surface`: `#FFFFFF`
- `--bg-surface-soft`: `#F1F4F8`
- `--text-primary`: `#0F172A`
- `--text-secondary`: `#64748B`
- `--text-muted`: `#94A3B8`
- `--line-subtle`: `#E5EAF1`

- `--brand-primary`: `#0B8FA8`
- `--brand-primary-strong`: `#087A91`
- `--brand-cyan`: `#1FB6D9`
- `--brand-indigo`: `#4E5F78`

- `--state-urgent`: `#E54B4B`
- `--state-overdue`: `#F97316`
- `--state-active`: `#14B8A6`
- `--state-review`: `#7DD3FC`
- `--state-idea`: `#94A3B8`
- `--state-paused`: `#94A3B8`
- `--state-success`: `#22C55E`
- `--state-warning`: `#F59E0B`

### Typography

- Font family: `Plus Jakarta Sans` (single app font family).
- Page title: `48/700` desktop equivalent scale (`text-5xl` visual weight, tight tracking).
- Section title: `34/700`.
- Card title: `18/700`.
- Body: `14/500`.
- Meta labels / table headers: `11/700`, uppercase, wide tracking.

### Radius + Shadows

- Primary button radius: `10px`.
- Secondary controls radius: `9-10px`.
- Cards radius: `16px`.
- Pills/badges radius: `9999px`.
- Shadow: subtle only (`0 6px 18px rgba(15,23,42,0.06)` max for floating surfaces).

### Spacing

- Base spacing unit: `8px`.
- Main content section vertical rhythm: `24px`.
- Card internal spacing: `16px`.

## 3) Page Blueprint (From Screenshot)

## 3.1 App Shell

- Left Sidebar (fixed):
  - Brand block (logo + app subtitle).
  - Nav groups with icon + label.
  - Active item with left cyan indicator bar.
  - Bottom settings + profile module.
- Top Bar (fixed inside content shell):
  - Breadcrumb/tab segment (`TASKS > PROJECT X`).
  - Nav tabs: `Overview`, `Analytics`, `Reports`.
  - Global search input.
  - Notification icon.
  - Primary CTA: `+ New Project`.

## 3.2 Content Structure

1. Hero block:
   - Title: `Active Tasks`
   - Subtitle line with operational summary.
   - View toggle on right (`Board` / `Table`).
2. Filter strip:
   - Status segmented controls (`All Tasks`, `Urgent`, `In Review`).
   - Sort control (`Recently Updated`).
   - Inline filter search.
3. Task board row:
   - 3 cards per row (desktop), each with status chip and metadata.
4. Dual module row:
   - Left: `Project Identity & Scope` (table card).
   - Right: `Technical Vault` (stats + quick links card).
5. Dual module row:
   - Left: `Recent Time Logs` (list rows).
   - Right: `Managed Services` (table card).
6. Bottom system showcase block:
   - Actions/buttons, form states, status/meta chips.

## 4) Component Rules

### Buttons

- Primary CTA: filled brand gradient or strong brand solid (`--brand-primary`), white text, medium shadow.
- Secondary button: white/soft surface with subtle border.
- Text link button: brand text with low-noise hover.
- All buttons must use unified radius (`10px`) unless pill-specific.

### Inputs

- Height compact (`36-40px`).
- Soft surface fill with subtle border.
- Focus ring uses `--brand-cyan` at low opacity.
- Placeholder uses muted text token.

### Cards

- Background always `--bg-surface`.
- Border `1px solid --line-subtle`.
- Rounded `16px`.
- No heavy gradients inside data cards.

### Status Chips

- `Urgent`: red tint + red text.
- `Overdue`: orange tint + orange text.
- `Active`: teal tint + teal text.
- `Review`: light-cyan tint + cyan text.
- `Idea/Paused`: neutral slate tint + slate text.

### Tables

- Header row on soft background.
- Uppercase micro labels.
- Row hover only subtle tint.
- Numeric columns right-aligned.

## 5) Interaction Rules

- Hover: subtle background shift or text-color emphasis, never jumpy scale.
- Active controls: clear filled/tinted state, always visible.
- Side panels/modals: same radius system, same spacing system, same typography hierarchy.
- Empty states: concise sentence + single relevant action.

## 6) Comprehensive Implementation Plan (App-Wide)

## Phase 0 — Baseline & Safety

1. Freeze visual tokens in `app/globals.css` from section 2 above.
2. Add a “UI kit regression” checklist for all pages/components.
3. Create preview screenshots for: home, tasks, projects, payments, side sheets.

## Phase 1 — Foundations

1. Enforce single font family (`Plus Jakarta Sans`) globally.
2. Standardize button primitives (`components/ui/button.tsx`) to 10px radius and consistent sizes.
3. Standardize input/select/textarea primitives.
4. Standardize card primitive (radius, border, shadow, padding presets).

## Phase 2 — Shell & Navigation

1. Rebuild sidebar to screenshot structure (brand block, nav, active indicator, profile footer).
2. Rebuild top header with tabs + global search + notification + main CTA.
3. Ensure responsive behavior:
   - Desktop: fixed shell.
   - Mobile: bottom nav + slide menu equivalent.

## Phase 3 — Core Screens

1. Tasks page:
   - Implement screenshot filter strip.
   - Enforce task card template (3-column desktop board, compact card height).
2. Projects page:
   - Apply same filter/toolbar visual language.
   - Align table style to screenshot table system.
3. Home page:
   - Keep KPI intent but render with same card and typography styles as kit.
4. Payments page:
   - Convert partner unpaid area to table style consistent with screenshot modules.

## Phase 4 — Side Panels, Modals, Logs

1. Make all side sheets share one shell template:
   - title block
   - key status chips
   - content sections
   - metadata footer
2. Align modal visuals to screenshot component style.
3. Normalize logs (time/payment/status) to same list row pattern.

## Phase 5 — Tokens Migration & Cleanup

1. Remove remaining hardcoded color classes (`text-blue-*`, `bg-indigo-*`, raw hexes) from app/components.
2. Replace with semantic tokens only.
3. Remove deprecated visual docs/conflicting style definitions.

## Phase 6 — QA & Rollout

1. Visual QA per route and breakpoint (`mobile`, `tablet`, `desktop`).
2. Accessibility pass (contrast, focus states, keyboard nav).
3. Performance pass (avoid expensive blur/shadow overuse).
4. Ship in two releases:
   - Release A: foundation + shell + tasks
   - Release B: projects/payments/home + side sheets

## 7) Acceptance Criteria

- All pages use one typography system and one color token system.
- Buttons and inputs are visually consistent across routes.
- Cards, tables, badges, and filters match screenshot language.
- No old UI system fragments remain.
- Side panels and modals follow one unified structure.

