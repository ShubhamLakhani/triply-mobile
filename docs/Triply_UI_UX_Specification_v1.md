# Triply UI/UX Specification v1.0

**Founder Product & Design Document**  
**Date:** 6 October 2026  
**Stage:** Pre-MVP / Interface and interaction specification

## 1. Purpose

This document translates the Triply PRD, user flows, safety architecture, matching logic, visual identity, and technical architecture into a buildable UI/UX specification.

The product should feel simple, premium, human, safe, mobile-first, and intentionally focused on the trip.

## 2. UX principles

1. Trip context is always obvious.
2. People stay central.
3. Date overlap is explicit.
4. Safety actions are easy to reach.
5. Low liquidity is communicated honestly.
6. No unnecessary forms.
7. No addictive swipe mechanics.
8. No dead ends.
9. Primary actions are clear.
10. Motion supports understanding.

## 3. Information architecture

Primary product areas:
- Discover
- Matches
- Trips
- Profile

Secondary:
- Notifications
- Safety Center
- Settings
- Help
- Account

Admin:
- Reports
- Cases
- Users
- Audit

## 4. Navigation

### Mobile
Bottom nav:
1. Discover
2. Matches
3. Trips
4. Profile

### Desktop
Top or left navigation with the same four areas.

## 5. Landing page

Hero:
**Meet before you go.**

Support:
Add your upcoming trip and discover compatible people traveling to the same destination during overlapping dates.

Primary CTA:
**Add your trip**

Secondary CTA:
**See how it works**

Sections:
1. How it works
2. Why Triply
3. Safety
4. Destination examples
5. CTA

## 6. Authentication

Centered mobile-first panel.

Field:
- email

Primary CTA:
**Continue**

States:
- loading
- invalid email
- rate limited
- email sent

## 7. Email verification

Show:
- masked email
- resend
- change email

Copy:
**Check your email**

## 8. Onboarding shell

Use:
- progress indicator
- back
- save/resume
- one clear primary CTA

Desktop form width:
480–560 px.

## 9. Identity step

Fields:
- first name
- date of birth
- gender
- interested in

Inline validation only.

## 10. Photos step

Show:
- photo grid
- upload
- reorder
- primary photo
- upload status

Minimum 1 photo.

## 11. Bio and interests

Fields:
- short bio
- interests
- home city/country
- languages optional

Use chips for interests.

## 12. Preferences

Fields:
- who you want to meet
- age range

Helper:
**These help us show people relevant to you.**

## 13. First trip

Fields:
- destination
- arrival
- departure

Primary:
**Add trip**

Helper:
**Triply uses your destination and dates to find people who overlap.**

## 14. Destination search

Search-first autocomplete.

Example:

**Canggu**  
Bali, Indonesia

## 15. Date range picker

Must:
- disable past dates
- clearly show start/end
- highlight selected range
- work well on mobile

Summary example:
**Dec 4–12 · 8 nights**

## 16. Onboarding result

With supply:
**You’re ready.**  
**See who overlaps with your trip.**

CTA:
**Start discovering**

Without supply:
**Not enough people here yet.**  
**We’ll let you know when more travelers match your dates.**

## 17. Discover

Header:
selected trip, e.g. **Bali · Dec 4–12**

Main:
one primary profile card or restrained card stack.

Actions:
- Pass
- Like
- Open profile

## 18. Discovery card

Show:
- photo
- first name
- age
- home city/country
- destination
- trip dates
- overlap
- interests
- short bio

Primary overlap badge:
**You overlap Dec 6–10**

## 19. Date-overlap component

Example:

**Your trip**  
Dec 4 ━━━━━━━━━ Dec 12

**Their trip**  
Dec 6 ━━━━━━━ Dec 10

**Overlap**  
**Dec 6–10 · 5 days**

Do not rely only on color.

## 20. Full profile

Sections:
1. photos
2. name/age
3. overlap summary
4. bio
5. interests
6. home city/country
7. trip dates
8. safety menu

Sticky actions:
- Pass
- Like

## 21. Like / pass

Like:
subtle feedback and advance.

Pass:
subtle dismiss motion.

Avoid exaggerated swipe physics.

## 22. Match state

Show:
- both photos
- destination
- overlap dates

Headline:
**You matched**

Support:
**You’re both going to Bali around the same time.**

Actions:
- Say hi
- Keep discovering

No confetti explosion.

## 23. Matches

Each item:
- photo
- name
- destination
- latest message preview
- unread state
- trip timing

## 24. Chat

Header:
- name
- destination
- overlap
- safety menu

Body:
- message bubbles
- timestamps

Composer:
- text only

No:
- photos
- voice
- files
- live location

## 25. First-message assist

Optional prompts:
- What are you most excited to do in Bali?
- Is this your first time there?

Never auto-send.

## 26. Trips

Sections:
- upcoming
- active
- completed

Trip card:
- destination
- dates
- status
- optional accurate eligible count

Primary:
**Add trip**

## 27. Edit / cancel trip

Edit warning:
**Changing these dates may change who you can discover.**

Cancel copy:
**It will stop appearing in active discovery. Existing conversations stay available.**

## 28. Profile

Sections:
- photos
- about
- interests
- preferences
- notifications
- safety
- account

Use section-based editing.

## 29. Notifications

Types:
- new match
- new message
- new eligible traveler
- trip reminder
- account/safety

Group:
- Today
- Earlier

## 30. Safety Center

Sections:
- Meet safely
- Keep your stay private
- Avoid scams
- Blocking & reporting
- Community standards

Tone:
calm and practical.

## 31. Report

Steps:
1. select reason
2. optional details
3. optionally block
4. submit

Confirmation:
**Report received.**

## 32. Block

Confirmation:
**Block [Name]?**

Support:
**They will no longer be able to find or contact you.**

## 33. Unmatch

Confirmation:
**Unmatch with [Name]?**

Support:
**Your conversation will close.**

Optional:
**Report a concern**

## 34. Low-liquidity state

Headline:
**Not enough people here yet.**

Support:
**We’ll let you know when more travelers match your dates.**

Actions:
- Edit dates
- Invite someone
- Add another trip

Never insert fake or irrelevant profiles.

## 35. Loading and errors

Use:
- skeleton cards
- inline button spinners
- retry states

Examples:

**Connection lost.**  
We’ll retry automatically.

**We couldn’t load destinations.**  
CTA: **Try again**

**That photo didn’t upload.**  
CTA: **Retry**

## 36. Suspended account

Full-screen restricted state.

Headline:
**Your account is temporarily restricted.**

Actions:
- Contact support
- Learn more

## 37. Admin UX

Desktop-first.

Navigation:
- Reports
- Cases
- Users
- Audit

Report queue columns:
- severity
- category
- reported user
- created
- status
- assigned moderator

Report detail:
- report summary
- profile
- relevant match/message context
- prior reports
- moderation history

Actions:
- No action
- Warn
- Restrict
- Suspend
- Ban
- Escalate

Every action requires a reason.

## 38. Design tokens

Colors:
- primary `#6C4DF6`
- accent `#FF6B5F`
- text `#15131D`
- secondary text `#6E6A78`
- background `#F7F6FB`
- surface `#FFFFFF`
- border `#E8E5EF`
- success `#1F9D73`
- warning `#D98E1E`
- danger `#D9465F`
- info `#4E7AD9`

Radius:
- 10
- 16
- 24
- 999

Spacing:
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64

## 39. Typography

Primary UI:
**Inter**

Display:
**Manrope**, **Plus Jakarta Sans**, or **Sora**

Sizes:
- Display: 48–64 desktop / 36–44 mobile
- H1: 40–48 / 32–36
- H2: 30–36
- H3: 22–26
- Body: 16–18
- Small: 14
- Caption: 12 minimum

## 40. Buttons

Primary:
violet fill, white text.

Secondary:
neutral surface and border.

Destructive:
danger style only for block/delete/ban.

## 41. Inputs

Use:
- visible label
- clear focus state
- inline validation
- helper/error text

Never use placeholder as the only label.

## 42. Cards

Core:
- ProfileCard
- TripCard
- MatchCard
- NotificationItem
- SafetyTip

Use soft borders and restrained shadows.

## 43. Motion

Micro:
120–220 ms

Standard:
220–350 ms

Brand:
400–700 ms

Use for:
- onboarding
- cards
- overlap
- match state
- dialogs

Respect reduced motion.

## 44. Responsive behavior

Mobile-first.

Minimum width target:
320 px.

Desktop:
- discovery stays centered
- matches may use two-column list/chat
- trips/profile expand into structured layouts
- admin remains desktop-first

## 45. Accessibility

Requirements:
- WCAG AA
- keyboard navigation
- visible focus
- semantic dialogs
- non-color error indicators
- 44×44 tap targets
- reduced motion
- captions on video
- meaningful alt text

## 46. Product copy rules

Prefer:
**Add your trip**

Avoid:
**Initiate your travel experience**

Prefer:
**You matched**

Avoid:
**A new connection opportunity has been created**

Tone:
warm, direct, calm, optimistic.

## 47. MVP screen inventory

1. Landing
2. Auth
3. Email verification
4. Onboarding shell
5. Identity
6. Photos
7. Bio/interests
8. Preferences
9. First trip
10. Onboarding result
11. Discover
12. Full profile
13. Match state
14. Matches
15. Chat
16. Trips
17. Add/edit trip
18. Profile
19. Edit profile
20. Notifications
21. Notification settings
22. Safety Center
23. Report
24. Block
25. Unmatch
26. Account settings
27. Delete account
28. Suspended account
29. Low-liquidity state
30. Admin reports
31. Admin report detail
32. Admin user review
33. Admin audit history

## 48. Component inventory

- AppShell
- BottomNav
- TopNav
- TripSwitcher
- TripCard
- DestinationSearch
- DateRangePicker
- DateOverlap
- ProfileCard
- ProfileGallery
- InterestChip
- MatchCard
- MessageBubble
- ChatComposer
- EmptyState
- ErrorState
- LoadingSkeleton
- SafetyMenu
- ReportSheet
- BlockDialog
- UnmatchDialog
- NotificationItem
- Avatar
- StatusBadge
- AdminSeverityBadge

## 49. Locked UI/UX decisions

| Decision | Status |
|---|---|
| 4-tab mobile navigation | **Locked** |
| Discover / Matches / Trips / Profile | **Locked** |
| Date overlap visually prominent | **Locked** |
| No endless-swipe framing | **Locked** |
| Honest low-liquidity states | **Locked** |
| Match state warm, not gamified | **Locked** |
| Text-only chat UI | **Locked** |
| Safety actions always accessible | **Locked** |
| Mobile-first | **Locked** |
| Accessible-premium styling | **Locked** |

## 50. Open UI decisions

To resolve during implementation:
- card-by-card vs list/card hybrid discovery
- exact onboarding step count
- separate Home dashboard vs Discover-first
- date picker library
- full route vs modal profile on desktop
- match modal vs route on mobile
- completed-trip organization
- persistent trip switcher behavior

## 51. Acceptance criteria

UI/UX is ready for implementation when:
- every PRD screen has a defined layout
- every key interaction has feedback
- loading/empty/error states are defined
- trip context is visible where needed
- date overlap is understandable
- safety controls are accessible
- mobile behavior is defined
- admin moderation is defined
- accessibility is included
- no core screen depends on undefined behavior

## 52. Next step

### Triply Implementation Roadmap v1.0

The final pre-build artifact should define:
- build phases
- dependencies
- migration order
- milestones
- testing gates
- staging gates
- closed-cohort release criteria
- founder workload
- AI-assisted development workflow
- launch checklist
- post-launch measurement plan

After that, Triply is ready for build kickoff.

# Founder conclusion

Triply's UI should make a complex system feel simple:

> **Where are you going? Who overlaps? Do you want to connect?**

Everything else supports that moment.
