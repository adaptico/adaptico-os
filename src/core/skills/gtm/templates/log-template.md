# GTM Log - [Project Name]

> Append-only history of this project's go-to-market work - what was tried, when, and what came of it. The founder's own attempts and Adaptico OS command runs share this one file. Commands read it before recommending, so nothing that already failed gets re-pitched cold and nothing that worked gets ignored.
>
> **The format is fixed and defined here - don't improvise variations:**
>
> - Entries live under the fixed sections below - one section per area of work, so "what have we tried here" is a single-section read. Every entry lands in exactly one section, appended at the end of that section (oldest first within it). Don't add, rename, or reorder sections.
> - One line per entry:
>   `- YYYY-MM-DD · who · what was done -> outcome`
>   - **who** - `founder`, or the command that acted (`/gtm audit`, `/gtm launch`, ...)
>   - **what was done** - the action or decision in a few words, naming the saved report when there is one (`see 2026-07-07-channel-plan.md`)
>   - **outcome** - what came of it, with numbers where they exist (`90 upvotes, 40 signups, 2 paying`). A concrete result the run itself produced counts (`GTM score 62/100, up from 55`). When the real-world result isn't in yet, write `pending` - with a review date when one exists (`pending - review 2026-08-04`) - and update that `pending` in place when the result lands (the one permitted edit).
> - Every `/gtm` command run against this project appends one line for its own run when it finishes, to the section named in the map below. A pass one command runs inside another (a closing polish, an inline review) never logs its own line - only the top-level command does. One-off runs outside a project have no log and write nothing.
> - The founder appends by hand anytime, to whichever section fits. Approximate dates are fine - `2026-06-15?` beats no date.
> - Keep every line short. This is a ledger, not a journal: a few words and the numbers, aiming under ~15 words after the date. Every command reads this file before recommending, so brevity is what keeps it readable and cheap forever.
> - Never rewrite or delete past entries (only a `pending` outcome is updated in place). If this file predates the sections, add the headings below once and move the existing lines under them unchanged.
> - **Roll-up valve** - when a section outgrows usefulness (roughly 25+ entries), its oldest entries may be rolled up into one dated summary line that keeps the numbers and verdicts: `- 2026-01..2026-05 · roll-up · 12 outreach runs -> best: intro-by-referral (3 meetings); cold DMs never replied`. The roll-up is the only other permitted rewrite; never roll up `pending` lines or a section's newest entries.
>
> **Section map** - where each line goes:
>
> | Section | What lands there |
> |---|---|
> | Strategy & positioning | `/gtm init`, `/gtm audit`, `/gtm critic`, `/gtm interviews`, `/gtm position`, `/gtm competitors`, `/gtm channel`, `/gtm brand` - and founder pivots, positioning changes, strategy calls |
> | Site & conversion | `/gtm analytics`, `/gtm copy`, `/gtm copyedit`, `/gtm landing`, `/gtm funnel`, `/gtm pricing`, `/gtm retention` - and site or pricing changes shipped by hand, plus the weekly numbers line the analytics habit appends |
> | Launches | `/gtm launch` - and every launch or directory submission, with its numbers |
> | Outreach | `/gtm outreach`, `/gtm pitch` - and every outbound campaign: channel, volume, replies, meetings |
> | Content & SEO | `/gtm content`, `/gtm article`, `/gtm repurpose`, `/gtm leadmagnet`, `/gtm vs`, `/gtm seo`, `/gtm geo` - and pieces published, rankings earned, AI-engine citations |
> | Social | `/gtm social`, `/gtm changelog` - and posting streaks, threads that landed, replies that converted |
> | Email & lifecycle | `/gtm emails` - and sequence performance once it exists |
> | Paid ads | `/gtm ads` - and every paid test: spend, result, verdict |
> | General | anything that fits nowhere above (a standalone `/gtm humanize` on a loose draft, tooling, notes) |
>
> A command not named in the map writes to the section its work belongs to, or General.
>
> Examples:
> `- 2026-05-10 · founder · launched on Product Hunt -> 90 upvotes, 40 signups, 2 paying` (under Launches)
> `- 2026-06-20 · /gtm position · set new positioning (see 2026-06-20-positioning.md) -> pending - review after next audit` (under Strategy & positioning)

## Strategy & positioning

## Site & conversion

## Launches

## Outreach

## Content & SEO

## Social

## Email & lifecycle

## Paid ads

## General
