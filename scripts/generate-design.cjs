/**
 * Design-reference generator (runs inside the Playwright MCP sandbox).
 *
 * Sandbox constraints found by probing:
 *   - Node side: `page` and `Buffer` exist; `process`, `require`, `fetch` do NOT.
 *   - Page-side `fetch` to http://127.0.0.1 fails: Chrome blocks it as mixed
 *     content on an https:// page, so the browser cannot POST to a local server.
 *   - Returning ~1.5MB of base64 through the tool result is wasteful and fragile.
 *
 * So the finished image leaves the browser via a real download event, which
 * Playwright writes to a staging path we choose. scripts/render-job.cjs then
 * validates the PNG and copies it into design/.
 *
 * __JOB__ is substituted by scripts/render-job.cjs with:
 *   { filename, prompt, timeoutMs }
 */
async (page) => {
  const JOB = __JOB__;
  const log = [];
  const timeoutMs = JOB.timeoutMs || 300000;

  // --- 1. always start from a fresh conversation ----------------------------
  await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const newChat = page.getByRole("button", { name: /new chat/i }).first();
  if (await newChat.count()) {
    try {
      await newChat.click({ timeout: 4000 });
      await page.waitForTimeout(1200);
      log.push("new chat");
    } catch {
      log.push("new-chat unavailable");
    }
  }

  // --- 2. submit the image prompt -------------------------------------------
  const box = page.getByRole("textbox", { name: /ask chatgpt/i }).first();
  await box.waitFor({ state: "visible", timeout: 30000 });
  await box.click();
  await box.fill(JOB.prompt);
  await page.waitForTimeout(400);
  await box.press("Enter");
  log.push("submitted");

  // --- 3. wait for a generated image to actually render ---------------------
  const deadline = Date.now() + timeoutMs;
  let imgSrc = null;
  let declined = false;

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      const gen = imgs.filter((i) => i.src.startsWith("blob:") && i.naturalWidth > 400);
      if (gen.length) {
        return { src: gen[gen.length - 1].src, ready: true };
      }
      // Detect an explicit refusal so we fail fast instead of burning 5 minutes.
      const body = document.body.innerText || "";
      const busy = /Generating|Thinking|Working/i.test(body.slice(0, 600));
      const refused = !busy && /I can't help|I'm sorry, I can't|cannot generate|content policy|unable to (create|generate)/i.test(body);
      return { src: null, ready: false, refused, busy };
    });

    if (state.src) {
      imgSrc = state.src;
      log.push("image rendered");
      break;
    }
    if (state.refused) {
      declined = true;
      log.push("model declined");
      break;
    }
    await page.waitForTimeout(1500);
  }

  if (!imgSrc) {
    const hint = await page.evaluate(() => {
      const turns = Array.from(document.querySelectorAll("[data-message-author-role]"));
      const last = turns[turns.length - 1];
      return (last ? last.innerText : document.body.innerText).trim().slice(0, 300);
    });
    return JSON.stringify({
      status: declined ? "declined" : "timeout",
      filename: JOB.filename,
      hint,
      log,
    });
  }

  // --- 4. pull the file out via a browser download event -------------------
  const tmp = "/tmp/opencode/design-staging/" + JOB.filename;
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 90000 }).catch(() => null),
    page.evaluate((s) => {
      const a = document.createElement("a");
      a.href = s;
      a.download = "design-output.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, imgSrc),
  ]);

  if (!download) return JSON.stringify({ status: "download-failed", filename: JOB.filename, log });
  await download.saveAs(tmp);
  log.push("downloaded");

  return JSON.stringify({ status: "ok", filename: JOB.filename, stagedAt: tmp, log });
}