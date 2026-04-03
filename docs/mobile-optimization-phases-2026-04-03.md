# Mobile Optimization Rollout (6 Phases)

## Phase 1: Baseline and Guardrails
- Added `scripts/verify-mobile-guardrails.ts` for static mobile regression checks.
- Added `npm run verify:mobile`.
- Added a CI quality-gate step to run `verify:mobile`.

## Phase 2: Shared Primitive Responsiveness
- Updated table primitives to allow content wrapping on small screens (`whitespace-normal`) and keep desktop behavior (`md:whitespace-nowrap`).
- Added `wrap` support for filter bar row/group primitives to avoid forced horizontal scrolling.
- Updated LMS date popover to responsive width and full-width calendar grid.

## Phase 3: LMS Mobile Layout Pass
- Implemented mobile card/list variants for:
  - `lms-analysis/tasks` (Hours by Employee + Actual Tasks Logged)
  - `lms-analysis/projects` (Projects Table rows)
  - `lms-analysis/data` (Import logs)
- Kept desktop table layouts untouched at `md+`.

## Phase 4: Performance Defaults
- Reduced default dashboard list page sizes:
  - `/projects`: default 50 (from 100), threshold 120.
  - `/tasks`: default 50 (from 100), threshold 120.
- This lowers initial query and render payload for mobile sessions.

## Phase 5: Accessibility and Touch Targets
- Increased pagination/select control heights from 32px to 36px on LMS tables.
- Added explicit `aria-label` attributes on filter and sort controls where needed.

## Phase 6: Safe Rollout Toggle
- Added feature flag helper `lib/lms-tasks/feature-flags.ts`.
- Mobile-optimized LMS card layouts are controlled by:
  - `NEXT_PUBLIC_LMS_ANALYSIS_MOBILE` (default enabled; set to `"false"` to disable).
