# Shared prompt prefix

Every design reference is generated with this block prepended, so the images
describe one coherent product instead of unrelated screens. It encodes the parts
of `design-system.md` that an image model must be told explicitly.

## Base (prepended to every reference prompt)

```
Design a single desktop web application screen for "FinLeaf", a digital banking
web app for financial inclusion and low-carbon spending, aimed at first-time and
underbanked users in India who may have low literacy and are often on a budget
phone. Render it as a clean, flat, professional UI mockup screenshot.

Visual language, follow exactly:
- Warm off-white page background #f7f7f4, white cards #ffffff.
- Primary deep green #12694a for primary buttons and active navigation;
  soft green tint #e6f2ec for selected chips and rows.
- Text near-black #1a1c19, secondary text #5c615a.
- Hairline borders #e2e2dc. Card radius 12-16px. Cards have NO drop shadow.
- One muted accent blue #1f5fa8 reserved for a "trust score" concept, and one
  amber #9a5b00 reserved for warnings or pending states. Never use gradients,
  never use glassmorphism, never use purple or neon.
- System sans-serif typeface, near-black text. Numbers large, bold, and
  tabular-aligned.
- Generous whitespace, clear hierarchy, restrained colour, no clutter.
- Icons are simple flat line/solid glyphs in a circle, always paired with a
  visible text label. Never rely on colour alone to convey meaning.
- All text must be legible, realistic, and correctly spelled English UI copy.
  Include realistic Indian rupee amounts such as 12,450.

Output a straight-on full-page screenshot of the screen at 1440x900 desktop
viewport, filling the frame edge to edge. Do not add a device mockup, browser
chrome, hand holding the phone, desk scene, or any surrounding context: just the
application screen itself. Do not add explanatory captions or callout
annotations outside the UI.
```

## Suffix for mobile references

Append:

```
Render this same screen as a MOBILE view at 390x844: single column, 16px
gutters, a bottom tab bar instead of a sidebar, stacked cards, and the primary
number near the top. Just the app screen filling the frame, no device mockup.
```

## Notes learned from generation

- The model reliably follows colour hex codes and "no gradient" instructions.
- It will add a phone or laptop frame unless told twice; the base block repeats
  the instruction.
- Without an explicit list of the cards on screen, the model invents a generic
  dashboard. Each page prompt therefore enumerates the exact regions.