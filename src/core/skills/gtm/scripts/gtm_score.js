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
 * The seven vectors mirror the methodology (what actually moves an early-stage
 * software startup), in journey order:
 *   positioning  Positioning Clarity          18%
 *   icp          ICP Focus                    14%
 *   conversion   Conversion (Primary Pages)   18%
 *   activation   Activation & Time-to-Value   14%
 *   channel      Channel Concentration        13%
 *   geo          AI-Search Readiness          10%
 *   revenue      Revenue Quality              13%
 *
 * geo entered the composite in audit 2.1: it scores the site's cheap,
 * observable groundwork for AI-answer surfaces (crawler access, extractable
 * copy, structure, server-rendered visibility) - readiness, never rank or
 * citation performance, which stay evidence-only in /gtm geo.
 *
 * Each vector is a number 0-100, "skipped" (no signals on this site - a
 * vector skip) or "degraded" (its agent failed the check twice). Excluded vectors are
 * reported, never silently dropped; the composite re-normalizes over the
 * scored vectors' weights and carries `weightCoverage` + `partial` so a
 * partial composite can never present itself as a full one.
 *
 * Two ways in:
 *
 *   --agents <dir>  the audit's path. Reads the five audit agents' saved replies
 *                   (<dir>/gtm-competitive.json, gtm-content.json,
 *                   gtm-conversion.json, gtm-strategy.json, gtm-technical.json),
 *                   checks each with gtm-audit's validate_agent_output.js, and
 *                   takes the vector scores and skips from the checked replies.
 *                   While any reply is missing or fails the check it scores
 *                   nothing, exits 1, and prints the problems to quote back on
 *                   the agent's one re-run. --degraded <agent> (repeatable, or
 *                   comma-separated) marks an agent whose re-run also failed;
 *                   its vectors are excluded as "degraded". A reply that passes
 *                   the check cannot be marked degraded.
 *   seven vector flags  re-scoring a saved audit by hand (the critic's Score
 *                   Impact line): all seven required, each a number 0-100,
 *                   "skipped" or "degraded".
 *
 * Any other flag is refused, so a mistyped --criticals cannot drop the cap.
 *
 * Usage:
 *   node gtm_score.js --agents <dir> [--degraded gtm-strategy] [--criticals N]
 *   node gtm_score.js --positioning 78 --icp 82 --conversion 48 \
 *                     --activation 64 --channel 74 --geo 60 --revenue 72 [--criticals N]
 *   node gtm_score.js --selftest
 *
 * Output: JSON with the composite, grade, band meaning, per-vector weighted
 * contributions, excluded vectors, coverage, weakest/strongest scored
 * vectors, and cap details; --agents adds each agent's status (valid or
 * degraded).
 *
 * --criticals N = count of unresolved Critical findings from the critic gate
 * (default 0). One or more caps the composite at 69 (grade C): work standing
 * on a critical defect cannot grade "good", however strong the other vectors.
 *
 * Zero dependencies (Node standard library only).
 * Exit codes: 0 success; 1 an agent reply is missing or fails the check
 * (--agents); 2 usage error. Selftest: 0 pass, 1 fail.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Weights must sum to exactly 1.0 (asserted in --selftest).
const WEIGHTS = {
  positioning: 0.18, // Positioning Clarity
  icp: 0.14,         // ICP Focus
  conversion: 0.18,  // Conversion (Primary Pages)
  activation: 0.14,  // Activation & Time-to-Value
  channel: 0.13,     // Channel Concentration
  geo: 0.10,         // AI-Search Readiness (audit 2.1 - groundwork, not rank)
  revenue: 0.13,     // Revenue Quality
};

const VECTOR_ORDER = ["positioning", "icp", "conversion", "activation", "channel", "geo", "revenue"];

const VECTOR_LABELS = {
  positioning: "Positioning Clarity",
  icp: "ICP Focus",
  conversion: "Conversion (Primary Pages)",
  activation: "Activation & Time-to-Value",
  channel: "Channel Concentration",
  geo: "AI-Search Readiness",
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
 * inputs: { positioning, icp, conversion, activation, channel, geo, revenue } -
 *   each a number 0-100, or "skipped", or "degraded". All seven required:
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
// Scoring from the audit agents' saved replies (--agents)
// ---------------------------------------------------------------------------

function loadValidator() {
  const p = path.join(__dirname, "..", "..", "gtm-audit", "scripts", "validate_agent_output.js");
  if (!fs.existsSync(p)) {
    throw new Error("--agents needs gtm-audit's validate_agent_output.js in the same skills directory (looked for " + p + ")");
  }
  return require(p);
}

/**
 * Pure: scores an audit from its agents' raw replies, checking each first.
 * raws: { "<agent>": raw reply string, or null when no reply was saved }.
 * degraded: agent names whose re-run also failed the check.
 * validator: the gtm-audit validator module.
 * Returns { result, problems }; when problems is non-empty, result is null.
 */
function scoreFromAgents(raws, degraded, criticals, validator) {
  const problems = [];
  const inputs = {};
  const agents = {};
  const reasons = {};
  const names = Object.keys(validator.AGENT_VECTORS);

  degraded.forEach(function (a) {
    if (names.indexOf(a) === -1) {
      problems.push("--degraded " + a + ": not an audit agent (one of: " + names.join(", ") + ")");
    }
  });

  names.forEach(function (agent) {
    const owned = validator.AGENT_VECTORS[agent];
    const raw = raws[agent];
    const check = raw === null || raw === undefined ? null : validator.validateAgentOutput(raw);
    const passes = check !== null && check.errors.length === 0 && check.summary.agent === agent;

    if (degraded.indexOf(agent) !== -1) {
      if (passes) {
        problems.push(agent + ": its reply passes the check - score it instead of marking it degraded");
        return;
      }
      owned.forEach(function (k) { inputs[k] = "degraded"; });
      agents[agent] = "degraded";
      return;
    }
    if (check === null) {
      problems.push(agent + ": no saved reply - save it as " + agent + ".json in the agents folder (if its re-run also failed, pass --degraded " + agent + ")");
      return;
    }
    if (check.errors.length) {
      problems.push(agent + ": reply failed the check:");
      check.errors.forEach(function (e) { problems.push("    - " + e); });
      return;
    }
    if (check.summary.agent !== agent) {
      problems.push(agent + ".json holds " + check.summary.agent + "'s reply - save each agent's reply under its own name");
      return;
    }
    owned.forEach(function (k) {
      if (check.summary.skipped.indexOf(k) !== -1) {
        inputs[k] = "skipped";
        reasons[k] = check.summary.skip_reasons[k];
      } else {
        inputs[k] = check.summary.scores[k];
      }
    });
    agents[agent] = "valid";
  });

  if (problems.length) return { result: null, problems: problems };
  let result;
  try {
    result = computeScore(inputs, criticals);
  } catch (e) {
    return { result: null, problems: [e.message] };
  }
  result.agents = agents;
  Object.keys(reasons).forEach(function (k) {
    result.vectors[k].reason = reasons[k];
    result.excluded.forEach(function (x) { if (x.key === k) x.reason = reasons[k]; });
  });
  return { result: result, problems: [] };
}

function readAgentReplies(dir, names) {
  const raws = {};
  const unreadable = [];
  names.forEach(function (agent) {
    const file = path.join(dir, agent + ".json");
    if (!fs.existsSync(file)) {
      raws[agent] = null;
      return;
    }
    try {
      raws[agent] = fs.readFileSync(file, "utf8");
    } catch (e) {
      unreadable.push(agent + ": cannot read " + file + " (" + e.code + ")");
    }
  });
  return { raws: raws, unreadable: unreadable };
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
    return { positioning: v, icp: v, conversion: v, activation: v, channel: v, geo: v, revenue: v };
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
  // 78*.18 + 82*.14 + 48*.18 + 64*.14 + 74*.13 + 60*.10 + 72*.13 = 68.10 -> 68 (C).
  const mixed = computeScore(
    { positioning: 78, icp: 82, conversion: 48, activation: 64, channel: 74, geo: 60, revenue: 72 }, 0
  );
  assertEq(mixed.composite, 68, "mixed case composite");
  assertEq(mixed.grade, "C", "mixed case grade");
  assertEq(mixed.weakest, "conversion", "mixed case weakest vector");
  assertEq(mixed.strongest, "icp", "mixed case strongest vector");
  assertEq(mixed.partial, false, "full coverage is not partial");

  // Weighting: positioning alone at 100 contributes 18 points; geo alone 10.
  assertEq(
    computeScore({ positioning: 100, icp: 0, conversion: 0, activation: 0, channel: 0, geo: 0, revenue: 0 }, 0).composite,
    18, "positioning weight = 18%"
  );
  assertEq(
    computeScore({ positioning: 0, icp: 0, conversion: 0, activation: 0, channel: 0, geo: 100, revenue: 0 }, 0).composite,
    10, "geo weight = 10%"
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
    { positioning: 80, icp: 80, conversion: 80, activation: "skipped", channel: 80, geo: 80, revenue: "skipped" }, 0
  );
  assertEq(skipped.composite, 80, "skips re-normalize (even 80 stays 80)");
  assertEq(skipped.partial, true, "skips mark the composite partial");
  assertEq(skipped.weightCoverage, 0.73, "coverage reflects scored weights");
  assertEq(skipped.scoredCount, 5, "scored count excludes skips");
  assertEq(skipped.excluded.length, 2, "excluded lists both vectors");
  assertEq(skipped.excluded[0].status, "skipped", "excluded carries status");

  // Re-normalized mix: 90*.18 + 60*.18 over 0.36 coverage -> 75.
  const twoVector = computeScore(
    { positioning: 90, icp: "skipped", conversion: 60, activation: "skipped", channel: "skipped", geo: "skipped", revenue: "skipped" }, 0
  );
  assertEq(twoVector.composite, 75, "two-vector re-normalized composite");
  assertEq(twoVector.weightCoverage, 0.36, "two-vector coverage");

  // Degraded is excluded like skipped, but labeled degraded.
  const degraded = computeScore(
    { positioning: 70, icp: 70, conversion: 70, activation: 70, channel: 70, geo: 70, revenue: "degraded" }, 0
  );
  assertEq(degraded.composite, 70, "degraded vector excluded from math");
  assertEq(degraded.excluded[0].status, "degraded", "degraded status preserved");
  assertEq(degraded.vectors.revenue.status, "degraded", "vector entry keeps degraded status");

  // Weakest/strongest ignore excluded vectors.
  const wk = computeScore(
    { positioning: "skipped", icp: 40, conversion: 90, activation: 50, channel: 60, geo: 55, revenue: 70 }, 0
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
    { positioning: 90, icp: 90, conversion: 90, activation: "skipped", channel: 90, geo: 90, revenue: 90 }, 2
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
      { positioning: "skipped", icp: "skipped", conversion: "degraded", activation: "skipped", channel: "skipped", geo: "skipped", revenue: "skipped" }, 0
    );
  } catch (e) { threw = true; }
  assertEq(threw, true, "all vectors excluded rejected");
  threw = false;
  try { computeScore(Object.assign(even(50), { icp: "maybe" }), 0); } catch (e) { threw = true; }
  assertEq(threw, true, "unknown status string rejected");

  // --agents: scores come only from replies that pass gtm-audit's check.
  let validator = null;
  try { validator = loadValidator(); } catch (e) { failures.push("--agents selftest: " + e.message); }
  if (validator) {
    const reply = function (agent, vectors) {
      return JSON.stringify({ agent: agent, vectors: vectors, findings: [], data_gaps: [] });
    };
    const replySet = function (s) {
      return {
        "gtm-competitive": reply("gtm-competitive", { positioning: { score: s.positioning, summary: "x" } }),
        "gtm-content": reply("gtm-content", { icp: { score: s.icp, summary: "x" } }),
        "gtm-conversion": reply("gtm-conversion", { conversion: { score: s.conversion, summary: "x" }, activation: { score: s.activation, summary: "x" } }),
        "gtm-strategy": reply("gtm-strategy", { channel: { score: s.channel, summary: "x" }, revenue: { score: s.revenue, summary: "x" } }),
        "gtm-technical": reply("gtm-technical", { geo: { score: s.geo, summary: "x" } }),
      };
    };
    const mixedSet = function () {
      return replySet({ positioning: 78, icp: 82, conversion: 48, activation: 64, channel: 74, geo: 60, revenue: 72 });
    };

    const ok = scoreFromAgents(mixedSet(), [], 0, validator);
    assertEq(ok.problems.length, 0, "agents: five passing replies score");
    assertEq(ok.result && ok.result.composite, 68, "agents: same composite as the mixed case");
    assertEq(ok.result && ok.result.agents["gtm-content"], "valid", "agents: status reported");

    const fenced = mixedSet();
    fenced["gtm-content"] = "Done.\n```json\n" + fenced["gtm-content"] + "\n```";
    assertEq(scoreFromAgents(fenced, [], 0, validator).problems.length, 0, "agents: fenced reply accepted");

    const skip = mixedSet();
    skip["gtm-conversion"] = reply("gtm-conversion", { conversion: { score: 48, summary: "x" }, activation: { skipped: "waitlist only" } });
    const sk = scoreFromAgents(skip, [], 0, validator);
    assertEq(sk.result && sk.result.vectors.activation.status, "skipped", "agents: a skip in the reply is a skip");
    assertEq(sk.result && sk.result.partial, true, "agents: a skip makes the composite partial");
    assertEq(sk.result && sk.result.vectors.activation.reason, "waitlist only", "agents: the skip reason is carried");
    assertEq(sk.result && sk.result.excluded[0].reason, "waitlist only", "agents: excluded lists the skip reason");

    const missing = mixedSet();
    missing["gtm-technical"] = null;
    const ms = scoreFromAgents(missing, [], 0, validator);
    assertEq(ms.result, null, "agents: a missing reply scores nothing");
    assertEq(ms.problems.some(function (p) { return p.indexOf("gtm-technical: no saved reply") === 0; }), true, "agents: the missing agent is named");

    const bad = mixedSet();
    bad["gtm-content"] = reply("gtm-content", { icp: { score: 140, summary: "x" } });
    const bd = scoreFromAgents(bad, [], 0, validator);
    assertEq(bd.result, null, "agents: a failing reply scores nothing");
    assertEq(bd.problems.some(function (p) { return p.indexOf("0-100") !== -1; }), true, "agents: the check's errors are passed on");

    const deg = mixedSet();
    deg["gtm-strategy"] = "not json";
    const dg = scoreFromAgents(deg, ["gtm-strategy"], 0, validator);
    assertEq(dg.problems.length, 0, "agents: a failing reply can be marked degraded");
    assertEq(dg.result && dg.result.vectors.channel.status, "degraded", "agents: degraded agent's vectors excluded");
    assertEq(dg.result && dg.result.vectors.revenue.status, "degraded", "agents: both owned vectors degraded");

    const degMissing = mixedSet();
    degMissing["gtm-strategy"] = null;
    assertEq(scoreFromAgents(degMissing, ["gtm-strategy"], 0, validator).problems.length, 0, "agents: a missing reply can be marked degraded");

    assertEq(scoreFromAgents(mixedSet(), ["gtm-content"], 0, validator).result, null, "agents: a passing reply cannot be marked degraded");
    assertEq(scoreFromAgents(mixedSet(), ["gtm-audit"], 0, validator).result, null, "agents: an unknown --degraded name is refused");
    const allDeg = scoreFromAgents({}, Object.keys(validator.AGENT_VECTORS), 0, validator);
    assertEq(allDeg.result === null && allDeg.problems.length === 1, true, "agents: all five degraded is a problem, not a crash");

    const swapped = mixedSet();
    swapped["gtm-content"] = swapped["gtm-competitive"];
    assertEq(scoreFromAgents(swapped, [], 0, validator).result, null, "agents: a reply saved under another agent's name is refused");

    const high = replySet({ positioning: 95, icp: 95, conversion: 95, activation: 95, channel: 95, geo: 95, revenue: 95 });
    const hc = scoreFromAgents(high, [], 1, validator);
    assertEq(hc.result && hc.result.composite, 69, "agents: the criticals cap applies");
    assertEq(hc.result && hc.result.uncapped, 95, "agents: the uncapped value is kept");
  }

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: gtm_score.js (weights, re-normalization, bands, cap, validation, and --agents all hold)");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = [
  "usage: node gtm_score.js --agents <dir> [--degraded <agent>] [--criticals N]",
  "       node gtm_score.js --positioning N --icp N --conversion N --activation N --channel N --geo N --revenue N [--criticals N]",
  "       (each vector takes a number 0-100, or 'skipped', or 'degraded')",
  "       node gtm_score.js --selftest",
].join("\n");

function main() {
  const args = process.argv.slice(2);
  if (args.indexOf("--selftest") !== -1) {
    selftest();
    return;
  }
  if (args.indexOf("--help") !== -1 || args.indexOf("-h") !== -1) {
    console.log(USAGE);
    return;
  }

  const flags = {};
  const degraded = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].slice(0, 2) === "--") {
      const name = args[i].slice(2);
      const value = args[i + 1];
      if (value !== undefined && value.slice(0, 2) === "--") {
        console.error("gtm_score: --" + name + " needs a value (got the next flag, " + value + ")");
        process.exit(2);
      }
      if (name === "degraded") {
        String(value === undefined ? "" : value).split(",").forEach(function (a) {
          if (a.trim()) degraded.push(a.trim());
        });
      } else {
        flags[name] = value;
      }
      i++;
    } else {
      console.error("gtm_score: unexpected argument '" + args[i] + "' - every value follows its --flag");
      process.exit(2);
    }
  }

  const known = ["agents", "criticals"].concat(VECTOR_ORDER);
  const unknown = Object.keys(flags).filter(function (n) { return known.indexOf(n) === -1; });
  if (unknown.length) {
    console.error("gtm_score: unknown flag(s): --" + unknown.join(", --") + " (known: --agents, --degraded, --criticals, the seven vectors, --selftest, --help)");
    process.exit(2);
  }

  if ("criticals" in flags && (flags.criticals === undefined || !/^\d+$/.test(flags.criticals))) {
    console.error("gtm_score: --criticals must be a non-negative integer (got: " + (flags.criticals === undefined ? "nothing" : "'" + flags.criticals + "'") + ")");
    process.exit(2);
  }
  const criticals = flags.criticals === undefined ? 0 : parseInt(flags.criticals, 10);

  if ("agents" in flags) {
    const mixed = VECTOR_ORDER.filter(function (k) { return flags[k] !== undefined; });
    if (mixed.length) {
      console.error("gtm_score: pass either --agents or the seven vector flags, not both (got --agents with --" + mixed.join(", --") + ")");
      process.exit(2);
    }
    if (!flags.agents || !fs.existsSync(flags.agents) || !fs.statSync(flags.agents).isDirectory()) {
      console.error("gtm_score: --agents needs the folder holding the five agents' saved replies (got: " + (flags.agents === undefined ? "nothing" : "'" + flags.agents + "'") + ")");
      process.exit(2);
    }
    let validator;
    try {
      validator = loadValidator();
    } catch (e) {
      console.error("gtm_score: " + e.message);
      process.exit(2);
    }
    const read = readAgentReplies(flags.agents, Object.keys(validator.AGENT_VECTORS));
    const scored = read.unreadable.length
      ? { result: null, problems: read.unreadable }
      : scoreFromAgents(read.raws, degraded, criticals, validator);
    if (scored.problems.length) {
      console.error("NOT SCORED - fix these, then run the same command again:");
      scored.problems.forEach(function (p) { console.error("  " + p); });
      console.error("A launched agent's reply that failed the check gets one re-run with these errors quoted; if the re-run fails too, add --degraded <agent>. A reply the session wrote itself is fixed until it passes.");
      process.exit(1);
    }
    console.log(JSON.stringify(scored.result, null, 2));
    return;
  }
  if (degraded.length) {
    console.error("gtm_score: --degraded works with --agents; by hand, pass the vector itself as 'degraded'");
    process.exit(2);
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
    console.error(USAGE);
    process.exit(2);
  }
  if (invalid.length) {
    console.error("gtm_score: must be a number 0-100, or 'skipped'/'degraded': " + invalid.join(", "));
    process.exit(2);
  }

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

module.exports = { computeScore: computeScore, scoreFromAgents: scoreFromAgents, WEIGHTS: WEIGHTS, CRITICAL_CAP: CRITICAL_CAP, VECTOR_ORDER: VECTOR_ORDER, VECTOR_LABELS: VECTOR_LABELS };
