# Side Modal Audit (2026-03-19)

## Scope
- Project side panel
- Task side panel
- Partner side panel
- Domain/site side panel
- Service side panel
- Time log side panel
- Payment-related modal touchpoints

## Audit Findings

1. Inconsistent shell sizing and elevation
- Different `SheetContent` widths, borders, shadows, and backgrounds created visual drift.

2. Mixed close behavior
- Some side panels used default Radix close button, others used custom top-right buttons.
- Domain/site panel did not consistently expose the same explicit close affordance.

3. Header rhythm mismatch
- Header paddings and spacing were close but not standardized, causing subtle jumps while switching panels.

4. Nested panel experience divergence
- Nested panels opened from projects/tasks used different shell classes than primary panels.

5. Notion-style visual language partially applied
- Several panels already used the intended clean card + soft-surface style, but shell consistency was incomplete.

## Implemented in this pass

1. Shared Notion-style shell utility
- Added `lib/ui/side-panels.ts` with:
  - `sidePanelClass(size)` for unified shell classes
  - `SIDE_PANEL_HEADER_CLASS` for unified header spacing

2. Standardized shell classes across major side panels
- `components/projects/project-sheet-wrapper.tsx`
- `components/tasks/task-details.tsx`
- `components/tasks/tasks-card-view.tsx`
- `components/projects/projects-table.tsx`
- `components/vault/partner-card.tsx`
- `components/vault/sites-table.tsx`
- `components/vault/sites-list-view.tsx`
- `components/services/services-list-view.tsx`
- `components/time/time-log-sheet.tsx`

3. Unified explicit close behavior for site panel
- Added `onClose` support and custom close button to:
  - `components/vault/site-sheet-content.tsx`
- Connected `onClose` from all relevant site sheet entry points.

4. Time-log sheet aligned with same side-panel language
- Same shell sizing tier + unified header spacing.
- Explicit close button added to match other panels.

## Phase 2 implementation update (completed)

1. Added shared internal panel primitives
- `components/ui/side-panel-primitives.tsx`
- Introduced:
  - `SidePanelSectionTitle`
  - `SidePanelMetaBar`
  - `SidePanelDangerZone`

2. Applied shared internal section primitives to side panels
- `components/projects/project-sheet-content.tsx`
- `components/tasks/task-details.tsx`
- `components/vault/partner-sheet-content.tsx`
- `components/vault/site-sheet-content.tsx`
- `components/services/service-sheet-content.tsx`
- `components/time/time-log-sheet.tsx`

3. What was standardized in content layout
- Section title typography and spacing.
- Bottom metadata row pattern (ID + created/updated).
- Danger zone block structure and visual treatment.
- Consistent micro-interaction language in side panel internals.

## Phase 3 and 4 implementation update (completed)

1. Unified chip system for side panels
- Added `SidePanelChip` + label-to-tone mapping in:
  - `components/ui/side-panel-primitives.tsx`
- Applied across project/task/service panel internals:
  - notes save state
  - history badges
  - open-website action pills
  - service recurring/one-time chip

2. Unified info-card blocks
- Added `SidePanelInfoCard` in:
  - `components/ui/side-panel-primitives.tsx`
- Applied to project/task “Info” sections (partner/domain cards).

3. Unified empty-state blocks
- Added `SidePanelEmptyState` in:
  - `components/ui/side-panel-primitives.tsx`
- Applied to project/task history and time-log empty states.

4. Unified non-sheet dialog spacing scale
- Added dialog shell helpers in:
  - `lib/ui/side-panels.ts`
- Applied to side-panel related dialogs:
  - project notes modal
  - task notes modal
  - partner add-payment modal

## Additional fixes made while validating
- Removed lint blockers and unsafe synthetic submit casts in partner sheet.
- Fixed a vault page typing mismatch during build:
  - `app/(dashboard)/vault/page.tsx`

## Recommended Next Improvements (Notion-inspired)

1. Shared section components for all side panels
- Add reusable primitives for section title, metadata row, and danger zone blocks.
- Goal: identical spacing and typography cadence across panels.

2. Action bar consistency
- Standardize bottom metadata/actions bar for task, project, partner, site, and service panels.

3. Keyboard UX parity
- Ensure identical keyboard behavior for close, save-on-blur, and focus rings in all side panels.

4. Status chip system
- Consolidate status/priority/payment chips into one shared variant map to remove remaining style drift.

5. Motion consistency
- Harmonize open/close and nested panel transitions to one timing curve and duration.
