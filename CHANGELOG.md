# Changelog

All notable changes to Adaptico OS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

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
