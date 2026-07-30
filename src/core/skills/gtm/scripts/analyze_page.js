#!/usr/bin/env node
/**
 * Marketing Page Analyzer - utility script for Adaptico OS.
 * Analyzes a webpage for marketing effectiveness: SEO elements, content
 * structure, trust signals, CTAs, social proof, and conversion indicators.
 *
 * Usage:
 *   node analyze_page.js <url>
 *   node analyze_page.js --selftest
 *
 * Output: JSON (same shape the audit and its subagents consume).
 *
 * Zero dependencies (Node standard library only). Security: only http/https
 * URLs that resolve to public addresses are fetched; every redirect hop is
 * re-validated. Falls back to Jina Reader on 403 (bot-blocked pages).
 * Exit codes: 0 success; 1 validation/fetch error. Selftest: 0 pass, 1 fail.
 */

"use strict";

const fs = require("fs");
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
  if (a === 0 || a === 10 || a === 127) return true;              // this-net, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true;              // CGNAT 100.64/10
  if (a === 169 && b === 254) return true;                        // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;               // private 172.16/12
  if (a === 192 && b === 168) return true;                        // private 192.168/16
  if (a === 192 && b === 0 && parts[2] === 0) return true;        // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true;           // benchmarking 198.18/15
  if (a >= 224) return true;                                      // multicast + reserved
  return false;
}

function isPrivateIpv6(ip) {
  const low = ip.toLowerCase();
  if (low === "::" || low === "::1") return true;                 // unspecified, loopback
  if (low.indexOf("::ffff:") === 0) {                             // IPv4-mapped
    const v4 = low.slice(7);
    return net.isIP(v4) === 4 ? isPrivateIpv4(v4) : true;
  }
  if (/^f[cd]/.test(low)) return true;                            // ULA fc00::/7
  if (/^fe[89ab]/.test(low)) return true;                         // link-local fe80::/10
  return false;
}

function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true; // not an IP at all - treat as unsafe
}

/**
 * Validate that a URL is http/https and points at a public internet address.
 * Resolves hostnames via DNS. Returns { valid, error, url (parsed), and for
 * DNS-resolved hosts address/family - the validated answer requestOnce pins }.
 */
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
  let hostname = parsed.hostname;
  if (!hostname) return { valid: false, error: "URL has no hostname" };
  // Strip brackets from IPv6 literals for the IP check.
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

/** Find the '>' that ends a tag starting at html[start] === '<', honoring quotes. */
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

/**
 * Stream the HTML through handlers:
 *   onStartTag(tag, attrs, selfClosing), onEndTag(tag),
 *   onText(decodedText), onRawText(tag, rawContent, attrs)  [script/style bodies]
 */
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
    if (next === "!" || next === "?") { // doctype, CDATA, processing instruction
      const end = html.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      continue;
    }

    const isEnd = next === "/";
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9:-]*/.exec(html.slice(lt + (isEnd ? 2 : 1)));
    if (!nameMatch) { // stray '<'
      handlers.onText("<");
      i = lt + 1;
      continue;
    }
    const gt = findTagEnd(html, lt);
    if (gt === -1) break; // unterminated tag - stop
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
// Marketing page collector (mirrors the audit's data contract)
// ---------------------------------------------------------------------------

const CTA_WORDS = [
  "sign up", "get started", "try free", "start free", "buy now",
  "subscribe", "join", "register", "download", "book", "schedule",
  "request demo", "contact us", "learn more", "see pricing",
  "start trial", "create account", "claim", "unlock",
];

const SOCIAL_PLATFORMS = [
  "twitter.com", "x.com", "facebook.com", "linkedin.com",
  "instagram.com", "youtube.com", "tiktok.com", "github.com",
];

const TRACKING_INDICATORS = {
  gtag: "Google Analytics (gtag)",
  googletagmanager: "Google Tag Manager",
  "google-analytics": "Google Analytics",
  analytics: "Analytics",
  fbevents: "Meta Pixel",
  facebook: "Meta/Facebook",
  "snap.licdn": "LinkedIn Insight Tag",
  hotjar: "Hotjar",
  fullstory: "FullStory",
  mixpanel: "Mixpanel",
  amplitude: "Amplitude",
  segment: "Segment",
  hubspot: "HubSpot",
  intercom: "Intercom",
  crisp: "Crisp Chat",
  drift: "Drift",
  tiktok: "TikTok Pixel",
  clarity: "Microsoft Clarity",
};

function newCollector() {
  return {
    title: "",
    metaDescription: "",
    metaKeywords: "",
    ogTags: {},
    headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
    links: [],
    images: [],
    forms: [],
    buttons: [],
    scripts: [],
    schemaData: [],
    ctas: [],
    socialLinks: [],
    trackingScripts: [],
    hasViewport: false,
    canonical: "",
    robotsMeta: "",
    textContent: [],
    // state
    _inTitle: false,
    _inHeading: null,
    _inButton: false,
    _inA: false,
    _currentText: "",
    _inForm: false,
    _currentForm: null,
    _formFields: [],
  };
}

function collectorHandlers(c) {
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
        else if (name === "keywords") c.metaKeywords = content;
        else if (name === "viewport") c.hasViewport = true;
        else if (name === "robots") c.robotsMeta = content;
        else if (prop.indexOf("og:") === 0) c.ogTags[prop] = content;
      } else if (tag === "link") {
        if ((attrs.rel || "").indexOf("canonical") !== -1) c.canonical = attrs.href || "";
      } else if (Object.prototype.hasOwnProperty.call(c.headings, tag)) {
        c._inHeading = tag;
        c._currentText = "";
      } else if (tag === "a") {
        c._inA = true;
        c._currentText = "";
        const href = attrs.href || "";
        c.links.push({ href: href, text: "", attrs: attrs });
        for (let i = 0; i < SOCIAL_PLATFORMS.length; i++) {
          if (href.indexOf(SOCIAL_PLATFORMS[i]) !== -1) {
            c.socialLinks.push({ platform: SOCIAL_PLATFORMS[i].split(".")[0], url: href });
          }
        }
      } else if (tag === "img") {
        c.images.push({
          src: attrs.src || "",
          alt: attrs.alt || "",
          has_alt: Object.prototype.hasOwnProperty.call(attrs, "alt"),
          loading: attrs.loading || "",
        });
      } else if (tag === "button") {
        c._inButton = true;
        c._currentText = "";
      } else if (tag === "form") {
        c._inForm = true;
        c._currentForm = {
          action: attrs.action || "",
          method: (attrs.method || "GET").toUpperCase(),
        };
        c._formFields = [];
      } else if (tag === "input" && c._inForm) {
        c._formFields.push({
          type: attrs.type || "text",
          name: attrs.name || "",
          placeholder: attrs.placeholder || "",
          required: Object.prototype.hasOwnProperty.call(attrs, "required"),
        });
      }
    },

    onEndTag: function (tag) {
      if (tag === "title" && c._inTitle) {
        c._inTitle = false;
        c.title = c._currentText.trim();
      } else if (Object.prototype.hasOwnProperty.call(c.headings, tag) && c._inHeading === tag) {
        const text = c._currentText.trim();
        if (text) c.headings[tag].push(text);
        c._inHeading = null;
      } else if (tag === "a" && c._inA) {
        c._inA = false;
        const text = c._currentText.trim();
        if (c.links.length) c.links[c.links.length - 1].text = text;
        const textLower = text.toLowerCase();
        for (let i = 0; i < CTA_WORDS.length; i++) {
          if (textLower.indexOf(CTA_WORDS[i]) !== -1) {
            c.ctas.push({ text: text, href: c.links[c.links.length - 1].href, type: "link" });
            break;
          }
        }
      } else if (tag === "button" && c._inButton) {
        c._inButton = false;
        const text = c._currentText.trim();
        if (text) {
          c.buttons.push(text);
          c.ctas.push({ text: text, type: "button" });
        }
      } else if (tag === "form" && c._inForm) {
        c._inForm = false;
        c._currentForm.fields = c._formFields;
        c._currentForm.field_count = c._formFields.length;
        c.forms.push(c._currentForm);
      }
    },

    onText: function (text) {
      if (c._inTitle || c._inHeading || c._inA || c._inButton) {
        c._currentText += text;
      }
      c.textContent.push(text);
    },

    onRawText: function (tag, content, attrs) {
      if (tag !== "script") return;
      const src = attrs.src || "";
      if (src) {
        c.scripts.push(src);
        const srcLower = src.toLowerCase();
        Object.keys(TRACKING_INDICATORS).forEach(function (indicator) {
          if (srcLower.indexOf(indicator) !== -1) {
            c.trackingScripts.push(TRACKING_INDICATORS[indicator]);
          }
        });
      }
      if (content.indexOf("gtag") !== -1 || content.indexOf("dataLayer") !== -1) {
        if (
          c.trackingScripts.indexOf("Google Analytics") === -1 &&
          c.trackingScripts.indexOf("Google Tag Manager") === -1
        ) {
          c.trackingScripts.push("Google Analytics/GTM (inline)");
        }
      }
      if (content.indexOf("fbq") !== -1 && c.trackingScripts.indexOf("Meta Pixel") === -1) {
        c.trackingScripts.push("Meta Pixel (inline)");
      }
      if ((attrs.type || "").toLowerCase() === "application/ld+json") {
        try {
          const schema = JSON.parse(content);
          if (Array.isArray(schema)) c.schemaData = c.schemaData.concat(schema);
          else c.schemaData.push(schema);
        } catch (e) { /* malformed JSON-LD - ignore */ }
      }
    },
  };
}

function collectorResults(c) {
  const imagesWithoutAlt = c.images.filter(function (img) { return !img.has_alt || !img.alt; }).length;
  const imagesWithLazy = c.images.filter(function (img) { return img.loading === "lazy"; }).length;

  const headingIssues = [];
  if (!c.headings.h1.length) headingIssues.push("Missing H1 tag");
  else if (c.headings.h1.length > 1) headingIssues.push("Multiple H1 tags (" + c.headings.h1.length + ")");
  if (c.headings.h3.length && !c.headings.h2.length) headingIssues.push("H3 used without H2 (skipped level)");

  const tracking = Array.from(new Set(c.trackingScripts));
  const fullText = c.textContent.join(" ");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  const headingsPresent = {};
  Object.keys(c.headings).forEach(function (k) {
    if (c.headings[k].length) headingsPresent[k] = c.headings[k];
  });

  return {
    seo: {
      title: c.title,
      title_length: c.title.length,
      title_ok: c.title.length >= 30 && c.title.length <= 60,
      meta_description: c.metaDescription,
      meta_description_length: c.metaDescription.length,
      meta_description_ok: c.metaDescription.length >= 120 && c.metaDescription.length <= 160,
      canonical: c.canonical,
      robots_meta: c.robotsMeta,
      has_viewport: c.hasViewport,
      og_tags: c.ogTags,
      headings: headingsPresent,
      heading_issues: headingIssues,
      images_total: c.images.length,
      images_without_alt: imagesWithoutAlt,
      images_with_lazy_loading: imagesWithLazy,
    },
    content: {
      word_count: wordCount,
      headings_count: Object.keys(c.headings).reduce(function (s, k) { return s + c.headings[k].length; }, 0),
      h1: c.headings.h1,
      h2: c.headings.h2,
    },
    conversion: {
      ctas: c.ctas.slice(0, 20),
      cta_count: c.ctas.length,
      forms: c.forms,
      form_count: c.forms.length,
      buttons: c.buttons.slice(0, 20),
    },
    trust: {
      social_links: c.socialLinks,
      social_link_count: c.socialLinks.length,
    },
    tracking: {
      tools_detected: tracking,
      tools_count: tracking.length,
      schema_types: c.schemaData.map(function (s) { return s["@type"] || "Unknown"; }),
      schema_count: c.schemaData.length,
    },
    technical: {
      total_links: c.links.length,
      internal_links: 0, // filled after URL analysis
      external_links: 0,
      scripts_count: c.scripts.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Scoring + result assembly (pure - used by analyze() and the selftest)
// ---------------------------------------------------------------------------

function computeScores(pageResults) {
  const scores = {};

  let seoScore = 10;
  const seo = pageResults.seo;
  if (!seo.title) seoScore -= 3;
  else if (!seo.title_ok) seoScore -= 1;
  if (!seo.meta_description) seoScore -= 3;
  else if (!seo.meta_description_ok) seoScore -= 1;
  if (!(seo.headings.h1 && seo.headings.h1.length)) seoScore -= 2;
  if (seo.images_without_alt > 0) seoScore -= Math.min(2, seo.images_without_alt);
  if (seo.heading_issues.length) seoScore -= 1;
  if (!seo.has_viewport) seoScore -= 1;
  scores.seo = Math.max(0, seoScore);

  let ctaScore = 5;
  const conv = pageResults.conversion;
  if (conv.cta_count === 0) ctaScore = 1;
  else if (conv.cta_count >= 2) ctaScore = 7;
  if (conv.cta_count >= 4) ctaScore = 8;
  const valueCtas = conv.ctas.filter(function (cta) { return (cta.text || "").length > 10; });
  if (valueCtas.length) ctaScore = Math.min(10, ctaScore + 1);
  scores.cta = ctaScore;

  let trustScore = 5;
  if (pageResults.trust.social_link_count >= 3) trustScore += 2;
  else if (pageResults.trust.social_link_count >= 1) trustScore += 1;
  if (pageResults.tracking.schema_count > 0) trustScore += 1;
  scores.trust = Math.min(10, trustScore);

  let trackScore = 3;
  if (pageResults.tracking.tools_count >= 3) trackScore = 9;
  else if (pageResults.tracking.tools_count >= 2) trackScore = 7;
  else if (pageResults.tracking.tools_count >= 1) trackScore = 5;
  scores.tracking = trackScore;

  return scores;
}

/** Parse HTML and assemble the page-level results for a given URL (no network). */
function buildPageResults(html, url) {
  const collector = newCollector();
  parseHTML(html, collectorHandlers(collector));
  const pageResults = collectorResults(collector);

  const domain = new URL(url).host;
  let internal = 0;
  let external = 0;
  collector.links.forEach(function (link) {
    const href = link.href || "";
    if (href.indexOf("/") === 0 || href.indexOf(domain) !== -1) internal += 1;
    else if (href.indexOf("http") === 0) external += 1;
  });
  pageResults.technical.internal_links = internal;
  pageResults.technical.external_links = external;

  const scores = computeScores(pageResults);
  pageResults.scores = scores;
  const values = Object.keys(scores).map(function (k) { return scores[k]; });
  pageResults.overall_score =
    Math.round((values.reduce(function (a, b) { return a + b; }, 0) / values.length) * 10) / 10;

  return pageResults;
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
            req.destroy(); // cap reached - keep what we have
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

/** Fetch via Jina Reader (r.jina.ai) when direct access is bot-blocked (403). */
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

/**
 * Fetch a page. Follows up to MAX_REDIRECTS redirects, re-validating every
 * hop against the public-address rules. Returns body text or null.
 */
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

async function fetchRobotsTxt(url) {
  const u = new URL(url);
  const content = await fetchPage(u.protocol + "//" + u.host + "/robots.txt");
  if (content) {
    return {
      exists: true,
      has_sitemap_reference: content.toLowerCase().indexOf("sitemap:") !== -1,
      content_preview: content.slice(0, 500),
    };
  }
  return { exists: false };
}

async function fetchSitemap(url) {
  const u = new URL(url);
  const content = await fetchPage(u.protocol + "//" + u.host + "/sitemap.xml");
  if (content) {
    const lower = content.toLowerCase();
    const urlCount = (lower.match(/<url>/g) || []).length || (lower.match(/<loc>/g) || []).length;
    return { exists: true, url_count: urlCount };
  }
  return { exists: false, url_count: 0 };
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

async function analyze(url) {
  const html = await fetchPage(url);
  if (!html) return { url: url, status: "error", message: "Could not fetch page" };

  let pageResults;
  try {
    pageResults = buildPageResults(html, url);
  } catch (e) {
    return { url: url, status: "error", message: "Parse error: " + e.message };
  }

  pageResults.robots = await fetchRobotsTxt(url);
  pageResults.sitemap = await fetchSitemap(url);

  return { url: url, status: "success", analysis: pageResults };
}

// ---------------------------------------------------------------------------
// Selftest (offline - no network)
// ---------------------------------------------------------------------------

const FIXTURE_HTML = [
  "<!DOCTYPE html>",
  "<html><head>",
  "<title>Acme Analytics &amp; Reports - Dashboards for SaaS Teams</title>",
  '<meta name="description" content="Acme turns your product data into decision-ready dashboards for SaaS teams. Connect your stack, pick a template, and share live reports with your whole company.">',
  '<meta name="keywords" content="analytics, dashboards">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="robots" content="index, follow">',
  '<meta property="og:title" content="Acme Analytics">',
  '<meta property="og:image" content="https://acme.example.com/og.png">',
  '<link rel="canonical" href="https://acme.example.com/">',
  '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>',
  "<script>window.dataLayer = window.dataLayer || [];</script>",
  '<script type="application/ld+json">{"@type": "Organization", "name": "Acme"}</script>',
  "</head><body>",
  "<h1>Ship better dashboards</h1>",
  "<h2>Why teams pick Acme</h2>",
  "<h2>Pricing</h2>",
  '<a href="/signup">Get started free</a>',
  '<a href="https://other.example.org/blog">Read the study</a>',
  '<a href="https://twitter.com/acme">Follow us</a>',
  '<img src="/hero.png" alt="Dashboard screenshot">',
  '<img src="/logo2.png" loading="lazy">',
  '<form action="/subscribe" method="post">',
  '<input type="email" name="email" placeholder="Work email" required>',
  '<input type="text" name="company">',
  "</form>",
  "<button>Start free trial</button>",
  "<p>Acme helps 400 SaaS teams make faster decisions every week.</p>",
  "</body></html>",
].join("\n");

async function selftest() {
  const failures = [];
  function assertEq(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) failures.push(label + ": expected " + e + ", got " + a);
  }

  // --- URL validation (literal IPs and schemes only - no DNS in the selftest)
  assertEq((await validateUrl("ftp://example.com/")).valid, false, "ftp scheme rejected");
  assertEq((await validateUrl("http://127.0.0.1/")).valid, false, "loopback rejected");
  assertEq((await validateUrl("http://10.0.0.5/")).valid, false, "10/8 rejected");
  assertEq((await validateUrl("http://192.168.1.1/")).valid, false, "192.168/16 rejected");
  assertEq((await validateUrl("http://172.16.0.1/")).valid, false, "172.16/12 rejected");
  assertEq((await validateUrl("http://169.254.1.1/")).valid, false, "link-local rejected");
  assertEq((await validateUrl("http://100.64.0.1/")).valid, false, "CGNAT rejected");
  assertEq((await validateUrl("http://[::1]/")).valid, false, "IPv6 loopback rejected");
  assertEq((await validateUrl("http://[fc00::1]/")).valid, false, "IPv6 ULA rejected");
  assertEq((await validateUrl("http://[fe80::1]/")).valid, false, "IPv6 link-local rejected");
  assertEq((await validateUrl("http://93.184.216.34/")).valid, true, "public IPv4 accepted");
  assertEq((await validateUrl("not a url")).valid, false, "garbage rejected");

  // --- Parser + assembly on the fixture
  const r = buildPageResults(FIXTURE_HTML, "https://acme.example.com/");
  assertEq(r.seo.title, "Acme Analytics & Reports - Dashboards for SaaS Teams", "title extracted + entity decoded");
  assertEq(r.seo.title_ok, true, "title length ok (30-60)");
  assertEq(r.seo.meta_description_ok, true, "meta description length ok (120-160)");
  assertEq(r.seo.canonical, "https://acme.example.com/", "canonical extracted");
  assertEq(r.seo.has_viewport, true, "viewport detected");
  assertEq(r.seo.robots_meta, "index, follow", "robots meta extracted");
  assertEq(r.seo.og_tags["og:title"], "Acme Analytics", "og tags extracted");
  assertEq(r.content.h1, ["Ship better dashboards"], "h1 extracted");
  assertEq(r.content.h2.length, 2, "two h2s extracted");
  assertEq(r.seo.heading_issues, [], "no heading issues on fixture");
  assertEq(r.seo.images_total, 2, "two images");
  assertEq(r.seo.images_without_alt, 1, "one image missing alt");
  assertEq(r.seo.images_with_lazy_loading, 1, "one lazy image");
  assertEq(r.conversion.form_count, 1, "one form");
  assertEq(r.conversion.forms[0].field_count, 2, "form has two fields");
  assertEq(r.conversion.forms[0].fields[0].required, true, "email field required");
  assertEq(r.conversion.cta_count, 2, "two CTAs (link + button)");
  assertEq(r.conversion.buttons, ["Start free trial"], "button text extracted");
  assertEq(r.trust.social_link_count, 1, "one social link");
  assertEq(r.tracking.schema_types, ["Organization"], "JSON-LD schema type extracted");
  const tools = r.tracking.tools_detected.slice().sort();
  assertEq(tools.indexOf("Google Tag Manager") !== -1, true, "GTM detected from script src");
  assertEq(r.technical.internal_links, 1, "one internal link");
  assertEq(r.technical.external_links, 2, "two external links");
  assertEq(r.technical.scripts_count, 1, "one external script");

  // --- Scoring math on the fixture
  // seo: 10 - 1 (one image without alt) = 9
  assertEq(r.scores.seo, 9, "seo score");
  // cta: 2 CTAs -> 7; value CTA ("Get started free" > 10 chars) -> 8
  assertEq(r.scores.cta, 8, "cta score");
  // trust: 5 + 1 (1 social link) + 1 (schema) = 7
  assertEq(r.scores.trust, 7, "trust score");
  // tracking: 2 tools (GTM + gtag-src indicators dedup to >=2) -> 7 or 3 tools -> 9
  if (r.scores.tracking < 7) failures.push("tracking score: expected >= 7, got " + r.scores.tracking);
  assertEq(typeof r.overall_score, "number", "overall score is a number");

  // --- Heading-issue detection on a degenerate page
  const degenerate = buildPageResults("<html><body><h3>Only an h3</h3></body></html>", "https://acme.example.com/");
  assertEq(
    degenerate.seo.heading_issues,
    ["Missing H1 tag", "H3 used without H2 (skipped level)"],
    "heading issues detected"
  );

  // --- Tokenizer robustness: comments, stray '<', unquoted attrs
  const odd = buildPageResults(
    "<!-- a comment --><h1 class=hero>Title with 3 < 5 math</h1>",
    "https://acme.example.com/"
  );
  assertEq(odd.content.h1.length, 1, "h1 survives comments and stray <");

  if (failures.length) {
    console.error("SELFTEST FAIL (" + failures.length + "):");
    failures.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
  console.log("SELFTEST PASS: analyze_page.js (URL validation, parser, scoring all hold)");
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
  // --out <file>: write the full JSON there and print a one-line summary
  // instead - keeps large payloads out of the terminal transcript.
  const outIdx = args.indexOf("--out");
  const outFile = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : null;
  const positional = args.filter(function (a, i) {
    if (outIdx !== -1 && (i === outIdx || i === outIdx + 1)) return false;
    return a.slice(0, 2) !== "--";
  });
  if (!positional.length) {
    console.log(JSON.stringify({
      usage: "node analyze_page.js <url> [--out <file>]",
      example: "node analyze_page.js https://yourstartup.com --out page.json",
      description: "Analyzes a webpage for marketing effectiveness; --out writes the full JSON to a file and prints only a one-line summary",
    }, null, 2));
    return;
  }

  let url = positional[0];
  if (url.indexOf("http") !== 0) url = "https://" + url;

  const check = await validateUrl(url);
  if (!check.valid) {
    console.log(JSON.stringify({ url: url, status: "error", message: check.error }, null, 2));
    process.exit(1);
  }

  const results = await analyze(url);
  if (!outFile) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  const a = results.analysis || {};
  const line = results.status === "success"
    ? "analyze_page: " + results.url + " - success (title " + ((a.seo && a.seo.title) ? "ok" : "missing") +
      ", h1 " + ((a.seo && a.seo.headings && a.seo.headings.h1 && a.seo.headings.h1.length) || 0) +
      ", ctas " + ((a.conversion && a.conversion.cta_count) || 0) +
      ", schema " + ((a.tracking && a.tracking.schema_count) || 0) + ")"
    : "analyze_page: " + results.url + " - " + results.status + (results.message ? " (" + results.message + ")" : "");
  console.log(line + " -> " + outFile);
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
  parseHTML: parseHTML,
  buildPageResults: buildPageResults,
  fetchPage: fetchPage,
};
