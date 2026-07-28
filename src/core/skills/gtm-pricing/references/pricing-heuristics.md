# Pricing-Page Heuristics, FAQ Bank & Objection Handling

Reference for `/gtm pricing`. The SKILL.md phases decide what to build; this file holds the checklist the teardown grades against, the FAQ bank the page answers are drawn from, and the objection reframes. Attribution rule: public frameworks are named honestly; rules without a canonical source are practitioner consensus, never given an invented citation.

## 1. Page heuristics checklist

Grade each item pass / fail / partial in audit mode; build to it in design mode.

1. **Prices are public.** A self-serve product at this stage shows real numbers. "Contact us" as the only option costs trust and filters out the self-serve buyer doing silent research; a "talk to us" tier alongside public tiers is fine.
2. **Three tiers, one highlighted.** Three is the working default for an early software product - fewer decisions than four or five, and enough ladder for anchoring and expansion (practitioner consensus). Four is defensible with a genuinely distinct fourth segment; five or more is a decision tax.
3. **The middle tier is visually anchored.** Buyers presented with three options gravitate to the middle one (the center-stage effect - documented in consumer-choice research). The top tier's job is to make the middle price look reasonable (anchoring); the highlight badge makes the default explicit.
4. **The badge is honest.** "Most popular" is a claim - with real customers it must be true. Pre-launch or pre-traction, write "Recommended" instead; a fabricated popularity claim is exactly the kind of small lie a buyer smells.
5. **Social proof sits adjacent to the tiers.** A customer quote or logo strip inside the same viewport as the tier cards - proof at the moment of decision, not on a distant page. Strongest form: one outcome-specific quote placed next to the highlighted tier ("cut our reporting time from 3 days to 2 hours"). Generic praise ("great tool!") adds nothing; move it or cut it.
6. **The billing toggle defaults to annual** and shows the effective monthly price with an explicit "billed annually" note. Showing the discounted number with an honest label is convention; hiding the billing term until checkout is a dark pattern.
7. **Each tier names its customer, not just its features.** One line under the tier name that lets a visitor self-select: "For solo developers" / "For growing teams". If a visitor can't tell which tier is theirs in five seconds, the packaging failed.
8. **Limits are phrased as capacity, not punishment.** "Up to 10,000 events/mo" beats "10,000 event limit". The value metric should be visible in every tier so the upgrade path reads as growth, not a paywall.
9. **One CTA per tier, same verb, low friction.** "Start free trial" on every tier beats a mix of "Buy", "Subscribe", "Contact". The CTA states what happens next (card required or not, trial length).
10. **An FAQ below the tiers** answering the real pre-purchase objections (section 2). The FAQ is where objection handling lives on the page.
11. **No fake urgency, no fake discounts.** Countdown timers on a subscription page, "was $99" anchors that never existed, or evergreen "launch pricing" all trade long-term trust for a short-term bump. An honest launch price with a stated end condition is fine.
12. **Money-page hygiene.** The page headline carries the value proposition, not the word "Pricing"; currency is stated; tax/VAT handling appears for international buyers; the free tier or trial terms are explicit (length, card required or not, what happens at the end).

## 2. FAQ bank

Pick 6-10, tailored to the product. Every answer is written for the page - short, plain, first person plural. Questions marked **[AI]** are required for AI products; **[required]** for everyone.

- **What happens when I hit my plan's limit?** [required] - State it exactly: soft warning, grace buffer, prompt to upgrade. Never silent overage charges. The answer that converts: "nothing breaks - we tell you and you choose."
- **Can I change plans or cancel anytime?** [required] - Yes-shaped answer with mechanics: upgrades prorate immediately, downgrades apply next cycle, cancellation keeps access to period end. No lock-in is a selling point at this stage; say it.
- **Is my data used to train AI models?** [AI, required] - The data-privacy answer every AI-product buyer now looks for. Answer plainly: whether customer data is used for training (by you or your model providers), what the retention window is, and how to opt out or get deleted. Name the underlying providers if their terms govern. If the honest answer is "yes, and there is no opt-out" - that is a product finding to flag to the founder, not a sentence to wordsmith around. Never write a misleading answer.
- **What happens to my data if I cancel?** [AI products and anything storing customer data] - Export path, deletion window, format.
- **Will the price change on me?** [required for early products] - The grandfathering answer: early customers keep their price (or get long notice). An early-stage product raising prices later is normal; committing to how you'll treat existing customers converts the risk into trust.
- **Why is there an annual discount?** - Honest version works best: "You commit for a year, we discount X% - it funds building the product without a sales team." Bootstrapped candor reads as a feature.
- **Do you offer refunds / a guarantee?** - State the risk-reversal chosen in section 3. A clear no-questions window beats vague "contact support".
- **Is there a free trial / free tier, and what's the catch?** - Length, card required or not, what converts and when.
- **How is [value metric] counted?** - Define the billing unit precisely (what counts as a seat, an event, a run). Ambiguity here generates support tickets and churn-flavored surprise.
- **Do you offer discounts for startups / education / nonprofits / open source?** - Only if the founder actually wants those deals; a stated policy beats ad-hoc negotiation.
- **Is my data secure?** - Hosting, encryption, compliance status stated honestly (aspirations labeled as such - "SOC 2 in progress" is fine; claiming a certification you don't hold is not).
- **Can I pay monthly?** - Yes, with the annual saving restated in one line.

## 3. Risk reversal (the perceived-likelihood lever)

From the Value Equation (SKILL.md Phase 1.4): certainty is a multiplier on perceived value, and risk reversal is the cheapest way to raise it. Options, in rough order of fit for a self-serve software product:

- **Free trial, no card** - lowest friction, weakest commitment signal. Fits PLG with fast time-to-value.
- **Free trial, card required** - higher-intent trials, fewer of them. Fits when onboarding cost is real.
- **Free tier** - permanent, capacity-limited by the value metric. Fits products with viral or seat-expansion mechanics; dangerous when the free capacity covers the whole job for most of the ICP.
- **Money-back window (14/30 days)** - converts the cautious annual buyer; pairs naturally with the annual discount ("try it for a month, keep the discount").
- **Cancel-anytime + prorated upgrade mechanics** - table stakes; stating them explicitly is the reversal.

Pick one primary mechanism and state it near the CTA. Stacking every guarantee at once reads as protesting too much.

## 4. Objection handling

For the report's sales-facing section (founder conversations, onboarding emails, demo calls) - not pasted onto the page verbatim; the page-facing versions live in the FAQ.

| Objection | The reframe |
|---|---|
| "Too expensive" | Never defend the number - return to the value math: "it replaces [quantified cost/time] - the mid tier is X% of that". If the value math can't beat the objection, the finding is a pricing problem, not an objection problem. |
| "Cheaper competitor exists" | Concede what's true, then differentiate on the dimension the ICP cares about (from PROFILE's differentiator). Competing on price against a cheaper rival is a race the smaller company loses; reposition or ignore. |
| "Why not free / open source?" | Sell the outcome, not the software: hosted, maintained, supported, accountable. If the ICP genuinely prefers self-hosting, that is an ICP finding for the profile, not a discount trigger. |
| "Can I get a discount?" | The annual discount is the discount - it has a reason (cash up front) and a shape (X%). Ad-hoc discounts teach customers the list price is fiction. |
| "We only have budget for X" | Downshift the tier, not the price: the low tier exists for exactly this buyer. Custom pricing per deal at this stage destroys the packaging's integrity. |
| "What if you shut down?" (early-stage trust) | Honest posture: data export anytime, no long lock-in, transparent roadmap or changelog. Small-company candor converts better than pretending to be bigger. |

## 5. Anti-patterns (flag on sight)

- **Cost-plus pricing** - "our costs plus a margin" caps the price at the wrong ceiling; costs set the floor, value sets the price.
- **Rival-minus pricing** - "the market leader minus 20%" imports a positioning (cheaper clone) along with the number, and anchors the product to a rival's value story instead of its own.
- **The negative-margin tier** - per-customer variable cost (hosting, AI inference) at or above the tier price. The calculator errors on it by design; volume makes it worse, not better.
- **The crippled low tier** - a bottom tier too limited to deliver the core value poisons word of mouth: its users churn angry instead of upgrading. Every tier must complete the core job at its capacity.
- **Five-plus tiers, matrix of 40 feature rows** - a decision tax that converts worse than three honest tiers (practitioner consensus); complexity signals indecision about the ICP.
- **Fake anchors** - a "most popular" badge with no customers, struck-through prices that never existed, permanent "launch pricing".
- **Hiding the price** - for a self-serve product, pricing behind a call is a leak, not a filter (sales-led enterprise products are a different game; that exception is real).
- **Underpricing as marketing** - a price far below the quantified value doesn't just cost revenue; it signals toy-grade software to a business buyer and attracts the highest-churn, highest-support segment.
