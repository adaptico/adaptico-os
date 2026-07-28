#!/usr/bin/env node
/**
 * Pricing calculator - deterministic math for /gtm pricing (Adaptico OS).
 *
 * The division of labor: what each tier contains, what the price SHOULD be,
 * and whether a spread is healthy are judgment calls the skill makes against
 * its rubric; this script owns the arithmetic - tier ratios, annual-discount
 * math, break-even, CAC payback - so no number in a pricing report is mental
 * math. Same inputs, same numbers, every run.
 *
 * Subcommands:
 *
 *   tiers      Ratios and spread for a 3-tier ladder, plus optional
 *              value-multiple and per-tier annual pricing.
 *              node pricing_calculator.js tiers --low 19 --mid 49 --high 149 \
 *                                               [--value 500] [--discount 20]
 *              --value  = quantified monthly value delivered to the target
 *                         customer (from the skill's value interrogation);
 *                         emits value/price multiples per tier.
 *              --discount = annual discount percent; emits annual math per tier.
 *
 *   annual     Annual-discount math for one monthly price.
 *              node pricing_calculator.js annual --monthly 49 --discount 20
 *              Emits the annual price, effective monthly, savings per year,
 *              and the months-free equivalent (12 * discount%).
 *
 *   breakeven  Unit economics for one tier.
 *              node pricing_calculator.js breakeven --price 49 --fixed 3000 \
 *                                                   [--variable 5] [--cac 200]
 *              --fixed    = fixed costs per month (burn to cover).
 *              --variable = variable cost per customer per month (hosting,
 *                           AI inference/API cost - the flag that catches a
 *                           negative-margin tier).
 *              --cac      = customer acquisition cost; emits payback months.
 *
 *   --selftest Run the built-in test suite.
 *
 * All money values are currency-agnostic numbers (no symbols). Money rounds
 * to 2 decimals, ratios to 2, percentages and months to 1. Unknown flags are
 * rejected (exit 2) - a typo like --vlaue must fail loudly, never silently
 * drop an optional input from the output.
 *
 * Zero dependencies (Node standard library only).
 * Exit codes: 0 success; 2 usage error. Selftest: 0 pass, 1 fail.
 */

"use strict";

function round2(x) { return Math.round(x * 100) / 100; }
function round1(x) { return Math.round(x * 10) / 10; }

function assertPositiveNumber(value, flag) {
  if (typeof value !== "number" || isNaN(value) || value <= 0) {
    throw new Error("--" + flag + " must be a number greater than 0 (got: " + value + ")");
  }
}

function assertNonNegativeNumber(value, flag) {
  if (typeof value !== "number" || isNaN(value) || value < 0) {
    throw new Error("--" + flag + " must be a number >= 0 (got: " + value + ")");
  }
}

function assertDiscount(discount) {
  if (typeof discount !== "number" || isNaN(discount) || discount < 0 || discount > 90) {
    throw new Error("--discount must be a percent between 0 and 90 (got: " + discount + ")");
  }
}

/**
 * Annual-discount math for one monthly price.
 * monthly: number > 0. discount: percent 0-90.
 * Returns the annual price, effective monthly, yearly savings, and the
 * months-free equivalent - the numbers behind "save 20%" / "2.4 months free".
 */
function computeAnnual(monthly, discount) {
  assertPositiveNumber(monthly, "monthly");
  assertDiscount(discount);
  const grossYear = monthly * 12;
  const annualPrice = grossYear * (1 - discount / 100);
  return {
    monthly: round2(monthly),
    discountPct: discount,
    annualPrice: round2(annualPrice),
    effectiveMonthly: round2(annualPrice / 12),
    annualSavings: round2(grossYear - annualPrice),
    monthsFreeEquivalent: round1(12 * discount / 100),
    upfrontCash: round2(annualPrice),
  };
}

/**
 * Tier math for a 3-tier ladder.
 * inputs: { low, mid, high } - monthly prices, strictly ascending;
 *         value (optional) - quantified monthly value delivered;
 *         discount (optional) - annual discount percent.
 * Returns ratios, the middle tier's position in the low-high span (0 = at the
 * low price, 1 = at the high price - how the anchor frames it), and per-tier
 * value multiples / annual math when the optional inputs are given.
 */
function computeTiers(inputs) {
  const low = inputs.low, mid = inputs.mid, high = inputs.high;
  assertPositiveNumber(low, "low");
  assertPositiveNumber(mid, "mid");
  assertPositiveNumber(high, "high");
  if (!(low < mid && mid < high)) {
    throw new Error("tiers must be strictly ascending: --low < --mid < --high (got: " + low + ", " + mid + ", " + high + ")");
  }
  if (inputs.value !== undefined) assertPositiveNumber(inputs.value, "value");
  if (inputs.discount !== undefined) assertDiscount(inputs.discount);

  const result = {
    tiers: {
      low: { monthly: round2(low) },
      mid: { monthly: round2(mid) },
      high: { monthly: round2(high) },
    },
    ratios: {
      midToLow: round2(mid / low),
      highToMid: round2(high / mid),
      highToLow: round2(high / low),
    },
    // Where the middle price sits between low and high. A mid below 0.5 reads
    // as closer to the low tier - the high anchor makes it look reasonable.
    midPosition: round2((mid - low) / (high - low)),
  };

  if (inputs.value !== undefined) {
    result.valueMonthly = round2(inputs.value);
    ["low", "mid", "high"].forEach(function (key) {
      result.tiers[key].valueMultiple = round1(inputs.value / result.tiers[key].monthly);
    });
  }

  if (inputs.discount !== undefined) {
    result.discountPct = inputs.discount;
    ["low", "mid", "high"].forEach(function (key) {
      result.tiers[key].annual = computeAnnual(result.tiers[key].monthly, inputs.discount);
    });
  }

  return result;
}

/**
 * Break-even and payback for one tier.
 * inputs: { price, fixed, variable (default 0), cac (optional) }.
 * contribution = price - variable cost per customer per month. A variable
 * cost at or above the price is an error, not a warning - that tier loses
 * money on every customer and no volume fixes it.
 */
function computeBreakeven(inputs) {
  const price = inputs.price;
  const fixed = inputs.fixed;
  const variable = inputs.variable === undefined ? 0 : inputs.variable;
  assertPositiveNumber(price, "price");
  assertNonNegativeNumber(fixed, "fixed");
  assertNonNegativeNumber(variable, "variable");
  if (inputs.cac !== undefined) assertNonNegativeNumber(inputs.cac, "cac");
  if (variable >= price) {
    throw new Error("--variable (" + variable + ") is at or above --price (" + price + ") - this tier has negative unit margin; no customer count breaks even");
  }

  const contribution = price - variable;
  const customersToBreakEven = fixed === 0 ? 0 : Math.ceil(fixed / contribution);
  const result = {
    price: round2(price),
    variableCost: round2(variable),
    contribution: round2(contribution),
    grossMarginPct: round1((contribution / price) * 100),
    fixedMonthly: round2(fixed),
    customersToBreakEven: customersToBreakEven,
    mrrAtBreakEven: round2(customersToBreakEven * price),
  };
  if (inputs.cac !== undefined) {
    result.cac = round2(inputs.cac);
    result.cacPaybackMonths = round1(inputs.cac / contribution);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Selftest
// ---------------------------------------------------------------------------

function selftest() {
  const failures = [];
  function assertEq(actual, expected, label) {
    if (actual !== expected) {
      failures.push(label + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
    }
  }
  function assertThrows(fn, label) {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) failures.push(label + ": expected an error, none thrown");
  }

  // --- annual -------------------------------------------------------------
  const a = computeAnnual(49, 20);
  assertEq(a.annualPrice, 470.4, "annual 49@20: annual price");
  assertEq(a.effectiveMonthly, 39.2, "annual 49@20: effective monthly");
  assertEq(a.annualSavings, 117.6, "annual 49@20: yearly savings");
  assertEq(a.monthsFreeEquivalent, 2.4, "annual 49@20: months-free equivalent");
  assertEq(a.upfrontCash, 470.4, "annual 49@20: upfront cash");

  const a0 = computeAnnual(49, 0);
  assertEq(a0.annualPrice, 588, "annual 49@0: no discount, full year");
  assertEq(a0.annualSavings, 0, "annual 49@0: zero savings");
  assertEq(a0.monthsFreeEquivalent, 0, "annual 49@0: zero months free");

  // "Two months free" framing is a ~16.7% discount: the math must line up.
  const a2mo = computeAnnual(30, 16.7);
  assertEq(a2mo.monthsFreeEquivalent, 2, "annual 30@16.7: ~2 months free");
  assertEq(a2mo.annualPrice, 299.88, "annual 30@16.7: annual price");

  // --- tiers ----------------------------------------------------------------
  const t = computeTiers({ low: 19, mid: 49, high: 149 });
  assertEq(t.ratios.midToLow, 2.58, "tiers 19/49/149: mid/low ratio");
  assertEq(t.ratios.highToMid, 3.04, "tiers 19/49/149: high/mid ratio");
  assertEq(t.ratios.highToLow, 7.84, "tiers 19/49/149: high/low spread");
  assertEq(t.midPosition, 0.23, "tiers 19/49/149: mid position in span");
  assertEq(t.tiers.mid.monthly, 49, "tiers: mid price echoed");
  assertEq(t.tiers.low.valueMultiple, undefined, "tiers: no value multiple without --value");

  const tv = computeTiers({ low: 19, mid: 49, high: 149, value: 500 });
  assertEq(tv.valueMonthly, 500, "tiers+value: value echoed");
  assertEq(tv.tiers.low.valueMultiple, 26.3, "tiers+value: low multiple");
  assertEq(tv.tiers.mid.valueMultiple, 10.2, "tiers+value: mid multiple");
  assertEq(tv.tiers.high.valueMultiple, 3.4, "tiers+value: high multiple");

  const td = computeTiers({ low: 19, mid: 49, high: 149, discount: 20 });
  assertEq(td.discountPct, 20, "tiers+discount: discount echoed");
  assertEq(td.tiers.low.annual.annualPrice, 182.4, "tiers+discount: low annual");
  assertEq(td.tiers.mid.annual.annualPrice, 470.4, "tiers+discount: mid annual");
  assertEq(td.tiers.high.annual.annualPrice, 1430.4, "tiers+discount: high annual");
  assertEq(td.tiers.mid.annual.monthsFreeEquivalent, 2.4, "tiers+discount: months free carried");

  // --- breakeven ------------------------------------------------------------
  const b = computeBreakeven({ price: 49, fixed: 3000, variable: 5, cac: 200 });
  assertEq(b.contribution, 44, "breakeven: contribution");
  assertEq(b.grossMarginPct, 89.8, "breakeven: gross margin pct");
  assertEq(b.customersToBreakEven, 69, "breakeven: customers (ceil of 68.18)");
  assertEq(b.mrrAtBreakEven, 3381, "breakeven: MRR at break-even");
  assertEq(b.cacPaybackMonths, 4.5, "breakeven: CAC payback months");

  const bExact = computeBreakeven({ price: 49, fixed: 4400, variable: 5 });
  assertEq(bExact.customersToBreakEven, 100, "breakeven: exact division, no ceil overshoot");
  assertEq(bExact.cacPaybackMonths, undefined, "breakeven: no payback without --cac");

  const bZero = computeBreakeven({ price: 49, fixed: 0 });
  assertEq(bZero.customersToBreakEven, 0, "breakeven: zero fixed costs, zero customers");
  assertEq(bZero.contribution, 49, "breakeven: variable defaults to 0");
  assertEq(bZero.grossMarginPct, 100, "breakeven: 100% margin with no variable cost");

  // --- validation -----------------------------------------------------------
  assertThrows(function () { computeTiers({ low: 49, mid: 49, high: 149 }); }, "equal low/mid rejected");
  assertThrows(function () { computeTiers({ low: 50, mid: 49, high: 149 }); }, "descending tiers rejected");
  assertThrows(function () { computeTiers({ low: 0, mid: 49, high: 149 }); }, "zero price rejected");
  assertThrows(function () { computeTiers({ low: 19, mid: 49, high: 149, value: -5 }); }, "negative value rejected");
  assertThrows(function () { computeAnnual(49, 95); }, "discount above 90 rejected");
  assertThrows(function () { computeAnnual(49, -1); }, "negative discount rejected");
  assertThrows(function () { computeAnnual(0, 20); }, "zero monthly rejected");
  assertThrows(function () { computeBreakeven({ price: 49, fixed: 3000, variable: 49 }); }, "variable >= price rejected (negative margin)");
  assertThrows(function () { computeBreakeven({ price: 49, fixed: -100 }); }, "negative fixed rejected");
  assertThrows(function () { computeBreakeven({ price: NaN, fixed: 100 }); }, "NaN price rejected");

  // --- strict flags -----------------------------------------------------------
  assertEq(unknownFlags({ vlaue: "500", low: "19" }, ["low", "mid", "high", "value", "discount"]).join(","), "vlaue", "typo'd flag detected as unknown");
  assertEq(unknownFlags({ low: "19", value: "500" }, ["low", "mid", "high", "value", "discount"]).length, 0, "known flags pass the strict check");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: pricing_calculator.js (tier ratios, annual math, break-even, and validation all hold)");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = [
  "usage: node pricing_calculator.js tiers --low N --mid N --high N [--value N] [--discount P]",
  "       node pricing_calculator.js annual --monthly N --discount P",
  "       node pricing_calculator.js breakeven --price N --fixed N [--variable N] [--cac N]",
  "       node pricing_calculator.js --selftest",
].join("\n");

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].slice(0, 2) === "--") {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function unknownFlags(flags, allowed) {
  return Object.keys(flags).filter(function (key) { return allowed.indexOf(key) === -1; });
}

function requireNumericFlags(flags, required, optional) {
  const known = required.concat(optional);
  const unknown = unknownFlags(flags, known);
  if (unknown.length) {
    console.error(
      "pricing_calculator: unknown flag(s): " + unknown.map(function (k) { return "--" + k; }).join(", ") +
      " (known: " + known.map(function (k) { return "--" + k; }).join(", ") + ")"
    );
    process.exit(2);
  }
  const missing = [];
  const invalid = [];
  const parsed = {};
  required.forEach(function (key) {
    if (flags[key] === undefined) missing.push("--" + key);
  });
  required.concat(optional).forEach(function (key) {
    if (flags[key] === undefined) return;
    if (!/^\d+(\.\d+)?$/.test(flags[key])) {
      invalid.push("--" + key + " '" + flags[key] + "'");
    } else {
      parsed[key] = parseFloat(flags[key]);
    }
  });
  if (missing.length) {
    console.error("pricing_calculator: missing required flag(s): " + missing.join(", "));
    console.error(USAGE);
    process.exit(2);
  }
  if (invalid.length) {
    console.error("pricing_calculator: not a number: " + invalid.join(", "));
    process.exit(2);
  }
  return parsed;
}

function main() {
  const args = process.argv.slice(2);
  if (args.indexOf("--selftest") !== -1) {
    selftest();
    return;
  }

  const subcommand = args[0];
  const flags = parseFlags(args.slice(1));
  let result;

  try {
    if (subcommand === "tiers") {
      const p = requireNumericFlags(flags, ["low", "mid", "high"], ["value", "discount"]);
      result = computeTiers(p);
    } else if (subcommand === "annual") {
      const p = requireNumericFlags(flags, ["monthly", "discount"], []);
      result = computeAnnual(p.monthly, p.discount);
    } else if (subcommand === "breakeven") {
      const p = requireNumericFlags(flags, ["price", "fixed"], ["variable", "cac"]);
      result = computeBreakeven(p);
    } else {
      console.error("pricing_calculator: unknown subcommand '" + (subcommand || "") + "'");
      console.error(USAGE);
      process.exit(2);
    }
  } catch (e) {
    console.error("pricing_calculator: " + e.message);
    process.exit(2);
  }

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { computeAnnual: computeAnnual, computeTiers: computeTiers, computeBreakeven: computeBreakeven };
