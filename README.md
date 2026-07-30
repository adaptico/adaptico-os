<p align="center">
  <img src="banner.svg" alt="Adaptico OS - go-to-market for SaaS & AI founders, in Claude Code" width="100%">
</p>

# Adaptico OS - the go-to-market operating system for SaaS and AI founders

Plug your startup into Claude Code and get a real go-to-market team on the command line. Adaptico OS audits your marketing, sharpens your positioning, fixes your conversion, writes your copy, plans your launch, and tracks your competitors - tuned specifically for **early-stage SaaS and AI startup founders**.

It's more than a set of skills - it's an orchestrator that puts a whole team of specialists on your startup and runs them in parallel if needed. Install it, run `/gtm init` once, and you've got a GTM advisor that already knows your product. Built for technical founders shipping modern software.

---

## What it does

Each Adaptico OS command puts a specialist on one part of your go-to-market - positioning, conversion, copy, a launch plan, a competitor breakdown. 

After `/gtm init`, the next one to run is `/gtm audit`: it sends a whole team across your site at once, scores the seven dimensions that actually move an early-stage startup - positioning clarity, ICP focus, conversion, activation, channel concentration, AI-search readiness, revenue quality - and rolls them into a single score out of 100 with the biggest fixes ranked first. It never invents a number: what can't be known from your pages is listed as a named gap, not guessed.

<p align="center">
  <img src="audit.svg" alt="Terminal output of /gtm audit: a seven-dimension score breakdown and a composite GTM Score of 68/100" width="100%">
</p>

Every run saves a dated report you can work through, and every re-audit opens with what changed since the last one - score movement per dimension, what you fixed, what regressed. Re-audit monthly or quarterly to measure strategy movement; re-run weekly only to verify a batch of shipped fixes.

---

## Quick start

```bash
# 1. Install the skills into your project
curl -fsSL https://raw.githubusercontent.com/adaptico/adaptico-os/main/install.sh | bash

# 2. Open Claude Code in your project and set up your startup
/gtm init

# 3. Run it
/gtm audit
/gtm position
/gtm landing
```

Or install manually:

```bash
git clone https://github.com/adaptico/adaptico-os.git
cd adaptico-os

# macOS / Linux:
./install.sh

# Windows:
bash install.sh
```

After installing, restart Claude Code so it picks up the new skills.

---

## Commands

| Command | What it does |
|---------|-------------|
| **Start here** | |
| `/gtm init` | Set up your startup profile (`PROFILE.md`) - do this first |
| `/gtm audit` | Full GTM audit with parallel agents + composite score; re-audits lead with what changed |
| `/gtm quick` | 60-second snapshot - top wins and fixes |
| `/gtm critic` | Red-team any report or draft - ranked findings, the one fix that matters most |
| **Research & position** | |
| `/gtm position` | Positioning map + statement - includes a quick competitor scan |
| `/gtm competitors` | The deep competitor dive (pricing, features, reviews, gaps); `position` uses it if present |
| **Launch & convert** | |
| `/gtm launch` | Launch playbook (Product Hunt / Hacker News / X) |
| `/gtm copy` | Before/after copy rewrites for any page |
| `/gtm copyedit` | Tighten your own draft for clarity while keeping your voice |
| `/gtm humanize` | Strip the AI-tells out of any draft before it ships |
| `/gtm landing` | Landing page CRO, tuned for SaaS signup/trial flows |
| `/gtm pricing` | Pricing page + value-based packaging, with a pricing calculator |
| `/gtm funnel` | Funnel & activation analysis - find the leaks (trial / PLG) |
| **Reach & retain** | |
| `/gtm outreach` | Cold outbound sequences - cold email & LinkedIn DM |
| `/gtm emails` | Activation onboarding & dunning (failed-payment recovery) email sequences |
| `/gtm retention` | Activation + churn defense - cancel-flows and save-offers |
| `/gtm social` | Founder-led socials: join conversations where buyers are, and an X/LinkedIn calendar |
| **Scale up (later)** | |
| `/gtm seo` | SEO groundwork audit + an honest "should I invest in SEO yet" verdict |
| `/gtm geo` | AI-search visibility - get found and cited by ChatGPT, Perplexity, AI Overviews |
| `/gtm brand` | Brand voice audit + a reusable voice guide (do's & don'ts, copy samples) |

Point any command at a URL (`/gtm audit https://example.com`), or pass a saved project's name (`/gtm audit my-startup`) to skip retyping the URL. With a single project set up, running a command bare just uses it.

---


## Uninstall

```bash
# macOS / Linux
./uninstall.sh

# Windows (Git Bash)
bash uninstall.sh
```

---

## License

MIT - see [LICENSE](LICENSE). Third-party notices: [CREDITS.md](CREDITS.md).

## Trademark

"Adaptico" and "Adaptico OS" are trademarks of the Adaptico project. The MIT license covers the code, not the name or logo. If you fork or redistribute, please use your own name and don't present your version as official Adaptico or imply endorsement.

## More

- See [AGENTS.md](AGENTS.md) for architecture and technical details
- See [CHANGELOG.md](CHANGELOG.md) for version history
