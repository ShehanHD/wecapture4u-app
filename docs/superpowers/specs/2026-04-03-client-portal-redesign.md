# Client Portal Redesign — Design Spec
**Date:** 2026-04-03  
**Status:** Approved

---

## Overview

A complete redesign of the weCapture4U client portal. The visual language is derived from the **public portfolio site** (light mode), not the admin panel. The portal must feel clean, minimal, and easy on the eyes.

---

## Design Tokens

All values sourced from the public site's CSS variables (`--pub-*`):

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#f8f9ff` | All portal pages |
| Card surface | `#ffffff` | Cards, sidebar, dialogs |
| Border | `#e0e8ff` | All borders |
| Accent | `#4d79ff` | Buttons, active states, links |
| Accent light | `#7aa5ff` | Secondary accent, hover |
| Text primary | `#0a0e2e` | Headings, labels |
| Text muted | `#778899` | Subtext, placeholders |
| Navy gradient | `linear-gradient(135deg, #0a0e2e, #1a3468)` | Upcoming session banner |
| Danger | `#e05252` | Logout, delete, errors |
| Input fill | `#f8f9ff` | Form inputs |
| Input border | `1.5px solid #e0e8ff` | Form inputs |
| Card shadow | `0 4px 16px rgba(77,121,255,0.06)` | Floating cards |
| Border radius | `10–14px` | Cards; `8–9px` inputs/buttons |

---

## Shell Layout

### Desktop (≥ 768px) — Sidebar

**Expanded (200px):**
- Logo strip at very top (logo mark + "weCapture4U" wordmark)
- User card below logo: avatar (initials, gradient ring) → full name → "Edit profile →" link
- Nav items: icon + label, active item gets `#f0f4ff` background + `#4d79ff` text
- Log out at the bottom (red tint)
- Collapse toggle button at the very bottom

**Collapsed (56px):**
- Logo mark only at top
- Avatar with pencil dot (clicking navigates to Profile page)
- Icon-only nav items
- Log out icon at bottom

**Nav items (desktop):**
| Item | Icon | Notes |
|------|------|-------|
| Home | `LayoutDashboard` | Active by default |
| Booking | `CalendarPlus` | |
| Notifications | `Bell` | Red dot when unread |
| Log out | `LogOut` | Red, separator above |

### Mobile (< 768px) — Top bar + Bottom tabs

**Top bar:**
- Logo mark + wordmark (left)
- Avatar / initials (right) — tapping navigates to Profile page

**Bottom tab bar (4 items):**
| Tab | Icon | Notes |
|-----|------|-------|
| Home | `LayoutDashboard` | |
| Booking | `CalendarPlus` | |
| Alerts | `Bell` | Red dot when unread |
| Log out | `LogOut` | Red tint |

Page background is `#f8f9ff`. Content has `padding-bottom: 70px` to clear the tab bar.

---

## Auth Pages

### Login (`/client/login`)

- Full-page `#f8f9ff` background
- Logo mark + wordmark centered above card
- Floating white card (`border-radius: 14px`, card shadow)
- Fields: Email, Password (with placeholder text)
- "Forgot password?" link (right-aligned, below password)
- Blue "Sign In" button (full width)
- "Don't have an account? Register" link below button
- "← Back to website" link below card

### Register (`/client/register`)

- Same card layout as login
- Fields: Full Name, Email, Phone, Password
- Blue "Create Account" button
- "Already have an account? Sign in" link
- After submit: switches to email-sent confirmation state inline (no page redirect)

---

## Pages

### Home (`/client`)

Combines Dashboard + Jobs into one page.

**Sections (in order):**
1. **Welcome heading** — "Welcome back, {name} 👋" + subtitle
2. **Upcoming session banner** (only if exists) — navy gradient card with pill label, session title, date/time, "View Details →" button
3. **"Your Sessions" section** — job cards list, sorted newest first

**Job card:**
- White card, `border: 1px solid #e0e8ff`, `border-radius: 12px`
- Left: session title (bold), date (muted)
- Right: coloured stage badge + "View Photos ↗" link (if delivery URL) + chevron
- Hover: subtle shadow + border darkens to `#c8d8ff`
- Tapping/clicking navigates to Job Detail page

**Empty state:** Dashed border card, prompt to book a session, CTA button.

### Job Detail (`/client/jobs/:id`)

- Back arrow + page title
- Session title (large heading)
- Date, session types
- Stage progress tracker (horizontal steps, active = blue, completed = muted, upcoming = gray)
- "View Your Photos" button (blue, full width) — only if delivery URL exists

### Booking (`/client/book`)

- Page title + subtitle
- Multi-slot form: session type dropdown, date picker, time-of-day select (morning / afternoon / evening / all_day)
- "Add another slot" link
- Optional message textarea
- Blue "Send Booking Request" button
- Below: "Past Requests" list — cards with status badge (pending/confirmed/rejected) + admin note if present

### Profile (`/client/profile`)

**Layout:**
- Avatar (large, initials, gradient ring, pencil edit button overlaid bottom-right)
- Name (bold, centered)
- Email (muted, centered)

**Rows (tappable on mobile, inline Edit/Change on desktop):**

*Personal Info section:*
- Full Name → tapping opens **Edit Name dialog**
- Phone → tapping opens **Edit Phone dialog**
- Email → read-only, "read-only" label

*Security section:*
- Password → tapping opens **Change Password dialog**

*Danger zone:*
- "Delete Account" button (outlined, red)

**Mobile dialogs (bottom sheets):**
- Edit Name: single input + Save / Cancel
- Edit Phone: single input + Save / Cancel
- Change Password: Current Password + New Password + Confirm New Password + Update Password / Cancel

**Desktop:** Same row layout but "Edit" / "Change" inline action links on the right of each row. Clicking opens a dialog/modal overlay (not a bottom sheet).

### Notifications (`/client/notifications`)

- List of notifications sorted newest first
- Each notification: icon, message, timestamp
- Unread items have a subtle blue-tinted background
- "Mark all as read" button at top right
- Empty state if no notifications

---

## Routing Changes

| Path | Component | Notes |
|------|-----------|-------|
| `/client/login` | `ClientLogin` | Redesigned |
| `/client/register` | `ClientRegister` | Redesigned |
| `/client` | `ClientHome` | Renamed from Dashboard, merges jobs |
| `/client/jobs/:id` | `ClientJobDetail` | Redesigned |
| `/client/book` | `ClientBooking` | Renamed from BookSession |
| `/client/profile` | `ClientProfile` | Redesigned, dedicated page |
| `/client/notifications` | `ClientNotifications` | New page |

---

## ClientShell Changes

- Replace current `ClientShell` with new implementation
- Desktop: collapsible sidebar (expanded/collapsed state in `localStorage`)
- Mobile: top bar + bottom tab bar
- Remove old Profile tab from nav
- Avatar click → navigate to `/client/profile`
- Notification bell shows unread dot (from existing notifications API)

---

## Component Conventions

- All new components use the public site's CSS variables (`--pub-*`) defined in `index.css`
- No shadcn theme tokens for the portal — use inline Tailwind with the pub palette
- Inputs: `bg-[#f8f9ff] border-[1.5px] border-[#e0e8ff] rounded-[9px]`
- Buttons: `bg-[#4d79ff] text-white font-bold rounded-[9px]`
- Cards: `bg-white border border-[#e0e8ff] rounded-[12px]`
- Active nav: `bg-[#f0f4ff] text-[#4d79ff]`
- Danger: `text-[#e05252]` / `border-[#fde0e0]`

---

## Files to Create / Modify

**New files:**
- `frontend/src/components/layout/ClientShell.tsx` (replace existing)
- `frontend/src/pages/client/Home.tsx` (replaces Dashboard.tsx)
- `frontend/src/pages/client/Booking.tsx` (replaces BookSession.tsx)
- `frontend/src/pages/client/Profile.tsx` (replace existing)
- `frontend/src/pages/client/Notifications.tsx` (new)
- `frontend/src/pages/auth/ClientLogin.tsx` (replace existing)
- `frontend/src/pages/auth/ClientRegister.tsx` (replace existing)

**Modified files:**
- `frontend/src/routes/index.tsx` — update route paths
- `frontend/src/pages/client/JobDetail.tsx` — restyle only

**Kept as-is:**
- All API/hook/schema files — no data layer changes
- Backend — no changes
