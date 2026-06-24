# Changelog

All notable changes to Adaptico OS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

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
