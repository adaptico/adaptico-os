#!/usr/bin/env python3
"""
Competitor Scanner — Utility script for Adaptico OS
Scans competitor websites to extract positioning, pricing, features, and trust signals
for competitive analysis.
"""

import sys
import json
import re
import socket
import ipaddress
import urllib.request
import urllib.error
import ssl
from html.parser import HTMLParser
from urllib.parse import urlparse

MAX_RESPONSE_SIZE = 5 * 1024 * 1024  # 5 MB — prevent memory exhaustion on huge pages


def validate_url(url):
    """Check URL uses http/https and resolves to a public internet address."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"
    if parsed.scheme not in ("http", "https"):
        return False, f"Scheme '{parsed.scheme}' is not allowed — only http and https are supported"
    hostname = parsed.hostname
    if not hostname:
        return False, "URL has no hostname"
    try:
        ip_str = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return False, f"'{hostname}' resolves to a private/internal address — only public internet URLs are supported"
    except socket.gaierror:
        return False, f"Could not resolve hostname '{hostname}'"
    return True, None


class CompetitorPageParser(HTMLParser):
    """Parse competitor page for positioning data."""

    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta_description = ""
        self.og_title = ""
        self.og_description = ""
        self.h1_tags = []
        self.h2_tags = []
        self.pricing_indicators = []
        self.social_links = []
        self.trust_signals = []
        self.ctas = []
        self.testimonial_count = 0
        self.logo_count = 0

        self._in_title = False
        self._in_h1 = False
        self._in_h2 = False
        self._in_a = False
        self._in_button = False
        self._current_text = ""
        self._all_text = []
        self._current_href = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == "title":
            self._in_title = True
            self._current_text = ""
        elif tag == "meta":
            name = attrs_dict.get("name", "").lower()
            prop = attrs_dict.get("property", "").lower()
            content = attrs_dict.get("content", "")
            if name == "description":
                self.meta_description = content
            elif prop == "og:title":
                self.og_title = content
            elif prop == "og:description":
                self.og_description = content
        elif tag == "h1":
            self._in_h1 = True
            self._current_text = ""
        elif tag == "h2":
            self._in_h2 = True
            self._current_text = ""
        elif tag == "a":
            self._in_a = True
            self._current_text = ""
            self._current_href = attrs_dict.get("href", "")
            # Social links
            social_platforms = {"twitter.com": "Twitter/X", "x.com": "Twitter/X",
                                "facebook.com": "Facebook", "linkedin.com": "LinkedIn",
                                "instagram.com": "Instagram", "youtube.com": "YouTube",
                                "tiktok.com": "TikTok", "github.com": "GitHub"}
            href = attrs_dict.get("href", "")
            for domain, name in social_platforms.items():
                if domain in href:
                    self.social_links.append({"platform": name, "url": href})
        elif tag == "button":
            self._in_button = True
            self._current_text = ""
        elif tag == "img":
            alt = attrs_dict.get("alt", "").lower()
            src = attrs_dict.get("src", "").lower()
            # Count customer logos
            if any(word in alt for word in ["logo", "client", "partner", "customer", "trusted"]):
                self.logo_count += 1
            if any(word in src for word in ["logo", "client", "partner"]):
                self.logo_count += 1

    def handle_endtag(self, tag):
        if tag == "title" and self._in_title:
            self._in_title = False
            self.title = self._current_text.strip()
        elif tag == "h1" and self._in_h1:
            self._in_h1 = False
            text = self._current_text.strip()
            if text:
                self.h1_tags.append(text)
        elif tag == "h2" and self._in_h2:
            self._in_h2 = False
            text = self._current_text.strip()
            if text:
                self.h2_tags.append(text)
        elif tag == "a" and self._in_a:
            self._in_a = False
            text = self._current_text.strip()
            cta_words = ["sign up", "get started", "try free", "start", "buy", "subscribe",
                         "join", "register", "download", "book", "demo", "contact", "pricing"]
            if any(w in text.lower() for w in cta_words):
                self.ctas.append(text)
        elif tag == "button" and self._in_button:
            self._in_button = False
            text = self._current_text.strip()
            if text:
                self.ctas.append(text)

    def handle_data(self, data):
        if self._in_title or self._in_h1 or self._in_h2 or self._in_a or self._in_button:
            self._current_text += data
        self._all_text.append(data.strip())

        # Detect pricing indicators
        text_lower = data.lower().strip()
        pricing_patterns = [r"\$\d+", r"€\d+", r"£\d+", r"/month", r"/year", r"/mo",
                            r"per month", r"per year", r"annually", r"free plan",
                            r"free tier", r"free trial", r"enterprise"]
        for pattern in pricing_patterns:
            if re.search(pattern, text_lower):
                self.pricing_indicators.append(data.strip())
                break

        # Detect testimonials
        testimonial_words = ["testimonial", "review", "said about", "what our customers",
                             "customer stories", "case study", "success story"]
        if any(w in text_lower for w in testimonial_words):
            self.testimonial_count += 1

    def get_results(self):
        full_text = " ".join(self._all_text)
        word_count = len(full_text.split())

        # Extract positioning
        positioning = self.og_description or self.meta_description or ""
        if self.h1_tags:
            positioning = self.h1_tags[0]

        return {
            "positioning": {
                "headline": self.h1_tags[0] if self.h1_tags else self.title,
                "tagline": self.meta_description,
                "og_title": self.og_title,
                "og_description": self.og_description,
                "key_sections": self.h2_tags[:10]
            },
            "pricing": {
                "has_pricing_info": len(self.pricing_indicators) > 0,
                "pricing_mentions": list(set(self.pricing_indicators))[:10]
            },
            "trust": {
                "social_platforms": [s["platform"] for s in self.social_links],
                "social_link_count": len(self.social_links),
                "estimated_logo_count": self.logo_count,
                "has_testimonials": self.testimonial_count > 0
            },
            "ctas": list(set(self.ctas))[:10],
            "content": {
                "word_count": word_count,
                "sections": len(self.h2_tags)
            }
        }


_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}


def _fetch_via_jina(url):
    """Fetch a page via Jina Reader (r.jina.ai) as a fallback when direct access is blocked."""
    jina_url = f"https://r.jina.ai/{url}"
    ctx = ssl.create_default_context()
    req = urllib.request.Request(jina_url, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/plain"})
    try:
        response = urllib.request.urlopen(req, timeout=20, context=ctx)
        return response.read(MAX_RESPONSE_SIZE).decode("utf-8", errors="replace")
    except Exception:
        return None


def fetch_page(url):
    """Fetch a webpage. Falls back to Jina Reader on 403 (bot-blocked)."""
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers=_BROWSER_HEADERS)
    try:
        response = urllib.request.urlopen(req, timeout=15, context=ctx)
        return response.read(MAX_RESPONSE_SIZE).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 403:
            return _fetch_via_jina(url)
        return None
    except Exception:
        return None


def scan_competitor(url):
    """Scan a competitor website."""
    if not url.startswith("http"):
        url = "https://" + url

    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "")

    result = {
        "url": url,
        "domain": domain,
        "status": "success"
    }

    html = fetch_page(url)
    if not html:
        result["status"] = "error"
        result["message"] = "Could not fetch page"
        return result

    parser = CompetitorPageParser()
    try:
        parser.feed(html)
    except Exception:
        result["status"] = "error"
        result["message"] = "Could not parse page"
        return result

    result["data"] = parser.get_results()

    # Try to fetch pricing page
    pricing_urls = [
        f"https://{parsed.netloc}/pricing",
        f"https://{parsed.netloc}/plans",
        f"https://{parsed.netloc}/price",
    ]

    for pricing_url in pricing_urls:
        pricing_html = fetch_page(pricing_url)
        if pricing_html and len(pricing_html) > 1000:
            pricing_parser = CompetitorPageParser()
            try:
                pricing_parser.feed(pricing_html)
                pricing_data = pricing_parser.get_results()
                result["pricing_page"] = {
                    "url": pricing_url,
                    "found": True,
                    "pricing_mentions": pricing_data["pricing"]["pricing_mentions"],
                    "sections": pricing_data["positioning"]["key_sections"]
                }
            except Exception:
                pass
            break
    else:
        result["pricing_page"] = {"found": False}

    return result


def scan_multiple(urls):
    """Scan multiple competitor URLs."""
    results = []
    for url in urls:
        result = scan_competitor(url)
        results.append(result)
    return results


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "usage": "python3 competitor_scanner.py <url1> [url2] [url3] ...",
            "example": "python3 competitor_scanner.py calendly.com acuityscheduling.com doodle.com",
            "description": "Scans competitor websites for positioning, pricing, and trust signals"
        }, indent=2))
        return

    urls = sys.argv[1:]
    validated = []
    for u in urls:
        if not u.startswith("http"):
            u = "https://" + u
        valid, error = validate_url(u)
        if not valid:
            print(json.dumps({"url": u, "status": "error", "message": error}, indent=2))
            sys.exit(1)
        validated.append(u)

    if len(validated) == 1:
        result = scan_competitor(validated[0])
        print(json.dumps(result, indent=2, default=str))
    else:
        results = scan_multiple(validated)
        print(json.dumps({"competitors": results}, indent=2, default=str))


if __name__ == "__main__":
    main()
