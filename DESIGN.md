---
name: Purchase Requisition Tracker
description: A public, friction-free Thai tracker for purchasing and store requisitions, organized as a familiar high-density work inbox.
colors:
  canvas: "#f6f8fc"
  ink: "#1f1f1f"
  blue: "#0b57d0"
  blueTint: "#e8f0fe"
  orange: "#b06000"
  green: "#188038"
  line: "#e0e3e7"
  danger: "#d93025"
typography:
  display: '"Plus Jakarta Sans", "Prompt", sans-serif'
  body: '"Prompt", "Plus Jakarta Sans", system-ui, sans-serif'
  data: '"SF Mono", Consolas, monospace'
---

# Design context

This is a Thai purchasing clerk's daily ledger. Its single job is to let anyone with the link find, add, correct, archive, and export an order without a sign-in barrier. The visual direction is **operations inbox**: a calm blue canvas, a compact Gmail-like navigation rail, and a dense working list. Blue marks primary work, orange marks upcoming delivery risk, and green confirms a healthy data connection. The signature is the live connection badge: it must never say the system is ready while a data error is on screen.

The table is the product. No promotional hero, fabricated KPIs, or decorative illustrations. Desktop users get a dense table with a sticky header; phone users see the same record as an easy-to-scan card. Forms use native controls, clear Thai labels, visible focus, explicit errors, and a native dialog. Row actions always name what happens: Edit, Archive, Restore, Save. Loading, empty, populated, and error views are mutually exclusive; CSS explicitly preserves the `hidden` state so a stale skeleton cannot overlay a real error.

The public deployment has no login by user decision. The footer and form dialog therefore state that every person holding the link can edit or archive records. Records are never deleted by the application; archived records leave the primary view and can be restored from the archive. This should be revisited before placing confidential purchasing data in the app.

## Responsive behavior

- 1024px and above: table is scrollable horizontally only when necessary; the app has 24px gutters.
- 640–1023px: compact table remains available with controlled horizontal scroll.
- Under 640px: records become cards; filters stack and every target remains at least 44px high.
- Motion is limited to 160ms feedback and disabled for reduced-motion users.
