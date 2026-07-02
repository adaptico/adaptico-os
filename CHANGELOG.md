# Changelog

All notable changes to Adaptico OS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

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
