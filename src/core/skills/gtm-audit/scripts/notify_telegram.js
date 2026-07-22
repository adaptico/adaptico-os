#!/usr/bin/env node
/**
 * Telegram notify - a dumb sender for /gtm audit (Adaptico OS).
 *
 * Posts a short message to the founder's OWN Telegram bot, so a scheduled
 * audit can land its summary on their phone. Deliberately minimal: one
 * message, one channel, no formatting engine, no retries. Data leaves the
 * machine only when the founder has configured their own bot credentials -
 * with no credentials the script prints "not configured - skipping" and
 * exits 0, so audit runs and scheduled routines never break on it.
 *
 * Usage:
 *   node notify_telegram.js --title "GTM audit: acme" "Score 72/100 (B) ..."
 *   echo "message body" | node notify_telegram.js --title "GTM audit: acme"
 *   node notify_telegram.js --html --title "<b>t</b>" "body with <b>/<code> tags"
 *   node notify_telegram.js --dry-run --title "t" "m"   (print, don't send)
 *   node notify_telegram.js --selftest
 *
 * --html sends with Telegram parse_mode HTML (tags: b, i, code; escape literal
 * & < > as &amp; &lt; &gt;). If Telegram rejects the HTML (400), the message is
 * re-sent once as stripped plain text - a notification never dies on markup.
 *
 * Credentials (checked in this order):
 *   1. env vars   TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
 *   2. JSON file  .adaptico/telegram.json in the workspace root
 *                 (seeded empty by install.sh, gitignored)
 *                 { "bot_token": "123:abc", "chat_id": "123456789" }
 *
 * Exit codes: 0 sent, dry-run, or not configured (skip); 1 send failed;
 * 2 usage error. Selftest: 0 pass, 1 fail.
 *
 * Zero dependencies (Node standard library only).
 */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

// Telegram rejects messages over 4096 chars - truncate, never fail.
const MAX_LEN = 4096;
const TRUNCATION_MARK = "\n[truncated]";

/** Parse argv (after node + script). Returns { title, message, dryRun, html }. */
function parseArgs(argv) {
  let title = null;
  let dryRun = false;
  let html = false;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--title") {
      title = argv[i + 1] !== undefined ? argv[i + 1] : null;
      i++;
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--html") {
      html = true;
    } else if (argv[i].slice(0, 2) === "--") {
      // Unknown flags are ignored - a dumb sender does not argue.
    } else {
      positional.push(argv[i]);
    }
  }
  return { title: title, message: positional.length ? positional.join(" ") : null, dryRun: dryRun, html: html };
}

/**
 * Resolve credentials from an env object and an optional config-file reader.
 * Returns { token, chatId } or null when not configured.
 */
function resolveCredentials(env, readConfigFile) {
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    return { token: env.TELEGRAM_BOT_TOKEN, chatId: String(env.TELEGRAM_CHAT_ID) };
  }
  const raw = readConfigFile();
  if (raw === null) return null;
  try {
    const cfg = JSON.parse(raw);
    if (cfg && cfg.bot_token && cfg.chat_id) {
      return { token: String(cfg.bot_token), chatId: String(cfg.chat_id) };
    }
  } catch (e) {
    // A broken config file counts as not configured - skip, don't crash runs.
  }
  return null;
}

/** Build the message text: title on top, truncated to Telegram's limit. */
function buildText(title, message) {
  const text = title ? title + "\n\n" + message : message;
  if (text.length <= MAX_LEN) return text;
  return text.slice(0, MAX_LEN - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}

function configPath() {
  // Workspace-local, like everything Adaptico installs. All bundled scripts
  // run from the workspace root, so cwd is the workspace.
  return path.join(process.cwd(), ".adaptico", "telegram.json");
}

/** Drop HTML tags and unescape entities - the plain-text fallback body. */
function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function send(creds, text, html, done) {
  const payload = { chat_id: creds.chatId, text: text };
  if (html) payload.parse_mode = "HTML";
  const body = JSON.stringify(payload);
  const req = https.request(
    {
      hostname: "api.telegram.org",
      path: "/bot" + creds.token + "/sendMessage",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 15000,
    },
    function (res) {
      let data = "";
      res.on("data", function (c) { data += c; });
      res.on("end", function () {
        if (res.statusCode === 200) {
          done(null);
        } else {
          done(new Error("Telegram API returned " + res.statusCode + ": " + data.slice(0, 200)));
        }
      });
    }
  );
  req.on("timeout", function () { req.destroy(new Error("request timed out after 15s")); });
  req.on("error", function (e) { done(e); });
  req.write(body);
  req.end();
}

// ---------------------------------------------------------------------------
// Selftest (pure functions only - no network, no real env)
// ---------------------------------------------------------------------------

function selftest() {
  const failures = [];
  function assertEq(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) failures.push(label + ": expected " + e + ", got " + a);
  }

  // Arg parsing.
  const a1 = parseArgs(["--title", "GTM audit: acme", "Score 72/100"]);
  assertEq(a1.title, "GTM audit: acme", "title parsed");
  assertEq(a1.message, "Score 72/100", "positional message parsed");
  assertEq(a1.dryRun, false, "dry-run defaults false");
  assertEq(parseArgs(["--dry-run", "--title", "t", "m"]).dryRun, true, "dry-run parsed");
  assertEq(parseArgs(["--title", "t"]).message, null, "no positional -> null message (stdin)");
  assertEq(parseArgs(["one", "two"]).message, "one two", "multiple positionals joined");
  assertEq(parseArgs(["--html", "m"]).html, true, "html flag parsed");
  assertEq(parseArgs(["m"]).html, false, "html defaults false");

  // HTML stripping (the plain-text fallback body).
  assertEq(stripHtml("<b>Score:</b> 48/100"), "Score: 48/100", "tags stripped");
  assertEq(stripHtml("Activation &amp; TTV &lt;5 min&gt;"), "Activation & TTV <5 min>", "entities unescaped");
  assertEq(stripHtml("<code>/gtm copy</code>"), "/gtm copy", "code tag stripped");

  // Credential resolution: env wins, file is fallback, absence is null.
  const envCreds = resolveCredentials(
    { TELEGRAM_BOT_TOKEN: "tok", TELEGRAM_CHAT_ID: 42 },
    function () { return null; }
  );
  assertEq(envCreds, { token: "tok", chatId: "42" }, "env credentials resolved");
  const fileCreds = resolveCredentials({}, function () { return '{"bot_token":"ft","chat_id":"7"}'; });
  assertEq(fileCreds, { token: "ft", chatId: "7" }, "config-file credentials resolved");
  assertEq(resolveCredentials({}, function () { return null; }), null, "no credentials -> null");
  assertEq(resolveCredentials({}, function () { return "{broken"; }), null, "broken config -> null (skip, not crash)");
  assertEq(resolveCredentials({ TELEGRAM_BOT_TOKEN: "only-token" }, function () { return null; }), null, "token without chat id -> null");

  // Text building + truncation.
  assertEq(buildText("Title", "Body"), "Title\n\nBody", "title prepended");
  assertEq(buildText(null, "Body"), "Body", "no title -> body only");
  const long = buildText("T", new Array(6000).join("x"));
  assertEq(long.length <= MAX_LEN, true, "long message truncated to Telegram limit");
  assertEq(long.slice(-TRUNCATION_MARK.length), TRUNCATION_MARK, "truncation is marked");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: notify_telegram.js (args, credentials, truncation all hold)");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.indexOf("--selftest") !== -1) {
    selftest();
    return;
  }

  const args = parseArgs(argv);

  let message = args.message;
  if (message === null) {
    try {
      message = fs.readFileSync(0, "utf8").trim();
    } catch (e) {
      message = "";
    }
  }
  if (!message) {
    console.error("notify_telegram: no message given (pass it as an argument or pipe it via stdin)");
    console.error('usage: node notify_telegram.js --title "GTM audit: <project>" "<summary>"');
    process.exit(2);
  }

  const creds = resolveCredentials(process.env, function () {
    const p = configPath();
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  });

  const text = buildText(args.title, message);

  if (args.dryRun) {
    console.log("dry-run - would send" + (args.html ? " as HTML" : "") + (creds ? "" : " (NOT CONFIGURED - a real run would skip)") + ":");
    console.log(text);
    process.exit(0);
  }

  if (!creds) {
    console.log("not configured - skipping (fill in " + configPath() + ")");
    process.exit(0);
  }

  send(creds, text, args.html, function (err) {
    if (err && args.html && err.message.indexOf("returned 400") !== -1) {
      // Broken HTML must not lose the message - deliver it plain instead.
      send(creds, stripHtml(text), false, function (err2) {
        if (err2) {
          console.error("notify_telegram: send failed - " + err2.message);
          process.exit(1);
        }
        console.log("sent (plain fallback - HTML rejected: " + err.message + ")");
        process.exit(0);
      });
      return;
    }
    if (err) {
      console.error("notify_telegram: send failed - " + err.message);
      process.exit(1);
    }
    console.log("sent");
    process.exit(0);
  });
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs: parseArgs, resolveCredentials: resolveCredentials, buildText: buildText, stripHtml: stripHtml };
