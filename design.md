# FinLeaf Design System Specification (`design.md`)

> **Single Source of Truth** for FinLeaf’s visual identity, component architecture, and design tokens.
> Aligned with [getdesign.md](https://getdesign.md/) NerdWallet financial clarity standards, `taste-skill v2` anti-slop guidelines, and Vercel Web Interface Guidelines.

---

## A. Brand and Design Principles

### 1. Core Mission
FinLeaf is a web-based digital banking platform built for **financial inclusion and carbon-conscious banking**. It brings basic accounts, transfers, micro-savings, peer vouching, and small loans to unbanked and underbanked populations, while making the environmental footprint of daily spending visible.

### 2. Brand Personality
- **Dignified & Inclusive:** Designed for first-time and low-literacy users on affordable mobile screens; simple language, large touch targets, zero patronizing clutter.
- **Trustworthy & Mathematical:** Every balance movement is tracked by an immutable double-entry ledger. No artificial numbers; every figure is either a verified ledger fact or an explicitly labeled scientific estimate.
- **Ecologically Conscious:** Deep spruce and forest greens combined with refreshing mint washes reflect environmental responsibility without resorting to generic greenwashing.
- **Honest & Transparent:** Follows Reserve Bank of India (RBI) Digital Lending Directions (2025) for explainable alternative credit scoring.

### 3. Visual Consistency Rules
- **Intentional Contrast:** Every text/background combination clears WCAG AA (minimum 4.5:1 for body copy, 3:1 for large display elements).
- **No Decoration for Decoration's Sake:** No random gradient blobs, no floating icons without purpose, no fake AI-generated dashboards.
- **Substantive Editorial Content:** Every section makes a concrete claim supported by data, citations, or real interactive models.

---

## B. Color Palette

FinLeaf employs an OKLCH perceptual ramp backed by clean HEX definitions derived from the NerdWallet financial clarity design system.

### 1. Brand & Accent Palette
| Token | HEX / Value | Role & Usage | Contrast Bar |
|---|---|---|---|
| `--color-spruce` | `#008254` | Primary brand action color, key buttons, verified badges | 4.8:1 on white |
| `--color-spruce-deep` | `#006642` | Hover states for primary buttons, active section titles | 6.5:1 on white |
| `--color-forest` | `#00482f` | Darkest brand green, stat headers, emphasized callouts | 9.8:1 on white |
| `--color-mint-50` | `#effcf8` | Primary section panel background wash, pill backgrounds | Surface wash |
| `--color-mint-100` | `#e3faf2` | Hover background for icon tiles and interactive rows | Surface wash |
| `--color-mint-200` | `#b7ecda` | Subtle hairline borders on green feature containers | Structure border |
| `--color-lime-accent` | `#ddfa88` | High-energy badge accent for carbon points & rewards | Accent highlight |
| `--color-lime-panel` | `#e8fdac` | Tag background for interactive demo badges | Accent wash |

### 2. Trust & Marketing Chrome (Midnight Ramp)
| Token | OKLCH / Value | Role & Usage |
|---|---|---|
| `--color-midnight-950` | `oklch(0.19 0.06 259)` | Deep nocturnal green for landing page footer & banner |
| `--color-midnight-900` | `oklch(0.29 0.09 258)` | Account showcase card background gradient anchor |
| `--color-on-midnight` | `oklch(0.97 0.006 240)` | High-contrast white copy on dark midnight surfaces |
| `--color-on-midnight-soft` | `oklch(0.82 0.02 245)` | Secondary copy on dark midnight surfaces |

### 3. Functional Status & Feedback
| Token | Value | Role |
|---|---|---|
| `--color-risk-low` / `good` | `oklch(0.678 0.178 153.1)` | Success notifications, positive carbon delta, on-time payments |
| `--color-risk-mid` / `warn` | `oklch(0.72 0.15 78)` | Anomaly confirmation warning, pending loan due dates |
| `--color-risk-high` / `bad` | `oklch(0.58 0.19 25.4)` | Overdue notices, transaction errors, validation failures |
| `--color-risk-crit` | `oklch(0.48 0.19 22.6)` | Security alerts, critical account lockouts |

### 4. Surfaces & Hairlines
| Token | HEX / Value | Role |
|---|---|---|
| `--color-surface` | `oklch(0.988 0.003 200)` | Standard page background (light off-white) |
| `--color-surface-raised` | `#FFFFFF` | Card surfaces, dialog backgrounds, input fills |
| `--color-surface-sunken` | `oklch(0.972 0.005 205)` | Table header backgrounds, inactive segmented tabs |
| `--color-hairline` | `#ebebec` | Standard dividing rules between cards and table cells |
| `--color-hairline-strong`| `#d8d9da` | Distinct form input borders and active card outlines |

---

## C. Typography

### 1. Type Families
- **Primary Display & Interface:** `Plus Jakarta Sans`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`
  - High legibility at low resolutions, geometric warmth, distinctive numerals.
- **Monospace & Accounting:** `Geist Mono`, `ui-monospace`, `monospace`
  - Used strictly for figures that must not re-space under animation: account numbers, ledger references, transaction IDs, IFSC codes.

### 2. Typographic Scale & Weights
| Level | Font Size | Line Height | Weight | Letter Spacing | Element / Role |
|---|---|---|---|---|---|
| **Display XL** | 50px (3.125rem) | 52px (1.04) | 800 (Extrabold) | -0.01em | Landing page hero H1 |
| **Heading 1** | 36px (2.25rem) | 42px (1.17) | 800 (Extrabold) | -0.01em | Page primary titles |
| **Heading 2** | 28px (1.75rem) | 34px (1.21) | 700 (Bold) | -0.01em | Major section headers |
| **Heading 3** | 20px (1.25rem) | 26px (1.30) | 700 (Bold) | 0 | Card titles, feature headlines |
| **Heading 4** | 16px (1.00rem) | 22px (1.37) | 600 (Semibold) | 0 | Subsection headers, table headers |
| **Body Large** | 17px (1.0625rem)| 26px (1.53) | 400 (Regular) | 0 | Intro paragraphs, lead subtitles |
| **Body Standard**| 15px (0.9375rem)| 22px (1.47) | 400 (Regular) | 0 | Card body text, table content |
| **UI Label** | 14px (0.875rem) | 20px (1.43) | 600 (Semibold) | -0.005em | Buttons, form labels, tabs |
| **Caption / Help**| 13px (0.8125rem)| 18px (1.38) | 500 (Medium) | 0 | Help text, timestamps |
| **Eyebrow / Micro**| 12px (0.75rem) | 16px (1.33) | 700 (Bold) | +0.017em | Uppercase badges, category kickers |

---

## D. Spacing and Layout

### 1. Spacing Scale (8pt Grid System)
```css
--space-1:  4px;   /* Micro spacing, icon gaps */
--space-2:  8px;   /* Tight button padding, tag gaps */
--space-3:  12px;  /* Small card padding, input internal gap */
--space-4:  16px;  /* Standard grid gap, input padding */
--space-6:  24px;  /* Standard card interior padding */
--space-8:  32px;  /* Section subsections, modal padding */
--space-12: 48px;  /* Landing page feature gaps */
--space-16: 64px;  /* Desktop major section spacing */
```

### 2. Layout Containers
- **Marketing Maximum Container:** `max-w-[1344px]` (centered with `mx-auto`)
- **Dashboard Maximum Container:** `max-w-6xl` (1152px, centered with `mx-auto`)
- **Reading / Form Container:** `max-w-3xl` or `max-w-md` (centered)
- **Responsive Gutters:**
  - Mobile (`<640px`): `px-4` (16px)
  - Tablet (`640px–1024px`): `px-6` (24px)
  - Desktop (`>1024px`): `px-8` or `desk:px-0` (in container)

### 3. Breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `desk`: 1400px (custom desktop canvas breakpoint)
- `2xl`: 1536px

---

## E. Components

### 1. Buttons (`.btn`)
- **Height:** 40px standard (`min-h-10`), 46px large (`btn-lg`), 32px compact (`btn-sm`).
- **Radius:** `rounded-[10px]` (`--radius-control`).
- **Variants:**
  - `btn-primary`: Background `#008254`, text `#FFFFFF`, hover `#006642`.
  - `btn-secondary`: Background `#FFFFFF`, text `#091B27`, border `#d8d9da`, hover `#effcf8`.
  - `btn-ghost`: Background transparent, text `#008254`, hover `#effcf8`.
  - `btn-danger`: Background `#de2828`, text `#FFFFFF`, hover `#a7000d`.
- **Transitions:** Explicit `transition-[background-color,border-color,color,box-shadow] duration-140`. Never `transition: all`.

### 2. Cards (`.card`)
- **Surface:** `#FFFFFF` (dark mode `oklch(0.212 0.01 235)`).
- **Border:** 1px solid `#ebebec` (`--color-rule`).
- **Corner Radius:** `14px` (`--radius-card`) or `24px` (`rounded-3xl` for hero features).
- **Shadow:** Restrained `--shadow-card` (0 1px 2px 0 rgba(0,0,0,0.04)).

### 3. Form Inputs (`.input`)
- **Height:** 42px minimum height for comfortable touch.
- **Border:** 1px solid `#d8d9da` (`--color-rule-strong`), transitions to `#008254` on focus.
- **Focus Ring:** 3px ring (`box-shadow: 0 0 0 3px color-mix(in oklab, #008254 60%, transparent)`).
- **Accessibility:** Explicit `<label htmlFor="...">`, `autoComplete`, and `aria-live="polite"` on inline error feedback.

### 4. Interactive Live Estimator (`<ImpactEstimator />`)
- **Thumb-friendly Range Input:** Custom styled green track with `#008254` accent.
- **Accessible Role Switch:** Smooth toggle for on-time payment consistency.
- **Real-time Live Calculation:** Instant projection of trust score, loan limit, and carbon footprint.

---

## F. Responsive Design Matrix

| Viewport | Device Range | Navigation Pattern | Hero Layout | Card Grid Columns |
|---|---|---|---|---|
| **Mobile** | `320px–639px` | Compact bar with logo & Login/Start buttons | Vertically stacked; headline → CTAs → 3D card | 1 column |
| **Tablet** | `640px–1023px` | Horizontal flex with icons | 2-column stacked; headline + 3D card visual | 2 columns |
| **Laptop** | `1024px–1399px`| Full nav with active indicator | 12-column grid (7-col text / 5-col 3D card visual) | 2 or 4 columns |
| **Desktop**| `1400px+` | Fixed-canvas art direction | Exact mockup geometry with 21px safe margin | 4 columns (`326px` / `338px`) |

---

## G. Implementation Reference

- **CSS Variables & Tokens:** `apps/web/src/app/globals.css`
- **Shared Primitives:** `apps/web/src/components/ui.tsx`
- **Interactive Landing Components:** `apps/web/src/components/landing/ImpactEstimator.tsx`
- **Public Marketing Route:** `apps/web/src/app/page.tsx`
- **Dashboard Shell:** `apps/web/src/app/dashboard/layout.tsx` & `NavBar.tsx`
- **Authentication Shell:** `apps/web/src/app/sign-in/page.tsx` & `AuthCard.tsx`
- **Imagery Assets:** `apps/web/public/landing/`
  - `hero-eco-card.webp`: 3D FinLeaf translucent emerald glass card with live floating metrics.
  - `sustainable-community.webp`: Rural Karnataka woman farmer with active smartphone banking app.
  - `trust-circles.webp`: Village self-help group and banking correspondent reviewing accounts under sunlight.

---

## H. Rules for Future Development

1. **Always reuse existing design tokens.** Never hardcode random hex values when `--color-spruce`, `--color-mint-50`, or `--color-hairline` exist.
2. **Never introduce `transition: all`.** Always specify the transition properties explicitly (`transition-[background-color,color]`, etc.).
3. **Keep `min-h-dvh` instead of `min-h-screen`.** Avoid viewport jump when mobile browsers hide or reveal the URL bar.
4. **Maintain WCAG AA compliance.** Check any new text color against its background surface before deploying.
5. **Preserve localization parity.** Any new user-facing copy added to `lib/locales/en.ts` must have corresponding entries in `hi.ts` and `kn.ts`.
6. **Keep `design.md` synchronized.** Whenever a token, component variant, or layout pattern is altered, update this document immediately.
