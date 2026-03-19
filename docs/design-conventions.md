# Design Conventions

## Typography
- Page titles: `ui-text-title`
- Section labels: `ui-text-section`
- Standard labels/body: `ui-text-label`
- Captions/meta: `ui-text-caption`
- Overlines (sparingly): `ui-overline`
- Numeric metrics (time/currency/counts): `ui-text-metric` + `font-mono` + `tabular-nums`

Rules:
- Avoid introducing new `text-[Npx]` unless there is a strict layout requirement.
- Avoid uppercase for regular labels and controls; reserve uppercase for overlines and tiny metadata only.

## Buttons and Links
- Default action control is `Button` from `components/ui/button.tsx`.
- For navigational controls that look like buttons, use `buttonLinkClassName(...)` from `components/ui/button-link.tsx`.
- Raw `<button>` should be limited to local primitives or very custom interactions where `Button` is not appropriate.

## Filter Bars
- Use:
  - `FilterBarShell`
  - `FilterBarScroll`
  - `FilterBarRow`
  - `FilterBarGroup`
  - `FilterBarDivider`
  - `FilterResultsRow`
- Keep group spacing and dividers consistent between pages.

## Tokens and Color
- Prefer semantic utilities (`text-foreground`, `bg-card`, `text-muted-foreground`, etc.) for shared UI.
- Use direct palette values (`slate-*`, `blue-*`, etc.) only when semantic tokens do not represent the intended state.

## Header Pattern
- Dashboard pages should prefer a consistent header shape:
  - left: menu trigger + title
  - center: search
  - right: primary action(s)
- Reuse `DashboardPageHeader` when possible.

## Side Panels
- Use shared shell classes from `lib/ui/side-panels.ts`.
- Use `components/ui/side-panel-primitives.tsx` for section titles, chips, info cards, empty states, and meta bars.
- Keep section order and spacing cadence consistent across panel types.
