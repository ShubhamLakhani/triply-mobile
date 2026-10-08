# Triply Founder Market Decision Brief v1.0
**Date:** 5 October 2026  
**Status:** Founder working document  
**Purpose:** Convert the IdeaProof validation + market-analysis output into decisions that will govern Triply's business plan, brand strategy, product scope, launch strategy, and acquisition system.

---

## 1. Founder position

Triply is being treated as a real company and product, not a portfolio project, side hustle, or demo.

The operating principle for this document is:

> **We do not optimize for producing impressive documents. We optimize for making decisions that increase Triply's probability of becoming a durable product and business.**

Every later artifact must trace back to evidence, a stated assumption, or a deliberate strategic choice.

---

## 2. Current decision

### Decision: PROCEED TO FOCUSED MVP

Triply has enough evidence to justify building a focused MVP.

This is **not** a decision to build a feature-complete global dating platform. It is a decision to build the smallest serious product capable of testing the core marketplace behavior:

> **Will travelers create a future trip, discover compatible people whose destination and dates overlap, express interest, match, and converse before arrival?**

The next proof must come from behavior inside the product.

---

## 3. Evidence we currently have

### 3.1 IdeaProof
- IdeaProof returned a **GO** verdict.
- The validation screen showed an overall result around **69/100**.
- A separate success score shown in the flow was **64/100**.
- IdeaProof identified emotional resonance as a strength.
- IdeaProof also flagged meaningful execution / historical-category risk.
- The generated market analysis covers market size, audience/segments, competitor analysis, positioning and adjacent strategic areas.

**Interpretation:** useful external signal, but not ground truth. We will use it as one input, not as authority.

### 3.2 Public market evidence
- Statista projects the worldwide **online dating** market at about **US$3.25B revenue in 2026**, with approximately **452M users expected by 2031**.
- Statista's broader **dating services** category is projected at about **US$8.48B in 2026**.
- American Express found **76% of surveyed Millennials and Gen Z** planned a solo trip in its 2024 Global Travel Trends study, indicating a meaningful behavioral base for solo travel.
- American Express reported in 2025 that **77% of respondents** expected to take the same number or more international trips than in 2024.
- Booking.com's 2026 travel research, based on more than **29,000 travelers across 33 countries/territories**, describes continued demand for highly individualized travel experiences.
- Large dating products also show a warning sign: Bumble's 2025 results included falling paying-user counts and revenue pressure. This reinforces that “dating market exists” does **not** mean a new dating product automatically wins.

### 3.3 Triply-specific evidence already created
Triply already has:
- a live landing experience,
- destination/date-first positioning,
- early-access collection,
- real-trip submission flow,
- UTM attribution,
- PostHog analytics,
- production infrastructure,
- initial organic acquisition creative.

This is important because Triply is already capable of collecting behavioral evidence rather than relying only on surveys.

---

## 4. The market thesis

Triply sits at the intersection of three behaviors:

1. **Online dating / romantic discovery**
2. **Solo and independent travel**
3. **Pre-trip planning**

The product is not simply “Tinder for travelers.”

The stronger thesis is:

> Existing dating apps primarily optimize around where the user is now. Triply organizes romantic discovery around **where the user will be and when they will be there**.

That temporal layer is the strategic core.

### Core job-to-be-done

> “I have an upcoming trip and would like to meet someone compatible who will be in the same destination during the same dates, before I arrive.”

This is more specific and defensible than “meet people while traveling.”

---

## 5. Initial ideal customer profile

### Primary launch ICP

**Independent leisure traveler, approximately 21–35**
- takes solo or semi-solo international trips,
- comfortable using dating/social apps,
- plans at least part of the trip in advance,
- wants social or romantic connection,
- is willing to meet someone new during the trip,
- uses Instagram/TikTok/short-form travel content,
- is comfortable creating a profile and sharing future destination/date ranges.

### High-potential subsegments
1. Solo leisure travelers
2. Digital nomads and remote workers
3. Frequent city-break travelers
4. Backpackers / hostel travelers
5. Travelers attending festivals, events or destination experiences

### Not the initial target
- family travel,
- business-only travel,
- travelers primarily seeking itinerary management,
- broad local dating with no upcoming trip,
- “meet anyone nearby right now” use cases.

---

## 6. The largest strategic risk: marketplace liquidity

Triply is a two-sided matching marketplace inside a narrow time-and-place window.

A conventional dating app can often match on:
- current geography,
- age,
- preference.

Triply may need:
- future destination,
- overlapping dates,
- preference compatibility,
- acceptable age / relationship intent,
- adequate supply during the same travel window.

This compounds scarcity.

### Consequence

A global launch is strategically dangerous.

If 1,000 users are split across 100 destinations and dozens of travel windows, the product can feel empty despite having 1,000 accounts.

### Founder decision

**Triply should launch density-first, not geography-first.**

Initial supply should be concentrated around:
- one destination,
- a small group of high-density destinations, or
- specific event/travel windows.

This is one of the most important decisions in the company.

---

## 7. Recommended launch wedge

### Preferred wedge

**Destination-first launch campaigns**, beginning with a small number of destinations strongly associated with independent/solo travel.

Candidate types:
- Bali
- Bangkok
- Barcelona
- Lisbon
- Dubai
- London

These are hypotheses, not final launch locations. Final selection should use:
- inbound visitor volume,
- solo-travel relevance,
- dating-app usage,
- English usability,
- seasonality,
- safety and regulatory considerations,
- organic acquisition cost,
- early-access demand.

### Campaign structure

Instead of:
> “Join Triply, the travel dating app.”

Use:
> “Going to Bali in November? See who else will be there.”

This creates a concrete trigger and concentrates liquidity.

---

## 8. Competitive landscape

Triply should not evaluate competitors only by whether they call themselves “travel dating.”

### Direct / near-direct competitors
- travel-specific dating and traveler-meeting apps,
- niche products that combine trip planning and connection.

### Functional competitors
- Tinder Passport / location-changing behavior,
- Bumble,
- Hinge,
- Couchsurfing-style social discovery,
- Hostelworld social features,
- Meetup,
- travel Facebook/WhatsApp/Telegram groups,
- nomad communities,
- destination-specific Discord groups.

### What users currently do instead
A traveler may:
1. wait until arrival and use Tinder/Bumble,
2. change dating-app location before traveling,
3. join destination groups,
4. meet people in hostels/events,
5. use travel-social apps,
6. do nothing and rely on chance.

Triply competes with all six behaviors.

---

## 9. Differentiation thesis

Triply should own:

### **Future-location matching**

Not:
- generic travel planning,
- “social network for travelers,”
- local dating,
- trip booking.

The product should communicate:

**Destination + Dates + Compatibility + Before Arrival**

### Product promise

> **Meet before you go.**

This is not yet declared the final tagline, but it accurately expresses the strategic territory.

---

## 10. Trust and safety is a core product system

Travel dating introduces additional safety concerns:
- users may be in unfamiliar countries,
- tourists can be more vulnerable,
- location and accommodation data are sensitive,
- scams and catfishing can exploit travel urgency,
- users may meet with limited local support.

Therefore safety cannot be treated as a legal/footer feature.

### MVP-level requirements
- age gate,
- reporting,
- blocking,
- unmatching,
- moderation workflow,
- privacy-preserving trip visibility,
- no exact accommodation disclosure,
- clear safety guidance,
- rate/behavior protections against spam,
- basic abuse monitoring.

Identity verification can become a major trust lever, but the exact MVP level requires a separate cost/benefit decision.

---

## 11. Product scope decision

### The focused MVP must prove only the following chain

**Account → Profile → Future Trip → Relevant Discovery → Like → Mutual Match → Chat**

Everything should support this loop.

### Build now
- authentication,
- profile,
- destination/date trip creation,
- match eligibility,
- discovery,
- like/pass,
- mutual matches,
- messaging,
- basic notifications,
- reporting/blocking/unmatching,
- analytics,
- admin/moderation basics.

### Defer
- AI matching,
- itinerary builder,
- flights/hotels,
- group trips,
- social feed,
- advanced map experience,
- travel marketplace,
- creator system,
- complex gamification,
- subscriptions before engagement is demonstrated,
- native mobile apps before the core loop is validated.

---

## 12. Monetization hypothesis

Monetization is **not yet validated**.

Potential models:
1. Freemium subscription
2. Paid travel/date visibility controls
3. Premium matching filters
4. Boosts / priority discovery
5. Travel-mode or multi-destination premium features
6. Travel affiliate/partner revenue later

### Founder decision

Do not optimize MVP design around monetization yet.

First prove:
- users create trips,
- users see relevant supply,
- users like,
- matches occur,
- conversations start,
- users return.

Monetization follows engagement proof.

---

## 13. North-star and core metrics

### Candidate North Star Metric

**Meaningful trip-based connections created**

Operational definition should eventually combine:
- mutual match,
- same/overlapping destination window,
- at least one message from each side.

### Core funnel
1. `landing_viewed`
2. `signup_started`
3. `signup_completed`
4. `profile_completed`
5. `trip_created`
6. `eligible_profiles_viewed`
7. `like_sent`
8. `match_created`
9. `conversation_started`
10. `two_way_conversation`
11. `return_session`

### Marketplace health
- % of trips with ≥1 eligible profile
- median eligible profiles per trip
- match rate per active traveler
- conversation-start rate
- two-way reply rate
- destination/date liquidity
- time to first meaningful match

### Safety
- report rate
- block rate
- spam rate
- moderation response time
- repeat-offender rate

---

## 14. Decision gates

### Gate A — MVP readiness
Before launch:
- core matching logic tested,
- privacy/safety baseline complete,
- analytics verified,
- moderation tools usable,
- seeded/real supply in launch market.

### Gate B — Liquidity
After initial acquisition:
- a meaningful share of active trips must return eligible people.
- if not, narrow destination/date campaigns further.

### Gate C — Connection
Users must progress from discovery to mutual match and conversation.

### Gate D — Retention
Travel is episodic, so Triply should measure:
- return for an existing trip,
- addition of a new future trip,
- post-trip reactivation.

### Gate E — Monetization
Only test paid features once the free core repeatedly creates value.

---

## 15. What would invalidate the thesis

We must be willing to change direction if evidence shows:

1. Travelers like the concept but will not create a real trip.
2. Users create trips but liquidity is consistently too low.
3. Users browse profiles but do not express interest.
4. Matches occur but conversations rarely start.
5. Safety/trust concerns materially suppress conversion.
6. Customer acquisition is prohibitively expensive even in concentrated markets.
7. Users prefer existing dating apps' travel/location features enough that the temporal distinction does not matter.

These are falsifiable conditions, not reasons to be pessimistic.

---

## 16. Founder-level strategic principles

1. **Density before scale**
2. **Behavior before opinions**
3. **Safety is product, not policy copy**
4. **Future trips are the core object**
5. **Do not become a generic travel super-app**
6. **Do not add features to compensate for low liquidity**
7. **Every acquisition campaign should create measurable trip supply**
8. **Every major assumption must eventually be converted into a metric**
9. **We should be willing to narrow before we broaden**
10. **Triply wins by creating useful pre-trip connections, not by having the most features**

---

## 17. Working assumptions requiring validation

These are not facts yet:

- 21–35 is the optimal initial age range.
- Bali is the best first liquidity market.
- romance is a stronger acquisition hook than friendship/social connection.
- users are comfortable sharing future travel dates.
- destination/date overlap is enough differentiation from mainstream dating apps.
- users will return across multiple trips.
- subscription is the optimal long-term monetization model.
- web-first is sufficient for initial product validation.

Each assumption will get an owner, experiment, metric, and deadline in the business plan / operating roadmap.

---

## 18. Next company-building sequence

### Step 1 — Business Plan
We will create:
- company thesis,
- business model,
- ICP,
- market model,
- competitive strategy,
- liquidity strategy,
- GTM,
- safety model,
- operations,
- product roadmap,
- financial assumptions,
- milestone plan,
- risk register.

### Step 2 — Brand Strategy
Built from the business strategy, not aesthetics.

### Step 3 — Visual Identity
Audit and formalize the existing Triply B3 direction against the final brand strategy.

### Step 4 — Acquisition System
Organic-first experiments that can later become paid campaigns.

### Step 5 — Founder Blueprint
One source of truth linking product, business, brand, acquisition, metrics, milestones, and decisions.

---

## 19. Current founder decision log

| Decision | Status |
|---|---|
| Continue Triply | **YES** |
| Build full-scale product immediately | **NO** |
| Build focused serious MVP | **YES** |
| Core differentiation = future destination + overlapping dates | **YES** |
| Global undifferentiated launch | **NO** |
| Density-first launch | **YES** |
| Add broad travel planning features now | **NO** |
| Treat safety as core product architecture | **YES** |
| Continue behavioral validation while building | **YES** |
| Purchase more IdeaProof credits | **NOT REQUIRED** |

---

## 20. Founder conclusion

Triply has earned the right to move from concept validation into disciplined product and company building.

The strongest opportunity is not simply the size of dating or travel markets. It is a clear behavioral wedge that mainstream dating products do not organize around:

> **People know where they will travel before they arrive. Triply turns that future trip into a discovery and connection graph.**

The strongest risk is marketplace liquidity. Our strategy, product architecture, acquisition model, and launch geography must all be designed around overcoming that constraint.

From this point onward, Triply should be managed through explicit decisions, measurable hypotheses, and release gates rather than feature enthusiasm.

**Next artifact: Triply Business Plan v1.0**
