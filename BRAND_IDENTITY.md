# Pixelist Brand Identity

## Scope
This document defines a single UI language for all CRM pages: typography, header structure, action buttons, spacing, and date formatting.

---

## Design Audit (Consistency)
### Key findings
1. Page titles were implemented with mixed scales and weights (`font-bold`, `font-extrabold`, `font-black`) across routes.
2. Primary page actions were inconsistent: icon-only in some pages, icon + label in others, and varied sizing/radius.
3. Header layout was not shared, creating different visual rhythm and alignment from page to page.
4. Project side view had oversized controls compared to nearby sections.
5. Date patterns were not unified between list view, side view, and footer metadata.

### UX impact
- Slower scanning and weaker hierarchy.
- Harder to predict what action is primary on each page.
- Perceived visual chaos despite good functional coverage.

---

## Design Pattern v1 (Required)

### 1) Typography
- `page-title`: only allowed class for top-level page headings.
- `page-subtitle`: only allowed class for subtitle/supporting copy under page heading.
- Section eyebrow labels: `text-xs font-bold uppercase tracking-[0.14em]`.
- Base body copy: `text-sm`.
- Metadata copy: `text-xs text-muted-foreground`.

### 2) Page Header
Use shared component:
- `components/layout/page-header.tsx`

Header anatomy:
- Left: `MobileMenuTrigger` + `page-title`.
- Right: primary actions.
- Optional second row: subtitle (`page-subtitle`).

### 3) Primary Header Action Pattern
Use shared utility classes:
- `.header-action-button`
- `.header-action-label`

Behavior:
- Mobile: icon-only (`h-10 w-10`).
- `md+`: icon + label.
- Shape: `rounded-xl`.
- Weight: `font-semibold`.
- Color: primary brand button.

Rule:
- Icon-only controls are allowed only for contextual/secondary actions, not for the main page CTA.

### 4) Spacing and Shape
- Primary controls: `h-10` baseline.
- Main cards: `rounded-xl` to `rounded-2xl`.
- Avoid mixing large pill buttons and compact rectangular controls in the same header row.

### 5) Date Language
- Project period in title/table: full month + year (`MMMM yyyy`), e.g. `February 2026`.
- Compact footer metadata: `d MMM. yy`, e.g. `21 Feb. 26`.
- Footer should show `Created` always.
- `Last updated` is shown only when value exists.

### 6) Project Side View Density
- Status/payment cards: compact vertical rhythm (`p-4` style density).
- Status values: controlled size (`text-xl` to `text-2xl` max).
- Amount display: integer style by default and currency suffix after value (`980 RON`).

---

## Implemented In This Pass

### Shared primitives
- Added and standardized utility classes in `app/globals.css`:
  - `.page-title`
  - `.page-subtitle`
  - `.header-action-button`
  - `.header-action-label`
  - `.header-action-icon`
- Added shared header component in `components/layout/page-header.tsx`.

### Title standardization
- `app/analytics/page.tsx`
- `app/services/page.tsx`
- `app/time/page.tsx`
- `app/ledger/page.tsx`
- `app/vault/sites/page.tsx`
- `app/settings/settings-content.tsx`
- `app/tasks/page.tsx`
- `app/projects/page.tsx`
- `app/vault/page.tsx`
- `app/vault/[partnerId]/page.tsx`
- `app/ppc/facebook-ads/page.tsx`
- `components/dashboard/greeting-header.tsx`

### Primary action button standardization
- `components/vault/create-partner-dialog.tsx`
- `components/vault/create-site-dialog.tsx`
- `components/services/create-service-dialog.tsx`
- `components/time/create-time-log-dialog.tsx`
- `components/projects/create-project-button.tsx` (full variant aligned to header pattern)

### Density/date-related UI consistency already aligned in recent project-side updates
- `components/projects/project-sheet-content.tsx`
- `components/projects/projects-table.tsx`

---

## Review Checklist (for every new page)
1. Does the page use `PageHeader` or match its structure exactly?
2. Does the page title use `page-title` only?
3. Is the primary CTA using `.header-action-button` + `.header-action-label`?
4. Are section labels and metadata using the standard text scale?
5. Are dates using approved formats only?
6. Are control heights/radii visually aligned with neighboring modules?
