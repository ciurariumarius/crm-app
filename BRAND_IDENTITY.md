# Pixelist Brand Identity & Product Blueprint

## I. Mission & Product Definition
**Pixelist** is a high-performance "Technical Cockpit" CRM designed for agencies and high-output teams. It bridges the gap between a visual project management tool and a precision financial instrument. 

### Core Value Props:
1. **Total Visibility**: Instant high-level metrics (Summary Rows) before diving into granular data.
2. **Speed-to-Action**: Minimalistic toolbars, keyboard-friendly flows, and high-contrast triage (Badge System).
3. **Professional Density**: Information density is prioritized over "white space," utilizing a technical HUD (Heads-Up Display) aesthetic.

---

## II. Design Philosophy: "The Technical Cockpit"
The design language is a fusion of **Apple-inspired precision** and **Industrial/Financial data density**.

### 1) Precision Elegance
- **Hierarchy**: Primary actions are bold and blue; secondary actions are ghost-style or slate.
- **Micro-animations**: Use subtle scales, pulses, and stagger entries to make the UI feel "alive" and responsive (e.g., timer heartbeats, card enters).
- **Glassmorphism**: Use `backdrop-blur-md` and `white/70` for containers to create depth without visual weight.

### 2) The Triage Law (High Contrast)
Every item's state should be identifiable in under 200ms using color-coded shapes:
- **Red/Rose**: High-alert, overdue, or urgent (Emergency).
- **Orange/Amber**: Impending work or paused states (Caution).
- **Blue**: Primary focus, active work, or upcoming (Normal).
- **Slate/Gray**: Completed, historical, or background metadata (Passive).

### 3) Technical HUD Aesthetic
- Use monospaced fonts (`font-mono`) for numerical data and technical metadata.
- Use `text-[10px]` to `text-[12px]` with `font-extrabold` and high letter-spacing (`tracking-[0.1em]`) for labels to give a "military-grade" or "premium cockpit" feel.

---

## IV. Functional Archetypes (The 3-Layer Rule)
Every new module or feature in Pixelist must follow this structural hierarchy:

1. **The Insight Layer (Top)**: A `TasksSummaryRow` or `ProjectsDashboardRows` grid.
    - Glassmorphic cards (`bg-white/70 backdrop-blur-md`).
    - Real-time technical counters (Large bold text).
    - Status-colored icons (`bg-focus-50`).

2. **The Control Layer (Middle)**: A `TasksToolbar` or Filter row.
    - Compact, label-less dropdowns and inputs.
    - Professional font scale (`text-[11px] font-extrabold`).
    - High utility (Search + Filter + Sort + Results count).

3. **The Execution Layer (Bottom)**: A Detail Table or Card Grid.
    - Consistent row heights (`h-12` to `h-14` for list items).
    - Clear triage badges (`Red Overdue`, `Orange Today`, `Blue Future`).
    - Premium hover states (`active:scale-[0.98]`, subtle shadow transitions).

---

## V. Technical Signature
- **Framework**: Next.js (App Router), TypeScript.
- **Styling**: Tailwind CSS v4 (Standardized utility classes).
- **Icons**: Lucide React (Stroke width: 1.5).
- **Data**: Prisma ORM with Tenant-Isolated Context (`requireTenantContext`).
- **Typography**: Inter (Sans), JetBrains Mono (Technical Data).
- **Animations**: Framer Motion / CSS Transitions (Custom `ease-spring`).

---

## VI. AI Interaction (Base Prompt Foundation)
*When asking an AI agent to build a new feature for Pixelist, use the following context:*

> "Act as the 'Pixelist' Lead Architect. We are building a High-Performance Technical Cockpit UI. Follow the '3-Layer Rule' (Insight, Control, Execution). Use professional high-density standards: `text-[11px] font-extrabold` for toolbars, glassmorphic summary rows, and the high-contrast triage badge system (Red: Emergency, Orange: Caution, Blue: Active). All code must be tenant-aware and styled with premium micro-animations (spring easing)."

---

## VII. Design Pattern v1 (Required Standards)

## Design Audit (Consistency)
### Key findings (March 2026 Audit)
1. Filters were inconsistent across Projects and Tasks (mixed labels and alignment).
2. Result summaries were taking up too much vertical space or were detached from controls.
3. Deadlines and priority badges were visually similar, causing scanning friction.
4. Summary metrics were missing from main list views, forcing users to click through to see totals.

### Implementation Goals (Achieved)
- Standardized filter density using icon-only labels and `text-[11px] font-extrabold`.
- Integrated results count directly into the filter toolbar.
- Implemented a High-Contrast Triple-Color Badge system for immediate status triage.
- Added premium Summary Rows with glassmorphism and micro-animations.

---

## Design Pattern v1 (Required)

### 1) Typography
- `page-title`: only allowed class for top-level page headings.
- `page-subtitle`: only allowed class for subtitle/supporting copy under page heading.
- Section eyebrow labels: `text-xs font-bold uppercase tracking-[0.14em]`.
- Filter labels (Compact): `text-[11px] font-extrabold uppercase tracking-tight text-slate-500`.
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

### 7) Filter Toolbar Pattern
- **Layout**: `flex items-center justify-between w-full`.
- **Labels**: Removed explicit text labels (e.g., "Status:"). Use placeholders or icons.
- **Font**: `text-[11px] font-extrabold`.
- **Spacing**: Use vertical dividers (`h-7 w-px bg-slate-200`) to separate functional clusters (Search | Filters | Sort | Results).
- **Sort**: Compact dropdown triggers with `ArrowDownUp` icon and no explicit "Sort by" label.

### 8) Summary Row Pattern
- **Placement**: Directly below main content or above significant sections.
- **Style**: Grid layout (1-4 cols) with `white/70` glassmorphism and `backdrop-blur-md`.
- **Anatomy**: Top row contains a colored icon (`bg-color-50`) + Small uppercase eyebrow. Bottom row contains a large bold metric + supporting metadata.

### 9) Badge System (High Contrast)
- **Urgent Priority**: Solid Rose (`bg-rose-600 text-white`) + `Zap` icon.
- **Overdue**: White BG, Red Border (`border-2 border-rose-500 text-rose-600`) + `Clock` icon.
- **Due Today**: Solid Orange (`bg-orange-500 text-white`) + `CalendarClock` icon.
- **Future**: Faint Blue theme (`bg-blue-50 text-blue-600 border-blue-200`) + `Calendar` icon.

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

### Filter & Toolbar standardization (March 2026)
- `components/tasks/tasks-toolbar.tsx`
- `app/(dashboard)/projects/page.tsx`
- Removed redundant labels, unified font to `text-[11px] font-extrabold`.
- Integrated results count into the toolbar layout.

### Premium Summary Rows
- `app/(dashboard)/tasks/page.tsx`
- `app/(dashboard)/projects/page.tsx`
- Implemented glassmorphic cards with live metrics and custom icons.

### High-Contrast Badge System
- `components/tasks/task-grid-card.tsx`
- `components/tasks/tasks-card-view.tsx`
- Standardized colors for Urgent, Overdue, and Today/Future deadlines.

---

## Review Checklist (for every new page)
1. Does the page use `PageHeader` or match its structure exactly?
2. Does the page title use `page-title` only?
3. Is the primary CTA using `.header-action-button` + `.header-action-label`?
4. Are filters using the compact `text-[11px] font-extrabold` pattern with dividers?
5. Are section labels and metadata using the standard text scale?
6. Are dates using approved formats only?
7. Are control heights/radii visually aligned with neighboring modules?
8. If applicable, is there a Summary Row for key metrics?
