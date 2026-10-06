/**
 * Sign in through the real one-time-code flow.
 *
 * Shared by the browser smoke test and the visual capture harness. Codes are
 * generated per request now, so nothing can be hardcoded: the code is read from
 * the sign-in page, which only shows it because no SMS gateway is configured on
 * this environment.
 *
 * Kept in one place so both harnesses exercise exactly the same path a user does.
 */

export const PHONE = process.env.APP_TEST_PHONE ?? "+91 98765 43210";

/**
 * One origin for the whole run.
 *
 * A session cookie is scoped to the host that set it, and Next derives the
 * post-sign-in redirect from the incoming Host header. Driving the app on
 * 127.0.0.1 while the server reports itself as localhost therefore lands the
 * redirect on a different origin and the cookie is dropped, which surfaces as
 * "#otp never appeared". Pinning a single hostname and refusing a mixed one is
 * cheaper than debugging that twice.
 */
function resolveBaseUrl(requested) {
  const url = new URL(requested);
  if (url.hostname === "127.0.0.1" || url.hostname === "::1") {
    throw new Error(
      `use a hostname, not a loopback IP: ${requested}\n` +
        "Sign-in cookies are origin-bound and the redirect would move to a different host.\n" +
        "Pass --base=http://localhost:PORT instead."
    );
  }
  return url.origin;
}

/** Matches the "Your code is 123456" hint on the code entry step. */
const CODE_HINT = /your code is\s+(\d{6})/i;

/**
 * Drive the sign-in flow to the dashboard.
 *
 * Throws with a specific message on each failure, because a harness that reports
 * "sign-in failed" for five different reasons wastes the reader's time.
 */
export async function signIn(page, requestedBaseUrl) {
  const baseUrl = resolveBaseUrl(requestedBaseUrl);
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });

  await page.fill("#phone", PHONE);
  await page.click('button[type="submit"]');
  await page.waitForSelector("#otp", { state: "visible", timeout: 30_000 });

  const code = await readIssuedCode(page);
  if (!code) {
    throw new Error(
      "the sign-in page did not show a code. That is expected only when no SMS gateway is " +
        "configured; if SMS_PROVIDER_URL is set, the code is delivered out of band and this " +
        "harness cannot complete sign-in."
    );
  }

  await page.fill("#otp", code);
  await page.click('button[type="submit"]');
  await page.waitForSelector("main h1", { state: "visible", timeout: 30_000 });

  if (!page.url().includes("/dashboard")) {
    throw new Error(`sign-in did not reach the dashboard (landed on ${page.url()})`);
  }
}

/** The code is rendered in the field hint, which is the only place it appears. */
async function readIssuedCode(page) {
  const hint = await page.textContent("#otp-hint").catch(() => null);
  const match = hint?.match(CODE_HINT);
  return match ? match[1] : null;
}