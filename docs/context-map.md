# Context Map

Last updated: 2026-03-26

## Primary app surfaces
- `app/(dashboard)/` pages and route wiring.
- `components/` UI, sheets, filters, cards.
- `lib/actions/` server actions (business logic + writes).
- `lib/` shared auth, utils, tenant, prisma bindings.
- `prisma/` schema and migrations.

## Fast reading order for new tasks
1. Route page in `app/(dashboard)/.../page.tsx`
2. Main feature component in `components/...`
3. Server action used by that feature in `lib/actions/...`
4. Supporting utility files in `lib/...`
5. Prisma model in `prisma/schema.prisma`

## Keep context small
- Avoid opening `tmp/`, generated files, and old diagnostic scripts.
- Read only feature-local files first.
- Prefer shared primitives over duplicating UI logic.

## Feature ownership quick index
- Tasks: `app/(dashboard)/tasks`, `components/tasks`, `lib/actions/tasks.ts`
- Projects: `app/(dashboard)/projects`, `components/projects`, `lib/actions/projects.ts`
- Payments: `app/(dashboard)/payments`, `components/payments`, `lib/actions/payment-actions.ts`
- Time: `app/(dashboard)/time`, `components/time`, `lib/actions/time.ts`
- Partners/Domains: `app/(dashboard)/partners`, `app/(dashboard)/domains`, `components/vault`
