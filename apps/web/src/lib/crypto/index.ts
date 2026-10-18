/**
 * Crypto layer.
 *
 * Split into two modules with different dependencies on purpose:
 *
 *   hash.ts    - pure primitives. No environment, no server-only guard, so the
 *                seed script and unit tests can import it directly.
 *   pepper.ts  - HMAC digests keyed by APP_SECRET. Server-only.
 *
 * Importing this index is the supported entry point; importing `hash.ts`
 * directly is also fine and is what the seed script and the tests do.
 */

export {
  digest,
  generateOtpCode,
  generateReference,
  generateSecret,
  generateSessionToken,
  hashPassword,
  maskPhone,
  safeEqual,
  verifyPassword,
} from "./hash";

export { hashOtpCode, hashSessionToken } from "./pepper";
