#!/usr/bin/env node
/**
 * Critic Lint - deterministic copy checks for the gtm-critic skill (Adaptico OS).
 *
 * Scans a markdown/text document and flags, with line numbers:
 *   1. banned-word   - hype and AI-tell vocabulary
 *   2. ai-slop       - stock filler phrases, staged openers ("here's the thing"),
 *                      fake-strong verbs ("serves as a"), emphasis kickers
 *                      ("let that sink in"), and self-answered question openers
 *                      ("Honestly? ...")
 *   3. x-not-y       - the "it's not X, it's Y" pivot family in its common shapes,
 *                      including the forms with no article ("that isn't X, it's Y",
 *                      "not because X. Because Y", "stops being X and starts Y")
 *                      and negative lists ("Not X. Not Y.")
 *   4. em-dash       - em/en dash overuse (density per 1000 words)
 *
 * Same input, same findings, every run. Findings are LEADS for the critic to
 * verify in context, not verdicts - a banned word inside a "before" example is
 * the example's point. Curly apostrophes and quotes match like straight ones.
 * Lines inside ``` fences are skipped by default (reports quote deliberately bad
 * copy there); --include-fenced scans them too. Quote lines (starting with ">")
 * are scanned and their findings marked "quoted", because drafts and reports
 * also use ">" for their own callouts and list items; --skip-quotes skips them
 * when a document quotes outside copy at length.
 *
 * Usage:
 *   node critic_lint.js <file> [--json] [--strict] [--include-fenced] [--skip-quotes]
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
  "elevate",
];

// Patterns that must open a sentence: the line start (after any markdown list,
// quote, or heading marker) or the end of the previous sentence, then optional
// bold/italic markers.
const SENT = "(?:^[\\s>*+#-]*(?:\\d+[.)]\\s+)?|[.!?:;]\\s+|[\"(\\[]\\s*)[*_]*";
function sentenceStart(body) {
  return new RegExp(SENT + body, "i");
}

const SLOP_NOTES = {
  stock: "stock filler phrase",
  opener: "staged opener",
  verb: "fake-strong verb",
  kicker: "emphasis kicker",
  question: "self-answered question",
};
const SLOP_FIXES = {
  stock: "cut it or say something specific",
  opener: "cut it and open with the point itself",
  verb: "use the plain verb - is, has, uses",
  kicker: "cut it and let the fact before it close the thought",
  question: "state the answer as a plain sentence",
};

// AI-slop phrases. Each entry: [regex, short id, kind]. Matched against the line
// with apostrophes and quotes normalized to their straight forms.
const AI_SLOP_PHRASES = [
  [/in today'?s ((fast-paced|digital|competitive|ever-changing|modern) (world|landscape|market|age|era|environment)|world)/i, "in today's ... world", "stock"],
  [/in the (ever-)?(evolving|changing) (world|landscape|realm) of/i, "the evolving landscape of", "stock"],
  [/navigat(e|es|ing) the (complex|complexities|ever-changing|evolving|modern)/i, "navigating the complex...", "stock"],
  [/look no further/i, "look no further", "stock"],
  [/unlock the (full )?(power|potential|secrets?|value) of/i, "unlock the power of", "stock"],
  [/takes? (your|the) [^.!?\n]{1,40}? to the next level/i, "take X to the next level", "stock"],
  [/a testament to/i, "a testament to", "stock"],
  [/at the end of the day/i, "at the end of the day", "stock"],
  [/embark on (a|your|this) journey/i, "embark on a journey", "stock"],
  [/(deep|deeper) dive into|dive deep into/i, "deep dive into", "stock"],
  [/\b(it'?s|it is) (important|worth) (to note|noting)/i, "it's important to note", "stock"],
  [/in conclusion/i, "in conclusion", "stock"],
  [/whether you'?re an? [^.!?\n]{1,40}? or an? /i, "whether you're a X or a Y", "stock"],
  [/we'?ve got you covered/i, "we've got you covered", "stock"],
  [/one-stop shop/i, "one-stop shop", "stock"],
  [/say goodbye to/i, "say goodbye to", "stock"],
  [/but wait[,:]? there'?s more/i, "but wait, there's more", "stock"],
  [/seamlessly integrat(e|es|ed|ing)/i, "seamlessly integrates", "stock"],
  [/revolutioniz(e|es|ing) the way/i, "revolutionizing the way", "stock"],
  [/rest assured/i, "rest assured", "stock"],
  [/the possibilities are endless/i, "the possibilities are endless", "stock"],
  [/in a world where/i, "in a world where", "stock"],
  [/gone are the days (of|when)/i, "gone are the days", "stock"],
  [/stay ahead of the (curve|competition|game)/i, "stay ahead of the curve", "stock"],
  [/level up your/i, "level up your", "stock"],
  [/harness the power of/i, "harness the power of", "stock"],
  [/a wide range of/i, "a wide range of", "stock"],
  [/elevate your/i, "elevate your", "stock"],
  [/game.?chang(er|ing)/i, "game-changer", "stock"],
  [/not only [^.!?\n]{1,60}?,? but also/i, "not only X but also Y", "stock"],
  [/\bno (fluff|bs|filler)[,.]? just\b/i, "no fluff, just", "stock"],
  [/welcome to the (world|future) of/i, "welcome to the world of", "stock"],
  [/that'?s where [^.!?\n]{1,30}? comes in/i, "that's where X comes in", "stock"],
  [/your secret weapon/i, "your secret weapon", "stock"],
  [/the ultimate (guide|solution|tool) (to|for)/i, "the ultimate X for", "stock"],
  [/\b(this|that|it) changes everything\b/i, "this changes everything", "stock"],
  [/\b(studies|research) (shows?|suggests?)\b(?!\s+(itself|up)\b)|\bexperts (agree|say|believe)\b|\bwidely regarded as\b|\bmany (argue|believe)\b/i, "studies show / experts agree", "stock"],
  [/\bin this (article|post|thread|guide),? (we|i)('ll| will)\b/i, "in this article, I'll", "stock"],
  [/\bthe quiet part (out loud|aloud)\b/i, "the quiet part out loud", "stock"],
  [/\bi hope this helps\b/i, "I hope this helps", "stock"],
  [/\bi hope this (email|message|note) finds you well\b/i, "I hope this email finds you well", "stock"],

  // Staged openers: the sentence announces a point instead of making it.
  [/\bhere'?s the thing(,? though)?\s*([:.,;!?–—-]|$)/i, "here's the thing", "opener"],
  [/\bhere'?s what (you need to know|i mean|nobody talks about|no one talks about)\b/i, "here's what you need to know", "opener"],
  [/\bhere'?s why (that|this|it) matters\b/i, "here's why that matters", "opener"],
  [/\blet me be (clear|honest|blunt)\b/i, "let me be clear", "opener"],
  [/\b(i'?ll|i'?m going to) be (honest|blunt|frank|direct|real|straight with you)\b|\bto be (honest|frank|blunt)\s*[,:]|\breal talk\s*[,:]/i, "I'll be honest", "opener"],
  [/\b(uncomfortable|brutal|hard|harsh|ugly|honest) truth(\s+is\b|\s*[:?.!,–—-])/i, "the uncomfortable truth", "opener"],
  [sentenceStart("the (?:truth|reality) is\\b"), "the truth is,", "opener"],
  [/\bthe (real|better|bigger|more interesting|harder|deeper|right) question (is|here is|becomes)\b/i, "the real question is", "opener"],
  [/\bthis is where (it|things) (gets?|starts? to get) (interesting|tricky|good|wild|fun|weird|real|messy|better|hard|crazy|spicy|fascinating)\b/i, "this is where it gets interesting", "opener"],
  [/\b(let'?s|let me) (unpack|break (it|this|that) down)\b/i, "let's unpack", "opener"],
  [/\b(what|the (one )?(thing|things|part|secret|truth)|things) (nobody|no one) (else )?(ever )?(tells|told|will tell) you\b|\bthat (nobody|no one) (else )?(ever )?tells you\b/i, "what nobody tells you", "opener"],
  [/\b(nobody|no one) wants you to know\b/i, "nobody wants you to know", "opener"],
  [/\bthe part (everyone|everybody|most people) (misses|miss|skips|skip|ignores|ignore|forgets|forget|gets wrong|get wrong)\b|\bthe part (nobody|no one) (talks about|mentions)\b/i, "the part everyone misses", "opener"],
  [/\bwhat (most people|everyone|everybody) (gets? wrong|miss(es)?|overlooks?|ignores?|forgets?)\b|\bthe (one )?thing (most people|everyone|everybody) gets? wrong\b/i, "what most people get wrong", "opener"],
  [/\bwithout further ado\b/i, "without further ado", "opener"],
  [/\bwhat if i told you\b/i, "what if I told you", "opener"],
  [/\bmake no mistake\b/i, "make no mistake", "opener"],
  [/\blet'?s dive (in|into|right in)\b/i, "let's dive in", "opener"],
  [sentenceStart("think about it\\s*:"), "think about it:", "opener"],
  [/\bplot twist\s*[:!]/i, "plot twist:", "opener"],
  [/\bspoiler( alert)?\s*[:!]/i, "spoiler:", "opener"],

  // Fake-strong verbs standing in for "is" or "use". The noun "leverage" (no
  // leverage, high-leverage) is ordinary English, so only the verb is matched.
  [/\b(serves|stands|functions) as (a|an|the)\b/i, "serves as a", "verb"],
  [/(?<!\b(the|a|an|no|of|more|some|any|much|own|real|huge|great|for|my|your|our|their|its|his|her|this|that) )\bleverag(e|es|ed|ing) (the|our|your|their|its|this|these|existing|ai|data|it)\b/i, "leverage X", "verb"],

  // Emphasis kickers: a line that tells the reader to be impressed.
  [/\blet that sink in\b/i, "let that sink in", "kicker"],
  [/\bread that again\b/i, "read that again", "kicker"],
  [sentenceStart("(full stop|period)[*_]*[.!](?=[\\s*_]|$)"), "Full stop. / Period.", "kicker"],
  [/\bthat'?s it\.\s+that'?s the\b/i, "that's it. that's the", "kicker"],
  [/\band that'?s (okay|ok)\s*[.!]/i, "and that's okay.", "kicker"],
  [sentenceStart("no (?:fluff|bs|filler)[*_]*[.!](?!\\s*just\\b)(?=[\\s*_]|$)"), "No fluff.", "kicker"],
  [/\bmatters more than it (sounds|seems)\b/i, "matters more than it sounds", "kicker"],
  [sentenceStart("(?:and )?(?:this|that) (?:distinction|difference|detail) matters[*_]*[.!]|(?:this|that) is (?:crucial|critical)[*_]*[.!]"), "This distinction matters.", "kicker"],

  // Self-answered question openers: a staged question the next words answer.
  [sentenceStart(
    "(?:(?:and |but |so )?(?:honestly|the (?:best|worst|hardest|hard|scariest|scary|craziest|crazy|funniest|funny|wildest|wild) part" +
    "|the (?:(?:real|only|biggest|main|key|big|whole|other|surprising|ugly|honest|actual|final|first|next|simple|easy|hard|short) )?" +
    "(?:lessons?|difference|key|solution|fix|takeaway|upshot|verdict|outcome|results?|conclusion|paradox|standout|punchline|payoff|" +
    "bottom line|plot twist|math|secret sauce|move|play|cost|catch|kicker|twist|truth|answer|problem|secret|trick|irony|reality|reason|" +
    "good news|bad news))[*_]*\\?(?=[\\s*_?!]|$)|why[*_]*\\?\\s+because\\b|why does (?:this|that|it) matter[*_]*\\?)"
  ), "Honestly? / The catch?", "question"],
];

// The "it's not X, it's Y" pivot family. One finding per line (it is one cliche).
// The bare (unqualified) forms are only cliches when the pivot restates the
// subject ("it's ... it's"); a "but" pivot needs a just/only/about qualifier,
// or ordinary contrastive prose ("it's not clear yet ..., but") gets flagged.
// The forms with no article need punctuation before the pivot, so a causal
// clause ("this isn't working because it's broken") stays clean. A mid-sentence
// "not because X, but because Y" is ordinary English, so that form counts only
// when "Not because" opens the sentence. The any-subject forms skip clauses that
// open with a condition or concession ("If you're not on the trial, you're
// billed"), quoted speech, and "I'm not sure".
const NOT_CONDITION = "(?<!\\b(?:if|when|unless|until|because|whether|although|though|while|since|once|as long as) [^.!?\\n]{0,30})";
const X_NOT_Y_PATTERNS = [
  [/\bit'?s not (just |only |simply |merely )?(about )?[^.!?\n]{1,60}?[.,;!?]?\s*[-–—]?\s*it'?s\b/i, "it's not X, it's Y"],
  [/\bit'?s not (just |only |simply |merely |about )[^.!?\n]{1,60}?[.,;!?]?\s*[-–—]?\s*but\b/i, "it's not just X, but Y"],
  [/\bisn'?t (just |only |simply |merely )?(a|an|about)\b[^.!?\n]{1,60}?[.,;!?]?\s*(it'?s|but)\b/i, "isn't just X, it's Y"],
  [/\bnot (just|only|simply|merely) (a|an|another|about)\b/i, "not just a X"],
  [/\b(we|you|they|i) (don'?t|didn'?t|do not|did not) (just |only |simply |merely )\w+[^.!?\n]{0,60}?[.,;!?]\s*(we|you|they|i)\b/i, "we don't just X, we Y"],
  [/\bmore than just (a|an|your)\b [^.!?\n]{1,50}/i, "more than just a X"],
  [/\b(this|it) is not (a|an|about|your)\b[^.!?\n]{1,50}?[.,;!?]\s*(this|it) is\b/i, "this is not X, this is Y"],
  [/\b(that|this)('?s not| is not| isn'?t| was not| wasn'?t) [^.!?\n]{1,60}?\s*([.,;:!?]|[-–—])\s*(it|that|this)('?s| is| was)\b/i, "that isn't X, it's Y"],
  [/\bthe (real )?(question|answer|problem|point|issue|goal|secret|trick|difference|bottleneck)( here)? (isn'?t|is not|wasn'?t|was not) [^.!?\n]{1,60}?\s*([.,;:!?]|[-–—])\s*(it'?s|it is|it was)\b/i, "the question isn't X. It's Y"],
  [/\b(isn'?t|is not|wasn'?t|was not|aren'?t|are not) the (real )?(problem|point|issue|question|answer|bottleneck|enemy)\s*([.,;:]|[-–—])\s*[^.!?\n]{1,60}?\b(is|are|was|were)\s*[.!]/i, "X isn't the problem. Y is"],
  [/\bnot because\b[^.!?\n]{1,80}?(?:[.!?]\s+[*_]*(?:but\s+)?|\s*[;:]\s*|\s*[-–—]\s*)because\b/i, "not because X. Because Y"],
  [sentenceStart("not because [^.!?\\n]{1,80}?,?\\s+but because\\b"), "Not because X, but because Y"],
  [/\bstop(s|ped)? being\b[^.!?\n]{1,60}?(\s+and|,)\s+(starts?|started|becomes?|became|turns? into|turned into)\b/i, "stops being X and starts Y"],
  [/\b(this|that|it) (doesn'?t|does not|didn'?t|did not) mean\b[^.!?\n]{1,60}?\s*([.,;:]|[-–—])\s*(it|this|that) means\b/i, "doesn't mean X. It means Y"],
  [sentenceStart("not [^.!?\\n]{1,40}[.!]\\s+[*_]*not [^.!?\\n]{1,40}[.!?]"), "Not X. Not Y."],
  [sentenceStart("stop [a-z]+ing\\b[^.!?\\n]{0,40}?(?:[.!,;]|\\s+and)\\s+[*_]*start [a-z]+ing\\b"), "Stop X. Start Y."],
  [sentenceStart("not just (?!because\\b)[^.!?\\n]{1,40}?,? but\\b"), "Not just X, but Y"],
  [/\b(doesn'?t|does not|didn'?t|did not|won'?t|will not) (just|only|simply|merely) [^.!?\n]{1,60}?\s*([.,;:!?]|[-–—])\s*[*_]*(it|this|that|they|he|she)\b/i, "X doesn't just A. It B."],
  [new RegExp(NOT_CONDITION + "\\b(?:the|your|our|my|their) ([a-z]+) (?:isn'?t|is not|wasn'?t|was not) [^.!?\\n]{1,60}?\\s*(?:[.;:,]|[-–—])\\s*[*_]*(?:the|your|our|my|their) \\1 (?:is|was)\\b", "i"), "The goal isn't X. The goal is Y."],
  [new RegExp(NOT_CONDITION + "\\b(?:isn'?t|is not|wasn'?t|was not) [^.!?\\n\"]{1,60}?\\s*(?:[.!;:,]|[-–—])\\s*[*_]*(?:it'?s|it is|it was)\\b", "i"), "X isn't Y. It's Z."],
  [new RegExp(NOT_CONDITION + "\\b(we|you|they)(?:'re not| are not| aren'?t) [^.!?\\n\"]{1,60}?\\s*(?:[.!;:,]|[-–—])\\s*[*_]*\\1(?:'re| are)\\b(?!\\s+not\\b)", "i"), "You're not X. You're Y."],
  [new RegExp(NOT_CONDITION + "\\b(?:aren'?t|are not|weren'?t|were not) [^.!?\\n\"]{1,60}?\\s*(?:[.!;:,]|[-–—])\\s*[*_]*(?:they'?re|they are|they were)\\b(?!\\s+not\\b)", "i"), "Founders aren't X. They're Y."],
  [new RegExp(NOT_CONDITION + "\\bi'?m not (?!sure\\b)[^.!?\\n\"]{1,60}?\\s*(?:[.!;:,]|[-–—])\\s*i'?m\\b(?!\\s+not\\b)", "i"), "I'm not X. I'm Y."],
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

// One character in, one character out, so match offsets map back to the
// original line unchanged.
function normalize(line) {
  return line
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u00A0\u202F]/g, " ");
}

function snippet(line, maxLen) {
  const t = line.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen - 3) + "...";
}

/**
 * Scan text. Returns { scannedLines, skippedFencedLines, quotedLines,
 * skippedQuotedLines, wordCount, summary, findings, warnings }.
 * Findings: { line, category, match, snippet, note, quoted }.
 */
function scan(text, opts) {
  opts = opts || {};
  const lines = text.split(/\r\n|\r|\n/);
  const findings = [];
  let inFence = false;
  let skippedFencedLines = 0;
  let quotedLines = 0;
  let skippedQuotedLines = 0;
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
    const quoted = /^\s{0,3}>/.test(line);
    if (quoted) {
      if (opts.skipQuotes) {
        skippedQuotedLines += 1;
        return;
      }
      quotedLines += 1;
    }

    const norm = normalize(line);
    const original = function (index, length) { return line.slice(index, index + length); };
    const add = function (category, match, note) {
      findings.push({
        line: lineNo,
        category: category,
        match: match,
        snippet: snippet(line, 140),
        note: quoted ? note + " (quote line: if it quotes someone else's copy, it is evidence about that source, not a defect of this document)" : note,
        quoted: quoted,
      });
    };

    const words = line.trim().split(/\s+/).filter(Boolean);
    wordCount += words.length;

    // 1. banned words
    let m;
    BANNED_WORDS_RE.lastIndex = 0;
    while ((m = BANNED_WORDS_RE.exec(norm)) !== null) {
      add("banned-word", original(m.index, m[1].length), "hype/AI-tell vocabulary - replace with a concrete, checkable claim");
    }

    // 2. AI-slop phrases
    AI_SLOP_PHRASES.forEach(function (entry) {
      const hit = norm.match(entry[0]);
      if (hit) {
        const kind = entry[2];
        add("ai-slop", original(hit.index, hit[0].length).trim(), SLOP_NOTES[kind] + " (" + entry[1] + ") - " + SLOP_FIXES[kind]);
      }
    });

    // 3. X-not-Y constructions (max one per line - it is one cliche family)
    for (let p = 0; p < X_NOT_Y_PATTERNS.length; p++) {
      const hit = norm.match(X_NOT_Y_PATTERNS[p][0]);
      if (hit) {
        add("x-not-y", original(hit.index, hit[0].length).trim(), "\"X, not Y\" pivot cliche (" + X_NOT_Y_PATTERNS[p][1] + ") - state what it IS in concrete terms");
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
      quoted: false,
    });
  }

  const count = function (cat) {
    return findings.filter(function (f) { return f.category === cat; }).length;
  };

  return {
    scannedLines: lines.length,
    skippedFencedLines: skippedFencedLines,
    quotedLines: quotedLines,
    skippedQuotedLines: skippedQuotedLines,
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
      quotedFindings: findings.filter(function (f) { return f.quoted; }).length,
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

  const lineOf = function (res, cat) {
    return res.findings.filter(function (f) { return f.category === cat; }).map(function (f) { return f.line; });
  };
  assertEq(lineOf(r, "x-not-y").join(","), "4,9", "x-not-y line numbers");
  assertEq(lineOf(r, "banned-word").join(","), "3,3,10", "banned-word line numbers");

  // fenced content must not be flagged by default, but is scanned with the flag
  const withFenced = scan(FIXTURE, { includeFenced: true });
  assertEq(withFenced.skippedFencedLines, 0, "includeFenced skips nothing");
  if (withFenced.summary.bannedWords <= r.summary.bannedWords) {
    failures.push("includeFenced: expected more banned words than fenced-skipping scan");
  }

  // clean text yields zero findings
  const clean = scan("A plain sentence about shipping the report on Tuesday.\nAnother concrete line with numbers: 40% fewer tickets.", {});
  assertEq(clean.summary.totalFindings, 0, "clean text has no findings");

  // quantity/contrast prose stays clean; spaced compounds, the but-pivot
  // cliche, and unclosed fences are caught.
  const prose = scan("We raised more than a dozen signups this week.\nWe don't have pricing yet. We plan to add it.\nIt's not clear yet whether the launch lands, but we will see.", {});
  assertEq(prose.summary.totalFindings, 0, "plain quantity/contrast prose has no findings");
  const cliches = scan("This cutting edge platform is state of the art.\nIt's not just a tool, but a platform.", {});
  assertEq(cliches.summary.bannedWords, 2, "spaced compound banned words caught");
  assertEq(cliches.summary.xNotY, 1, "but-pivot cliche with qualifier caught");
  const openFence = scan("Fine line.\n```\nhidden revolutionary line", {});
  assertEq(openFence.warnings.length, 1, "unclosed fence warns at EOF");
  assertEq(openFence.summary.totalFindings, 0, "unclosed fence content stays skipped");

  // Structure fixture: staged openers, fake-strong verbs, kickers,
  // self-answered questions, the article-free pivots, and a quote line.
  const FIXTURE_SHAPES = [
    "# Launch notes",
    "Here's the thing: most launches stall in week two.",
    "The dashboard serves as a single place for every signup.",
    "We shipped the beta in nine days. Let that sink in.",
    "Honestly? It's the fragments.",
    "Not because the tool is slow. Because nobody owns the rollout.",
    "The question isn't price. It's who signs the contract.",
    "The weekly report stops being a chore and starts paying for itself.",
    "That isn't caution, it's fear of shipping.",
    "> Our revolutionary onboarding cut setup to five minutes.",
    "A plain line about the launch period ending in May.",
    "Here's what we found in the audit: three broken links.",
    "She serves as many customers as the team can handle.",
    "What was the best part?",
    "This isn't working because the webhook times out.",
  ].join("\n");

  const shapes = scan(FIXTURE_SHAPES, {});
  assertEq(shapes.summary.aiSlopPhrases, 4, "shapes ai-slop (opener, serves as a, let that sink in, Honestly?)");
  assertEq(lineOf(shapes, "ai-slop").join(","), "2,3,4,5", "shapes ai-slop line numbers");
  assertEq(shapes.summary.xNotY, 4, "shapes x-not-y (not-because, the-question-isn't, stops-being, that-isn't)");
  assertEq(lineOf(shapes, "x-not-y").join(","), "6,7,8,9", "shapes x-not-y line numbers");
  assertEq(shapes.summary.bannedWords, 1, "shapes banned word on the quote line");
  assertEq(shapes.quotedLines, 1, "shapes quote line scanned");
  assertEq(shapes.summary.quotedFindings, 1, "shapes quote-line finding marked");
  assertEq(lineOf(shapes, "banned-word").join(","), "10", "shapes quoted finding line number");
  assertEq(shapes.summary.totalFindings, 9, "shapes total findings (clean lines stay clean)");

  // --skip-quotes drops quote lines entirely
  const shapesSkip = scan(FIXTURE_SHAPES, { skipQuotes: true });
  assertEq(shapesSkip.skippedQuotedLines, 1, "skipQuotes skips the quote line");
  assertEq(shapesSkip.summary.bannedWords, 0, "skipQuotes: no finding from the quote line");
  assertEq(shapesSkip.summary.totalFindings, 8, "skipQuotes total findings");

  // curly apostrophes match like straight ones
  const curly = scan("It’s not just a dashboard, it’s a command center.\nIn today’s fast-paced world, teams need clarity.\nHere’s the thing: we ship weekly.", {});
  assertEq(curly.summary.xNotY, 1, "curly apostrophe pivot caught");
  assertEq(curly.summary.aiSlopPhrases, 2, "curly apostrophe slop phrases caught");
  assertEq(curly.findings[0].match.indexOf("’") !== -1, true, "match text keeps the original apostrophe");
  const nbsp = scan("Let" + String.fromCharCode(0xA0) + "that sink in.", {});
  assertEq(nbsp.summary.aiSlopPhrases, 1, "no-break space matches like a space");

  // sentence-anchored kickers stay clean mid-sentence
  const anchored = scan("The trial period ends Friday.\nWe hit a full stop on hiring in May.\nLet me think about it and reply tomorrow.", {});
  assertEq(anchored.summary.totalFindings, 0, "mid-sentence period/full stop and plain 'think about it' stay clean");
  const kickers = scan("We don't discount. Period.\nNot a tool. Not a platform. A teammate.", {});
  assertEq(kickers.summary.aiSlopPhrases, 1, "standalone 'Period.' kicker caught");
  assertEq(kickers.summary.xNotY, 1, "negative list caught");

  // the noun "leverage" stays clean, the verb is caught; one tell, one finding
  const nouns = scan("We had no leverage until the waitlist hit 2,000.\nI'm grateful for the leverage AI gives a team of two.", {});
  assertEq(nouns.summary.totalFindings, 0, "noun 'leverage' stays clean");
  const verbs = scan("Leverage your data to grow.\nHere's what nobody tells you about pricing.", {});
  assertEq(verbs.summary.aiSlopPhrases, 2, "verb 'leverage' caught; 'here's what nobody tells you' counted once");

  // a mid-sentence "not because X, but because Y" stays clean; the staged forms are caught
  const because = scan("We passed on the raise, not because raising is impossible, but because we lack traction.\nWe stopped. Not because it failed, but because it worked.\nNot because I lack talent. But because I chose comfort.", {});
  assertEq(lineOf(because, "x-not-y").join(","), "2,3", "not-because: mid-sentence form clean, staged forms caught");

  // "harness" is the AI builders' noun for agent tooling; "harness the power of" stays a slop phrase
  const field = scan("Claude Code is the harness; the model is swappable.\nStop selling software. Start selling results.\nNobody wants you to know this, but cold email still works.", {});
  assertEq(field.summary.bannedWords, 0, "noun 'harness' stays clean");
  assertEq(lineOf(field, "x-not-y").join(","), "2", "Stop X. Start Y. caught");
  assertEq(lineOf(field, "ai-slop").join(","), "3", "'nobody wants you to know' caught");

  // every "nobody tells you" reveal promise counts once; a past-tense relative clause stays clean
  const nobody = scan("The thing nobody tells you about pricing.\nHere's the part that nobody tells you.\nThe part nobody tells you about onboarding.\nA rule that nobody told you about existed.", {});
  assertEq(lineOf(nobody, "ai-slop").join(","), "1,2,3", "'nobody tells you' forms caught once per line");

  // the pivot with any subject; conditions, concessions, "I'm not sure" and FAQ answers stay clean
  const anySubject = scan([
    "Pricing isn't the hard part. It's the packaging.",
    "You're not behind. You're early.",
    "Founders aren't lazy. They're busy.",
    "I'm not a marketer. I'm a builder.",
    "The tool doesn't just track churn, it predicts it.",
    "The goal isn't more leads. The goal is better ones.",
    "Not just faster, but cheaper.",
    "Although the export isn't perfect, it's good enough to ship.",
    "If you're not on the trial, you're billed monthly.",
    "I'm not sure yet. I'm testing it this week.",
    "Why isn't my data syncing? It's usually an expired token.",
  ].join("\n"), {});
  assertEq(lineOf(anySubject, "x-not-y").join(","), "1,2,3,4,5,6,7", "any-subject pivots caught, guarded clauses clean");
  assertEq(anySubject.summary.totalFindings, 7, "any-subject block has no other findings");

  // openers, kickers and stock lines that announce instead of saying, one finding per line
  const announce = scan([
    "I'll be honest, the launch flopped.",
    "Honestly? I expected more signups.",
    "The brutal truth: most launches stall.",
    "The truth is, buyers research alone.",
    "The real question is who signs.",
    "That changes everything.",
    "This is where it gets interesting.",
    "Here's what most people miss about cold email.",
    "Let's unpack the pricing.",
    "In this article, I'll cover pricing.",
    "Studies show most trials convert in week one.",
    "No fluff.",
    "This distinction matters.",
    "The lesson? Ship smaller.",
    "In today's world, buyers research alone.",
    "It is important to note the limits.",
  ].join("\n"), {});
  assertEq(lineOf(announce, "ai-slop").join(","), "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16", "announcing lines caught once each");
  assertEq(announce.summary.totalFindings, 16, "announcing block has no other findings");
  const plainTalk = scan("I told her the hard truth about the numbers.\nNo fluff. Just the numbers.\nThe tone? The layout? Both changed.", {});
  assertEq(plainTalk.summary.totalFindings, 1, "a told truth and an open list of real questions stay clean; 'no fluff, just' counts once");

  // a list of negatives is not a pivot; spoken candor and the literal verb stay clean
  const plainVoice = scan("I'm not shy, I'm not an introvert, and I'm comfortable on camera.\nHonestly, I was terrified before the first call.\nBad research shows itself quickly.\nWe're not hiring. We're not raising. We're shipping.", {});
  assertEq(lineOf(plainVoice, "x-not-y").join(","), "4", "negative lists, spoken 'Honestly,' and 'research shows itself' clean; a pivot after a list still counts");
  assertEq(plainVoice.summary.totalFindings, 1, "plain-voice block has no other findings");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: critic_lint.js (" + r.summary.totalFindings + " findings on fixture, " +
    shapes.summary.totalFindings + " on the structure fixture, 0 on clean text)");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHuman(result, source, opts) {
  console.log("=== critic lint: " + source + " ===");
  console.log(
    "lines " + result.scannedLines +
    " | words " + result.wordCount +
    " | fenced lines skipped " + result.skippedFencedLines +
    (opts.skipQuotes
      ? " | quote lines skipped " + result.skippedQuotedLines
      : " | quote lines scanned " + result.quotedLines)
  );
  console.log("");
  if (result.findings.length === 0) {
    console.log("No deterministic findings.");
  } else {
    result.findings.forEach(function (f) {
      console.log("L" + f.line + " [" + f.category + "]" + (f.quoted ? " (quote line)" : "") + " \"" + f.match + "\"");
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
    (result.summary.emDash.flagged ? " (FLAGGED, " + result.summary.emDash.per1000Words + "/1000 words)" : "") +
    (result.summary.quotedFindings ? " | on quote lines " + result.summary.quotedFindings : "")
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
  const opts = {
    includeFenced: args.indexOf("--include-fenced") !== -1,
    skipQuotes: args.indexOf("--skip-quotes") !== -1,
  };
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
    console.error("usage: node critic_lint.js <file> [--json] [--strict] [--include-fenced] [--skip-quotes]");
    console.error("       node critic_lint.js --selftest");
    process.exit(2);
  }

  const result = scan(text, opts);
  if (json) {
    console.log(JSON.stringify(Object.assign({ file: source }, result), null, 2));
  } else {
    printHuman(result, source, opts);
  }
  process.exit(strict && result.findings.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { scan: scan };
