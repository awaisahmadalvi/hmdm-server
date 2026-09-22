# Design System — MDM Portal Redesign

Single source of truth for the internal admin UI's visual language.
Token implementation: `server/src/main/webapp/css/tokens.css`.

**Scope note:** this covers the internal admin UI only. The login page
(`login.css`) has its own separate treatment per the project brief and is
not themed from these tokens.

**Stack note:** this app is AngularJS 1.x + Bootstrap 3 + plain CSS, no
build pipeline for the frontend. "Tokens" here means CSS custom properties
(`:root { --name: value }`), not TypeScript — the equivalent mechanism for
this stack.

---

## 1. Source references

| File | Role |
|---|---|
| `design.png` | Project-wide color source of truth (a literal spec table with hex codes) |
| `design1.png` | Header **layout** reference only (structure/composition, not final colors — see §2) |
| `whi.mp4` / `bla.mp4` | Login page background video, light/dark theme respectively |

## 2. How the two references were reconciled

design.png (white canvas + slate + indigo `#6366F1`) and design1.png (dark
navy gradient bar + lime `#AACD02` accent) are visually incompatible if
applied literally to the same surface. Approved resolution (Q1):

- **design.png is the palette source of truth**, project-wide.
- **design1.png is the layout/structure source of truth for the header**,
  re-tinted to indigo/slate. Its lime accent survives only as a restrained,
  narrow-use accent (active-nav indicator, focus glow, positive/online
  status) — never a large fill, never brand-color #2.
- **Contrast testing settled where lime can actually live:** lime measures
  1.84:1 against white (fails even the loosest 3:1 UI threshold) but
  7.97–10.99:1 against the slate-800/900/950 dark tones (comfortably passes
  AA). This is not a style preference — it's a measured fact — so lime is
  restricted to dark surfaces.
- **Proposed composition (for your review, not yet built):** the sidebar/
  header chrome uses the dark gradient (`--gradient-chrome`,
  slate-800→slate-900) where lime and the design1.png layout language live;
  the main content canvas stays white/slate-100 per design.png. This is a
  common modern SaaS pattern (dark chrome + light canvas) and is the only
  composition where both references' colors are simultaneously legible.
  **This is a proposal for Step 2, not yet implemented** — flag now if you
  want a different split (e.g. light sidebar, no dark chrome at all, lime
  dropped entirely).

## 3. Color palette

All ratios below are computed via the standard WCAG relative-luminance
formula, not estimated. Script used is disposable/not part of the repo.

### 3.1 Brand

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--color-accent` | `#6366F1` | `#6366F1` | Literal design.png value. 4.47:1 with white text — **passes** large-text/UI (≥3:1), **fails by a hair** for small-text AA (needs ≥4.5:1). Used for icons, borders, focus rings, chart lines — contexts that only need the 3:1 threshold. |
| `--color-accent-strong` | `#4F46E5` (indigo-600) | `#6366F1` (indigo-500) | The AA-safe fill for **text-bearing** surfaces (solid buttons, filled badges). Light theme needs the darker 600-weight (6.29:1) to clear 4.5:1; dark theme actually needs the *lighter* 500-weight, because 600-weight's boundary contrast against the dark canvas drops to 2.84:1 (fails 3:1) while 500-weight holds 4.00:1. This asymmetry is a measured result, not a stylistic choice. |
| `--color-accent-strong-hover` | `#4338CA` (indigo-700) | `#818CF8` (indigo-400) | Light hover darkens (light-UI convention); dark hover lightens (dark-UI convention). |
| `--color-accent-lime` | `#AACD02` | `#AACD02` | From design1.png. **Dark surfaces only** — see §2. Restrained use: active-nav indicator, focus glow, "online" status. |

### 3.2 Neutral surfaces

| Token | Light | Dark |
|---|---|---|
| `--color-canvas` | `#FFFFFF` | `#0F172A` (slate-900) |
| `--color-surface` | `#FFFFFF` | `#1E293B` (slate-800) |
| `--color-surface-muted` | `#F1F5F9` (slate-100, literal design.png "Cool Gray") | `#0F172A` |
| chrome (sidebar/header) | `#1E293B → #0F172A` gradient | `#0F172A → #020617` gradient |

### 3.3 Text

| Token | Light hex | Contrast (on canvas) | Dark hex | Contrast (on canvas) |
|---|---|---|---|---|
| `--color-text-primary` | `#1E293B` (literal design.png) | 14.63:1 | `#F1F5F9` | 16.30:1 |
| `--color-text-secondary` | `#475569` | 7.58:1 | `#CBD5E1` | 12.02:1 |
| `--color-text-tertiary` | `#64748B` (literal design.png "Secondary Accent", dual-purposed as muted text — same swatch, matches its own stated purpose "muted tabs, secondary icons") | 4.76:1 (passes AA) | `#94A3B8` | 6.96:1 |
| `--color-text-disabled` | `#94A3B8` | 2.56:1 — **fails AA**, intentionally: WCAG exempts disabled/inactive controls from contrast requirements. Never use for body text, only truly-disabled UI. | `#64748B` | — |

design.png only specified one text level (`#1E293B`); the other three are
derived from the same slate family the spec itself is built from (design.png's
"Secondary Accent" `#64748B` *is* Tailwind slate-500, so tier 3 reuses it
rather than inventing an unrelated value).

### 3.4 Semantic

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--color-success` | `#16A34A` | `#4ADE80` | Light value is 3.30:1 on white — fine for icons/badges/borders (3:1 tier), **not** for small text. Use `--color-success-text` (`#15803D`, clears 4.5) if rendering success-colored text. |
| `--color-warning` | `#D97706` | `#FBBF24` | Same caveat as success; text-safe variant `--color-warning-text` (`#B45309`). |
| `--color-danger` | `#DC2626` | `#F87171` | 4.83:1 on white — safe for text directly, no separate text variant needed. |
| `--color-info` | `#4F46E5` | `#818CF8` | Reuses the accent-strong family rather than adding a 4th hue family — design.png didn't specify one and the brand color already reads as "informational" in most SaaS conventions. |

**HCI guardrail, not a token:** status must never be color-only. Every
status indicator (device online/offline, install success/fail, etc.) needs
a second signal — icon shape, text label, or position — alongside color, for
the ~8% of users with red-green color blindness. This applies when
restyling status dots/badges in later steps; flagging it now so it isn't
forgotten.

### 3.5 Gradients

| Token | Value | Use |
|---|---|---|
| `--gradient-chrome` | `linear-gradient(180deg, #1E293B, #0F172A)` | Sidebar/header background. Adapted from design1.png's horizontal gray→navy sweep — rotated to vertical because a *sidebar* reads depth top-to-bottom, not left-to-right. This is a deliberate adaptation, not a pixel-port; flag if you want the horizontal orientation preserved instead. |
| `--gradient-primary` | `linear-gradient(135deg, #6366F1, #4F46E5)` | CTA buttons, active-state fills — brand indigo to AA-safe-strong indigo. |
| `--gradient-surface` | `linear-gradient(180deg, #FFFFFF, #F8FAFC)` (light) / `#1E293B → #17212F` (dark) | Very subtle depth on large raised surfaces (cards), not a visible "gradient effect." |
| `--gradient-glow-accent` / `--gradient-glow-lime` | radial, low-opacity | Focus rings / online-status pulse glow. |

## 4. Typography

**Chosen: Inter**, single typeface (no separate display/heading font). For a
data-dense admin console the brief's own visual direction ("clean and quiet")
favors one neutral, highly-legible-at-small-sizes typeface over a decorative
heading pairing — Inter is the de facto standard for exactly this (Linear,
Vercel, GitHub, Stripe dashboard all use it or its close relatives).

Font files are **not yet vendored** — that happens in Step 2 when the
`@font-face`/`<link>` actually gets wired into `index.html`, so it can be
verified in the browser immediately rather than declared inertly now.
Fallback stack in the meantime: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.

| Token | Size / line-height | Typical use |
|---|---|---|
| `--font-size-xs` | 12 / 16 | Table meta, badges |
| `--font-size-sm` | 13 / 18 | Secondary labels |
| `--font-size-base` | 14 / 20 | Body default (matches the app's current global 14px — preserves density users are used to) |
| `--font-size-md` | 15 / 22 | Emphasized body |
| `--font-size-lg` | 17 / 24 | Card/section titles |
| `--font-size-xl` | 20 / 28 | Page titles |
| `--font-size-2xl` | 24 / 32 | Dashboard KPI numbers |
| `--font-size-3xl` | 30 / 38 | Rare, large hero numbers |

Weights: 400 / 500 / 600 / 700.

## 5. Spacing, radius, elevation, motion

- **Spacing:** 4px base scale, `--space-1` (4px) through `--space-16` (64px).
- **Radius:** `--radius-sm` 6px, `-md` 8px, `-lg` 12px, `-xl` 16px, `-full` 999px (pills/avatars).
- **Elevation:** layered shadows (a tight contact shadow + a soft ambient one)
  rather than one flat blur — reads as more refined, and pairs with a 1px
  border on cards for crisp definition at low elevation. Dark-theme shadows
  use higher-opacity black rather than the same rgba values, since low-opacity
  shadows don't register against dark backgrounds.
- **Motion:** durations 120/180/250ms, standard/`ease-out`/`ease-in` cubic-
  béziers — matches the brief's "150–250ms transitions."

## 6. Dark mode activation

`prefers-color-scheme: dark` only, today. No visible toggle — building one is
explicitly deferred to a separate, later-approved task (per Q4 ruling), to
avoid smuggling new functionality into a "visual-only" redesign. A
`[data-theme="dark"]`/`[data-theme="light"]` attribute-selector hook already
exists in `tokens.css` so that whenever the toggle *is* approved, it's a pure
JS attribute-set with zero CSS changes — this is forward-compatibility, not
scope creep; nothing sets that attribute today.

## 7. Open questions carried forward to Step 2

1. Confirm or redirect the "dark chrome + light canvas" composition proposed in §2.
2. Confirm the chrome gradient's vertical re-orientation (§3.5), or request the horizontal orientation instead.
3. Sidebar width, collapsed-state width, and breakpoint for the mobile drawer.
