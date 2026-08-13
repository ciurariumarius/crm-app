# Pixelist UI System

This document is the visual source of truth for Pixelist CRM.

## Direction

- Product character: calm, precise, operational and medium-compact.
- Typography: Geist for interface text and Geist Mono for numeric or technical data.
- Brand: green is the primary action and focus color. State colors communicate meaning and are not decorative accents.
- Themes: light and dark are equal product surfaces. Shared components must use semantic tokens rather than light-only palette utilities.

## Foundations

### Typography

- Page title: `ui-text-title`
- Section title: `ui-text-section`
- Body and control label: `ui-text-label`
- Caption: `ui-text-caption`
- Metric: `ui-text-metric` with tabular numerals where applicable
- Overline: `ui-overline`, reserved for secondary metadata

Functional labels and controls must be at least 12px. Text below 12px is allowed only for non-essential technical metadata.

### Geometry

- Surface/card radius: 16px
- Button, input and local control radius: 12px
- Status and filter chips: pill radius
- Floating shell radius: 20px
- Shadows remain subtle; hierarchy is created primarily through spacing, border and typography.

### Color

Use the semantic variables in `app/globals.css`:

- Surfaces: `--bg-canvas`, `--background`, `--surface-lowest`, `--surface-low`, `--surface-highest`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`
- Brand: `--brand-primary`, `--brand-primary-strong`
- States: `--state-success`, `--state-warning`, `--state-urgent`, `--info` and their semantic surfaces

Direct Tailwind palette colors are allowed only for source-specific visualizations that cannot be represented by a semantic state.

## Composition

- Every dashboard route starts with `AppPageHeader`.
- A header owns its surface; pages must not wrap it in another bordered card.
- Use one primary action per page header. Secondary actions use outline, ghost or a contextual menu.
- Use `SectionCard` for content modules, `StatCard` for summary metrics and `IconButton` for icon-only actions.
- Use `StatusChip` for status, payment, urgency and recurring state.

## Responsive and accessibility

- Mobile: up to 767px; tablet portrait: 768–1023px; tablet landscape: 1024–1279px; desktop: 1280px and above.
- Primary and icon-only mobile actions require a minimum 44x44px target.
- Icon-only controls require an accessible label.
- Collapsed sidebar groups open explicit right-side flyouts; focus must never temporarily expand the sidebar.
- All focus, hover, selected, empty and error states must work in both themes.

## Review checklist

- One page header and one primary action
- No nested decorative surfaces
- Semantic colors in both themes
- Functional text at least 12px
- Visible keyboard focus and accessible names
- Mobile, tablet portrait, tablet landscape and desktop verification
