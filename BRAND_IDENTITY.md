# Pixelist Brand Identity & Design Direction

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

## III. Functional Archetypes (The 3-Layer Rule)
Every new module or feature in Pixelist must follow this structural hierarchy:

1. **The Insight Layer (Top)**: Glassmorphic summary cards with real-time technical counters.
2. **The Control Layer (Middle)**: Compact, label-less dropdowns and inputs using a professional `text-[11px] font-extrabold` font scale.
3. **The Execution Layer (Bottom)**: Dense tables or grids using consistent row heights and clear triage badges.

---

## IV. AI Interaction (Base Prompt Foundation)
*When asking an AI agent to build a new feature for Pixelist, use the following context:*

> "Act as the 'Pixelist' Lead Architect. We are building a High-Performance Technical Cockpit UI. Follow the '3-Layer Rule' (Insight, Control, Execution). Use professional high-density standards: `text-[11px] font-extrabold` for toolbars, glassmorphic summary rows, and the high-contrast triage badge system (Red: Emergency, Orange: Caution, Blue: Active). All code must be tenant-aware and styled with premium micro-animations (spring easing)."
