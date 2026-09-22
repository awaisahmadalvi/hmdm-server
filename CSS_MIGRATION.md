# CSS Migration Tracker

Tracks the progressive retirement of `server/src/main/webapp/css/main.css`
as each screen is rebuilt on the new token system, per the approved rule:

> `main.css` is FROZEN — delete from it, never add to it. As each screen is
> rebuilt, strip that screen's rules out of main.css. Do not touch rules for
> screens not yet redesigned, even if they look dead.

Update this file every step, immediately after removing rules.

## Baseline (start of redesign, before Step 2)

| File | Lines | Size | Selectors (approx, `^\.` count) |
|---|---|---|---|
| `main.css` | 2761 | 41,126 bytes | 606 |
| `dashboard.css` | 861 | 16,474 bytes | (built this session, pre-redesign — will itself be superseded screen-by-screen) |
| `login.css` | — | 2,684 bytes | Out of scope — login gets its own new treatment in Step 3, separate from this tracker |
| `alert.css` | — | 3,683 bytes | Not yet addressed — global toast/alert styling is a later "Global" step |
| `tokens.css` | 232 | new | Step 1 — token definitions only, no component rules |

## Status by screen

Legend: ⬜ not started · 🟨 in progress · ✅ retired from main.css

| Screen / state | Status | main.css selectors removed this step | Notes |
|---|---|---|---|
| Design tokens (foundation) | ✅ | 0 (tokens.css is new, additive) | Step 1 |
| App shell (header/sidebar) | ⬜ | — | Step 2 |
| Login (`login`) | ⬜ | — | Step 3. Has its own login.css already; not tracked against main.css the same way |
| Device list (`main`) | ⬜ | — | |
| Dashboard (`summary`) | ⬜ | — | |
| Applications (`applications`) | ⬜ | — | |
| App version editor (`appVersionsEditor`) | ⬜ | — | |
| Configurations list (`configurations`) | ⬜ | — | |
| Configuration editor (`configEditor`) | ⬜ | — | |
| Files (`files`) | ⬜ | — | |
| Settings: common (`commonSettings`) | ⬜ | — | |
| Settings: design (`designSettings`) | ⬜ | — | |
| Settings: language (`langSettings`) | ⬜ | — | |
| Users (`users`) | ⬜ | — | |
| Roles (`roles`) | ⬜ | — | |
| Groups (`groups`) | ⬜ | — | |
| Icons (`icons`) | ⬜ | — | |
| Hints (`hints`) | ⬜ | — | |
| Plugin settings shell (`pluginSettings`) | ⬜ | — | |
| Profile (`profile`) | ⬜ | — | |
| Updates (`updates`) | ⬜ | — | |
| Control panel (`control-panel`) | ⬜ | — | |
| Password reset / recovery | ⬜ | — | |
| Two-factor auth | ⬜ | — | |
| Signup / signup complete | ⬜ | — | |
| QR page | ⬜ | — | |
| Plugin: Audit | ⬜ | — | |
| Plugin: Device Info (+ dynamic, + settings) | ⬜ | — | |
| Plugin: Device Log (+ settings) | ⬜ | — | |
| Plugin: Messaging (+ settings) | ⬜ | — | |
| Plugin: Push (+ settings) | ⬜ | — | |
| Plugin: Xtra | ⬜ | — | |
| Global: modals/confirms/toasts/skeletons/404 | ⬜ | — | Last — depends on all screens being done |

## Running totals

| After step | main.css lines | main.css bytes | Delta |
|---|---|---|---|
| Baseline | 2761 | 41,126 | — |
