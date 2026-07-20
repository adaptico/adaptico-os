#!/usr/bin/env node
/**
 * GTM Score engine - deterministic composite scoring for /gtm audit (Adaptico OS).
 *
 * The division of labor: each audit vector's 0-100 score is an LLM judgment
 * against its rubric; this script owns everything after that - the weights,
 * the critical-findings cap, the rounding, and the grade banding. Same six
 * inputs, same composite, every run. The score is a method, not a vibe.
 *
 * Usage:
 *   node gtm_score.js --content 72 --conversion 65 --seo 70 \
 *                     --competitive 60 --brand 75 --growth 68 [--criticals N]
 *   node gtm_score.js --selftest
 *
 * Output: JSON with the composite, grade, band meaning, per-vector weighted
 * contributions, weakest/strongest vectors, and cap details.
 *
 * --criticals N = count of unresolved Critical findings from a critique pass
 * (default 0). One or more caps the composite at 69 (grade C): work standing
 * on a critical defect cannot grade "good", however strong the other vectors.
 *
 * Zero dependencies (Node standard library only).
 * Exit codes: 0 success; 2 usage error. Selftest: 0 pass, 1 fail.
 */

"use strict";

// Weights must sum to exactly 1.0 (asserted in --selftest).
const WEIGHTS = {
  content: 0.25,     // Content & Messaging
  conversion: 0.20,  // Conversion Optimization
  seo: 0.20,         // SEO & Discoverability
  competitive: 0.15, // Competitive Positioning
  brand: 0.10,       // Brand & Trust
  growth: 0.10,      // Growth & Strategy
};

const VECTOR_ORDER = ["content", "conversion", "seo", "competitive", "brand", "growth"];

const VECTOR_LABELS = {
  content: "Content & Messaging",
  conversion: "Conversion Optimization",
  seo: "SEO & Discoverability",
  competitive: "Competitive Positioning",
  brand: "Brand & Trust",
  growth: "Growth & Strategy",
};

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
 * scores: { content, conversion, seo, competitive, brand, growth } each 0-100.
 * criticals: integer >= 0.
 * Returns the result object, or throws Error on invalid input.
 */
function computeScore(scores, criticals) {
  criticals = criticals || 0;
  if (!Number.isInteger(criticals) || criticals < 0) {
    throw new Error("--criticals must be a non-negative integer");
  }

  const vectors = {};
  let weightedSum = 0;
  VECTOR_ORDER.forEach(function (key) {
    const v = scores[key];
    if (typeof v !== "number" || isNaN(v) || v < 0 || v > 100) {
      throw new Error("--" + key + " must be a number between 0 and 100 (got: " + v + ")");
    }
    const weighted = v * WEIGHTS[key];
    weightedSum += weighted;
    vectors[key] = {
      label: VECTOR_LABELS[key],
      score: v,
      weight: WEIGHTS[key],
      weighted: Math.round(weighted * 100) / 100,
    };
  });

  const uncapped = Math.round(weightedSum);
  const capApplied = criticals > 0 && uncapped > CRITICAL_CAP;
  const composite = capApplied ? CRITICAL_CAP : uncapped;
  const band = bandFor(composite);

  // Weakest/strongest by raw score; ties resolve to canonical vector order.
  let weakest = VECTOR_ORDER[0];
  let strongest = VECTOR_ORDER[0];
  VECTOR_ORDER.forEach(function (key) {
    if (scores[key] < scores[weakest]) weakest = key;
    if (scores[key] > scores[strongest]) strongest = key;
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
    return { content: v, conversion: v, seo: v, competitive: v, brand: v, growth: v };
  }

  // Weights must sum to exactly 1.0.
  const weightSum = VECTOR_ORDER.reduce(function (s, k) { return s + WEIGHTS[k]; }, 0);
  assertEq(Math.round(weightSum * 1000) / 1000, 1, "weights sum to 1.0");

  // Bounds.
  assertEq(computeScore(even(100), 0).composite, 100, "all 100 -> 100");
  assertEq(computeScore(even(100), 0).grade, "A", "all 100 -> A");
  assertEq(computeScore(even(0), 0).composite, 0, "all 0 -> 0");
  assertEq(computeScore(even(0), 0).grade, "F", "all 0 -> F");

  // Known mixed case: 72*.25 + 65*.2 + 70*.2 + 60*.15 + 75*.1 + 68*.1 = 68.3 -> 68 (C).
  const mixed = computeScore(
    { content: 72, conversion: 65, seo: 70, competitive: 60, brand: 75, growth: 68 }, 0
  );
  assertEq(mixed.composite, 68, "mixed case composite");
  assertEq(mixed.grade, "C", "mixed case grade");
  assertEq(mixed.weakest, "competitive", "mixed case weakest vector");
  assertEq(mixed.strongest, "brand", "mixed case strongest vector");

  // Weighting: content alone at 100 contributes 25 points.
  assertEq(
    computeScore({ content: 100, conversion: 0, seo: 0, competitive: 0, brand: 0, growth: 0 }, 0).composite,
    25, "content weight = 25%"
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

  // Critical cap: caps a high score at 69/C, reports the uncapped value.
  const capped = computeScore(even(90), 1);
  assertEq(capped.composite, 69, "1 critical caps 90 -> 69");
  assertEq(capped.grade, "C", "capped grade is C");
  assertEq(capped.uncapped, 90, "uncapped value preserved");
  assertEq(capped.capApplied, true, "capApplied true");

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
  try { computeScore({ content: 50 }, 0); } catch (e) { threw = true; }
  assertEq(threw, true, "missing vectors rejected");
  threw = false;
  try { computeScore(even(50), -1); } catch (e) { threw = true; }
  assertEq(threw, true, "negative criticals rejected");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: gtm_score.js (weights, bands, cap, and validation all hold)");
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

  const scores = {};
  const missing = [];
  const invalid = [];
  VECTOR_ORDER.forEach(function (key) {
    if (flags[key] === undefined) {
      missing.push("--" + key);
    } else if (!/^\d+(\.\d+)?$/.test(flags[key])) {
      invalid.push("--" + key + " '" + flags[key] + "'");
    } else {
      scores[key] = parseFloat(flags[key]);
    }
  });

  if (missing.length) {
    console.error("gtm_score: missing required flag(s): " + missing.join(", "));
    console.error("usage: node gtm_score.js --content N --conversion N --seo N --competitive N --brand N --growth N [--criticals N]");
    console.error("       node gtm_score.js --selftest");
    process.exit(2);
  }
  if (invalid.length) {
    console.error("gtm_score: not a plain number 0-100: " + invalid.join(", "));
    process.exit(2);
  }
  if (flags.criticals !== undefined && !/^\d+$/.test(flags.criticals)) {
    console.error("gtm_score: --criticals must be a non-negative integer (got: '" + flags.criticals + "')");
    process.exit(2);
  }

  const criticals = flags.criticals === undefined ? 0 : parseInt(flags.criticals, 10);

  let result;
  try {
    result = computeScore(scores, criticals);
  } catch (e) {
    console.error("gtm_score: " + e.message);
    process.exit(2);
  }

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { computeScore: computeScore, WEIGHTS: WEIGHTS, CRITICAL_CAP: CRITICAL_CAP };
