# App Design Overview

This document provides a concise reference of the application's design system, visual direction, and component conventions as of March 2026.

## 1. Brand Identity & Visual Line
The app follows a **"Soft Productivity Cockpit"** aesthetic:
- **Surfaces**: Light slate backgrounds (`#F8FAFC`) with clean white cards (`#FFFFFF`).
- **Geometry**: High border-radius (`12px` to `24px`) for a modern, approachable feel.
- **Elevation**: Sublte shadows (`shadow-sm`, `apple-shadow`) and `backdrop-blur` for glassmorphism effects.
- **Accents**: Blue as primary action color (`#2563EB`) with soft state-based tints (tints for success, warning, debt).

## 2. Typography Tokens
All typography should use the following semantic classes to maintain consistency:
- **`ui-text-title`**: Large page headings (24px+, bold, tight tracking).
- **`ui-text-section`**: Section/group titles (14px, semi-bold).
- **`ui-text-label`**: Primary body/form labels (13px, medium).
- **`ui-text-caption`**: Metadata, subtitles, secondary info (12px, medium).
- **`ui-overline`**: Overlines/micro-category (11px, bold, uppercase, `0.08em` tracking).
- **`ui-text-metric`**: High-emphasis numbers (22px+, `font-mono`, `tabular-nums`).

**Rules**:
- Minimize `uppercase`. Reserve for `ui-overline` only.
- Prefer **Sentence case** for titles and labels.

## 3. Core Component Patterns

### Dashboards & Lists
- **Layout**: Custom CSS Grid replacing standard tables (min-width `1240px`).
- **Rows**: `premium-card` class with `stagger-row-enter` animations.
- **Headers**: `DashboardPageHeader` (unified Title + Search + Actions).
- **Filters**: Standard `FilterBar` primitives (Shell, Group, Divider).

### Side Panels (Sheets)
- **Structure**: Notion-inspired modular sections.
- **Primitives**: `SidePanelSectionTitle`, `SidePanelMetaBar` (ID/Dates), `SidePanelLoadingState`.
- **Logic**: Centralized state management via Sheets (Project, Task, etc.).

### Actions & Forms
- **Buttons**: Unified `Button` variants or `buttonLinkClassName` for nav-links.
- **Inputs**: Clean rounded fields with `shadcn` base or `input-ghost` for inline edits.
- **Status**: `StatusChip` for all status-based labels (Paid, Unpaid, Active, Paused).

## 4. Interaction Principles
- **Mobile-First**: High-touch targets, collapsible filters, and `showMobile` headers.
- **Immediate Feedback**: Instant client-side filtering and optimistic UI updates (e.g., status toggles).
- **Depth**: Using vertical pills/accents to indicate selection and status changes.
