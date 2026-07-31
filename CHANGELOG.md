# Changelog

All notable changes to Adaptico OS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.13.0]

### Added
- `/gtm ads` - runs a "should you run ads at all" gate against your stage and unit economics before any creative work, and a not-yet verdict names the exact numbers that would flip it. When the gate passes, it picks one platform, sizes the smallest test you can actually read, and writes paste-ready copy in your voice. It never touches an ad account - you launch.
- An `Activation milestone` field in the profile: the one user action that predicts sticking around. `/gtm emails`, `/gtm funnel`, and `/gtm audit` anchor to the same milestone instead of each inferring its own. `/gtm init` fills it only when you already know it or a retention or funnel report names one.

### Changed
- `/gtm audit` names `/gtm retention` and `/gtm pricing` as the deep dives behind their vectors, and states why `/gtm ads` is deliberately absent from that map - no weak vector is fixed by buying traffic.
- `/gtm seo` and `/gtm geo` print a terminal summary and recommend a critic pass before you commit to months of work.
- `/gtm pricing` joins the Tier 2 and Tier 3 sequences `/gtm init` recommends.

### Fixed
- `/gtm copy` and `/gtm funnel` recommended labelling a plan "Most Popular" whether or not it was; the badge now has to be true, or it reads "Recommended".
- `/gtm retention` keys its save-offer table to what the cancel survey actually said, rather than an abstract reason.
- `/gtm seo` described Google's FAQ rich results incorrectly.

## [0.12.0]

### Added
- `/gtm seo` - checks the cheap SEO groundwork (crawlability, indexing, titles, headings, internal links) with exact fixes, then tells you whether it's worth investing in active SEO at your stage. It says "not yet" when that's the right answer.
- `/gtm geo` - audits whether ChatGPT, Perplexity, and Google AI Overviews can find and quote you: an extractable value prop, quotable passages, AI-crawler access, server-rendered content.

### Changed
- `/gtm audit` now scores a seventh dimension, AI-Search Readiness, at 10% of the composite. It measures the groundwork that makes a site quotable by AI answer engines - not whether you currently rank or get cited, which stays evidence-only in `/gtm geo`. The other six dimensions re-weight to make room, so **scores from 0.11.0 and earlier are not comparable to new ones**.

### Fixed
- The page analyzer dropped the URL when run without `--out`, reporting no URL given.

## [0.11.0]

### Added
- `/gtm retention` - maps the path from signup to first value, holds you to one activation metric, and puts first-90-days fixes ahead of late-stage retention tricks. Also designs the churn defenses: cancel flow, save offers, and what to do when a payment fails.

### Changed
- `/gtm emails` anchors its onboarding sequence to the activation metric from a retention run, and matches its dunning sequence to that run's failed-payment posture. `/gtm funnel` hands the post-signup work off to `/gtm retention` rather than half-covering it.
- Retention is now its own step in the Tier 3 journey `/gtm init` recommends, instead of a note attached to the emails step.

### Fixed
- `/gtm audit` pointed weak Activation and Revenue Quality scores at commands that only partly address them. Activation now leads to `/gtm retention`, and Revenue Quality to `/gtm pricing` for packaging and `/gtm retention` for churn defenses.

## [0.10.0]

### Added
- `/gtm pricing` - works out what to charge from the value you deliver rather than your costs, designs three tiers with the annual-discount math worked out, and audits or drafts the pricing page itself, objection handling included. A bundled calculator does the arithmetic - tier ratios, annual pricing, break-even, CAC payback - so the numbers in the report are computed, not estimated.

### Fixed
- `/gtm brand` and `/gtm humanize` listed which commands read the voice guide and run the humanize pass, and both lists had gone stale; they now include `/gtm pricing`.

## [0.9.0]

### Added
- `/gtm humanize` - strips the tells that make a draft read machine-written (hype words, stock phrases, the "it's not X, it's Y" pivot, em-dash overuse), then enforces your voice. Runs on pasted text or a file.
- `/gtm copyedit` - a line edit of a draft you wrote: front-loads the point, tightens sentences, swaps jargon for plain English, and reports how much it cut, without flattening your voice.

### Changed
- `/gtm brand` now writes a `brand-voice.md` voice guide into your project. `/gtm copy`, `/gtm copyedit`, `/gtm social`, `/gtm outreach`, and `/gtm emails` read it automatically, so everything they write comes out in one voice instead of re-deriving it each run. It updates in place across runs and won't overwrite your own edits.
- The writing commands finish with the humanize pass by default. Add `--no-humanize` to skip it.

### Fixed
- Two skills referenced the critic by a path that didn't resolve from their own folder; they now use its installed location.

## [0.8.0]

### Changed
- `/gtm audit` now scores six dimensions chosen for early-stage projects - Positioning Clarity, ICP Focus, Conversion (Primary Pages), Activation & Time-to-Value, Channel Concentration, Revenue Quality - replacing the old content / conversion / SEO / competitive / brand / growth set. **Scores from 0.7.0 and earlier are not comparable to new ones**, so expect your number to move on the first re-audit for reasons that aren't your site.
- A dimension whose signals don't exist on your site is skipped with a stated reason and the composite re-normalizes over the rest; a partial score is always labeled partial. The audit never invents a metric - what can't be known is listed as a named gap.
- Every re-audit opens with what changed since the last one - score movement per dimension, what you fixed, what regressed. Re-audit monthly or quarterly for strategy movement; weekly only to verify a batch of shipped fixes.
- The five audit subagents are remapped onto the new dimensions, with the technical agent becoming an unscored evidence backbone that verifies the others.

### Added
- Optional Telegram summaries: when `/gtm audit` finishes it can send the score, the change since your last audit, per-vector lines, and the top fixes to your own Telegram bot - useful for scheduled runs. The installer seeds a config file and gitignores it; with no credentials set nothing is sent and nothing breaks.
- `--out <file>` on the bundled analysis scripts writes the full JSON to a file and prints a one-line summary, keeping large payloads out of the run transcript.

### Fixed
- Each subagent's output is validated before it reaches the report. A malformed agent is re-run once, and if it fails again its dimensions are marked degraded rather than silently dropped.

## [0.7.0]

### Added
- `/gtm critic` - an adversarial red-team of any saved report or draft: severity-ranked findings (Critical / Major / Minor) with exact-line citations, the principle each one breaks, and the single most valuable fix. `/gtm copy`, `/gtm landing`, `/gtm position`, and `/gtm audit` can run it as an optional pass before saving.
- `/gtm audit` now computes its composite score with a bundled script instead of by hand, so the same six category scores always give the same score, grade, and band. Unresolved Critical findings from a critic pass cap the composite at 69 (grade C), shown next to the uncapped value.

### Changed
- The bundled analysis scripts are now zero-dependency Node instead of Python. **Node.js is required; Python no longer is**, and `requirements.txt` is gone.
- The `/gtm competitors` scanner takes several competitor URLs per run and returns more: positioning, a pricing-page probe, trust signals, CTAs, and content stats.

### Fixed
- Skills pointed at the advisor framework by a path that didn't resolve from their own folder; they now use its installed location and fall back cleanly when it's absent.
- The bundled fetchers connect to the exact address that passed URL validation, closing a DNS-rebinding window that a re-resolve reopened.

## [0.6.0]

### Added
- `LOG.md` - an append-only GTM history for each project. `/gtm init` starts it by asking what you've already tried; commands read it before recommending, so nothing that already failed gets pitched again cold, and results get logged back with dates.
- Page memory: `/gtm audit` and `/gtm landing` save and reuse your key pages, so the same important pages get checked every run and pages you ship between runs are caught.
- `/gtm launch` directory-submission pack: ready-to-paste tagline, descriptions, keywords, and maker's comment, plus a tiered list of launch platforms and directories.

### Changed
- `/gtm position` and `/gtm competitors` are more honest about coverage: known competitors are never dropped, whitespace claims are scoped to what was actually checked, and each position is web-search pressure-tested against the live market.
- `/gtm launch` refocuses early-stage launches on email captures and feedback over revenue, and de-prioritizes cold paid ads (retargeting warm traffic only until PMF).
- `/gtm funnel` labels every step as observed, founder-provided, or inferred, and states its scope.
- `/gtm copy` skips A/B-testing CTA color at early-stage traffic - it ships the higher-contrast option as a judgment call instead of stalling on an underpowered test.

## [0.5.1]

### Changed
- `/gtm init` onboarding: the main goal is now a required 30-day focus plus an optional 90-day direction, with plain-language answer suggestions.

### Fixed
- The bundled analysis scripts now run as documented - `analyze_page.py` and `competitor_scanner.py` are invoked from their installed `.claude/skills/.../scripts/` paths.

## [0.5.0]

### Added
- `/gtm outreach` - cold outbound sequences: multi-touch, value-first cold email and LinkedIn DM sequences for founder-led manual outreach to land your first customers.

## [0.4.0]

### Added
- `/gtm brand` - brand voice analysis and a reusable voice guide (voice chart, do's and don'ts, messaging hierarchy, on-brand copy samples) you can write from.
- `/gtm social` - founder-led social: specific, useful replies in the conversations where your buyers already are (Reddit, Hacker News, LinkedIn, X), plus a lean X/LinkedIn posting calendar.

### Changed
- `/gtm copy` and `/gtm position` can save a one-line voice rule to your profile when none exists, so copy stays on-brand before you run a full `/gtm brand`.

## [0.3.0]

### Added
- `/gtm funnel` - funnel and activation analysis: maps your public funnel (landing, pricing, signup) and works through the post-signup path to first value, to find drop-off and improve trial-to-paid / PLG activation.
- `/gtm emails` - lifecycle email sequences: generates activation onboarding and dunning (failed-payment recovery) emails for your product.

### Changed
- Commands take a project name or URL interchangeably as `<target>`, and a non-project target can be filed into any existing project it relates to, not just as a competitor.

## [0.2.0]

### Changed
- Every command now works against projects under `projects/`. Point a command at a saved project or a URL and it resolves where the run belongs — your project, a competitor of an existing project, or a one-off — then tailors the output to that project's profile.

### Removed
- "URL mode" that wrote reports to the current working directory; output now always saves under `projects/` (a project folder, or a dated one-off file at its root).

## [0.1.3]

### Changed
- `/gtm audit` now reads your profile to tailor the whole audit: it feeds ICP, positioning, competitors, channel, and goal into all 5 subagents (flagging where the live site under-sells its own positioning) and orders recommendations by your stage and main goal.
- `/gtm init` now derives secondary profile fields (pain points, primary channel, tone, MRR) from answers you already gave instead of re-asking, and leaves Differentiator/Key messages for `/gtm position` and `/gtm competitors` to fill in.

## [0.1.2]

### Changed
- `/gtm copy` and `/gtm landing` now read your profile to tailor their output (ICP, positioning, competitors), so rewrites and teardowns lead with your established positioning instead of re-deriving it from the page.
- `/gtm landing` checks the hero against the promise of wherever traffic comes from (ad, launch post, docs link).

### Fixed
- `/gtm copy` no longer picks CTA colors by "color psychology"; it optimizes for contrast and visual isolation, validated by A/B test.

## [0.1.1]

### Changed
- `/gtm position`, `/gtm competitors`, and `/gtm launch` now read more of your profile to tailor their output, and offer to save findings back to PROFILE.md so other commands reuse them.
- `/gtm competitors` also reads About/pricing/product pages, not just the homepage.

## [0.1.0] - 2026-06-19

First public release. Adaptico OS is a go-to-market operating system for
early-stage SaaS and AI startup founders, built on Claude Code skills.

### Added
- `/gtm init` - set up your startup profile
- `/gtm audit` - full GTM audit with 5 parallel agents and a composite score
- `/gtm quick` - 60-second snapshot of the top wins and fixes
- `/gtm position` - positioning map and a positioning statement
- `/gtm competitors` - competitive intelligence
- `/gtm copy` - before/after copy rewrites for any page
- `/gtm landing` - landing page conversion review
- `/gtm launch` - launch playbook (Product Hunt / Hacker News / X)
