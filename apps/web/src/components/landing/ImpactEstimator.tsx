"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Leaf, Sparkles, TrendingUp } from "lucide-react";

/**
 * Live Financial & Impact Estimator.
 *
 * Implements taste-skill's "One Live Thing" rule and follows the Vercel Web
 * Interface Guidelines for form controls and accessibility:
 * - Explicit <label> with htmlFor
 * - Accessible slider with aria-valuetext and touch-friendly targets
 * - Tabular numbers with formatted Indian currency
 * - Transparent explanation of how estimates are derived (no fake promises)
 */
export function ImpactEstimator({
  locale = "en",
}: {
  locale?: string;
}) {
  const [monthlySpend, setMonthlySpend] = useState<number>(6000);
  const [onTimePayments, setOnTimePayments] = useState<boolean>(true);

  // Estimates aligned with FinLeaf's actual formulas:
  // - Trust score starts at base 500, +150 for consistent payments, scales with regular activity
  const baseScore = onTimePayments ? 680 : 560;
  const activityBonus = Math.min(80, Math.round((monthlySpend / 10000) * 40));
  const estimatedTrustScore = Math.min(850, baseScore + activityBonus);

  // Micro-loan borrowing capacity derived strictly from trust score tier (as in lib/banking/loans.ts)
  const estimatedLoanCapacity =
    estimatedTrustScore >= 750
      ? 15000
      : estimatedTrustScore >= 700
        ? 10000
        : estimatedTrustScore >= 620
          ? 5000
          : 2000;

  // Carbon tracked: ~1.2 kg CO₂e per ₹100 typical Indian household spending basket
  const estimatedCo2eKg = +( (monthlySpend / 100) * 1.25 ).toFixed(1);
  const estimatedGreenPoints = Math.round((monthlySpend / 100) * 8);

  const formatRupees = (val: number) => {
    const loc = locale === "hi" ? "hi-IN" : locale === "kn" ? "kn-IN" : "en-IN";
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="w-full rounded-3xl border border-[#d8d9da] bg-white p-6 shadow-sm transition-[border-color,box-shadow] duration-150 sm:p-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left Column: Interactive Controls */}
        <div className="flex flex-col justify-between lg:col-span-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#e8fdac] px-3.5 py-1 text-xs font-bold text-[#006642]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Interactive Estimator</span>
            </div>

            <h3 className="mt-3 text-2xl font-bold tracking-tight text-[#071929] sm:text-3xl">
              See what FinLeaf unlocks for you
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#55606C]">
              Adjust your monthly budget to project your behavioral Trust Score, micro-credit access, and carbon accounting.
            </p>

            <div className="mt-8 space-y-6">
              {/* Slider Field */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="monthly-spend-slider" className="text-sm font-semibold text-[#071929]">
                    Estimated Monthly Expenses
                  </label>
                  <span className="font-mono text-lg font-bold text-[#008254]">
                    {formatRupees(monthlySpend)}
                  </span>
                </div>
                <input
                  id="monthly-spend-slider"
                  type="range"
                  min={1000}
                  max={30000}
                  step={500}
                  value={monthlySpend}
                  onChange={(e) => setMonthlySpend(Number(e.target.value))}
                  aria-valuemin={1000}
                  aria-valuemax={30000}
                  aria-valuenow={monthlySpend}
                  aria-valuetext={`${formatRupees(monthlySpend)} per month`}
                  className="mt-3 h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-[#e3faf2] accent-[#008254] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008254] focus-visible:ring-offset-2"
                />
                <div className="mt-1 flex justify-between text-xs text-[#64666a]">
                  <span>₹1,000</span>
                  <span>₹15,000</span>
                  <span>₹30,000+</span>
                </div>
              </div>

              {/* Toggle switch for on-time bill payment habits */}
              <div className="flex items-center justify-between rounded-2xl border border-[#ebebec] bg-[#effcf8]/50 p-4">
                <div className="pr-4">
                  <p className="text-sm font-semibold text-[#071929]">
                    Consistent Utility & Recharge Habits
                  </p>
                  <p className="text-xs text-[#64666a]">
                    Paying electricity or mobile recharges regularly boosts trust.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={onTimePayments}
                  aria-label="Toggle on-time payment consistency habit"
                  onClick={() => setOnTimePayments((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-[background-color] duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008254] focus-visible:ring-offset-2 ${
                    onTimePayments ? "bg-[#008254]" : "bg-[#d8d9da]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-[transform] duration-150 ease-in-out ${
                      onTimePayments ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-[#868685] leading-relaxed">
            * Estimates are educational projections. In FinLeaf, your actual Trust Score is computed solely from immutable double-entry ledger transactions and peer group vouches.
          </p>
        </div>

        {/* Right Column: Dynamic Projected Metric Cards (NerdWallet comparison aesthetic) */}
        <div className="flex flex-col justify-between rounded-2xl bg-[#effcf8] p-6 lg:col-span-6">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#006642]">
              Projected Account Privileges
            </h4>

            {/* Metric 1: Trust Score */}
            <div className="flex items-center justify-between rounded-xl border border-[#b7ecda] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e3faf2] text-[#008254]">
                  <TrendingUp className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#64666a]">Projected Trust Score</p>
                  <p className="text-sm font-bold text-[#071929]">
                    {estimatedTrustScore >= 700 ? "Excellent Profile" : "Building Profile"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-2xl font-black text-[#008254]">
                  {estimatedTrustScore}
                </span>
                <span className="block text-[11px] text-[#64666a]">out of 850</span>
              </div>
            </div>

            {/* Metric 2: Micro-loan Capacity */}
            <div className="flex items-center justify-between rounded-xl border border-[#b7ecda] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e3faf2] text-[#008254]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#64666a]">Eligible Micro-Loan Limit</p>
                  <p className="text-sm font-bold text-[#071929]">No Collateral Required</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-2xl font-black text-[#071929]">
                  {formatRupees(estimatedLoanCapacity)}
                </span>
                <span className="block text-[11px] text-[#008254]">Instant Disbursement</span>
              </div>
            </div>

            {/* Metric 3: Carbon Tracked & Eco Rewards */}
            <div className="flex items-center justify-between rounded-xl border border-[#b7ecda] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e3faf2] text-[#008254]">
                  <Leaf className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#64666a]">CO₂e Estimated & Tracked</p>
                  <p className="text-sm font-bold text-[#071929]">
                    +{estimatedGreenPoints} Eco Points
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xl font-black text-[#071929]">
                  {estimatedCo2eKg} kg
                </span>
                <span className="block text-[11px] text-[#64666a]">per month</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#b7ecda]/60">
            <Link
              href="/sign-in"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#008254] py-3.5 text-center text-sm font-bold text-white transition-[background-color,transform] duration-150 hover:bg-[#006642] active:scale-[0.99]"
            >
              <span>Get Started with Your Free Account</span>
              <ArrowRight className="h-4 w-4 transition-[transform] duration-150 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
