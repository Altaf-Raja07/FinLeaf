#!/usr/bin/env node
/**
 * Unit tests for the money, carbon and points rules.
 *
 * Run: npm test
 *
 * Node strips the TypeScript types natively, so these import the real source
 * modules directly. That matters: a test that reimplements the rule it is testing
 * proves nothing about the rule the app actually uses.
 *
 * Only pure modules are tested here. Anything that touches the database, cookies,
 * or the ML service is covered by the integration script instead.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { rupeesToPaise, paiseToRupees, formatMoney, formatAbsolute } from "../src/lib/money.ts";
import {
  estimateCarbon,
  greenPointsFor,
  isCarbonCategory,
  CARBON_FACTORS,
} from "../src/lib/carbon.ts";
import { eligibleLoanAmount, MAX_LOAN_RUPEES, INSTALMENT_COUNT } from "../src/lib/loans.ts";

/* ------------------------------------------------------------------ money */

test("rupees convert to paise without floating point drift", () => {
  assert.equal(rupeesToPaise(12.45), 1245);
  // The classic float trap: 0.1 + 0.2 !== 0.3 in binary floating point.
  assert.equal(rupeesToPaise(0.1) + rupeesToPaise(0.2), rupeesToPaise(0.3));
  assert.equal(paiseToRupees(1245), 12.45);
  assert.equal(rupeesToPaise(-840.5), -84050);
});

test("money formatting uses Indian digit grouping and an explicit sign", () => {
  // Credits carry a leading + by default, so a statement shows direction without
  // the reader having to infer it from colour.
  assert.equal(formatMoney(1245000), "+₹12,450.00");
  assert.equal(formatMoney(-84000), "-₹840.00");
  assert.equal(formatMoney(84000), "+₹840.00");
  assert.equal(formatMoney(84000, { sign: "never" }), "₹840.00");
  assert.equal(formatAbsolute(-84000), "₹840.00");
  // Lakhs group as 1,00,000 rather than 100,000.
  assert.equal(formatMoney(10000000, { sign: "never" }), "₹1,00,000.00");
  assert.equal(formatMoney(0), "₹0.00");
});

/* ----------------------------------------------------------------- carbon */

test("the proposal's worked example reproduces exactly", () => {
  // Proposal section 9: 2,000 rupees of fuel at 2.5 kg per 100 rupees = 50 kg.
  const result = estimateCarbon("fuel", 200000);
  assert.equal(result.kgPer100Rupees, 2.5);
  assert.equal(result.co2eKg, 50);
  assert.equal(result.source, "static");
});

test("carbon estimation is linear in the amount spent", () => {
  const one = estimateCarbon("groceries", 84000); // ₹840 at 0.5 per 100 rupees
  assert.equal(one.co2eKg, 4.2);
  const twice = estimateCarbon("groceries", 168000);
  assert.equal(twice.co2eKg, one.co2eKg * 2);
});

test("moving your own money between accounts emits nothing", () => {
  assert.equal(estimateCarbon("transfer", 500000).co2eKg, 0);
  assert.equal(CARBON_FACTORS.transfer.kgPer100Rupees, 0);
});

test("an unknown category is rejected rather than defaulting to zero", () => {
  assert.equal(isCarbonCategory("fuel"), true);
  assert.equal(isCarbonCategory("yacht"), false);
});

test("every carbon estimate carries the factor and basis that produced it", () => {
  // The UI relies on this to explain an estimate rather than assert one.
  const result = estimateCarbon("fuel", 200000);
  assert.ok(result.basis.length > 0, "basis must explain the factor");
  assert.equal(result.kgPer100Rupees, CARBON_FACTORS.fuel.kgPer100Rupees);
});

/* ---------------------------------------------------------- green points */

test("only low-carbon categories earn points", () => {
  // A ₹2,000 bus pass earns points; a ₹2,000 fuel purchase does not.
  assert.ok(greenPointsFor("travel", 200000) > 0);
  assert.equal(greenPointsFor("fuel", 200000), 0);
  assert.equal(greenPointsFor("electronics", 200000), 0);
  // Electronics is high-carbon but necessary, which is exactly why the points
  // rule is kept separate from the emission table.
  assert.ok(estimateCarbon("electronics", 200000).co2eKg > estimateCarbon("groceries", 200000).co2eKg);
});

test("points scale with spend and floor per hundred rupees", () => {
  assert.equal(greenPointsFor("travel", 0), 0);
  assert.equal(greenPointsFor("travel", 9900), 0); // under ₹100
  assert.equal(greenPointsFor("travel", 10000), 12); // exactly ₹100
  assert.equal(greenPointsFor("travel", 1000000), 1200); // ₹10,000 at 12 per ₹100
});

/* -------------------------------------------------------- loan eligibility */

test("loan limits are in paise and rise with the trust score", () => {
  assert.equal(eligibleLoanAmount(0).limitPaise, 0);
  // 50,000 rupees over 6 whole-rupee instalments is 8,333.33 each, so the limit is
  // derived from the instalment: 49,998, not the unquotable 50,000.
  assert.equal(eligibleLoanAmount(100).limitPaise, 4_999_800);
  assert.equal(INSTALMENT_COUNT, 6);
  assert.equal(MAX_LOAN_RUPEES, 50_000);
  const mid = eligibleLoanAmount(50);
  assert.equal(mid.instalments, INSTALMENT_COUNT);
  assert.equal(mid.instalmentPaise, 416700); // a whole rupee
  // The invariant that matters: the instalments must sum to the quoted limit
  // exactly. This failed once with 2,500,002 because the limit was computed first
  // and the instalment derived from it by rounding.
  assert.equal(mid.instalmentPaise * mid.instalments, mid.limitPaise);
  assert.equal(mid.instalmentPaise % 100, 0, "instalment must be a whole rupee");
  assert.ok(eligibleLoanAmount(80).limitPaise > mid.limitPaise);
  assert.ok(eligibleLoanAmount(0).limitPaise < mid.limitPaise);
});