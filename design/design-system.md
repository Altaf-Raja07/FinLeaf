# FinLeaf design system

Visual language for a banking product whose users are first-time or underbanked
customers, often on low-end mobile browsers, sometimes with low literacy and low
digital confidence. Every rule below exists to serve that audience. Nothing is
included for decoration alone.

## 1. Design principles

1. **Legible before clever.** Large type, high contrast, generous touch targets.
   A user who cannot read the label will not use the feature, no matter how
   elegant it looks.
2. **One idea per screen.** Each page answers one question. Anything secondary
   moves down or to a secondary surface.
3. **The number is the hero.** Balance, trust score, and footprint are the
   things users came for. They get the largest type and the strongest contrast.
4. **Icons reinforce text, never replace it.** Every iconised control keeps a
   visible label; icons carry meaning only as a second channel. This is also an
   accessibility requirement, not just a literacy one.
5. **Say what is an estimate.** Carbon figures, trust scores, and loan offers
   are modelled estimates. The UI labels them as such wherever they appear.
6. **Warm, not corporate.** FinLeaf is about everyday money, not institutional
   finance. Restrained green and a warm neutral base instead of bank blue.
7. **Nothing decorative earns its place.** No gradients-as-ornament, no glass
   effects, no gradients behind text. Depth comes from one soft shadow and a
   hairline border.

## 2. Colour

Base is a warm off-white; primary is a deep, high-contrast green that reads as
"growth / go" without the coldness of corporate blue. Accent amber is reserved
for warnings and pending states, and is never the only signal.

| Token | Value | Use |
| --- | --- | --- |
| `--fl-bg` | `#f7f7f4` | app background, warm neutral |
| `--fl-surface` | `#ffffff` | cards, sheets, menus |
| `--fl-surface-sunken` | `#f0f0ec` | wells, table headers, skeletons |
| `--fl-border` | `#e2e2dc` | hairline dividers and card borders |
| `--fl-border-strong` | `#c9c9c0` | input borders, stronger separation |
| `--fl-text` | `#1a1c19` | primary text, 15.9:1 on `--fl-bg` |
| `--fl-text-muted` | `#5c615a` | secondary text, 6.2:1 on `--fl-bg` |
| `--fl-primary` | `#12694a` | primary actions, active nav |
| `--fl-primary-hover` | `#0d5238` | hover / pressed |
| `--fl-primary-soft` | `#e6f2ec` | tinted chips, selected rows |
| `--fl-leaf` | `#3f9e6b` | sustainability accents, positive deltas |
| `--fl-leaf-soft` | `#e8f4ec` | sustainability tinted surfaces |
| `--fl-amber` | `#9a5b00` | warnings, pending loans |
| `--fl-amber-soft` | `#fdf1de` | warning tinted surfaces |
| `--fl-danger` | `#a32020` | errors, flagged anomalies |
| `--fl-danger-soft` | `#fbeaea` | error tinted surfaces |
| `--fl-trust` | `#1f5fa8` | trust-score accents, distinct from green |
| `--fl-trust-soft` | `#e8eff9` | trust tinted surfaces |

Primary, leaf, trust, amber, and danger are deliberately distinct hues so a
colour-blind user can still tell a trust score from a sustainability score;
every coloured element also carries a label or icon.

Charts use these five hues plus two neutral greys for comparison series, chosen
to stay distinguishable under deuteranopia.

## 3. Typography

System font stack, so low-end devices render text immediately with no webfont
download:

```
--fl-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
           "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--fl-font-num: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
```

Numeric values use the mono stack with `font-variant-numeric: tabular-nums`, so
balance columns and table amounts align and do not jitter when they update.

| Role | Size / line-height | Weight | Notes |
| --- | --- | --- | --- |
| Hero figure (balance) | 40 / 44 | 650 | mono, tabular; 28px on mobile |
| Page title | 26 / 32 | 650 | 22px on mobile |
| Section heading | 17 / 24 | 600 | |
| Body | 15.5 / 23 | 400 | |
| Label, caption | 13 / 18 | 500 | muted colour |
| Micro / axis | 11.5 / 16 | 500 | tabular, uppercase tracking for axes |

Body size starts at 15.5px rather than 14px deliberately: the target user is
often reading a phone at arm's length in bright daylight.

## 4. Spacing, radii, elevation

4px base scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

Radii: `--fl-r-sm: 8px` (chips, inputs), `--fl-r-md: 12px` (buttons, cards),
`--fl-r-lg: 16px` (panels, sheets), `--fl-r-full: 999px` (pills, avatars).

Exactly one shadow is used, for genuinely floating surfaces (dialog, sticky bar):
`--fl-shadow: 0 1px 2px rgba(16,24,16,.06), 0 8px 24px rgba(16,24,16,.08)`.
Everything else is separated by a 1px `--fl-border`.

## 5. Breakpoints and layout

| Name | Width | Behaviour |
| --- | --- | --- |
| mobile | < 640px | single column, bottom tab bar, 16px gutters |
| tablet | 640–1023px | single column, wider gutters, 2-up stat grids |
| desktop | ≥ 1024px | persistent sidebar 248px + content |
| wide | ≥ 1440px | content capped at 1200px, centred |

Touch targets are at least 44x44px on mobile. Content is capped at 1200px so
lines never get long enough to hurt readability on a desktop.

## 6. Components

- **Buttons** — primary (solid green), secondary (white with border), ghost, and
  danger. Height 44px mobile / 40px desktop. Disabled states use 45% opacity
  plus `cursor: not-allowed` and are never the only feedback.
- **Inputs** — 44px minimum height, label always above the field (never
  placeholder-only), error text linked with `aria-describedby` and a red border.
- **Cards** — white surface, 1px border, 16px radius, no shadow.
- **Metric cards** — label, hero value, and a delta line. The delta pairs a sign
  with a word, never colour alone.
- **Transaction rows** — icon tile, merchant, category + time, right-aligned
  amount. Tappable across the full row on mobile.
- **Charts** — 2px lines, rounded caps, gridlines at `--fl-border`, axis labels in
  micro type, and a text summary adjacent for screen readers.
- **Score gauges** — a 0-100 arc with the number in the centre plus a plain
  language band ("Getting started" / "Steady" / "Strong").
- **Empty / loading / error states** — every list has all three. Loading uses
  skeleton blocks matching the real layout, so nothing jumps on arrival.

## 7. Imagery

Photography is not used for decoration. Two asset types only:

1. **Product illustrations** — calm, flat, single-accent scenes of everyday
   banking (a shopkeeper counting cash, a bus stop, a kitchen), used only on the
   landing page and empty states.
2. **Category glyphs** — a small consistent set of flat icons for spending
   categories (fuel, travel, groceries, bills, dining, electronics, transfer).

Both are referenced as local files from `public/assets/`. Generated imagery is
saved to disk and committed; nothing hotlinks a third-party CDN.

## 8. Motion

150-220ms, ease-out, for state changes only (hover, disclosure, toast). Honours
`prefers-reduced-motion`, which collapses all transitions to near-instant.
There are no entrance animations on page load and no looping decorative motion.

## 9. Accessibility baseline

Semantic landmarks on every page; one `h1` per page; visible 2px focus rings
using `--fl-primary` with an offset; `prefers-reduced-motion` respected; charts
carry `role="img"` plus a text summary; icon-only buttons carry `aria-label`;
status is never conveyed by colour alone; all interactive targets are reachable
and operable by keyboard.

## 10. Copy

Short sentences. Say the amount first. "Estimated" appears before any modelled
figure. Errors say what happened and what to do next, without blame: "We could
not reach the server. Check your connection and try again."