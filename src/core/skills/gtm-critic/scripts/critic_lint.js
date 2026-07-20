#!/usr/bin/env node
/**
 * Critic Lint - deterministic copy checks for the gtm-critic skill (Adaptico OS).
 *
 * Scans a markdown/text document and flags, with line numbers:
 *   1. banned-word   - hype and AI-tell vocabulary
 *   2. ai-slop       - stock filler phrases
 *   3. x-not-y       - the "it's not X, it's Y" cliche construction family
 *   4. em-dash       - em/en dash overuse (density per 1000 words)
 *
 * Same input, same findings, every run. Findings are LEADS for the critic to
 * verify in context, not verdicts - a banned word inside a "before" example is
 * the example's point. Lines inside ``` fences are skipped by default (reports
 * quote deliberately bad copy there); --include-fenced scans them too.
 *
 * Usage:
 *   node critic_lint.js <file> [--json] [--strict] [--include-fenced]
 *   cat draft.md | node critic_lint.js [--json]
 *   node critic_lint.js --selftest
 *
 * Zero dependencies (Node standard library only).
 * Exit codes: 0 scan completed (findings are data, not errors);
 *             1 findings found and --strict was set;
 *             2 usage or I/O error. Selftest: 0 pass, 1 fail.
 */

"use strict";

const fs = require("fs");

// ---------------------------------------------------------------------------
// Rule sets
// ---------------------------------------------------------------------------

// Matched case-insensitively on word boundaries. Literal words/short phrases.
const BANNED_WORDS = [
  "revolutionary", "revolutionize", "groundbreaking", "cutting-edge",
  "state-of-the-art", "next-generation", "world-class", "best-in-class",
  "industry-leading", "market-leading", "award-winning",
  "seamless", "seamlessly", "effortless", "effortlessly", "frictionless",
  "supercharge", "turbocharge", "skyrocket", "unleash", "unlock",
  "empower", "empowering", "transformative", "disruptive", "innovative",
  "synergy", "holistic", "robust", "bespoke",
  "unparalleled", "unrivaled", "unmatched",
  "delve", "plethora", "myriad", "tapestry", "meticulous", "meticulously",
  "boasts", "pivotal", "paradigm", "realm", "beacon", "bustling", "vibrant",
  "harness", "elevate",
];

// Stock filler phrases. Each entry: [regex, short id].
const AI_SLOP_PHRASES = [
  [/in today'?s (fast-paced|digital|competitive|ever-changing|modern) (world|landscape|market|age|era|environment)/i, "in today's ... world"],
  [/in the (ever-)?(evolving|changing) (world|landscape|realm) of/i, "the evolving landscape of"],
  [/navigat(e|es|ing) the (complex|complexities|ever-changing|evolving|modern)/i, "navigating the complex..."],
  [/look no further/i, "look no further"],
  [/unlock the (full )?(power|potential|secrets?|value) of/i, "unlock the power of"],
  [/takes? (your|the) [^.!?\n]{1,40}? to the next level/i, "take X to the next level"],
  [/a testament to/i, "a testament to"],
  [/at the end of the day/i, "at the end of the day"],
  [/embark on (a|your|this) journey/i, "embark on a journey"],
  [/(deep|deeper) dive into|dive deep into/i, "deep dive into"],
  [/it'?s (important|worth) (to note|noting)/i, "it's important to note"],
  [/in conclusion/i, "in conclusion"],
  [/whether you'?re an? [^.!?\n]{1,40}? or an? /i, "whether you're a X or a Y"],
  [/we'?ve got you covered/i, "we've got you covered"],
  [/one-stop shop/i, "one-stop shop"],
  [/say goodbye to/i, "say goodbye to"],
  [/but wait[,:]? there'?s more/i, "but wait, there's more"],
  [/seamlessly integrat(e|es|ed|ing)/i, "seamlessly integrates"],
  [/revolutioniz(e|es|ing) the way/i, "revolutionizing the way"],
  [/rest assured/i, "rest assured"],
  [/the possibilities are endless/i, "the possibilities are endless"],
  [/in a world where/i, "in a world where"],
  [/gone are the days (of|when)/i, "gone are the days"],
  [/stay ahead of the (curve|competition|game)/i, "stay ahead of the curve"],
  [/level up your/i, "level up your"],
  [/harness the power of/i, "harness the power of"],
  [/a wide range of/i, "a wide range of"],
  [/elevate your/i, "elevate your"],
  [/game.?chang(er|ing)/i, "game-changer"],
  [/not only [^.!?\n]{1,60}?,? but also/i, "not only X but also Y"],
  [/the best part\?/i, "the best part?"],
  [/no fluff[,.]? just/i, "no fluff, just"],
  [/welcome to the (world|future) of/i, "welcome to the world of"],
  [/that'?s where [^.!?\n]{1,30}? comes in/i, "that's where X comes in"],
  [/your secret weapon/i, "your secret weapon"],
  [/the ultimate (guide|solution|tool) (to|for)/i, "the ultimate X for"],
];

// The "it's not X, it's Y" pivot family. One finding per line (it is one cliche).
// The bare (unqualified) forms are only cliches when the pivot restates the
// subject ("it's ... it's"); a "but" pivot needs a just/only/about qualifier,
// or ordinary contrastive prose ("it's not clear yet ..., but") gets flagged.
const X_NOT_Y_PATTERNS = [
  [/\bit'?s not (just |only |simply |merely )?(about )?[^.!?\n]{1,60}?[.,;!?]?\s*[-–—]?\s*it'?s\b/i, "it's not X, it's Y"],
  [/\bit'?s not (just |only |simply |merely |about )[^.!?\n]{1,60}?[.,;!?]?\s*[-–—]?\s*but\b/i, "it's not just X, but Y"],
  [/\bisn'?t (just |only |simply |merely )?(a|an|about)\b[^.!?\n]{1,60}?[.,;!?]?\s*(it'?s|but)\b/i, "isn't just X, it's Y"],
  [/\bnot (just|only|simply|merely) (a|an|another|about)\b/i, "not just a X"],
  [/\bwe don'?t (just |only |simply )\w+[^.!?\n]{0,60}?[.,;!?]\s*we\b/i, "we don't just X, we Y"],
  [/\bmore than just (a|an|your)\b [^.!?\n]{1,50}/i, "more than just a X"],
  [/\b(this|it) is not (a|an|about|your)\b[^.!?\n]{1,50}?[.,;!?]\s*(this|it) is\b/i, "this is not X, this is Y"],
];

// Em/en dash density threshold: flag when BOTH hold.
const EM_DASH_MIN_COUNT = 4;
const EM_DASH_PER_1000_WORDS = 5;

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Hyphenated entries also match their spaced forms ("cutting edge").
const BANNED_WORDS_RE = new RegExp(
  "\\b(" + BANNED_WORDS.map(escapeRegExp).map(function (w) { return w.replace(/-/g, "[-\\s]"); }).join("|") + ")\\b",
  "gi"
);

function snippet(line, maxLen) {
  const t = line.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen - 3) + "...";
}

/**
 * Scan text. Returns { scannedLines, skippedFencedLines, wordCount, summary, findings }.
 * Findings: { line, category, match, snippet, note }.
 */
function scan(text, opts) {
  opts = opts || {};
  const lines = text.split(/\r\n|\r|\n/);
  const findings = [];
  let inFence = false;
  let skippedFencedLines = 0;
  let wordCount = 0;
  let emDashCount = 0;
  const emDashLines = [];

  lines.forEach(function (line, i) {
    const lineNo = i + 1;

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence && !opts.includeFenced) {
      skippedFencedLines += 1;
      return;
    }

    const words = line.trim().split(/\s+/).filter(Boolean);
    wordCount += words.length;

    // 1. banned words
    let m;
    BANNED_WORDS_RE.lastIndex = 0;
    while ((m = BANNED_WORDS_RE.exec(line)) !== null) {
      findings.push({
        line: lineNo,
        category: "banned-word",
        match: m[1],
        snippet: snippet(line, 140),
        note: "hype/AI-tell vocabulary - replace with a concrete, checkable claim",
      });
    }

    // 2. AI-slop phrases
    AI_SLOP_PHRASES.forEach(function (entry) {
      const hit = line.match(entry[0]);
      if (hit) {
        findings.push({
          line: lineNo,
          category: "ai-slop",
          match: hit[0],
          snippet: snippet(line, 140),
          note: "stock filler phrase (" + entry[1] + ") - cut it or say something specific",
        });
      }
    });

    // 3. X-not-Y constructions (max one per line - it is one cliche family)
    for (let p = 0; p < X_NOT_Y_PATTERNS.length; p++) {
      const hit = line.match(X_NOT_Y_PATTERNS[p][0]);
      if (hit) {
        findings.push({
          line: lineNo,
          category: "x-not-y",
          match: hit[0],
          snippet: snippet(line, 140),
          note: "\"X, not Y\" pivot cliche (" + X_NOT_Y_PATTERNS[p][1] + ") - state what it IS in concrete terms",
        });
        break;
      }
    }

    // 4. em/en dash occurrences (density judged after the pass)
    const dashes = line.match(/[–—]/g);
    if (dashes) {
      emDashCount += dashes.length;
      emDashLines.push(lineNo);
    }
  });

  const warnings = [];
  if (inFence && !opts.includeFenced) {
    warnings.push("unclosed ``` fence - every line after it was skipped; close the fence or re-run with --include-fenced");
  }

  const per1000 = wordCount > 0 ? (emDashCount / wordCount) * 1000 : 0;
  const emDashFlagged =
    emDashCount >= EM_DASH_MIN_COUNT && per1000 > EM_DASH_PER_1000_WORDS;
  if (emDashFlagged) {
    findings.push({
      line: emDashLines[0],
      category: "em-dash",
      match: emDashCount + " em/en dashes (" + per1000.toFixed(1) + " per 1000 words)",
      snippet: "lines: " + emDashLines.slice(0, 10).join(", ") + (emDashLines.length > 10 ? ", ..." : ""),
      note: "em-dash overuse is a strong AI tell - restructure into plain sentences",
    });
  }

  const count = function (cat) {
    return findings.filter(function (f) { return f.category === cat; }).length;
  };

  return {
    scannedLines: lines.length,
    skippedFencedLines: skippedFencedLines,
    wordCount: wordCount,
    summary: {
      bannedWords: count("banned-word"),
      aiSlopPhrases: count("ai-slop"),
      xNotY: count("x-not-y"),
      emDash: {
        count: emDashCount,
        per1000Words: Math.round(per1000 * 10) / 10,
        flagged: emDashFlagged,
      },
      totalFindings: findings.length,
    },
    findings: findings,
    warnings: warnings,
  };
}

// ---------------------------------------------------------------------------
// Selftest (offline, no I/O)
// ---------------------------------------------------------------------------

function selftest() {
  const failures = [];
  function assertEq(actual, expected, label) {
    if (actual !== expected) {
      failures.push(label + ": expected " + expected + ", got " + actual);
    }
  }

  const FIXTURE = [
    "# Sample draft",
    "",
    "Our revolutionary platform will supercharge your growth.",
    "It's not just a dashboard, it's a command center.",
    "In today's fast-paced world, teams need clarity.",
    "```",
    "BEFORE: Our revolutionary, seamless approach will delve into your data.",
    "```",
    "We don't just track metrics. We turn them into decisions.",
    "Say goodbye to spreadsheet chaos and unlock the power of automation.",
    "The results — faster onboarding — speak for themselves — every time.",
    "Teams ship faster — much faster — with fewer meetings — and less stress.",
    "A clean line with nothing wrong.",
  ].join("\n");

  const r = scan(FIXTURE, {});
  assertEq(r.summary.bannedWords, 3, "banned words (revolutionary, supercharge, unlock)");
  assertEq(r.summary.aiSlopPhrases, 3, "slop phrases (in today's..., say goodbye to, unlock the power of)");
  assertEq(r.summary.xNotY, 2, "x-not-y (lines 4 and 9)");
  assertEq(r.summary.emDash.count, 6, "em dash count");
  assertEq(r.summary.emDash.flagged, true, "em dash flagged");
  assertEq(r.skippedFencedLines, 1, "fenced line skipped");
  assertEq(r.summary.totalFindings, 9, "total findings");

  const lineOf = function (cat) {
    return r.findings.filter(function (f) { return f.category === cat; }).map(function (f) { return f.line; });
  };
  assertEq(lineOf("x-not-y").join(","), "4,9", "x-not-y line numbers");
  assertEq(lineOf("banned-word").join(","), "3,3,10", "banned-word line numbers");

  // fenced content must not be flagged by default, but is scanned with the flag
  const withFenced = scan(FIXTURE, { includeFenced: true });
  assertEq(withFenced.skippedFencedLines, 0, "includeFenced skips nothing");
  if (withFenced.summary.bannedWords <= r.summary.bannedWords) {
    failures.push("includeFenced: expected more banned words than fenced-skipping scan");
  }

  // clean text yields zero findings
  const clean = scan("A plain sentence about shipping the report on Tuesday.\nAnother concrete line with numbers: 40% fewer tickets.", {});
  assertEq(clean.summary.totalFindings, 0, "clean text has no findings");

  // R1 fix regressions: quantity/contrast prose stays clean; spaced compounds,
  // the but-pivot cliche, and unclosed fences are caught.
  const prose = scan("We raised more than a dozen signups this week.\nWe don't have pricing yet. We plan to add it.\nIt's not clear yet whether the launch lands, but we will see.", {});
  assertEq(prose.summary.totalFindings, 0, "plain quantity/contrast prose has no findings");
  const cliches = scan("This cutting edge platform is state of the art.\nIt's not just a tool, but a platform.", {});
  assertEq(cliches.summary.bannedWords, 2, "spaced compound banned words caught");
  assertEq(cliches.summary.xNotY, 1, "but-pivot cliche with qualifier caught");
  const openFence = scan("Fine line.\n```\nhidden revolutionary line", {});
  assertEq(openFence.warnings.length, 1, "unclosed fence warns at EOF");
  assertEq(openFence.summary.totalFindings, 0, "unclosed fence content stays skipped");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: critic_lint.js (" + r.summary.totalFindings + " findings on fixture, 0 on clean text)");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHuman(result, source) {
  console.log("=== critic lint: " + source + " ===");
  console.log(
    "lines " + result.scannedLines +
    " | words " + result.wordCount +
    " | fenced lines skipped " + result.skippedFencedLines
  );
  console.log("");
  if (result.findings.length === 0) {
    console.log("No deterministic findings.");
  } else {
    result.findings.forEach(function (f) {
      console.log("L" + f.line + " [" + f.category + "] \"" + f.match + "\"");
      console.log("    " + f.snippet);
      console.log("    -> " + f.note);
    });
  }
  result.warnings.forEach(function (w) {
    console.log("");
    console.log("WARNING: " + w);
  });
  console.log("");
  console.log(
    "summary: banned-words " + result.summary.bannedWords +
    " | ai-slop " + result.summary.aiSlopPhrases +
    " | x-not-y " + result.summary.xNotY +
    " | em-dashes " + result.summary.emDash.count +
    (result.summary.emDash.flagged ? " (FLAGGED, " + result.summary.emDash.per1000Words + "/1000 words)" : "")
  );
  console.log("Findings are leads for the critic to verify in context, not verdicts.");
}

function main() {
  const args = process.argv.slice(2);
  if (args.indexOf("--selftest") !== -1) {
    selftest();
    return;
  }
  const json = args.indexOf("--json") !== -1;
  const strict = args.indexOf("--strict") !== -1;
  const includeFenced = args.indexOf("--include-fenced") !== -1;
  const file = args.filter(function (a) { return a.charAt(0) !== "-"; })[0];

  let text;
  let source;
  if (file) {
    try {
      text = fs.readFileSync(file, "utf8");
      source = file;
    } catch (e) {
      console.error("critic_lint: cannot read '" + file + "': " + e.message);
      process.exit(2);
    }
  } else if (!process.stdin.isTTY) {
    try {
      text = fs.readFileSync(0, "utf8");
      source = "(stdin)";
    } catch (e) {
      console.error("critic_lint: cannot read stdin: " + e.message);
      process.exit(2);
    }
  } else {
    console.error("usage: node critic_lint.js <file> [--json] [--strict] [--include-fenced]");
    console.error("       node critic_lint.js --selftest");
    process.exit(2);
  }

  const result = scan(text, { includeFenced: includeFenced });
  if (json) {
    console.log(JSON.stringify(Object.assign({ file: source }, result), null, 2));
  } else {
    printHuman(result, source);
  }
  process.exit(strict && result.findings.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { scan: scan };
