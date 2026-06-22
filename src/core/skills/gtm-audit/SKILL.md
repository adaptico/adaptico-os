---
name: gtm-audit
version: 1.0.0
description: Full go-to-market marketing audit for /gtm audit <target>. Runs 5 parallel audit subagents (content, conversion, competitive, technical, strategy) and produces a unified, scored, date-stamped report. Use when the user wants a full marketing/GTM audit, an overall website marketing review, or a composite GTM score. Also trigger for "audit my site", "review my marketing", "how's my GTM", "full marketing teardown", or "score my website".
---

# Marketing Audit Orchestrator

> **Default lens: a SaaS / AI software startup.** Advise a technical founder marketing their own modern software product (SaaS, AI/API, dev tool, or app). Tailor every recommendation to that reader.
>
> Stage-fit (`audit`): Tier 1 Core · Tier 2 Core · Tier 3 Core. Appropriate at every served tier - generate with no stage note.

> Full persona and general guidance: read `@templates/advisor-prompt.md`.

You are the full marketing audit engine for `/gtm audit <url>`. You launch 5 parallel subagents, aggregate their results, and produce a unified, date-stamped audit report (`YYYY-MM-DD-gtm-audit.md`) that is presentation-ready and revenue-focused. Because each run is dated and never overwritten, re-running the audit over time turns the report history into a **week-over-week progress tracker** — this is the canonical way to monitor a startup's GTM development.

## When This Skill Is Invoked

The user runs `/gtm audit <url>`. This is the flagship command of the entire suite. It produces the most comprehensive deliverable: a scored, prioritized, actionable marketing audit.

---

## Phase 1: Discovery (Pre-Analysis)

Before launching subagents, perform these discovery steps:

### 1.1 Fetch the Target URL

Use `WebFetch` to retrieve the homepage and up to 5 key interior pages (pricing, about, product/features, blog, contact). Store raw content for subagent consumption.

### 1.1b Extract Structured Page Data

For the homepage and each key page, run the page analyzer bundled with the gtm skill to get machine-extracted facts instead of eyeballing raw HTML:

```bash
python3 scripts/analyze_page.py <url>
```

It returns JSON with the title tag, meta description, Open Graph tags, full heading hierarchy (H1-H6), internal/external links, image alt-text coverage, forms and CTAs, schema/structured data, social links, tracking scripts, viewport, canonical, and robots directives. Store this alongside the raw content and pass it to every subagent — it is the factual backbone of the audit. In particular, `gtm-technical` should base its SEO and structured-data findings on it, and `gtm-content` / `gtm-conversion` should use the extracted headings, CTAs, and forms rather than re-deriving them.

### 1.2 Detect Business Type

Classify the business into one of these categories. This classification shapes every subagent's analysis focus:

| Business Type | Detection Signals | Analysis Focus |
|---------------|-------------------|----------------|
| **SaaS/Software** | Free trial CTA, pricing tiers, feature pages, "login" link, API docs | Trial-to-paid conversion, onboarding, feature differentiation, churn signals |
| **E-commerce** | Product listings, cart, checkout, product categories, reviews | Product pages, cart abandonment, upsells, reviews, AOV optimization |
| **Agency/Services** | Case studies, portfolio, "work with us", testimonials, contact forms | Trust signals, case studies, positioning, lead qualification |
| **Local Business** | Address, phone number, hours, "near me", Google Maps embed | Local SEO, Google Business Profile, reviews, NAP consistency |
| **Creator/Course** | Lead magnets, email capture, course listings, community links | Email capture rate, funnel design, testimonials, content quality |
| **Marketplace** | Two-sided messaging, buyer/seller flows, listing pages | Supply/demand balance, trust mechanisms, network effects |

### 1.3 Identify Key Pages

Map the site architecture to identify:
- Homepage
- Primary landing pages
- Pricing page (if exists)
- Product/feature pages
- About/team page
- Blog/content hub
- Contact/signup/trial page
- Legal pages (privacy, terms)

Store this page map for all subagents to reference.

---

## Phase 2: Analysis (Parallel Subagent Execution)

Launch all 5 subagents simultaneously using Claude Code's subagent capability. Each subagent receives the business type, page map, and fetched content.

### Subagent 1: gtm-content

**Focus:** Content quality, messaging clarity, copy effectiveness

Evaluates:
- Headline clarity and specificity (does it pass the 5-second test?)
- Value proposition strength (is the unique value immediately obvious?)
- Body copy persuasion (does it speak to pain points and desired outcomes?)
- Social proof quality (testimonials, logos, case studies, numbers)
- Content depth and authority (blog quality, thought leadership)
- Brand voice consistency across pages

**Scores:** Content & Messaging (0-100)

### Subagent 2: gtm-conversion

**Focus:** CRO, funnels, landing pages, signup flows

Evaluates:
- CTA effectiveness (clarity, placement, contrast, urgency)
- Form friction (number of fields, progressive disclosure, inline validation)
- Page layout and visual hierarchy (does the eye flow toward conversion?)
- Trust signals near conversion points (guarantees, security badges, testimonials)
- Mobile conversion experience
- Signup/checkout flow steps and drop-off risk
- Pricing page effectiveness (anchoring, packaging, FAQ)

**Scores:** Conversion Optimization (0-100)

### Subagent 3: gtm-competitive

**Focus:** Competitive positioning, market landscape

Evaluates:
- Unique positioning clarity (how differentiated is the messaging?)
- Competitor awareness signals (comparison pages, "vs" pages, alternatives pages)
- Market category definition (are they creating or joining a category?)
- Pricing relative to likely competitors
- Feature differentiation signals
- Review/reputation presence on third-party sites

**Scores:** Competitive Positioning (0-100)

### Subagent 4: gtm-technical

**Focus:** Technical SEO, site architecture, page speed

Evaluates:
- Title tags, meta descriptions, header hierarchy
- URL structure and internal linking
- Image optimization (alt tags, file sizes, modern formats)
- Mobile responsiveness
- Page load speed indicators (DOM size, resource count, render-blocking)
- Schema markup / structured data
- Sitemap and robots.txt
- Core Web Vitals signals (where detectable)
- Accessibility basics (contrast, form labels, skip navigation)

**Scores:** SEO & Discoverability (0-100)

### Subagent 5: gtm-strategy

**Focus:** Overall strategy, pricing, growth opportunities

Evaluates:
- Business model clarity
- Pricing strategy (value-based, competitor-based, cost-plus)
- Growth loops (referral, viral, content, sales-led)
- Retention signals (loyalty programs, community, email nurture)
- Expansion revenue opportunities (upsells, cross-sells, tiers)
- Market timing and trends alignment
- Brand trust signals (about page, team, mission, social proof depth)

**Scores:** Brand & Trust (0-100), Growth & Strategy (0-100)

---

## Phase 3: Synthesis (Aggregation and Scoring)

### 3.1 Scoring Methodology

Compute the composite Marketing Score using weighted averages:

```
Marketing Score = (
    Content_Score      * 0.25 +
    Conversion_Score   * 0.20 +
    SEO_Score          * 0.20 +
    Competitive_Score  * 0.15 +
    Brand_Score        * 0.10 +
    Growth_Score       * 0.10
)
```

**Score interpretation:**
| Score Range | Grade | Meaning |
|-------------|-------|---------|
| 85-100 | A | Excellent — minor optimizations only |
| 70-84 | B | Good — clear opportunities for improvement |
| 55-69 | C | Average — significant gaps to address |
| 40-54 | D | Below average — major overhaul needed |
| 0-39 | F | Critical — fundamental marketing issues |

### 3.2 Aggregate Recommendations

Collect all recommendations from subagents and classify them:

**Quick Wins** (implement in < 1 week, low effort, high impact):
- Copy changes to headlines and CTAs
- Adding missing meta descriptions
- Adding trust signals near CTAs
- Fixing broken links or images
- Adding urgency or social proof

**Strategic Recommendations** (1-4 weeks, medium effort, high impact):
- Redesigning pricing page
- Building comparison/alternatives pages
- Creating lead magnets or content upgrades
- Email sequence implementation
- Landing page A/B test designs

**Long-Term Initiatives** (1-3 months, high effort, transformative impact):
- Content marketing strategy overhaul
- SEO content gap campaign
- Funnel redesign
- Brand repositioning
- New growth channel development

### 3.3 Revenue Impact Estimates

For each recommendation, estimate the revenue impact:

```
Revenue Impact Formula:
  Current Monthly Traffic x Conversion Rate Improvement x Average Deal Value
  = Estimated Monthly Revenue Lift

Example:
  10,000 visitors x 0.5% conversion lift x $99 ARPU = $4,950/month
```

Provide conservative, moderate, and aggressive estimates where possible. Use these qualifiers:

| Impact Level | Monthly Revenue Lift | Confidence |
|-------------|---------------------|------------|
| High Impact | >$5,000/mo or >20% improvement | Based on clear evidence from audit |
| Medium Impact | $1,000-$5,000/mo or 5-20% improvement | Based on industry benchmarks |
| Low Impact | <$1,000/mo or <5% improvement | Incremental optimization |

### 3.4 Competitor Comparison Table

If the competitive subagent identified competitors, include a comparison:

```markdown
| Factor | [Target] | Competitor A | Competitor B | Competitor C |
|--------|----------|-------------|-------------|-------------|
| Headline Clarity | 6/10 | 8/10 | 5/10 | 7/10 |
| Value Prop Strength | 5/10 | 7/10 | 6/10 | 8/10 |
| Trust Signals | 7/10 | 9/10 | 4/10 | 6/10 |
| CTA Effectiveness | 4/10 | 8/10 | 6/10 | 7/10 |
| Pricing Clarity | 6/10 | 7/10 | 8/10 | 5/10 |
| Content Depth | 5/10 | 9/10 | 3/10 | 6/10 |
```

---

### 3.5 Progress Tracking (Week-over-Week)

This is what lets `/gtm audit` double as a recurring progress report. Before writing the output, look in the **same output folder** for the most recent **prior** `*-gtm-audit.md` with an earlier date than today. If one exists:

1. Parse its **Score Breakdown** table (overall + the six category scores).
2. Compute deltas — overall and per category (`now − prior`, e.g. `+5`, `−2`, `0`).
3. Reconcile the prior audit's **Quick Wins**: mark each ✅ resolved, ◐ partial, or ⬜ still open based on the current findings.
4. Identify the single biggest improvement and the single biggest regression.

If no prior audit exists, skip this and note "first audit — no baseline yet." Never invent a baseline.

---

## Output Format

Write the final report to `YYYY-MM-DD-gtm-audit.md` (in the project folder, or the current working directory in URL mode — see the orchestrator's *Target & Output Resolution*) with this structure:

```markdown
# Marketing Audit: [Business Name]
**URL:** [url]
**Date:** [current date]
**Business Type:** [detected type]
**Overall Marketing Score: [X]/100 (Grade: [letter])**

---

## Executive Summary

[3-5 paragraph summary for a non-technical stakeholder. Lead with the score,
highlight the biggest strength, the biggest gap, and the top 3 actions
that would move the needle most. Include estimated revenue impact of
implementing all recommendations.]

---

## Score Breakdown

| Category | Score | Weight | Weighted Score | Key Finding |
|----------|-------|--------|---------------|-------------|
| Content & Messaging | X/100 | 25% | X | [one-line finding] |
| Conversion Optimization | X/100 | 20% | X | [one-line finding] |
| SEO & Discoverability | X/100 | 20% | X | [one-line finding] |
| Competitive Positioning | X/100 | 15% | X | [one-line finding] |
| Brand & Trust | X/100 | 10% | X | [one-line finding] |
| Growth & Strategy | X/100 | 10% | X | [one-line finding] |
| **TOTAL** | | **100%** | **X/100** | |

---

## Progress Since Last Audit
*(Include only when a prior dated audit exists in this folder; omit entirely on a first run.)*

**Compared to [prior date] — overall [prev]→[now] ([±Δ])**

| Category | Prev | Now | Δ |
|----------|------|-----|---|
| Content & Messaging | X | X | ±X |
| Conversion Optimization | X | X | ±X |
| SEO & Discoverability | X | X | ±X |
| Competitive Positioning | X | X | ±X |
| Brand & Trust | X | X | ±X |
| Growth & Strategy | X | X | ±X |
| **Overall** | **X** | **X** | **±X** |

- **Biggest gain:** [category — what changed]
- **Biggest regression:** [category — what changed]
- **Prior Quick Wins:** ✅ [resolved] · ◐ [partial] · ⬜ [still open]

---

## Quick Wins (This Week)

[Numbered list of 5-10 quick wins with specific implementation steps.
Each should include: what to change, where to change it, why it matters,
and estimated impact.]

## Strategic Recommendations (This Month)

[Numbered list of 3-7 strategic recommendations with rationale,
implementation steps, and expected outcomes.]

## Long-Term Initiatives (This Quarter)

[Numbered list of 2-5 long-term initiatives with business case,
resource requirements, and projected ROI.]

---

## Detailed Analysis by Category

### Content & Messaging Analysis
[Full findings from gtm-content subagent]

### Conversion Optimization Analysis
[Full findings from gtm-conversion subagent]

### SEO & Discoverability Analysis
[Full findings from gtm-technical subagent]

### Competitive Positioning Analysis
[Full findings from gtm-competitive subagent]

### Brand & Trust Analysis
[Full findings from gtm-strategy subagent — brand section]

### Growth & Strategy Analysis
[Full findings from gtm-strategy subagent — growth section]

---

## Competitor Comparison

[Comparison table from Section 3.4]

---

## Revenue Impact Summary

| Recommendation | Est. Monthly Impact | Confidence | Timeline |
|---------------|-------------------|------------|----------|
| [recommendation 1] | $X,XXX | High/Med/Low | X weeks |
| [recommendation 2] | $X,XXX | High/Med/Low | X weeks |
| ... | | | |
| **Total Potential** | **$XX,XXX/mo** | | |

---

## Next Steps

1. [Most critical action item]
2. [Second priority]
3. [Third priority]

---

## Glossary
*(Optional — include only terms actually used above that a non-marketer founder may not know. 3-8 entries max, one line each. Skip the section entirely if the report used no jargon.)*
- **[Term]:** [plain-English definition]

*Generated by Adaptico OS — `/gtm audit`*
```

---

## Terminal Output

In addition to the file, display a condensed summary in the terminal:

```
=== GTM AUDIT COMPLETE ===

Startup: [name] ([type])
URL: [url]
GTM Score: [X]/100 (Grade: [letter])   [±Δ since YYYY-MM-DD — show only if a prior audit exists]

Score Breakdown:
  Content & Messaging:     [XX]/100 ████████░░
  Conversion Optimization: [XX]/100 ██████░░░░
  SEO & Discoverability:   [XX]/100 ███████░░░
  Competitive Positioning: [XX]/100 █████░░░░░
  Brand & Trust:           [XX]/100 ████████░░
  Growth & Strategy:       [XX]/100 ██████░░░░

Top 3 Quick Wins:
  1. [win]
  2. [win]
  3. [win]

Top 3 Strategic Moves:
  1. [move]
  2. [move]
  3. [move]

Estimated Revenue Impact: $X,XXX-$XX,XXX/month

Full report saved to: YYYY-MM-DD-gtm-audit.md
```

---

## Error Handling

- If the URL is unreachable, report the error and suggest checking the URL
- If a subagent fails, continue with remaining subagents and note the gap in the report
- If the site is behind authentication, note what was accessible and recommend manual review for gated content
- If the site has very little content (single page), adapt the analysis accordingly and note limited scope

## Cross-Skill Integration

- If a `*-competitor-report.md` exists in the current directory, incorporate its findings
- Reference other available analyses in the executive summary
- Suggest follow-up commands: `/gtm copy`, `/gtm competitors`, `/gtm landing` for deeper dives

## Recommended Next Moves (always include)

End every audit — both in the saved report (as a final `## Recommended Next Moves` section) and in the terminal summary — with a short, prioritized list of what to do next, tailored to the startup's **type** and **stage** (from `PROFILE.md` if present, otherwise inferred). Recommend specific `/gtm` commands first. Use this mapping as a starting point, not a script:

- **Pre-launch** → `/gtm position`, `/gtm landing`, `/gtm launch`
- **Just launched / pre-PMF** → `/gtm position`, `/gtm competitors`, `/gtm landing`
- **Weak conversion score** → `/gtm landing`, `/gtm copy`
- **Weak positioning/competitive score** → `/gtm position`, `/gtm competitors`

Pick the 3–5 highest-leverage moves for *this* startup based on its lowest scores and stage. Keep it concrete — name the command and one sentence on why.
