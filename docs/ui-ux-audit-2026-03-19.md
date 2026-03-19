# UI/UX Design Audit (2026-03-19)

## Scope
- App shell and navigation
- Core dashboards and list pages (`/`, `/tasks`, `/projects`, `/partners`, `/domains`, `/services`, `/time`, `/payments`)
- Shared UI primitives (`button`, `input`, `badge`, `card`, `sheet`, `dialog`)
- Side panels (project/task/partner/domain/service/time)
- Mobile vs desktop interaction patterns

This audit is based on the current codebase implementation (not a Figma/source-of-truth spec).

## Design Line (Current Visual Direction)
The app currently follows a **soft productivity UI** line:
- Light slate surfaces (`#F8FAFC`) with white cards and subtle borders
- Blue as primary action and focus color
- Rounded geometry (`lg` to `3xl`) with soft shadows
- Dense data display with chips, pills, and status tints
- "Notion-inspired" side panel direction recently standardized (shell + section primitives)

In short: **clean and modern, but with mixed typographic density and inconsistent component discipline in some areas**.

## Typography Audit

### Font stack in use
- Primary: `Inter` via `next/font/google`
- Mono: `JetBrains Mono` via `next/font/google`
- Mapped in `app/layout.tsx` and `app/globals.css` (`--font-inter`, `--font-jetbrains-mono`, `font-sans`, `font-mono`)

### Typographic behavior
- Base body has slight negative tracking (`letter-spacing: -0.008em`)
- Headings use tighter tracking (`-0.03em`) and semi-bold default
- Strong use of mono + tabular numbers for finance/time metrics (good for readability in data-heavy UI)

### Drift findings
- Very high number of one-off size/tracking utilities:
  - `text-[...px]`, custom tracking, and uppercase patterns are heavily repeated
  - Rough scan: `402` occurrences of custom size/tracking/uppercase markers and `155` `uppercase` usages
- Heavy micro-label style (`10px-11px`, uppercase, wide tracking) appears across many screens, causing visual noise and reduced readability on dense pages.
- One explicit hardcoded font family appears in PDF export generation in project notes (`components/projects/project-sheet-content.tsx`), bypassing design tokens.

## Button Audit (Across Components)

### Shared primitive quality
- `components/ui/button.tsx` is solid:
  - central variants (`default`, `outline`, `secondary`, `ghost`, etc.)
  - multiple sizes
  - focus/invalid states handled

### Real-world usage findings
- Pattern drift between:
  - `<Button>` with variant system
  - raw `<button>` with custom classes
  - `<Link>` styled as button
- Rough scan:
  - raw `<button>` in app/components: `125`
  - `<Button` usage: `141`
  - many bespoke class-heavy "button-like" links and buttons in toolbars/filters/cards
- Result: inconsistent hover/focus/active behavior and small spacing/shape differences between pages.

## Color, Tokens, and Surfaces
- Global semantic tokens exist in `app/globals.css`, but implementation often prefers direct slate utilities.
- Rough scan:
  - direct slate utilities: `1110`
  - semantic token utilities: `647`
- This indicates partial token adoption. Theme flexibility and visual consistency are limited by direct per-component color styling.

## Layout & Component Consistency

### Strengths
- Shared page title and action button style exists (`page-title`, `header-action-button`)
- Side panel shell has meaningful standardization (`lib/ui/side-panels.ts`, `components/ui/side-panel-primitives.tsx`)
- Filter bars for tasks/projects have converged significantly
- Cards and table visuals are generally coherent with current brand tone

### Gaps
- Header composition differs across pages:
  - some use `PageHeader`
  - others manually compose `MobileMenuTrigger + page-title + actions`
- Very large component files increase UI drift risk:
  - `project-sheet-content.tsx` (~1733 lines)
  - `projects-board-rows.tsx` (~1333 lines)
  - `task-details.tsx` (~1050 lines)
- Similar UI intent is often implemented with separate class strings instead of shared primitives (especially pills/chips/button rows/section labels).

## UX Findings

### Good
- Data-rich pages expose many quick controls (filters, sorting, columns, status toggles)
- Search in tasks/projects has been moved toward client-style instant behavior with context-driven updates
- Mobile navigation and side-panel flow are functional and discoverable

### Needs improvement
- Cognitive load in dense screens (many uppercase micro-labels, multiple chip styles, mixed emphasis levels)
- Inconsistent information hierarchy:
  - some cards use heavy display typography (`font-black`), others use medium weights for similar importance
- Button affordance inconsistency:
  - similar actions look different depending on file-specific class strings
- Filter bars remain visually complex; separators, spacing rhythm, and active-state affordance are not fully systematized across all pages

## Side Panels (Notion-Inspired Consistency Check)
- Recent standardization is clearly positive:
  - shared shell sizing
  - shared section/title/meta/danger primitives
- Remaining opportunity:
  - keep reducing one-off text styles inside each panel section
  - unify action rows (primary, secondary, danger) into one internal pattern
  - normalize spacing cadence between "notes / tracker / info / history / danger / meta" sections in every panel type

## Top Recommendations (Visual Upgrade Plan)

### Phase 1: Foundation tightening (fastest impact)
1. Create a **Typography Scale Map** in code:
   - `ui-text-title`, `ui-text-section`, `ui-text-label`, `ui-text-metric`, `ui-text-caption`
   - Replace most `text-[10px]`, `text-[11px]`, custom tracking variants with these classes.
2. Create a **Button Usage Rule**:
   - default to `<Button>` for all actions
   - reserve raw `<button>` only for semantic edge cases
   - wrap button-like links in one `buttonLinkVariants`.
3. Consolidate status/pill/chip styles:
   - one shared variant map for status, payment, urgency, overdue states.

### Phase 2: Page shell and filter system unification
1. Standardize all dashboard page headers on one pattern:
   - `PageHeader` + optional search slot + action slot.
2. Build a shared **FilterBar primitive**:
   - group spacing
   - divider logic
   - active-state visuals
   - result count + active filter chips + clear action
3. Normalize CTA hierarchy:
   - only one visual "primary" per viewport section
   - downgrade secondary actions to outline/ghost consistently.

### Phase 3: Visual clarity and readability upgrades
1. Reduce uppercase microcopy by ~40%:
   - keep uppercase only for section overlines and tiny metadata.
2. Increase body-label readability:
   - migrate many `10px/11px` labels to `12px/13px` where possible.
3. Use semantic tokens over direct slate utilities for key surfaces/text:
   - improves future theming and prevents drift.

### Phase 4: Structural maintainability (UI quality at scale)
1. Split very large UI files into section modules:
   - e.g., project/task side panel sections as independent components.
2. Introduce lightweight visual regression checks for critical views:
   - tasks card
   - projects rows
   - side panels
   - filter bars.
3. Add a short "Design Conventions" MD in repo:
   - typography usage
   - button hierarchy
   - spacing rhythm
   - token usage rules.

## Priority Fix List (Recommended Next 10)
1. Standardize header pattern on `/tasks`, `/projects`, `/vault` pages.
2. Create and apply a shared `FilterBar` wrapper for tasks/projects.
3. Replace high-frequency raw button classes in tasks/projects toolbars with shared button/link variants.
4. Unify all status/payment/urgency pills into one primitive map.
5. Reduce excessive `font-black` usage in card metadata and secondary metrics.
6. Raise smallest labels to a consistent minimum readable size (mobile first).
7. Move color-heavy slate utility usage to semantic token class usage for core surfaces.
8. Refactor project/task side panel internals into modular sections with shared spacing tokens.
9. Normalize icon sizing/stroke weight for all action controls.
10. Add a compact UI quality checklist to PR process (readability, hierarchy, focus states, spacing consistency).

## Overall Assessment
- **Design maturity:** Medium-high
- **Consistency:** Medium
- **Scalability of current UI system:** Medium (improving, but still too many one-off style implementations)
- **Main opportunity:** convert current strong visual direction into stricter reusable patterns so future updates stay consistent automatically.
