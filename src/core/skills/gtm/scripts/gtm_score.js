#!/usr/bin/env node
/**
 * GTM Score engine - deterministic composite scoring for /gtm audit (Adaptico OS).
 *
 * The division of labor: each audit vector's 0-100 score is an LLM judgment
 * against its rubric; this script owns everything after that - the weights,
 * the re-normalization when vectors are skipped or degraded, the
 * critical-findings cap, the rounding, and the grade banding. Same inputs,
 * same composite, every run. The score is a method, not a vibe.
 *
 * The six vectors mirror the methodology (what actually moves an early-stage
 * software startup), in journey order:
 *   positioning  Positioning Clarity          20%
 *   icp          ICP Focus                    15%
 *   conversion   Conversion (Primary Pages)   20%
 *   activation   Activation & Time-to-Value   15%
 *   channel      Channel Concentration        15%
 *   revenue      Revenue Quality              15%
 *
 * Every vector flag is REQUIRED and takes a number 0-100, or the literal
 * "skipped" (its signals don't exist on this site - conditional spawning) or
 * "degraded" (its agent failed validation twice). Excluded vectors are
 * reported, never silently dropped; the composite re-normalizes over the
 * scored vectors' weights and carries `weightCoverage` + `partial` so a
 * partial composite can never present itself as a full one.
 *
 * Usage:
 *   node gtm_score.js --positioning 78 --icp 82 --conversion 48 \
 *                     --activation 64 --channel 74 --revenue 72 [--criticals N]
 *   node gtm_score.js --positioning 70 --icp 65 --conversion 60 \
 *                     --activation skipped --channel 55 --revenue degraded
 *   node gtm_score.js --selftest
 *
 * Output: JSON with the composite, grade, band meaning, per-vector weighted
 * contributions, excluded vectors, coverage, weakest/strongest scored
 * vectors, and cap details.
 *
 * --criticals N = count of unresolved Critical findings from the critic gate
 * (default 0). One or more caps the composite at 69 (grade C): work standing
 * on a critical defect cannot grade "good", however strong the other vectors.
 *
 * Zero dependencies (Node standard library only).
 * Exit codes: 0 success; 2 usage error. Selftest: 0 pass, 1 fail.
 */

"use strict";

// Weights must sum to exactly 1.0 (asserted in --selftest).
const WEIGHTS = {
  positioning: 0.20, // Positioning Clarity
  icp: 0.15,         // ICP Focus
  conversion: 0.20,  // Conversion (Primary Pages)
  activation: 0.15,  // Activation & Time-to-Value
  channel: 0.15,     // Channel Concentration
  revenue: 0.15,     // Revenue Quality
};

const VECTOR_ORDER = ["positioning", "icp", "conversion", "activation", "channel", "revenue"];

const VECTOR_LABELS = {
  positioning: "Positioning Clarity",
  icp: "ICP Focus",
  conversion: "Conversion (Primary Pages)",
  activation: "Activation & Time-to-Value",
  channel: "Channel Concentration",
  revenue: "Revenue Quality",
};

const EXCLUDED_STATUSES = ["skipped", "degraded"];

// Grade bands on the (capped) composite.
const BANDS = [
  { min: 85, grade: "A", meaning: "Excellent - minor optimizations only" },
  { min: 70, grade: "B", meaning: "Good - clear opportunities for improvement" },
  { min: 55, grade: "C", meaning: "Average - significant gaps to address" },
  { min: 40, grade: "D", meaning: "Below average - major overhaul needed" },
  { min: 0,  grade: "F", meaning: "Critical - fundamental marketing issues" },
];

// One or more unresolved Critical findings caps the composite here (top of C).
const CRITICAL_CAP = 69;

function bandFor(score) {
  for (let i = 0; i < BANDS.length; i++) {
    if (score >= BANDS[i].min) return BANDS[i];
  }
  return BANDS[BANDS.length - 1];
}

/**
 * Pure scoring function.
 * inputs: { positioning, icp, conversion, activation, channel, revenue } -
 *   each a number 0-100, or "skipped", or "degraded". All six required:
 *   excluding a vector is a conscious act, never a forgotten flag.
 * criticals: integer >= 0.
 * Returns the result object, or throws Error on invalid input.
 */
function computeScore(inputs, criticals) {
  criticals = criticals || 0;
  if (!Number.isInteger(criticals) || criticals < 0) {
    throw new Error("--criticals must be a non-negative integer");
  }

  const vectors = {};
  const excluded = [];
  let weightedSum = 0;
  let coveredWeight = 0;

  VECTOR_ORDER.forEach(function (key) {
    const v = inputs[key];
    if (v === undefined) {
      throw new Error("--" + key + " is required (a number 0-100, or 'skipped', or 'degraded')");
    }
    if (typeof v === "string" && EXCLUDED_STATUSES.indexOf(v) !== -1) {
      excluded.push({ key: key, label: VECTOR_LABELS[key], status: v });
      vectors[key] = { label: VECTOR_LABELS[key], status: v, weight: WEIGHTS[key] };
      return;
    }
    if (typeof v !== "number" || isNaN(v) || v < 0 || v > 100) {
      throw new Error("--" + key + " must be a number between 0 and 100, or 'skipped'/'degraded' (got: " + v + ")");
    }
    const weighted = v * WEIGHTS[key];
    weightedSum += weighted;
    coveredWeight += WEIGHTS[key];
    vectors[key] = {
      label: VECTOR_LABELS[key],
      status: "scored",
      score: v,
      weight: WEIGHTS[key],
      weighted: Math.round(weighted * 100) / 100,
    };
  });

  if (coveredWeight === 0) {
    throw new Error("every vector is skipped/degraded - there is nothing to score");
  }

  // Re-normalize over the scored vectors' weights so a skipped vector never
  // silently drags the composite toward zero.
  const uncapped = Math.round(weightedSum / coveredWeight);
  const capApplied = criticals > 0 && uncapped > CRITICAL_CAP;
  const composite = capApplied ? CRITICAL_CAP : uncapped;
  const band = bandFor(composite);

  // Weakest/strongest among SCORED vectors; ties resolve to canonical order.
  const scoredKeys = VECTOR_ORDER.filter(function (k) { return vectors[k].status === "scored"; });
  let weakest = scoredKeys[0];
  let strongest = scoredKeys[0];
  scoredKeys.forEach(function (key) {
    if (vectors[key].score < vectors[weakest].score) weakest = key;
    if (vectors[key].score > vectors[strongest].score) strongest = key;
  });

  return {
    composite: composite,
    grade: band.grade,
    band: band.meaning,
    uncapped: uncapped,
    capApplied: capApplied,
    criticals: criticals,
    criticalCap: CRITICAL_CAP,
    vectors: vectors,
    excluded: excluded,
    scoredCount: scoredKeys.length,
    weightCoverage: Math.round(coveredWeight * 100) / 100,
    partial: coveredWeight < 1,
    weakest: weakest,
    strongest: strongest,
  };
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
  function even(v) {
    return { positioning: v, icp: v, conversion: v, activation: v, channel: v, revenue: v };
  }

  // Weights must sum to exactly 1.0.
  const weightSum = VECTOR_ORDER.reduce(function (s, k) { return s + WEIGHTS[k]; }, 0);
  assertEq(Math.round(weightSum * 1000) / 1000, 1, "weights sum to 1.0");

  // Bounds.
  assertEq(computeScore(even(100), 0).composite, 100, "all 100 -> 100");
  assertEq(computeScore(even(100), 0).grade, "A", "all 100 -> A");
  assertEq(computeScore(even(0), 0).composite, 0, "all 0 -> 0");
  assertEq(computeScore(even(0), 0).grade, "F", "all 0 -> F");

  // Known mixed case:
  // 78*.20 + 82*.15 + 48*.20 + 64*.15 + 74*.15 + 72*.15 = 69.0 -> 69 (C).
  const mixed = computeScore(
    { positioning: 78, icp: 82, conversion: 48, activation: 64, channel: 74, revenue: 72 }, 0
  );
  assertEq(mixed.composite, 69, "mixed case composite");
  assertEq(mixed.grade, "C", "mixed case grade");
  assertEq(mixed.weakest, "conversion", "mixed case weakest vector");
  assertEq(mixed.strongest, "icp", "mixed case strongest vector");
  assertEq(mixed.partial, false, "full coverage is not partial");

  // Weighting: positioning alone at 100 contributes 20 points.
  assertEq(
    computeScore({ positioning: 100, icp: 0, conversion: 0, activation: 0, channel: 0, revenue: 0 }, 0).composite,
    20, "positioning weight = 20%"
  );

  // Band edges.
  assertEq(computeScore(even(85), 0).grade, "A", "85 -> A");
  assertEq(computeScore(even(84), 0).grade, "B", "84 -> B");
  assertEq(computeScore(even(70), 0).grade, "B", "70 -> B");
  assertEq(computeScore(even(69), 0).grade, "C", "69 -> C");
  assertEq(computeScore(even(55), 0).grade, "C", "55 -> C");
  assertEq(computeScore(even(54), 0).grade, "D", "54 -> D");
  assertEq(computeScore(even(40), 0).grade, "D", "40 -> D");
  assertEq(computeScore(even(39), 0).grade, "F", "39 -> F");

  // Skipped vectors re-normalize: an even 80 stays 80 with two vectors out.
  const skipped = computeScore(
    { positioning: 80, icp: 80, conversion: 80, activation: "skipped", channel: 80, revenue: "skipped" }, 0
  );
  assertEq(skipped.composite, 80, "skips re-normalize (even 80 stays 80)");
  assertEq(skipped.partial, true, "skips mark the composite partial");
  assertEq(skipped.weightCoverage, 0.7, "coverage reflects scored weights");
  assertEq(skipped.scoredCount, 4, "scored count excludes skips");
  assertEq(skipped.excluded.length, 2, "excluded lists both vectors");
  assertEq(skipped.excluded[0].status, "skipped", "excluded carries status");

  // Re-normalized mix: 90*.20 + 60*.20 over 0.40 coverage -> 75.
  const twoVector = computeScore(
    { positioning: 90, icp: "skipped", conversion: 60, activation: "skipped", channel: "skipped", revenue: "skipped" }, 0
  );
  assertEq(twoVector.composite, 75, "two-vector re-normalized composite");
  assertEq(twoVector.weightCoverage, 0.4, "two-vector coverage");

  // Degraded is excluded like skipped, but labeled degraded.
  const degraded = computeScore(
    { positioning: 70, icp: 70, conversion: 70, activation: 70, channel: 70, revenue: "degraded" }, 0
  );
  assertEq(degraded.composite, 70, "degraded vector excluded from math");
  assertEq(degraded.excluded[0].status, "degraded", "degraded status preserved");
  assertEq(degraded.vectors.revenue.status, "degraded", "vector entry keeps degraded status");

  // Weakest/strongest ignore excluded vectors.
  const wk = computeScore(
    { positioning: "skipped", icp: 40, conversion: 90, activation: 50, channel: 60, revenue: 70 }, 0
  );
  assertEq(wk.weakest, "icp", "weakest among scored only");
  assertEq(wk.strongest, "conversion", "strongest among scored only");

  // Critical cap: caps a high score at 69/C, reports the uncapped value.
  const capped = computeScore(even(90), 1);
  assertEq(capped.composite, 69, "1 critical caps 90 -> 69");
  assertEq(capped.grade, "C", "capped grade is C");
  assertEq(capped.uncapped, 90, "uncapped value preserved");
  assertEq(capped.capApplied, true, "capApplied true");

  // Cap applies to a partial composite too.
  const cappedPartial = computeScore(
    { positioning: 90, icp: 90, conversion: 90, activation: "skipped", channel: 90, revenue: 90 }, 2
  );
  assertEq(cappedPartial.composite, 69, "cap fires on a partial composite");
  assertEq(cappedPartial.partial, true, "partial flag survives the cap");

  // Cap never raises a score already at or below it.
  const low = computeScore(even(65), 2);
  assertEq(low.composite, 65, "cap does not raise a 65");
  assertEq(low.capApplied, false, "capApplied false at/below the cap");
  assertEq(low.criticals, 2, "criticals still reported");

  // Zero criticals never caps.
  assertEq(computeScore(even(90), 0).capApplied, false, "no criticals, no cap");

  // Input validation.
  let threw = false;
  try { computeScore(even(101), 0); } catch (e) { threw = true; }
  assertEq(threw, true, "score > 100 rejected");
  threw = false;
  try { computeScore({ positioning: 50 }, 0); } catch (e) { threw = true; }
  assertEq(threw, true, "missing vectors rejected");
  threw = false;
  try { computeScore(even(50), -1); } catch (e) { threw = true; }
  assertEq(threw, true, "negative criticals rejected");
  threw = false;
  try {
    computeScore(
      { positioning: "skipped", icp: "skipped", conversion: "degraded", activation: "skipped", channel: "skipped", revenue: "skipped" }, 0
    );
  } catch (e) { threw = true; }
  assertEq(threw, true, "all vectors excluded rejected");
  threw = false;
  try { computeScore(Object.assign(even(50), { icp: "maybe" }), 0); } catch (e) { threw = true; }
  assertEq(threw, true, "unknown status string rejected");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: gtm_score.js (weights, re-normalization, bands, cap, and validation all hold)");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.indexOf("--selftest") !== -1) {
    selftest();
    return;
  }

  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].slice(0, 2) === "--") {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }

  const inputs = {};
  const missing = [];
  const invalid = [];
  VECTOR_ORDER.forEach(function (key) {
    if (flags[key] === undefined) {
      missing.push("--" + key);
    } else if (EXCLUDED_STATUSES.indexOf(flags[key]) !== -1) {
      inputs[key] = flags[key];
    } else if (!/^\d+(\.\d+)?$/.test(flags[key])) {
      invalid.push("--" + key + " '" + flags[key] + "'");
    } else {
      inputs[key] = parseFloat(flags[key]);
    }
  });

  if (missing.length) {
    console.error("gtm_score: missing required flag(s): " + missing.join(", "));
    console.error("usage: node gtm_score.js --positioning N --icp N --conversion N --activation N --channel N --revenue N [--criticals N]");
    console.error("       (each vector takes a number 0-100, or 'skipped', or 'degraded')");
    console.error("       node gtm_score.js --selftest");
    process.exit(2);
  }
  if (invalid.length) {
    console.error("gtm_score: must be a number 0-100, or 'skipped'/'degraded': " + invalid.join(", "));
    process.exit(2);
  }
  if (flags.criticals !== undefined && !/^\d+$/.test(flags.criticals)) {
    console.error("gtm_score: --criticals must be a non-negative integer (got: '" + flags.criticals + "')");
    process.exit(2);
  }

  const criticals = flags.criticals === undefined ? 0 : parseInt(flags.criticals, 10);

  let result;
  try {
    result = computeScore(inputs, criticals);
  } catch (e) {
    console.error("gtm_score: " + e.message);
    process.exit(2);
  }

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { computeScore: computeScore, WEIGHTS: WEIGHTS, CRITICAL_CAP: CRITICAL_CAP, VECTOR_ORDER: VECTOR_ORDER, VECTOR_LABELS: VECTOR_LABELS };
