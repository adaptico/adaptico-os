#!/usr/bin/env node
/**
 * Ads calculator - deterministic math for /gtm ads (Adaptico OS).
 *
 * The division of labor: whether ads are the right move, which platform to
 * test, and what the ads should say are judgment calls the skill makes; this
 * script owns the arithmetic - CAC, payback, break-even ROAS, test-budget
 * sizing, and A/B sample-size math - so no number in an ads report is mental
 * math. Same inputs, same numbers, every run.
 *
 * Subcommands:
 *
 *   cac        Customer acquisition cost, payback, and (optionally) LTV:CAC.
 *              node ads_calculator.js cac --spend 1500 --customers 10 \
 *                                         [--price 49] [--variable 5] [--churn 3]
 *              --spend     = total acquisition spend for the period.
 *              --customers = customers that spend produced (projected or real).
 *              --price     = monthly price per customer (ARPA); unlocks
 *                            contribution + payback months.
 *              --variable  = variable cost per customer per month (hosting,
 *                            AI inference/API) - requires --price.
 *              --churn     = monthly churn percent - requires --price; unlocks
 *                            lifetime months, LTV, and the LTV:CAC ratio.
 *
 *   breakeven  Break-even ROAS and the maximum affordable CAC.
 *              node ads_calculator.js breakeven --price 49 [--variable 5] \
 *                                               [--payback 6]
 *              Break-even ROAS = revenue / spend at zero profit = 1 / the
 *              contribution-margin fraction (measured on the revenue the spend
 *              produced, any horizon). --payback = months the business can
 *              wait to recover acquisition cost; emits the max CAC that
 *              payback tolerance can afford.
 *
 *   testbudget Minimum budget for a readable test signal.
 *              node ads_calculator.js testbudget --cpa 60 [--signal 50] \
 *                                                [--daily 50] [--budget 1000]
 *              --cpa    = expected cost per conversion (the platform's
 *                         optimization event).
 *              --signal = conversions that count as a readable signal
 *                         (default 50 - the floor major platforms document
 *                         for exiting their learning phase, ~50 optimization
 *                         events per ad set per week).
 *              --daily  = daily budget; emits days-to-signal and whether that
 *                         pace ever exits the learning phase.
 *              --budget = a fixed test budget; emits the conversions it buys
 *                         and the shortfall against the signal floor.
 *
 *   abtest     Sample size needed to detect a conversion-rate lift
 *              (Lehr's approximation: n per arm = 16 * p(1-p) / delta^2 at
 *              80% power, alpha 0.05 two-sided; 21 for 90% power).
 *              node ads_calculator.js abtest --rate 2 --lift 25 \
 *                                            [--cpc 3] [--power 80]
 *              --rate = baseline conversion percent, --lift = relative lift
 *              percent to detect, --cpc = cost per visitor/click (emits the
 *              cost of the test), --power = 80 (default) or 90.
 *
 *   --selftest Run the built-in test suite.
 *
 * All money values are currency-agnostic numbers (no symbols). Money rounds
 * to 2 decimals, ratios to 2, percentages and months to 1; sample sizes and
 * day counts round up (a fraction of a visitor doesn't exist), while what a
 * budget buys keeps one decimal so a shortfall stays visible.
 * Unknown flags are rejected (exit 2) - a typo like --custmers must fail
 * loudly, never silently drop an input from the output.
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

function assertPercent(value, flag) {
  if (typeof value !== "number" || isNaN(value) || value <= 0 || value >= 100) {
    throw new Error("--" + flag + " must be a percent between 0 and 100, exclusive (got: " + value + ")");
  }
}

function assertMargin(price, variable) {
  if (variable >= price) {
    throw new Error("--variable (" + variable + ") is at or above --price (" + price + ") - negative unit margin; no ad spend, budget, or volume makes this acquisition pay back");
  }
}

/**
 * CAC, payback months, and (with churn) LTV:CAC.
 * inputs: { spend, customers, price?, variable?, churn? }.
 * --variable and --churn only mean anything relative to a price, so both
 * require --price. LTV uses the standard SaaS shape: monthly contribution *
 * (1 / monthly churn rate). The skill decides whether the churn input is real
 * data or a guess - this function just computes.
 */
function computeCac(inputs) {
  assertPositiveNumber(inputs.spend, "spend");
  assertPositiveNumber(inputs.customers, "customers");
  if (inputs.variable !== undefined && inputs.price === undefined) {
    throw new Error("--variable requires --price (contribution is price minus variable cost)");
  }
  if (inputs.churn !== undefined && inputs.price === undefined) {
    throw new Error("--churn requires --price (LTV is built from monthly contribution)");
  }

  const cac = inputs.spend / inputs.customers;
  const result = {
    spend: round2(inputs.spend),
    customers: inputs.customers,
    cac: round2(cac),
  };

  if (inputs.price !== undefined) {
    const price = inputs.price;
    const variable = inputs.variable === undefined ? 0 : inputs.variable;
    assertPositiveNumber(price, "price");
    assertNonNegativeNumber(variable, "variable");
    assertMargin(price, variable);
    const contribution = price - variable;
    result.price = round2(price);
    result.variableCost = round2(variable);
    result.contribution = round2(contribution);
    result.grossMarginPct = round1((contribution / price) * 100);
    result.paybackMonths = round1(cac / contribution);

    if (inputs.churn !== undefined) {
      assertPercent(inputs.churn, "churn");
      const lifetimeMonths = 100 / inputs.churn;
      const ltv = contribution * lifetimeMonths;
      result.churnPctMonthly = inputs.churn;
      result.lifetimeMonths = round1(lifetimeMonths);
      result.ltv = round2(ltv);
      result.ltvToCac = round1(ltv / cac);
    }
  }

  return result;
}

/**
 * Break-even ROAS and max affordable CAC.
 * inputs: { price, variable (default 0), payback? }.
 * Break-even ROAS = 1 / contribution-margin fraction: the revenue each unit
 * of spend must return before the contribution profit on that revenue equals
 * the spend. maxCacOneMonth = one month of contribution (the CPA ceiling for
 * instant payback); maxCacAtPayback = contribution * the months the founder
 * can wait.
 */
function computeBreakeven(inputs) {
  const price = inputs.price;
  const variable = inputs.variable === undefined ? 0 : inputs.variable;
  assertPositiveNumber(price, "price");
  assertNonNegativeNumber(variable, "variable");
  assertMargin(price, variable);
  if (inputs.payback !== undefined) assertPositiveNumber(inputs.payback, "payback");

  const contribution = price - variable;
  const result = {
    price: round2(price),
    variableCost: round2(variable),
    contribution: round2(contribution),
    grossMarginPct: round1((contribution / price) * 100),
    breakEvenRoas: round2(price / contribution),
    maxCacOneMonth: round2(contribution),
  };
  if (inputs.payback !== undefined) {
    result.paybackMonths = inputs.payback;
    result.maxCacAtPayback = round2(contribution * inputs.payback);
  }
  return result;
}

/**
 * Minimum budget for a readable signal.
 * inputs: { cpa, signal (default 50), daily?, budget? }.
 * The default signal floor is the ~50 optimization events per ad set per
 * week that major platforms document for exiting their learning phase - a
 * documented platform number, overridable, not a law of statistics.
 */
function computeTestBudget(inputs) {
  const cpa = inputs.cpa;
  const signal = inputs.signal === undefined ? 50 : inputs.signal;
  assertPositiveNumber(cpa, "cpa");
  assertPositiveNumber(signal, "signal");
  if (inputs.daily !== undefined) assertPositiveNumber(inputs.daily, "daily");
  if (inputs.budget !== undefined) assertPositiveNumber(inputs.budget, "budget");

  const minBudget = cpa * signal;
  const result = {
    cpa: round2(cpa),
    signalFloor: signal,
    minBudgetForSignal: round2(minBudget),
  };

  if (inputs.daily !== undefined) {
    result.dailyBudget = round2(inputs.daily);
    result.daysToSignal = Math.ceil(minBudget / inputs.daily);
    const weeklyPace = (inputs.daily / cpa) * 7;
    result.weeklyEventPace = round1(weeklyPace);
    // The learning-phase window is a rolling week: pace below the floor never
    // exits it no matter how long the test runs.
    result.exitsLearningAtDaily = weeklyPace >= signal;
  }

  if (inputs.budget !== undefined) {
    result.budget = round2(inputs.budget);
    result.eventsBudgetBuys = round1(inputs.budget / cpa);
    result.readableSignal = inputs.budget / cpa >= signal;
    result.budgetShortfall = round2(Math.max(0, minBudget - inputs.budget));
  }

  return result;
}

/**
 * A/B sample size per arm (Lehr's approximation for two proportions):
 * n = M * pbar(1-pbar) / (p1-p0)^2, M = 16 at 80% power / 21 at 90%,
 * alpha 0.05 two-sided.
 * inputs: { rate (baseline %), lift (relative %), cpc?, power (80|90) }.
 */
function computeAbTest(inputs) {
  assertPercent(inputs.rate, "rate");
  assertPositiveNumber(inputs.lift, "lift");
  if (inputs.cpc !== undefined) assertPositiveNumber(inputs.cpc, "cpc");
  const power = inputs.power === undefined ? 80 : inputs.power;
  if (power !== 80 && power !== 90) {
    throw new Error("--power must be 80 or 90 (got: " + power + ")");
  }

  const p0 = inputs.rate / 100;
  const p1 = p0 * (1 + inputs.lift / 100);
  if (p1 >= 1) {
    throw new Error("--rate " + inputs.rate + "% lifted by " + inputs.lift + "% exceeds 100% - no detectable variant exists");
  }
  const pbar = (p0 + p1) / 2;
  const delta = p1 - p0;
  const multiplier = power === 90 ? 21 : 16;
  const nPerArm = Math.ceil((multiplier * pbar * (1 - pbar)) / (delta * delta));

  const result = {
    baselineRatePct: inputs.rate,
    liftedRatePct: round2(p1 * 100),
    relativeLiftPct: inputs.lift,
    powerPct: power,
    visitorsPerArm: nPerArm,
    visitorsTotal: nPerArm * 2,
  };
  if (inputs.cpc !== undefined) {
    result.cpc = round2(inputs.cpc);
    result.costPerArm = round2(nPerArm * inputs.cpc);
    result.costTotal = round2(nPerArm * 2 * inputs.cpc);
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

  // --- cac ------------------------------------------------------------------
  const c = computeCac({ spend: 1500, customers: 10 });
  assertEq(c.cac, 150, "cac 1500/10: CAC");
  assertEq(c.paybackMonths, undefined, "cac without price: no payback");

  const cp = computeCac({ spend: 1500, customers: 10, price: 49, variable: 5 });
  assertEq(cp.contribution, 44, "cac+price: contribution");
  assertEq(cp.grossMarginPct, 89.8, "cac+price: gross margin pct");
  assertEq(cp.paybackMonths, 3.4, "cac+price: payback months (150/44)");

  const cl = computeCac({ spend: 1500, customers: 10, price: 49, variable: 5, churn: 3 });
  assertEq(cl.lifetimeMonths, 33.3, "cac+churn: lifetime months (100/3)");
  assertEq(cl.ltv, 1466.67, "cac+churn: LTV (44 * 33.33)");
  assertEq(cl.ltvToCac, 9.8, "cac+churn: LTV:CAC");

  // --- breakeven --------------------------------------------------------------
  const b = computeBreakeven({ price: 49, variable: 5 });
  assertEq(b.contribution, 44, "breakeven 49/5: contribution");
  assertEq(b.breakEvenRoas, 1.11, "breakeven 49/5: ROAS (49/44)");
  assertEq(b.maxCacOneMonth, 44, "breakeven 49/5: one-month CAC ceiling");

  const b25 = computeBreakeven({ price: 100, variable: 75 });
  assertEq(b25.grossMarginPct, 25, "breakeven 25% margin: pct");
  assertEq(b25.breakEvenRoas, 4, "breakeven 25% margin: ROAS = 1/0.25");

  const bp = computeBreakeven({ price: 49, variable: 5, payback: 6 });
  assertEq(bp.maxCacAtPayback, 264, "breakeven+payback: 44 * 6");

  const bd = computeBreakeven({ price: 49 });
  assertEq(bd.breakEvenRoas, 1, "breakeven no variable: ROAS 1.0");
  assertEq(bd.grossMarginPct, 100, "breakeven no variable: 100% margin");

  // --- testbudget --------------------------------------------------------------
  const t = computeTestBudget({ cpa: 60 });
  assertEq(t.signalFloor, 50, "testbudget: default signal floor 50");
  assertEq(t.minBudgetForSignal, 3000, "testbudget: 60 * 50");

  const td = computeTestBudget({ cpa: 60, daily: 50 });
  assertEq(td.daysToSignal, 60, "testbudget+daily: days to signal");
  assertEq(td.weeklyEventPace, 5.8, "testbudget+daily: weekly pace (50/60*7)");
  assertEq(td.exitsLearningAtDaily, false, "testbudget+daily: never exits learning");

  const tb = computeTestBudget({ cpa: 60, budget: 1000 });
  assertEq(tb.eventsBudgetBuys, 16.7, "testbudget+budget: events bought");
  assertEq(tb.readableSignal, false, "testbudget+budget: below signal floor");
  assertEq(tb.budgetShortfall, 2000, "testbudget+budget: shortfall to floor");

  const tOk = computeTestBudget({ cpa: 10, budget: 500, signal: 50 });
  assertEq(tOk.eventsBudgetBuys, 50, "testbudget: budget exactly at floor");
  assertEq(tOk.readableSignal, true, "testbudget: floor met reads");
  assertEq(tOk.budgetShortfall, 0, "testbudget: no shortfall at floor");

  // --- abtest --------------------------------------------------------------------
  const ab = computeAbTest({ rate: 2, lift: 25 });
  assertEq(ab.liftedRatePct, 2.5, "abtest 2%+25%: lifted rate");
  assertEq(ab.visitorsPerArm, 14076, "abtest 2%+25%: n per arm (Lehr)");
  assertEq(ab.visitorsTotal, 28152, "abtest 2%+25%: total visitors");

  const abc = computeAbTest({ rate: 2, lift: 25, cpc: 3 });
  assertEq(abc.costTotal, 84456, "abtest+cpc: total cost of the read");

  const abBig = computeAbTest({ rate: 2, lift: 100 });
  assertEq(abBig.visitorsPerArm, 1164, "abtest 2%+100%: big lifts are cheap to read");

  const ab90 = computeAbTest({ rate: 2, lift: 100, power: 90 });
  assertEq(ab90.visitorsPerArm, 1528, "abtest 90% power: multiplier 21");

  // --- validation -----------------------------------------------------------------
  assertThrows(function () { computeCac({ spend: 0, customers: 10 }); }, "zero spend rejected");
  assertThrows(function () { computeCac({ spend: 1500, customers: 0 }); }, "zero customers rejected");
  assertThrows(function () { computeCac({ spend: 1500, customers: 10, variable: 5 }); }, "variable without price rejected");
  assertThrows(function () { computeCac({ spend: 1500, customers: 10, churn: 3 }); }, "churn without price rejected");
  assertThrows(function () { computeCac({ spend: 1500, customers: 10, price: 49, churn: 100 }); }, "churn of 100% rejected");
  assertThrows(function () { computeCac({ spend: 1500, customers: 10, price: 49, variable: 49 }); }, "cac: negative unit margin rejected");
  assertThrows(function () { computeBreakeven({ price: 49, variable: 50 }); }, "breakeven: variable above price rejected");
  assertThrows(function () { computeBreakeven({ price: 49, variable: 5, payback: 0 }); }, "zero payback rejected");
  assertThrows(function () { computeTestBudget({ cpa: 0 }); }, "zero cpa rejected");
  assertThrows(function () { computeTestBudget({ cpa: 60, budget: -1 }); }, "negative budget rejected");
  assertThrows(function () { computeAbTest({ rate: 60, lift: 80 }); }, "lifted rate above 100% rejected");
  assertThrows(function () { computeAbTest({ rate: 0, lift: 25 }); }, "zero baseline rate rejected");
  assertThrows(function () { computeAbTest({ rate: 2, lift: 25, power: 85 }); }, "power other than 80/90 rejected");

  // --- strict flags -----------------------------------------------------------------
  assertEq(unknownFlags({ custmers: "10", spend: "1500" }, ["spend", "customers", "price", "variable", "churn"]).join(","), "custmers", "typo'd flag detected as unknown");
  assertEq(unknownFlags({ spend: "1500", customers: "10" }, ["spend", "customers", "price", "variable", "churn"]).length, 0, "known flags pass the strict check");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: ads_calculator.js (CAC/payback, break-even ROAS, test-budget sizing, A/B sample math, and validation all hold)");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = [
  "usage: node ads_calculator.js cac --spend N --customers N [--price N] [--variable N] [--churn P]",
  "       node ads_calculator.js breakeven --price N [--variable N] [--payback M]",
  "       node ads_calculator.js testbudget --cpa N [--signal N] [--daily N] [--budget N]",
  "       node ads_calculator.js abtest --rate P --lift P [--cpc N] [--power 80|90]",
  "       node ads_calculator.js --selftest",
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
      "ads_calculator: unknown flag(s): " + unknown.map(function (k) { return "--" + k; }).join(", ") +
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
    console.error("ads_calculator: missing required flag(s): " + missing.join(", "));
    console.error(USAGE);
    process.exit(2);
  }
  if (invalid.length) {
    console.error("ads_calculator: not a number: " + invalid.join(", "));
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
    if (subcommand === "cac") {
      const p = requireNumericFlags(flags, ["spend", "customers"], ["price", "variable", "churn"]);
      result = computeCac(p);
    } else if (subcommand === "breakeven") {
      const p = requireNumericFlags(flags, ["price"], ["variable", "payback"]);
      result = computeBreakeven(p);
    } else if (subcommand === "testbudget") {
      const p = requireNumericFlags(flags, ["cpa"], ["signal", "daily", "budget"]);
      result = computeTestBudget(p);
    } else if (subcommand === "abtest") {
      const p = requireNumericFlags(flags, ["rate", "lift"], ["cpc", "power"]);
      result = computeAbTest(p);
    } else {
      console.error("ads_calculator: unknown subcommand '" + (subcommand || "") + "'");
      console.error(USAGE);
      process.exit(2);
    }
  } catch (e) {
    console.error("ads_calculator: " + e.message);
    process.exit(2);
  }

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { computeCac: computeCac, computeBreakeven: computeBreakeven, computeTestBudget: computeTestBudget, computeAbTest: computeAbTest };
