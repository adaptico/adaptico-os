#!/usr/bin/env node
/**
 * Agent-output validator for /gtm audit (Adaptico OS).
 *
 * Each of the 5 audit subagents must return one JSON object matching the
 * output contract in its agent file. This script is the deterministic gate
 * between agents and synthesis: the audit validates every agent's JSON here
 * BEFORE using it. A malformed agent is re-run once with the errors below
 * quoted back to it; if it fails again, its vector(s) are scored as
 * "degraded" - reported, never silently dropped.
 *
 * Contract checked (extra fields are allowed and ignored):
 *   - agent: one of the 5 agent names
 *   - vectors: exactly the vectors that agent owns; each entry is either
 *       { "score": 0-100, "summary": "..." }  or  { "skipped": "reason" }
 *     (gtm-technical owns none - its vectors must be {})
 *   - findings: array; each with severity critical|major|minor and
 *     non-empty area, issue, evidence, fix, impact strings
 *   - data_gaps: array of non-empty strings (may be empty - but must exist:
 *     "no gaps" is a claim, not an omission)
 *
 * Usage:
 *   node validate_agent_output.js <file.json>
 *   node validate_agent_output.js < agent-output.json   (stdin)
 *   node validate_agent_output.js --selftest
 *
 * Output: on success, one JSON summary line (agent, scored/skipped vectors,
 * finding counts) on stdout, exit 0. On contract violations, each problem
 * on stderr in plain language (quote these back to the agent on its re-run),
 * exit 1. Usage errors exit 2. Selftest: 0 pass, 1 fail.
 *
 * Zero dependencies (Node standard library only).
 */

"use strict";

const fs = require("fs");

// Which composite vectors each agent owns (must all appear in its output).
const AGENT_VECTORS = {
  "gtm-content": ["icp"],
  "gtm-conversion": ["conversion", "activation"],
  "gtm-competitive": ["positioning"],
  "gtm-technical": [],
  "gtm-strategy": ["channel", "revenue"],
};

const SEVERITIES = ["critical", "major", "minor"];

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Pure validation. Returns { errors: [..], summary: {..}|null }.
 * raw: the agent's output string (may be the bare JSON, or contain one
 * fenced ```json block - the last fenced block wins, so agents that echo
 * the contract example earlier in prose still validate on their real output).
 */
function validateAgentOutput(raw) {
  const errors = [];

  // Accept a bare JSON document or extract the last fenced code block.
  let text = String(raw).trim();
  const fences = text.match(/```(?:json)?\s*\r?\n([\s\S]*?)```/g);
  if (fences && fences.length) {
    const last = fences[fences.length - 1];
    text = last.replace(/^```(?:json)?\s*\r?\n/, "").replace(/```$/, "").trim();
  }

  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    return { errors: ["output is not valid JSON: " + e.message], summary: null };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { errors: ["output must be a single JSON object"], summary: null };
  }

  // agent
  const agent = obj.agent;
  if (!isNonEmptyString(agent) || !(agent in AGENT_VECTORS)) {
    errors.push("'agent' must be one of: " + Object.keys(AGENT_VECTORS).join(", ") + " (got: " + JSON.stringify(agent) + ")");
    return { errors: errors, summary: null };
  }
  const owned = AGENT_VECTORS[agent];

  // vectors
  const scored = [];
  const skipped = [];
  if (typeof obj.vectors !== "object" || obj.vectors === null || Array.isArray(obj.vectors)) {
    errors.push("'vectors' must be an object" + (owned.length ? "" : " (empty {} for " + agent + ")"));
  } else {
    const keys = Object.keys(obj.vectors);
    keys.forEach(function (k) {
      if (owned.indexOf(k) === -1) {
        errors.push("'vectors." + k + "' does not belong to " + agent + " (it owns: " + (owned.join(", ") || "none") + ")");
      }
    });
    owned.forEach(function (k) {
      const v = obj.vectors[k];
      if (v === undefined) {
        errors.push("'vectors." + k + "' is missing - score it, or return { \"skipped\": \"reason\" }");
        return;
      }
      if (typeof v !== "object" || v === null || Array.isArray(v)) {
        errors.push("'vectors." + k + "' must be an object with score+summary, or a skipped reason");
        return;
      }
      if (v.skipped !== undefined) {
        if (!isNonEmptyString(v.skipped)) {
          errors.push("'vectors." + k + ".skipped' must be a non-empty reason string");
        } else {
          skipped.push(k);
        }
        return;
      }
      let vectorClean = true;
      if (typeof v.score !== "number" || isNaN(v.score) || v.score < 0 || v.score > 100) {
        errors.push("'vectors." + k + ".score' must be a number 0-100 (got: " + JSON.stringify(v.score) + ")");
        vectorClean = false;
      }
      if (!isNonEmptyString(v.summary)) {
        errors.push("'vectors." + k + ".summary' must be a non-empty one-line string");
        vectorClean = false;
      }
      if (vectorClean) scored.push(k);
    });
  }

  // findings
  const counts = { critical: 0, major: 0, minor: 0 };
  if (!Array.isArray(obj.findings)) {
    errors.push("'findings' must be an array (empty [] when there are none)");
  } else {
    obj.findings.forEach(function (f, i) {
      const where = "findings[" + i + "]";
      if (typeof f !== "object" || f === null) {
        errors.push(where + " must be an object");
        return;
      }
      if (SEVERITIES.indexOf(f.severity) === -1) {
        errors.push(where + ".severity must be one of: " + SEVERITIES.join(", ") + " (got: " + JSON.stringify(f.severity) + ")");
      } else {
        counts[f.severity] += 1;
      }
      ["area", "issue", "evidence", "fix", "impact"].forEach(function (key) {
        if (!isNonEmptyString(f[key])) {
          errors.push(where + "." + key + " must be a non-empty string - a finding without " + key + " is not usable");
        }
      });
    });
  }

  // data_gaps
  if (!Array.isArray(obj.data_gaps)) {
    errors.push("'data_gaps' must be an array of strings (empty [] means 'no gaps' - say so explicitly)");
  } else {
    obj.data_gaps.forEach(function (g, i) {
      if (!isNonEmptyString(g)) errors.push("data_gaps[" + i + "] must be a non-empty string");
    });
  }

  if (errors.length) return { errors: errors, summary: null };
  return {
    errors: [],
    summary: {
      valid: true,
      agent: agent,
      scored: scored,
      skipped: skipped,
      findings: counts,
      data_gaps: obj.data_gaps.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Selftest
// ---------------------------------------------------------------------------

function selftest() {
  const failures = [];
  function check(label, raw, expectValid, expectErrorPart) {
    const r = validateAgentOutput(raw);
    const valid = r.errors.length === 0;
    if (valid !== expectValid) {
      failures.push(label + ": expected valid=" + expectValid + ", got errors: " + JSON.stringify(r.errors));
      return r;
    }
    if (!expectValid && expectErrorPart) {
      const hit = r.errors.some(function (e) { return e.indexOf(expectErrorPart) !== -1; });
      if (!hit) failures.push(label + ": no error mentions '" + expectErrorPart + "' in " + JSON.stringify(r.errors));
    }
    return r;
  }

  const goodContent = {
    agent: "gtm-content",
    vectors: { icp: { score: 62, summary: "Speaks to 'teams' - no named reader." } },
    findings: [{ severity: "major", area: "Homepage hero", issue: "Generic audience", evidence: "\"Built for modern teams\"", fix: "Name the ICP in the H1", impact: "Right reader bounces" }],
    data_gaps: ["traffic split - not observable from public pages"],
  };
  const r1 = check("valid content output", JSON.stringify(goodContent), true);
  if (r1.summary && r1.summary.scored.join(",") !== "icp") failures.push("valid content: scored should be [icp]");

  // Fenced block extraction (last block wins).
  check("fenced json extracted",
    "Analysis done.\n```json\n" + JSON.stringify(goodContent) + "\n```", true);

  check("not json", "hello there", false, "not valid JSON");
  check("wrong agent", JSON.stringify(Object.assign({}, goodContent, { agent: "gtm-audit" })), false, "'agent'");

  const foreign = JSON.parse(JSON.stringify(goodContent));
  foreign.vectors.positioning = { score: 50, summary: "x" };
  check("foreign vector rejected", JSON.stringify(foreign), false, "does not belong");

  const noSummary = JSON.parse(JSON.stringify(goodContent));
  delete noSummary.vectors.icp.summary;
  check("missing summary", JSON.stringify(noSummary), false, "summary");

  const badScore = JSON.parse(JSON.stringify(goodContent));
  badScore.vectors.icp.score = 140;
  check("score out of range", JSON.stringify(badScore), false, "0-100");

  const conv = {
    agent: "gtm-conversion",
    vectors: {
      conversion: { score: 48, summary: "Primary CTA is buried." },
      activation: { skipped: "no signup surface - waitlist only" },
    },
    findings: [],
    data_gaps: [],
  };
  const r2 = check("skipped vector accepted", JSON.stringify(conv), true);
  if (r2.summary && r2.summary.skipped.join(",") !== "activation") failures.push("conversion: skipped should be [activation]");

  const convMissing = { agent: "gtm-conversion", vectors: { conversion: { score: 48, summary: "x" } }, findings: [], data_gaps: [] };
  check("missing owned vector", JSON.stringify(convMissing), false, "'vectors.activation' is missing");

  const tech = { agent: "gtm-technical", vectors: {}, findings: [], data_gaps: ["real load timings - not measurable from static HTML"] };
  check("technical empty vectors ok", JSON.stringify(tech), true);

  const techScored = { agent: "gtm-technical", vectors: { conversion: { score: 50, summary: "x" } }, findings: [], data_gaps: [] };
  check("technical scoring a vector rejected", JSON.stringify(techScored), false, "does not belong");

  const badSev = JSON.parse(JSON.stringify(goodContent));
  badSev.findings[0].severity = "high";
  check("bad severity", JSON.stringify(badSev), false, "severity");

  const noEvidence = JSON.parse(JSON.stringify(goodContent));
  noEvidence.findings[0].evidence = "";
  check("empty evidence", JSON.stringify(noEvidence), false, "evidence");

  const noImpact = JSON.parse(JSON.stringify(goodContent));
  delete noImpact.findings[0].impact;
  check("missing impact", JSON.stringify(noImpact), false, "impact");

  const noGaps = JSON.parse(JSON.stringify(goodContent));
  delete noGaps.data_gaps;
  check("missing data_gaps", JSON.stringify(noGaps), false, "data_gaps");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: validate_agent_output.js (contract, extraction, and rejections all hold)");
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

  const file = args.filter(function (a) { return a.charAt(0) !== "-"; })[0];
  let raw;
  try {
    raw = fs.readFileSync(file !== undefined ? file : 0, "utf8");
  } catch (e) {
    console.error("validate_agent_output: cannot read " + (file || "stdin") + ": " + e.message);
    console.error("usage: node validate_agent_output.js <file.json>   (or pipe JSON via stdin)");
    process.exit(2);
  }

  const result = validateAgentOutput(raw);
  if (result.errors.length) {
    console.error("INVALID agent output (" + result.errors.length + " problem(s)):");
    result.errors.forEach(function (e) { console.error("  - " + e); });
    process.exit(1);
  }
  console.log(JSON.stringify(result.summary, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { validateAgentOutput: validateAgentOutput, AGENT_VECTORS: AGENT_VECTORS };
