import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { formatCompactMoney } from "@/lib/i18n";
import {
  EMISSION_FACTORS,
  co2eFor,
  greenPointsFor,
  isEmissionCategory,
  labelFor,
  noteFor,
} from "@/lib/carbon/factors";

/**
 * Carbon accounting invariants.
 *
 * The worked example from the project proposal is the reference case: INR 2,000
 * spent on fuel at a factor of 2.5 kg per INR 100 gives 50 kg CO2e. If that
 * stops holding, every other number in the product is wrong.
 */

describe("emission factors", () => {
  it("reproduces the proposal's worked example", () => {
    expect(co2eFor("FUEL", 2000)).toBe(50);
  });

  it("is linear in amount", () => {
    // Spend-based accounting is a direct proportion, so doubling the spend must
    // double the estimate. Any curvature here would mean a hidden unit error.
    expect(co2eFor("GROCERIES", 1000)).toBeCloseTo(co2eFor("GROCERIES", 500) * 2, 6);
  });

  it("scales by factor per 100", () => {
    expect(co2eFor("ELECTRICITY", 500)).toBeCloseTo((500 / 100) * 1.9, 6);
    expect(co2eFor("DINING", 300)).toBeCloseTo((300 / 100) * 0.8, 6);
  });

  it("treats offsets as negative, so funding a project removes carbon", () => {
    expect(co2eFor("OFFSET", 1000)).toBeLessThan(0);
  });

  it("gives zero-carbon categories a zero estimate rather than null", () => {
    for (const category of ["SALARY", "TRANSFER", "SAVINGS", "LOAN"]) {
      expect(co2eFor(category, 5000)).toBe(0);
    }
  });

  it("falls back to the OTHER factor for an unknown category", () => {
    expect(co2eFor("NOT_A_CATEGORY", 100)).toBe(co2eFor("OTHER", 100));
  });

  it("accepts a string amount, which is what Prisma returns", () => {
    expect(co2eFor("FUEL", "2000")).toBe(50);
  });

  it("exposes every factor with a label and a note in all three locales", () => {
    for (const [key, entry] of Object.entries(EMISSION_FACTORS)) {
      for (const locale of ["en", "hi", "kn"]) {
        expect(labelFor(key, locale), `${key}/${locale}`).not.toBe(key);
        expect(noteFor(key, locale).length).toBeGreaterThan(5);
      }
    }
  });

  it("recognises only real categories", () => {
    expect(isEmissionCategory("FUEL")).toBe(true);
    expect(isEmissionCategory("bogus")).toBe(false);
  });

  it("awards green points only to low-carbon categories", () => {
    expect(greenPointsFor("TRAVEL_PUBLIC")).toBeGreaterThan(0);
    expect(greenPointsFor("FUEL")).toBe(0);
    expect(greenPointsFor("bogus")).toBe(0);
  });
});

describe("formatCompactMoney", () => {
  it("compacts without scientific notation", () => {
    const out = formatCompactMoney(1_500_000);
    expect(out).not.toContain("e");
    expect(out).toContain("L");
  });

  it("keeps small amounts readable", () => {
    expect(formatCompactMoney(999)).toBe("999");
  });
});

describe("decimal handling", () => {
  /**
   * Money is stored as `Decimal(14,2)` and shared with Postgres, so every
   * amount must survive arithmetic without picking up binary floating-point
   * error. `0.1 + 0.2` in a plain JS number is `0.30000000000000004`; in a
   * ledger that shows up as a one-rupee-off statement.
   */
  it("adds rupee amounts exactly", () => {
    const a = new Prisma.Decimal("0.10");
    const b = new Prisma.Decimal("0.20");
    const sum = a.plus(b);
    expect(sum.toString()).toBe("0.3");
    // The value, not the shape, is what must not drift.
    expect(sum.toNumber()).toBe(0.3);
  });

  it("compares amounts without float error", () => {
    // 19.99 x 3 is a real balance edge case: 59.97, exactly.
    const price = new Prisma.Decimal("19.99");
    expect(price.times(3).toString()).toBe("59.97");
  });

  it("rejects a negative balance in the guard the ledger uses", () => {
    const balance = new Prisma.Decimal("100");
    const debit = new Prisma.Decimal("150");
    expect(balance.gte(debit)).toBe(false);
  });

  it("accepts an exactly-matching debit", () => {
    // Draining an account to exactly zero is allowed and must not be rejected
    // by an off-by-one in the comparison.
    const balance = new Prisma.Decimal("100");
    const debit = new Prisma.Decimal("100");
    expect(balance.gte(debit)).toBe(true);
  });

  it("keeps money at two decimals through a division", () => {
    const instalment = new Prisma.Decimal("1000").dividedBy(3);
    expect(instalment.toDecimalPlaces(2).toString()).toBe("333.33");
  });
});
