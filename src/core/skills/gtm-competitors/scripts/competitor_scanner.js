#!/usr/bin/env node
/**
 * Competitor Scanner - utility script for Adaptico OS.
 * Scans competitor websites to extract positioning, pricing signals, trust
 * signals, and CTAs for competitive analysis. Also probes for a public
 * pricing page (/pricing, /plans, /price).
 *
 * Usage:
 *   node competitor_scanner.js <url1> [url2] [url3] ...
 *   node competitor_scanner.js --selftest
 *
 * Output: JSON - one result object for a single URL, {"competitors": [...]}
 * for several.
 *
 * Zero dependencies (Node standard library only). Security: only http/https
 * URLs that resolve to public addresses are fetched; every redirect hop is
 * re-validated. Falls back to Jina Reader on 403 (bot-blocked pages).
 * Exit codes: 0 success; 1 validation error. Selftest: 0 pass, 1 fail.
 */

"use strict";

const https = require("https");
const http = require("http");
const zlib = require("zlib");
const dns = require("dns");
const net = require("net");
const { URL } = require("url");

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB - prevent memory exhaustion
const FETCH_TIMEOUT_MS = 15000;
const JINA_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  DNT: "1",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
};

// ---------------------------------------------------------------------------
// URL validation (public internet only)
// ---------------------------------------------------------------------------

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(function (p) { return isNaN(p); })) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const low = ip.toLowerCase();
  if (low === "::" || low === "::1") return true;
  if (low.indexOf("::ffff:") === 0) {
    const v4 = low.slice(7);
    return net.isIP(v4) === 4 ? isPrivateIpv4(v4) : true;
  }
  if (/^f[cd]/.test(low)) return true;
  if (/^fe[89ab]/.test(low)) return true;
  return false;
}

function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

async function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    return { valid: false, error: "Invalid URL format" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "Scheme '" + parsed.protocol.replace(":", "") + "' is not allowed - only http and https are supported",
    };
  }
  const hostname = parsed.hostname;
  if (!hostname) return { valid: false, error: "URL has no hostname" };
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(bare)) {
    if (isPrivateIp(bare)) {
      return { valid: false, error: "'" + hostname + "' is a private/internal address - only public internet URLs are supported" };
    }
    return { valid: true, url: parsed };
  }
  try {
    const res = await dns.promises.lookup(bare);
    if (isPrivateIp(res.address)) {
      return { valid: false, error: "'" + hostname + "' resolves to a private/internal address - only public internet URLs are supported" };
    }
    return { valid: true, url: parsed, address: res.address, family: res.family };
  } catch (e) {
    return { valid: false, error: "Could not resolve hostname '" + hostname + "'" };
  }
}

// ---------------------------------------------------------------------------
// Minimal HTML tokenizer (tolerant, zero-dep)
// ---------------------------------------------------------------------------

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "-", ndash: "-", hellip: "...", rsquo: "'", lsquo: "'",
  rdquo: '"', ldquo: '"', copy: "(c)", reg: "(R)", trade: "(TM)",
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (m, body) {
    if (body.charAt(0) === "#") {
      const code = body.charAt(1).toLowerCase() === "x"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!isNaN(code) && code > 0 && code < 0x110000) {
        try { return String.fromCodePoint(code); } catch (e) { return m; }
      }
      return m;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body] : m;
  });
}

function parseAttrs(attrText) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(attrText)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : "";
    if (!Object.prototype.hasOwnProperty.call(attrs, name)) {
      attrs[name] = decodeEntities(value);
    }
  }
  return attrs;
}

function findTagEnd(html, start) {
  let quote = null;
  for (let i = start + 1; i < html.length; i++) {
    const c = html.charAt(i);
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return i;
    }
  }
  return -1;
}

const RAW_TEXT_TAGS = { script: true, style: true };

function parseHTML(html, handlers) {
  const lower = html.toLowerCase();
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      if (i < n) handlers.onText(decodeEntities(html.slice(i)));
      break;
    }
    if (lt > i) handlers.onText(decodeEntities(html.slice(i, lt)));

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    const next = html.charAt(lt + 1);
    if (next === "!" || next === "?") {
      const end = html.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      continue;
    }

    const isEnd = next === "/";
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9:-]*/.exec(html.slice(lt + (isEnd ? 2 : 1)));
    if (!nameMatch) {
      handlers.onText("<");
      i = lt + 1;
      continue;
    }
    const gt = findTagEnd(html, lt);
    if (gt === -1) break;
    const tag = nameMatch[0].toLowerCase();

    if (isEnd) {
      handlers.onEndTag(tag);
      i = gt + 1;
      continue;
    }

    const inner = html.slice(lt + 1 + tag.length, gt);
    const selfClosing = /\/\s*$/.test(inner);
    const attrs = parseAttrs(selfClosing ? inner.replace(/\/\s*$/, "") : inner);
    handlers.onStartTag(tag, attrs, selfClosing);

    i = gt + 1;
    if (selfClosing) {
      handlers.onEndTag(tag);
      continue;
    }
    if (RAW_TEXT_TAGS[tag]) {
      const close = lower.indexOf("</" + tag, i);
      const rawEnd = close === -1 ? n : close;
      handlers.onRawText(tag, html.slice(i, rawEnd), attrs);
      if (close === -1) { i = n; continue; }
      const closeGt = html.indexOf(">", close);
      handlers.onEndTag(tag);
      i = closeGt === -1 ? n : closeGt + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Competitor page collector
// ---------------------------------------------------------------------------

const SOCIAL_PLATFORMS = {
  "twitter.com": "Twitter/X",
  "x.com": "Twitter/X",
  "facebook.com": "Facebook",
  "linkedin.com": "LinkedIn",
  "instagram.com": "Instagram",
  "youtube.com": "YouTube",
  "tiktok.com": "TikTok",
  "github.com": "GitHub",
};

const CTA_WORDS = [
  "sign up", "get started", "try free", "start", "buy", "subscribe",
  "join", "register", "download", "book", "demo", "contact", "pricing",
];

const PRICING_PATTERNS = [
  /\$\d+/, /€\d+/, /£\d+/, /\/month/, /\/year/, /\/mo/,
  /per month/, /per year/, /annually/, /free plan/,
  /free tier/, /free trial/, /enterprise/,
];

const TESTIMONIAL_WORDS = [
  "testimonial", "review", "said about", "what our customers",
  "customer stories", "case study", "success story",
];

function newCollector() {
  return {
    title: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
    h1Tags: [],
    h2Tags: [],
    pricingIndicators: [],
    socialLinks: [],
    ctas: [],
    testimonialCount: 0,
    logoCount: 0,
    allText: [],
    _inTitle: false,
    _inH1: false,
    _inH2: false,
    _inA: false,
    _inButton: false,
    _currentText: "",
  };
}

function collectorHandlers(c) {
  function scanTextSignals(data) {
    const textLower = data.toLowerCase().trim();
    for (let i = 0; i < PRICING_PATTERNS.length; i++) {
      if (PRICING_PATTERNS[i].test(textLower)) {
        c.pricingIndicators.push(data.trim());
        break;
      }
    }
    for (let i = 0; i < TESTIMONIAL_WORDS.length; i++) {
      if (textLower.indexOf(TESTIMONIAL_WORDS[i]) !== -1) {
        c.testimonialCount += 1;
        break;
      }
    }
  }

  return {
    onStartTag: function (tag, attrs) {
      if (tag === "title") {
        c._inTitle = true;
        c._currentText = "";
      } else if (tag === "meta") {
        const name = (attrs.name || "").toLowerCase();
        const prop = (attrs.property || "").toLowerCase();
        const content = attrs.content || "";
        if (name === "description") c.metaDescription = content;
        else if (prop === "og:title") c.ogTitle = content;
        else if (prop === "og:description") c.ogDescription = content;
      } else if (tag === "h1") {
        c._inH1 = true;
        c._currentText = "";
      } else if (tag === "h2") {
        c._inH2 = true;
        c._currentText = "";
      } else if (tag === "a") {
        c._inA = true;
        c._currentText = "";
        const href = attrs.href || "";
        Object.keys(SOCIAL_PLATFORMS).forEach(function (domain) {
          if (href.indexOf(domain) !== -1) {
            c.socialLinks.push({ platform: SOCIAL_PLATFORMS[domain], url: href });
          }
        });
      } else if (tag === "button") {
        c._inButton = true;
        c._currentText = "";
      } else if (tag === "img") {
        const alt = (attrs.alt || "").toLowerCase();
        const src = (attrs.src || "").toLowerCase();
        if (["logo", "client", "partner", "customer", "trusted"].some(function (w) { return alt.indexOf(w) !== -1; })) {
          c.logoCount += 1;
        }
        if (["logo", "client", "partner"].some(function (w) { return src.indexOf(w) !== -1; })) {
          c.logoCount += 1;
        }
      }
    },

    onEndTag: function (tag) {
      if (tag === "title" && c._inTitle) {
        c._inTitle = false;
        c.title = c._currentText.trim();
      } else if (tag === "h1" && c._inH1) {
        c._inH1 = false;
        const text = c._currentText.trim();
        if (text) c.h1Tags.push(text);
      } else if (tag === "h2" && c._inH2) {
        c._inH2 = false;
        const text = c._currentText.trim();
        if (text) c.h2Tags.push(text);
      } else if (tag === "a" && c._inA) {
        c._inA = false;
        const text = c._currentText.trim();
        const textLower = text.toLowerCase();
        if (CTA_WORDS.some(function (w) { return textLower.indexOf(w) !== -1; })) {
          c.ctas.push(text);
        }
      } else if (tag === "button" && c._inButton) {
        c._inButton = false;
        const text = c._currentText.trim();
        if (text) c.ctas.push(text);
      }
    },

    onText: function (data) {
      if (c._inTitle || c._inH1 || c._inH2 || c._inA || c._inButton) {
        c._currentText += data;
      }
      c.allText.push(data.trim());
      scanTextSignals(data);
    },

    onRawText: function () { /* script/style content carries no copy signals */ },
  };
}

function collectorResults(c) {
  const fullText = c.allText.join(" ");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  return {
    positioning: {
      headline: c.h1Tags.length ? c.h1Tags[0] : c.title,
      tagline: c.metaDescription,
      og_title: c.ogTitle,
      og_description: c.ogDescription,
      key_sections: c.h2Tags.slice(0, 10),
    },
    pricing: {
      has_pricing_info: c.pricingIndicators.length > 0,
      pricing_mentions: Array.from(new Set(c.pricingIndicators)).slice(0, 10),
    },
    trust: {
      social_platforms: c.socialLinks.map(function (s) { return s.platform; }),
      social_link_count: c.socialLinks.length,
      estimated_logo_count: c.logoCount,
      has_testimonials: c.testimonialCount > 0,
    },
    ctas: Array.from(new Set(c.ctas)).slice(0, 10),
    content: {
      word_count: wordCount,
      sections: c.h2Tags.length,
    },
  };
}

/** Parse a competitor page's HTML into the result shape (no network). */
function buildPageResults(html) {
  const collector = newCollector();
  parseHTML(html, collectorHandlers(collector));
  return collectorResults(collector);
}

// ---------------------------------------------------------------------------
// Fetching (redirects re-validated, gzip/deflate/br decoded, size-capped)
// ---------------------------------------------------------------------------

function requestOnce(urlObj, headers, timeoutMs, pin) {
  return new Promise(function (resolve) {
    const mod = urlObj.protocol === "https:" ? https : http;
    const options = { method: "GET", headers: headers };
    if (pin && pin.address) {
      // Connect to the exact address that passed validation - a re-resolve
      // here would reopen the DNS-rebinding window validateUrl closed.
      options.lookup = function (host, opts, cb) {
        if (opts && opts.all) return cb(null, [{ address: pin.address, family: pin.family }]);
        return cb(null, pin.address, pin.family);
      };
    }
    const req = mod.request(
      urlObj,
      options,
      function (res) {
        const chunks = [];
        let received = 0;
        res.on("data", function (chunk) {
          received += chunk.length;
          if (received > MAX_RESPONSE_SIZE) {
            chunks.push(chunk.slice(0, chunk.length - (received - MAX_RESPONSE_SIZE)));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", function () { finish(res, Buffer.concat(chunks)); });
        res.on("aborted", function () { finish(res, Buffer.concat(chunks)); });
        req.on("error", function () { finish(res, Buffer.concat(chunks)); });

        let done = false;
        function finish(response, body) {
          if (done) return;
          done = true;
          const encoding = (response.headers["content-encoding"] || "").toLowerCase();
          let decoded = body;
          try {
            if (encoding === "gzip") decoded = zlib.gunzipSync(body);
            else if (encoding === "deflate") decoded = zlib.inflateSync(body);
            else if (encoding === "br" && zlib.brotliDecompressSync) decoded = zlib.brotliDecompressSync(body);
          } catch (e) { /* keep raw body if decoding fails */ }
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: decoded.toString("utf8"),
          });
        }
      }
    );
    req.setTimeout(timeoutMs, function () { req.destroy(new Error("timeout")); });
    req.on("error", function () { resolve(null); });
    req.end();
  });
}

async function fetchViaJina(url) {
  try {
    const jinaUrl = new URL("https://r.jina.ai/" + url);
    const res = await requestOnce(jinaUrl, { "User-Agent": "Mozilla/5.0", Accept: "text/plain" }, JINA_TIMEOUT_MS);
    if (res && res.status && res.status >= 200 && res.status < 300) return res.body;
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchPage(rawUrl) {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = await validateUrl(current);
    if (!check.valid) return null;
    const res = await requestOnce(check.url, BROWSER_HEADERS, FETCH_TIMEOUT_MS, check);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      try {
        current = new URL(res.headers.location, current).toString();
      } catch (e) {
        return null;
      }
      continue;
    }
    if (res.status === 403) return fetchViaJina(current);
    if (res.status >= 200 && res.status < 300) return res.body;
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

async function scanCompetitor(rawUrl) {
  let url = rawUrl;
  if (url.indexOf("http") !== 0) url = "https://" + url;

  const parsed = new URL(url);
  const domain = parsed.host.replace(/^www\./, "");
  const result = { url: url, domain: domain, status: "success" };

  const html = await fetchPage(url);
  if (!html) {
    result.status = "error";
    result.message = "Could not fetch page";
    return result;
  }

  try {
    result.data = buildPageResults(html);
  } catch (e) {
    result.status = "error";
    result.message = "Could not parse page";
    return result;
  }

  // Probe for a public pricing page.
  const pricingUrls = [
    "https://" + parsed.host + "/pricing",
    "https://" + parsed.host + "/plans",
    "https://" + parsed.host + "/price",
  ];
  result.pricing_page = { found: false };
  for (let i = 0; i < pricingUrls.length; i++) {
    const pricingHtml = await fetchPage(pricingUrls[i]);
    if (pricingHtml && pricingHtml.length > 1000) {
      try {
        const pricingData = buildPageResults(pricingHtml);
        result.pricing_page = {
          url: pricingUrls[i],
          found: true,
          pricing_mentions: pricingData.pricing.pricing_mentions,
          sections: pricingData.positioning.key_sections,
        };
      } catch (e) { /* keep found: false */ }
      break;
    }
  }

  return result;
}

async function scanMultiple(urls) {
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    results.push(await scanCompetitor(urls[i]));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Selftest (offline - no network)
// ---------------------------------------------------------------------------

const FIXTURE_HTML = [
  "<html><head>",
  "<title>Rival CRM - Sales Pipeline Software</title>",
  '<meta name="description" content="The CRM sales teams actually use.">',
  '<meta property="og:title" content="Rival CRM">',
  '<meta property="og:description" content="Pipeline software for closers.">',
  "</head><body>",
  "<h1>Close more deals, faster</h1>",
  "<h2>Features</h2>",
  "<h2>What our customers say</h2>",
  "<h2>Plans</h2>",
  "<p>Starter at $29/month. Free trial for 14 days. Enterprise available.</p>",
  '<a href="/signup">Start free trial</a>',
  '<a href="https://linkedin.com/company/rival">LinkedIn</a>',
  '<a href="https://x.com/rivalcrm">X</a>',
  '<img src="/customers/acme-logo.png" alt="Acme customer logo">',
  "<button>Book a demo</button>",
  "</body></html>",
].join("\n");

async function selftest() {
  const failures = [];
  function assertEq(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) failures.push(label + ": expected " + e + ", got " + a);
  }

  // URL validation (literal IPs and schemes only - no DNS in the selftest).
  assertEq((await validateUrl("ftp://example.com/")).valid, false, "ftp scheme rejected");
  assertEq((await validateUrl("http://127.0.0.1/")).valid, false, "loopback rejected");
  assertEq((await validateUrl("http://192.168.1.1/")).valid, false, "192.168/16 rejected");
  assertEq((await validateUrl("http://[fe80::1]/")).valid, false, "IPv6 link-local rejected");
  assertEq((await validateUrl("http://93.184.216.34/")).valid, true, "public IPv4 accepted");

  // Parser on the fixture.
  const r = buildPageResults(FIXTURE_HTML);
  assertEq(r.positioning.headline, "Close more deals, faster", "h1 wins as headline");
  assertEq(r.positioning.tagline, "The CRM sales teams actually use.", "meta description as tagline");
  assertEq(r.positioning.og_title, "Rival CRM", "og:title extracted");
  assertEq(r.positioning.key_sections.length, 3, "three h2 sections");
  assertEq(r.pricing.has_pricing_info, true, "pricing indicators detected");
  if (r.pricing.pricing_mentions.length < 1) failures.push("pricing mentions: expected at least 1");
  assertEq(r.trust.social_link_count, 2, "two social links");
  assertEq(r.trust.social_platforms.slice().sort(), ["LinkedIn", "Twitter/X"], "platforms mapped");
  assertEq(r.trust.estimated_logo_count, 2, "logo counted from alt and src");
  assertEq(r.trust.has_testimonials, true, "testimonial signal from 'What our customers'");
  assertEq(r.ctas.indexOf("Start free trial") !== -1, true, "link CTA captured");
  assertEq(r.ctas.indexOf("Book a demo") !== -1, true, "button CTA captured");
  assertEq(r.content.sections, 3, "section count");
  if (r.content.word_count < 20) failures.push("word count: expected > 20, got " + r.content.word_count);

  // Headline falls back to title when no h1 exists.
  const noH1 = buildPageResults("<html><head><title>Only Title</title></head><body><p>text</p></body></html>");
  assertEq(noH1.positioning.headline, "Only Title", "title fallback when no h1");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: competitor_scanner.js (URL validation and parser hold)");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  if (args.indexOf("--selftest") !== -1) {
    await selftest();
    return;
  }
  if (!args.length) {
    console.log(JSON.stringify({
      usage: "node competitor_scanner.js <url1> [url2] [url3] ...",
      example: "node competitor_scanner.js competitor-one.com competitor-two.com competitor-three.com",
      description: "Scans competitor websites for positioning, pricing, and trust signals",
    }, null, 2));
    return;
  }

  const validated = [];
  for (let i = 0; i < args.length; i++) {
    let u = args[i];
    if (u.indexOf("http") !== 0) u = "https://" + u;
    const check = await validateUrl(u);
    if (!check.valid) {
      console.log(JSON.stringify({ url: u, status: "error", message: check.error }, null, 2));
      process.exit(1);
    }
    validated.push(u);
  }

  if (validated.length === 1) {
    console.log(JSON.stringify(await scanCompetitor(validated[0]), null, 2));
  } else {
    console.log(JSON.stringify({ competitors: await scanMultiple(validated) }, null, 2));
  }
}

if (require.main === module) {
  main().catch(function (e) {
    console.error(JSON.stringify({ status: "error", message: e.message }));
    process.exit(1);
  });
}

module.exports = {
  validateUrl: validateUrl,
  isPrivateIp: isPrivateIp,
  buildPageResults: buildPageResults,
  scanCompetitor: scanCompetitor,
};
