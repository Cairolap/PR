# Technical Specification: UI Layout Expansion & Logo Redesign

**Status**: Approved  
**Author**: Antigravity Frontend Specialist  
**Date**: 2026-09-18  
**Target Milestone**: V1.2 Frontend Design Polish  

---

## 1. Executive Summary & Goals

### 1.1 Objective
Enhance user ergonomics and aesthetic balance across the Purchase Requisition & Store Ledger application by:
1. Sizing and properly aligning the official "แผนกซ่อมไฟฟ้า" logo alongside the system title.
2. Expanding the Add Item / Edit workspace (`#view-entry`) to 100% viewport width by automatically collapsing/hiding the left navigation sidebar upon entry.
3. Expanding and optimizing the real-time preview table on the right side of the split view to eliminate awkward horizontal scrolling, ensuring high-density readability and click-to-edit responsiveness.

### 1.2 Success Metrics
- **Zero Horizontal Scrollbar** on standard desktop viewports (>= 1280px) in the live preview table.
- **100% Viewport Utilization**: The split entry workspace occupies the entire window below the header.
- **Crisp Logo Display**: The brand logo renders cleanly at high resolution (38px height, native aspect ratio) with no clipping.

### 1.3 Non-Goals
- Changing database schema or backend Worker endpoints.
- Introducing multi-page hard routing (single-page reactive state transitions remain standard).

---

## 2. User Experience & Interaction Flows

### 2.1 Primary User Journeys

#### Journey 1: Opening New Entry Workspace
1. User clicks "+ สร้างรายการใหม่" (or edits an existing row).
2. System adds class `workspace-entry-active` to `document.body` and reveals `#view-entry` while hiding `#view-ledger`.
3. Sidebar collapses/hides; the split workspace expands across 100% screen width.
4. Left pane displays the entry form (42%-45% width).
5. Right pane displays the live table preview (55%-58% width) showing all recent records with sticky headers.

#### Journey 2: Dismissing / Returning to Ledger
1. User clicks "← กลับสู่หน้ารายการ" or presses `Escape`.
2. System removes `workspace-entry-active` from `document.body`, revealing `#view-ledger` and restoring the sidebar.

### 2.2 UI Layout Matrix

View State | Left Sidebar | Left Pane (Form) | Right Pane (Preview Table)
:--- | :--- | :--- | :---
**Ledger View (`#view-ledger`)** | Visible (256px) | N/A | Full ledger table + bulk action bar
**Entry View (`#view-entry`)** | Hidden (0px / collapsed) | 42%-45% width form | 55%-58% full-width preview table

---

## 3. System Architecture & CSS Contract

### 3.1 CSS Rules & Sizing
- `.brand-logo-img`: `height: 38px; width: auto; max-width: 200px; object-fit: contain; vertical-align: middle;`
- `body.workspace-entry-active .app-sidebar`: `display: none !important;`
- `body.workspace-entry-active .app-container`: `grid-template-columns: 1fr;`
- `.split-workspace-body`: `display: flex; gap: 20px; padding: 16px 24px; height: calc(100vh - var(--header-height) - 64px);`
- `.split-left-pane`: `flex: 0 0 44%; max-width: 580px; min-width: 420px; overflow-y: auto;`
- `.split-right-pane`: `flex: 1 1 56%; min-width: 0; display: flex; flex-direction: column; overflow: hidden;`
- `.split-table-scroll`: `flex: 1; overflow-y: auto; overflow-x: hidden;`

---

## 4. Verification Plan
- Verify unit tests: `npm test` passing.
- Visual inspection of logo, full-screen entry view, and horizontal-scrollbar-free live table.
- Production deployment via Wrangler to Cloudflare Workers.
