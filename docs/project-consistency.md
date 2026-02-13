# Project Detail Consistency

## Features Implemented
- **Unified Project Naming**: Created `lib/project-utils.ts` with `getProjectDisplayName` logic used across the app (Sidebar, List, Details).
- **Consistent Detail View**: Refactored `ProjectSheetContent` to be a reusable component for both the side drawer (in list view) and the dedicated Project Detail page (`/projects/[id]`).
- **Sidebar Project List**: Added an "Active Projects" section to the sidebar, fetching data in `RootLayout` and passing it to the `Sidebar` component.
- **UI Standardization**: Ensured consistent styling, icons, and layout for project information.

## API Changes
- **New Utility**: `getProjectDisplayName` in `lib/project-utils.ts`.
- **New Component**: `components/projects/project-sheet-content.tsx`.
- **Layout Update**: `app/layout.tsx` fetches active projects for the sidebar.
- **Sidebar Update**: `components/layout/sidebar.tsx` accepts `projects` prop.

## Usage
- The project detail view is now identical whether accessed via the table drawer or the direct URL.
- Project names consistently fallback to `Site Domain - Service Name` if a custom name is not set.
- Active projects are quickly accessible from the sidebar.
