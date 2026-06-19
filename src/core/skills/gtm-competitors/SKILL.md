# Competitive Intelligence Analysis

> **Default lens: a SaaS / AI software startup.** Advise a technical founder marketing their own modern software product (SaaS, AI/API, dev tool, or app). Tailor every recommendation to that reader.
>
> Stage-fit (`competitors`): Tier 1 Core · Tier 2 Core · Tier 3 Core. Appropriate at every served tier - generate with no stage note.

> Full persona and general guidance: read `@templates/advisor-prompt.md`.

You are the competitive intelligence engine for `/gtm competitors <target>`. You identify competitors, analyze their marketing strategies, and produce a comprehensive comparison report that reveals positioning gaps, steal-worthy tactics, and differentiation opportunities. Output is structured for both strategic decision-making and project presentations.

> **Scope note:** This is the deep competitive analysis. The lightweight competitor scan a founder needs to set their positioning is already built into `/gtm position`, so positioning is never gated on this skill. Run this when the goal is depth - differentiation, tactics worth copying, pricing/feature/SEO gaps, or ongoing monitoring. Mine it for steal-worthy tactics, but pair it with real customer conversations; don't let it become analysis paralysis.

## When This Skill Is Invoked

The user runs `/gtm competitors <target>`. In project mode, seed from PROFILE.md (Phase 0), then identify and analyze competitors, write results back to PROFILE.md, and save the report as `YYYY-MM-DD-competitor-report.md` in the project folder. In URL mode, save to the current working directory.

---

## Phase 0: Seed from PROFILE.md (Project Mode Only)

Before doing any discovery, check whether competitors are already known. In project mode, read `PROFILE.md` and look for entries in:
- `### User-Added Competitors` — competitors the founder specified manually
- `### AI-Researched Competitors` — competitors discovered by a previous run of this skill

Collect all entries from both sections as your **seed list**. In Phase 1, start from this list and expand it rather than starting from scratch. Competitors already in the seed list do not need to be re-discovered, but do still need to be fully analyzed if they haven't been profiled yet.

If both sections are empty and the user hasn't already been asked (via the orchestrator's Competitor Resolution Protocol), offer to proceed with full discovery or ask the user to provide starting names.

---

## Phase 1: Competitor Identification

### 1.1 Competitor Categories

Identify competitors across three tiers:

| Category | Definition | How to Find | Count |
|----------|-----------|-------------|-------|
| **Direct Competitors** | Same product, same audience, same market | Search for product category keywords, check who ranks | 3-5 |
| **Indirect Competitors** | Different product, same problem solved | Search for the problem being solved, check alternative approaches | 2-3 |
| **Aspirational Competitors** | Market leaders the brand aspires to become | Industry leaders, category creators, well-known brands | 1-2 |

### 1.2 Competitor Discovery Methods

Use multiple methods to identify competitors:

**Method 1: Keyword-Based Discovery**
- Search for the target site's primary keywords
- Note which companies rank on page 1
- Search for "[product category] software/service/tool"
- Search for "[target brand] alternatives"
- Search for "[target brand] vs"

**Method 2: Site-Based Discovery**
- Look for comparison pages on the target site
- Check footer links for industry associations
- Look for "integrations" pages that mention similar tools
- Check the target site's blog for competitor mentions

**Method 3: Review Platform Discovery**
- Search G2, Capterra, Trustpilot for the product category
- Note top-rated competitors in the same category
- Check "Compare" features on review sites

**Method 4: Social and Community Discovery**
- Search Reddit for "[product category] recommendations"
- Check Twitter/X for conversations about the product category
- Look at LinkedIn for companies followed by the target's audience

### 1.3 Automated Data Collection

Use the Python script at `scripts/competitor_scanner.py` for automated data collection when available:

```
python scripts/competitor_scanner.py --url [competitor-url] --output json
```

The script can collect:
- Homepage content and metadata
- Pricing page data (if public)
- Blog post count and recent topics
- Social media profile links and follower counts
- Technology stack detection
- Page speed metrics

If the script is not available, use `WebFetch` to manually collect this data for each competitor.

---

## Phase 2: Competitor Analysis Framework

### 2.1 Website and Messaging Analysis

For each competitor, analyze:

**Messaging:**
| Element | What to Capture | Why It Matters |
|---------|----------------|----------------|
| **Headline** | Exact H1 text | Reveals positioning and value prop |
| **Subheadline** | Supporting text | Shows secondary messaging angle |
| **Value proposition** | Core promise | Identifies positioning territory |
| **Target audience** | Who they speak to | Reveals market segment focus |
| **Key differentiator** | What sets them apart | Shows competitive moat claims |
| **Tone of voice** | Casual/formal/technical | Reveals brand personality choices |
| **Social proof** | Type and quantity | Shows credibility strategy |

**Positioning Map:**
Plot each competitor on two axes:
- X-axis: Perceived simplicity ←→ Perceived power
- Y-axis: Perceived affordability ←→ Perceived premium

```
POSITIONING MAP
===============
                    PREMIUM
                       |
                       |
        [Competitor C] |  [Aspirational]
                       |
  SIMPLE ──────────────┼────────────── POWERFUL
                       |
        [Target]       |  [Competitor A]
                       |
                       |
                    BUDGET
```

Adjust axes based on what matters most in the specific industry.

### 2.2 Pricing Comparison

Build a detailed pricing matrix:

```markdown
| Feature/Plan | [Target] | Competitor A | Competitor B | Competitor C |
|-------------|----------|-------------|-------------|-------------|
| Free Plan | Yes/No | Yes/No | Yes/No | Yes/No |
| Starter Price | $X/mo | $X/mo | $X/mo | $X/mo |
| Pro Price | $X/mo | $X/mo | $X/mo | $X/mo |
| Enterprise | Custom | Custom | $X/mo | Custom |
| Free Trial | X days | X days | X days | X days |
| Annual Discount | X% | X% | X% | X% |
| Per-User Pricing | Yes/No | Yes/No | Yes/No | Yes/No |
| Usage Limits | [detail] | [detail] | [detail] | [detail] |
```

**Pricing Strategy Assessment:**
- Is the target priced above, below, or at market average?
- Is pricing transparent or hidden (requiring sales calls)?
- What pricing model is used (per-user, per-usage, flat-rate, tiered)?
- Are there pricing anchoring tactics being used?
- Does the pricing page communicate value before showing numbers?

### 2.3 Feature Comparison Matrix

Build a comprehensive feature comparison:

```markdown
| Feature Category | Feature | [Target] | Comp A | Comp B | Comp C |
|-----------------|---------|----------|--------|--------|--------|
| Core | [Feature 1] | Full | Full | Partial | No |
| Core | [Feature 2] | Full | Full | Full | Full |
| Core | [Feature 3] | Partial | Full | No | Full |
| Advanced | [Feature 4] | No | Full | No | Full |
| Advanced | [Feature 5] | Full | No | Full | No |
| Integration | [Feature 6] | Full | Full | No | Partial |
| Support | [Feature 7] | Full | Partial | Full | Full |
```

Use: Full, Partial, No, or Beta to categorize.

Highlight:
- Features where the target has an advantage (competitive moats)
- Features where the target has a gap (vulnerability)
- Features unique to one competitor (potential differentiators)

### 2.4 SEO Competition Analysis

For each competitor, analyze:

**Content Strategy:**
| Metric | [Target] | Comp A | Comp B | Comp C |
|--------|----------|--------|--------|--------|
| Blog posts (estimated) | X | X | X | X |
| Publishing frequency | X/week | X/week | X/week | X/week |
| Content depth | Shallow/Medium/Deep | | | |
| Content types | Blog/Video/Podcast | | | |
| Key topics | [list] | [list] | [list] | [list] |

**Keyword Strategy:**
- What keywords is each competitor clearly targeting?
- Where do multiple competitors rank but the target does not? (content gaps)
- Are competitors creating comparison/alternatives content?
- What long-tail keywords are competitors ranking for?

**Content Gap Analysis:**
List topics that competitors cover but the target does not:
```
CONTENT GAPS (Competitors Cover, Target Does Not):
  1. [Topic] — covered by Comp A, B (high search intent)
  2. [Topic] — covered by Comp A, C (medium search intent)
  3. [Topic] — covered by Comp B (high search intent)
  4. [Topic] — covered by all competitors (critical gap)
```

### 2.5 Social Media Presence Comparison

| Platform | [Target] | Comp A | Comp B | Comp C |
|----------|----------|--------|--------|--------|
| LinkedIn followers | X | X | X | X |
| Twitter/X followers | X | X | X | X |
| Instagram followers | X | X | X | X |
| YouTube subscribers | X | X | X | X |
| TikTok followers | X | X | X | X |
| Posting frequency | X/week | X/week | X/week | X/week |
| Engagement rate | X% | X% | X% | X% |
| Top content type | [type] | [type] | [type] | [type] |

### 2.6 Review Mining

Analyze reviews on third-party platforms (G2, Capterra, Trustpilot, Reddit):

**For each competitor, extract:**
- Overall rating (stars)
- Number of reviews
- Top 3 praised features (what customers love)
- Top 3 complaints (what customers hate)
- Common switching reasons (why customers leave)
- Use cases mentioned most frequently

**Review Intelligence Matrix:**
```markdown
| Competitor | Rating | Reviews | Top Praise | Top Complaint | Switch Reason |
|-----------|--------|---------|-----------|---------------|--------------|
| Comp A | 4.5/5 | 500+ | Easy to use | Limited integrations | Price increase |
| Comp B | 4.2/5 | 200+ | Powerful features | Steep learning curve | Poor support |
| Comp C | 3.8/5 | 100+ | Good value | Buggy | Better alternatives |
```

---

## Phase 3: SWOT Analysis

### 3.1 SWOT for Each Competitor

For each identified competitor, produce a SWOT:

```
COMPETITOR: [Name]
URL: [url]

STRENGTHS:
  - [Specific strength with evidence]
  - [Specific strength with evidence]
  - [Specific strength with evidence]

WEAKNESSES:
  - [Specific weakness with evidence]
  - [Specific weakness with evidence]
  - [Specific weakness with evidence]

OPPORTUNITIES (for the target to exploit):
  - [Opportunity based on competitor weakness]
  - [Opportunity based on market gap]
  - [Opportunity based on unserved segment]

THREATS (competitor advantages to watch):
  - [Threat with potential impact]
  - [Threat with potential impact]
  - [Threat with potential impact]
```

### 3.2 Aggregate SWOT for the Target

Combine all competitor intelligence into a single SWOT for the target brand:

- **Strengths:** Where the target outperforms all or most competitors
- **Weaknesses:** Where the target lags behind all or most competitors
- **Opportunities:** Gaps in the market no competitor is addressing well
- **Threats:** Areas where competitors are significantly stronger

---

## Phase 4: Strategic Recommendations

### 4.1 "Steal-Worthy" Tactics

Identify specific marketing tactics from competitors worth adopting:

```
STEAL-WORTHY TACTICS
====================

1. [Competitor A] — [Tactic: e.g., "Interactive pricing calculator"]
   Why it works: [explanation]
   How to implement: [specific steps for the target]
   Estimated effort: [Low/Medium/High]
   Expected impact: [Low/Medium/High]

2. [Competitor B] — [Tactic: e.g., "Customer success story video series"]
   Why it works: [explanation]
   How to implement: [specific steps]
   Estimated effort: [Low/Medium/High]
   Expected impact: [Low/Medium/High]

[Continue for 5-10 tactics]
```

Focus on tactics that are:
- Proven (working for the competitor)
- Adaptable (can be customized for the target)
- Underutilized (the target is not currently doing this)

### 4.2 Messaging Differentiation Strategy

Based on the competitive analysis, recommend how the target should differentiate:

**Differentiation Framework:**
1. **Category:** Can the target create or own a sub-category? (e.g., "the [specific attribute] [category]")
2. **Audience:** Can the target own a specific audience segment competitors ignore?
3. **Feature:** Is there a unique feature or capability no competitor offers?
4. **Philosophy:** Can the target differentiate on values, approach, or methodology?
5. **Experience:** Can the target differentiate on customer experience, support, or community?

For each viable differentiation angle, provide:
- Positioning statement
- Headline recommendation
- Supporting evidence or proof points
- How it would manifest across the website

### 4.3 Alternative Page Strategy

Recommend creating "[Competitor] Alternative" pages:

**For each major competitor, outline:**
```
PAGE: [Target Brand] vs [Competitor Name]
URL: /vs/[competitor-name] or /alternatives/[competitor-name]

Headline: "Looking for a [Competitor] alternative? Here's why [X] teams chose [Target] instead."

Sections:
  1. Quick comparison table (features, pricing, ratings)
  2. Where [Target] wins (3-4 advantages with evidence)
  3. Where [Competitor] wins (honest, builds trust)
  4. Who [Target] is best for (ideal customer profile)
  5. Customer switching stories (testimonials from switchers)
  6. Migration guide or switching offer
  7. FAQ about switching
  8. CTA: "Try [Target] free" or "See how [Target] compares"
```

**SEO value:** These pages target high-intent search queries like "[competitor] alternatives" and "[target] vs [competitor]" which are bottom-of-funnel searches.

### 4.4 Switching Narrative Development

Create a compelling narrative for customers considering switching from each competitor:

```
SWITCHING NARRATIVE: [Competitor] → [Target]

Why customers switch:
  1. [Primary reason based on review mining]
  2. [Secondary reason]
  3. [Tertiary reason]

Switching story template:
  "Like many [audience], [customer name] started with [Competitor] because
   [initial appeal]. But after [time/event], they realized [pain point].
   After switching to [Target], they [specific result with numbers]."

Switching offer:
  - Free migration assistance
  - Extended trial for [Competitor] users
  - Matching or discounting pricing
  - Dedicated onboarding for switchers
```

---

## Phase 5: Monitoring and Ongoing Intelligence

### 5.1 Competitive Monitoring Checklist

Recommend ongoing monitoring activities:

- [ ] Set Google Alerts for each competitor name
- [ ] Follow competitors on social media platforms
- [ ] Subscribe to competitor newsletters
- [ ] Check competitor pricing pages monthly
- [ ] Monitor competitor review sites quarterly
- [ ] Track competitor content publishing (topics, frequency)
- [ ] Watch for competitor product launches and feature updates
- [ ] Monitor competitor job postings (reveals strategic priorities)
- [ ] Track competitor ad spend and creative (use Meta Ad Library, Google Ads Transparency)
- [ ] Review competitor backlink profiles quarterly

### 5.2 Competitive Response Playbook

Provide guidance on how to respond to competitor moves:

| Competitor Move | Response Strategy | Timeline |
|----------------|-------------------|----------|
| Price cut | Emphasize value and quality, not price war | 1 week |
| New feature launch | Assess relevance, communicate roadmap to customers | 2 weeks |
| Aggressive ad campaign | Double down on owned channels and retention | Ongoing |
| Negative comparison content | Create factual, balanced comparison content | 1 week |
| Major funding / acquisition | Reassure customers, emphasize stability and focus | 1-2 days |
| Customer reviews / complaints | Monitor for opportunities, address shared concerns | Ongoing |

---

## Output Format

Write the full output to `YYYY-MM-DD-competitor-report.md`:

```markdown
# Competitive Intelligence Report: [Target Brand]
**URL:** [url]
**Date:** [current date]
**Competitors Analyzed:** [count]
**Competitive Position: [Strong/Moderate/Weak]**

---

## Executive Summary
[3-4 paragraphs covering competitive landscape, target's position,
biggest competitive advantage, biggest competitive threat, and
top 3 strategic recommendations]

---

## Competitor Overview

### Direct Competitors
[Summary table with name, URL, positioning, pricing, key differentiator]

### Indirect Competitors
[Summary table]

### Aspirational Competitors
[Summary table]

---

## Detailed Competitor Profiles

### [Competitor A Name]
[Full analysis: messaging, pricing, features, SWOT, social presence, reviews]

### [Competitor B Name]
[Full analysis]

[Repeat for each competitor]

---

## Comparison Tables

### Feature Comparison
[Full feature matrix]

### Pricing Comparison
[Full pricing matrix]

### Review Ratings
[Review intelligence matrix]

### Social Media Presence
[Platform comparison table]

---

## Positioning Map
[Visual positioning map with explanation]

---

## Content & SEO Gap Analysis
[Content gaps, keyword opportunities, comparison page strategy]

---

## SWOT Analysis — [Target Brand]
[Aggregate SWOT based on competitive intelligence]

---

## Strategic Recommendations

### Steal-Worthy Tactics
[5-10 tactics with implementation guidance]

### Differentiation Strategy
[Recommended positioning angles]

### Alternative Pages to Create
[Competitor vs pages with outlines]

### Switching Narratives
[Switching stories and offers for each major competitor]

---

## Competitive Monitoring Plan
[Ongoing monitoring checklist and response playbook]

---

## Next Steps
1. [Most critical competitive action]
2. [Second priority]
3. [Third priority]
```

---

## Terminal Output

```
=== COMPETITIVE INTELLIGENCE REPORT ===

Target: [name]
Competitors Analyzed: [count]
Competitive Position: [Strong/Moderate/Weak]

Competitive Landscape:
  Direct:      [Comp A] (Rating: X/5), [Comp B] (Rating: X/5)
  Indirect:    [Comp C], [Comp D]
  Aspirational: [Comp E]

Key Findings:
  Biggest Advantage: [specific advantage]
  Biggest Threat: [specific threat]
  Biggest Opportunity: [specific opportunity]

Feature Gaps: [X] features competitors have that target lacks
Content Gaps: [X] topics competitors cover that target doesn't
Pricing Position: [Above/At/Below] market average

Top 3 Actions:
  1. [action]
  2. [action]
  3. [action]

Full report saved to: YYYY-MM-DD-competitor-report.md
```

---

## Write Back to PROFILE.md (Project Mode Only)

After completing the analysis, update `projects/<name>/PROFILE.md` with the newly discovered competitors. This keeps the profile current so all future skills can use it without re-running discovery.

**Find the `### AI-Researched Competitors` section** in PROFILE.md and replace its contents with the full competitor list discovered in this run. Use this format:

```
- [Competitor Name](https://url) — Direct
- [Competitor Name](https://url) — Indirect
- [Competitor Name](https://url) — Aspirational
```

Rules:
- Replace the entire AI-Researched section (this run is more complete than any previous run)
- Never touch the `### User-Added Competitors` section
- If PROFILE.md does not yet have the `### AI-Researched Competitors` section (older profile format), append it after `### User-Added Competitors`

Tell the user: "I've updated `projects/<name>/PROFILE.md` with [N] competitors. Future `/gtm position`, `/gtm audit`, and other commands will use this list automatically."

---

## Cross-Skill Integration

- Check `PROFILE.md` for user-added competitors before starting discovery (Phase 0)
- After analysis, write results back to PROFILE.md `### AI-Researched Competitors` section
- If a marketing audit report exists in the project folder, reference competitive positioning scores from it
- Suggest follow-up: `/gtm position` for positioning strategy, `/gtm copy` for differentiated messaging
