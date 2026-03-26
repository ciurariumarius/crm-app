# Codebase Cleanup Playbook

Last updated: 2026-03-26

## Goal
Keep the repository production-focused and reduce noise for development, review, and AI context windows.

## 1) What must not be committed
- Generated artifacts: `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`
- Local databases: `*.db`, `*.sqlite`, `*.db-journal`
- Temp/debug outputs: `tmp/`, `*.log`, `audit_output*.txt`, `lint_output.txt`
- Local assistant metadata: `.agent/`, `.gemini/`

## 2) Allowed top-level files
- Product code and config only (`app/`, `components/`, `lib/`, `prisma/`, `scripts/`, `docs/`)
- Keep one-off diagnostics outside git or under ignored paths.

## 3) Cleanup commands
```bash
npm run clean:artifacts
git status --short
```

## 4) Quality gate before merge
```bash
npm run lint
npm run typecheck
npm run build
```

Or run:
```bash
npm run verify
```

## 5) Monthly maintenance
1. Remove stale scripts not used by `package.json` scripts or workflows.
2. Remove old temporary docs/reports from root and `tmp/`.
3. Keep docs concise and current (`docs/design-*`, security runbooks, deployment notes).

## 6) Deletion policy
- Safe to delete: local experiments, debug snapshots, temporary test scaffolding.
- Do not delete without migration plan: `prisma/migrations`, production actions/API routes, auth/session flows.
