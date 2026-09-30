# Changelog

All notable changes to Adaptico OS are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.20.0]

### Changed
- `/gtm landing` grades the first screen before anything else: can a stranger tell what it is, who it's for, and why to care. A hero that fails gets a replacement headline and subhead. It also flags sections that talk about how the product was built instead of what the buyer gets, marks where the signup button and the proof should repeat down the page, and goes through the signup form field by field - needed now, or can it wait.
- `/gtm copy` scores each key line on your page: can the reader picture it, could it be proven wrong, and could a competitor have written it word for word. Lines that fail get rewritten, and each rewrite shows the score before and after and names the copywriting formula it used. Every rewritten line is held to one concrete detail instead of a stack of adjectives.
- `/gtm position` names a funded competitor already selling to a segment and counts it against that segment, since you can't outspend them on distribution.
- `/gtm landing` gives its conversion-rate estimate as a range based on typical rates for that kind of page, instead of a single number.
- `/gtm landing` now writes inside your project's voice guide and ends with the humanize pass, like the other writing commands.

## [0.19.0]

### Added
- `/gtm pitch` - gets you ready for one specific sales call. A one-pager to send afterwards, the objections that buyer is likely to raise with an answer for each, a demo script that opens with questions about their situation instead of a feature tour, and a cheat sheet for when they name a competitor.
- `/gtm vs` - writes the comparison pages buyers read before they ever contact you: "alternative to X", "best [category] alternatives", and "you vs X", each tied to the search phrase it targets. Facts about a rival come only from their own pricing page or docs, with the date, and the rival gets credit where it is genuinely better.

### Changed
- Every command that writes to your project log now shows that line in the terminal, so you can see what was recorded without opening the file.

## [0.18.0]

### Added
- Install as a Claude Code plugin:
  ```
  /plugin marketplace add adaptico/adaptico-os
  /plugin install adaptico-os
  ```
  Plugin installs update themselves whenever a new version comes out.
- If you installed with the script instead, Adaptico OS now tells you when your copy is out of date. It checks once per session, on your first `/gtm` command and only after that command has finished its work, then adds one line saying how many skills are behind and how to update. If it can't reach GitHub it says nothing.

### Changed
- The README shows the plugin first, then `npx skills add` for other agents (Cursor, Codex, Windsurf, Gemini CLI), then cloning the repo, then the curl one-liner.

### Fixed
- Skills pointed at each other using paths that only exist when you install with the script, so those pointers were broken for anyone using the plugin. They now work with every install method.

## [0.17.0]

### Added
- Type `/gtm` followed by your actual situation instead of a command - "launched two weeks ago and signups are flat", "30 trial users but nobody converts". It reads your profile and log first, then either recommends a short sequence and runs the first step, tells you plainly that no command covers what you asked, or asks the one question that decides the route. It won't improvise work that a command exists to do.

### Changed
- `LOG.md` is now split into fixed sections - strategy, site, launches, outreach, content, social, email, ads, general - so "what have we already tried on outreach" is one section to read instead of the whole file. A long section can be rolled up into a summary line once it passes about 25 entries.
- Every command writes one line to the log when it finishes, naming the report it saved. Your history builds itself instead of depending on you remembering to write it down, and the next command reads it before recommending anything.
- The working unit is called a project throughout, not a startup. "Startup" now only appears where it means the audience.

## [0.16.0]

### Added
- `/gtm content` - the editorial plan, built around what your buyers are trying to get done: pillars derived from your positioning, a pillar-and-cluster topic map, and a cadence sized to the hours you actually have. Strategy only - the writing happens in `/gtm article`.
- `/gtm article` - writes one long-form piece properly: research before any outline, one thesis you can defend, and every factual claim either cited or marked as opinion. Built for authority and getting quoted by AI, not for volume.
- `/gtm repurpose` - takes one finished piece and rewrites it for each platform: an X thread, a LinkedIn post, a script outline, a newsletter section. Each one is rebuilt to fit the platform and stands on its own - nothing is truncated, and platforms the piece can't honestly feed get skipped.
- `/gtm changelog` - reads your git log, CHANGELOG, and project log, finds the story in what you actually shipped, and writes ship notes, an X thread, and a LinkedIn post. Every claim traces back to a real commit, so a fix doesn't become a rewrite.

### Changed
- `/gtm social` hands a finished piece to `/gtm repurpose` instead of drafting the variants itself, and reads your content plan when one exists so the pillars and the calendar work together.
- `/gtm interviews` runs the humanize pass over the outreach asks, since those get pasted into DMs as they are.
- `/gtm position` prints a terminal summary at the end of a run.
- `/gtm init` puts the content engine in the Tier 3 sequence it recommends.

## [0.15.0]

### Added
- `/gtm channel` - makes you pick one distribution channel and drop the rest. It scores every candidate against where your ICP actually gathers, the hours you really have each week, how your product gets bought, and how fast the channel compounds. You get one channel, a four-week starter plan, an explicit not-now list for everything rejected, and a kill-or-review date set before you start.
- `/gtm leadmagnet` - designs the one asset that turns traffic into an email list: picks the format from your ICP's sharpest pain (checklist, template, tool, or teardown), writes the hook and outline, and designs the delivery and capture flow. It ends with a validation checklist you have to pass before building anything.

### Changed
- `/gtm social` now starts by finding the live threads where your buyers are already asking about the problem, and triages them by fit and recency before drafting any reply. The posting calendar moved to the end and got leaner - replying in someone else's thread reaches an audience before you have one.
- `/gtm init` puts `/gtm channel` in the Tier 2 sequence it recommends, and `/gtm leadmagnet` in Tier 3.

### Fixed
- `/gtm social` presented best-posting-time advice as if it were measured data. It's practitioner folklore and now says so - where your own posts actually land beats any chart.

## [0.14.0]

### Added
- `/gtm interviews` - two jobs in one command. It gives you a discovery kit (who to talk to, where to find them, Mom-Test-style questions that get at what people actually did, and a capture sheet per conversation), then turns your notes into validated pains, verbatim customer phrases, and switching triggers. Those go into the profile as Customer Evidence, and `/gtm position`, `/gtm copy`, and `/gtm outreach` read them automatically.
- `Customer Evidence` and `Competitive Alternatives` sections in the profile, for what real conversations have established and what your customers would use if you didn't exist.

### Changed
- `/gtm position` now derives positioning as a chain rather than picking from a map: real alternatives, then the attributes only you have, then the value those produce, then the segment that cares most. Your current position gets scored before anything is rewritten, the three options are sharper-vertical variants pressure-tested against live rivals, and you end with a messaging house instead of one statement.
- `/gtm init` asks what customers would do if your product vanished, and why the last one signed up. Interview notes or transcripts sitting in the project folder are handed to `/gtm interviews` instead of being linked as generic reference docs. The intake also says up front how long it is and why none of it is filler.
- `/gtm copy` and `/gtm outreach` reuse the customers' own recurring phrases when Customer Evidence exists, instead of inventing language for the pain.

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
