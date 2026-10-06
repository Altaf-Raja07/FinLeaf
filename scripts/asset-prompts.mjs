/**
 * Application illustration and photography assets.
 *
 * Generated through ChatGPT image generation, then validated and saved to
 * `public/assets/`. Each prompt asks explicitly for illustration, because the
 * first pass of reference images was prompted for a "flat UI mockup" and came
 * back icon-only with no imagery at all.
 *
 * These are local files. Nothing hotlinks a CDN.
 */

const STYLE = [
  "Style: warm, modern flat vector illustration with soft organic shapes and gentle texture.",
  "Restrained palette of deep green #12694a, soft leaf green #3f9e6b, pale mint #e6f2ec,",
  "warm cream #f7f7f4, warm brown #8a6a4f, and near-black accents.",
  "Clean confident linework, generous negative space, no gradients.",
  "No text, no lettering, no words anywhere, no numbers, no logos, no watermark.",
  "Friendly and calm, suitable for a banking app used by first-time users in rural India.",
].join(" ");

/** @type {Record<string, {prompt: string, alt: string, ratio: string}>} */
export const ASSETS = {
  "hero-illustration": {
    ratio: "wide",
    alt: "A shopkeeper counting money for a customer, with a bus stop and a schoolboy behind them, and leaves growing beside the shop",
    prompt: `A single flat vector illustration for a banking app hero, filling the frame edge to edge. Show a calm scene of everyday Indian life: a woman in a simple sari at a small village shopkeeper's counter receiving money, a bus waiting at a stop behind her, a young boy with a school bag walking past, and two large stylised leaves and a small tree growing beside the shop. The shopkeeper counts notes on a wooden counter. Warm afternoon light, simple rounded shapes, a few soft green hills behind. ${STYLE}`,
  },

  "empty-transactions": {
    ratio: "square",
    alt: "A neat stack of paper receipts held with a clip, with a small leaf resting on top",
    prompt: `A single flat vector illustration, simple and centred with generous empty space around it, roughly square. Show one neat stack of paper receipts held together with a small clip, resting on a simple table, with a small green leaf resting on top of the stack. Calm and tidy, nothing alarming. ${STYLE}`,
  },

  "empty-goals": {
    ratio: "square",
    alt: "A glass savings jar with coins dropping into it and a small green sprout growing from the top",
    prompt: `A single flat vector illustration, simple and centred with generous empty space around it, roughly square. Show a glass savings jar on a shelf with a few coins dropping into it from above, and one small green sprout growing out of the top of the jar. Hopeful and calm. ${STYLE}`,
  },

  "empty-rewards": {
    ratio: "square",
    alt: "Two cupped hands holding a small growing sapling with a soft rising sun behind it",
    prompt: `A single flat vector illustration, simple and centred with generous empty space around it, roughly square. Show two hands in a cupped shape holding a small growing sapling with several green leaves, with a soft rising sun behind it. Warm, hopeful, generous. ${STYLE}`,
  },

  "lesson-savings-safe": {
    ratio: "banner",
    alt: "A closed padlock resting on a rounded piggy bank with coins beside it",
    prompt: `A single flat vector illustration, simple and centred, wide banner proportions. Show a closed padlock sitting on top of a rounded piggy bank, with a few coins beside them and one small leaf resting against the piggy bank. Protective and calm. ${STYLE}`,
  },

  "lesson-on-time-bills": {
    ratio: "banner",
    alt: "A wall calendar with a tick beside one date, and a paid receipt in front of it",
    prompt: `A single flat vector illustration, simple and centred, wide banner proportions. Show a wall calendar page with a small tick mark beside one date, and a paid receipt with a torn edge resting in front of it. Orderly and reassuring. ${STYLE}`,
  },

  "lesson-trust-score": {
    ratio: "banner",
    alt: "An upward-trending line chart with a leaf growing from its highest point and two small figures looking at it",
    prompt: `A single flat vector illustration, simple and centred, wide banner proportions. Show a simple upward-trending line chart on a plain surface, with a small leaf growing from the highest point of the line and two small stylised people figures standing beside it looking at the chart. Encouraging and calm. ${STYLE}`,
  },

  "auth-welcome": {
    ratio: "portrait",
    alt: "A welcoming open doorway with warm light spilling out, a potted plant beside it, framed by leaves",
    prompt: `A single flat vector illustration, simple and centred with generous empty space around it, tall portrait proportions. Show a welcoming open doorway with warm light spilling out, a small plant beside the doorway in a pot, and two large stylised leaves framing the scene. Safe and inviting. ${STYLE}`,
  },

  "agent-kiosk": {
    ratio: "wide",
    alt: "A small village banking kiosk with a person behind the counter and a customer in front, a bus stop pole nearby",
    prompt: `A single flat vector illustration filling the frame edge to edge. Show a small village banking kiosk: a modest shopfront with a counter, a person behind the counter, and a customer standing in front. A simple blank signboard shape above the shop with no writing on it. A bus stop pole and a couple of stylised trees nearby. Everyday and reassuring. ${STYLE}`,
  },

  "voice-assistant": {
    ratio: "square",
    alt: "A person speaking, with soft curved sound-wave arcs radiating towards a stylised leaf",
    prompt: `A single flat vector illustration, simple and centred with generous empty space around it, roughly square. Show a person speaking, with soft curved sound-wave arcs radiating from their mouth towards a simple stylised leaf. Warm, calm, human. ${STYLE}`,
  },
};