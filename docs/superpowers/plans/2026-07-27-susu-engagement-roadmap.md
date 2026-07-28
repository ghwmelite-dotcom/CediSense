# Susu Engagement Program — Roadmap

> **Goal:** 10 engagement features, implemented sequentially, each shipped
> independently (tests → E2E verify → PR → deploy). One detailed plan per
> feature lives beside this file.

**Program architecture:** Most features wire existing infrastructure
(trust_scores streaks, badges, cron at `0 3 * * *`, VAPID push via
`lib/web-push.ts`, notifications tables, group chat) into visible loops.
New shared schema goes in sequential migrations after 0034.

## Sequence

| # | Feature | Core loop | Depends on |
|---|---------|-----------|------------|
| 1 | Contribution streaks with stakes | fear of losing a visible streak | trust_scores.current_streak (exists) |
| 2 | Payout-day push + celebration | anticipation of "my day" | notifications + push (exist) |
| 3 | Due-date nudge sequence (3-stage) | never forget a contribution | cron + push (exist) |
| 4 | Chat-first triggers (@mention push, digest) | social pull back into chat | chat + mentions (exist) |
| 5 | Weekly group health recap (system msg) | group accountability | system messages (F1) |
| 6 | Milestone moments (50% cycle, trust 90, perfect round) | celebration + shares | badges (exist) |
| 7 | Shareable Trust Card (public verify) | flex → acquisition funnel | credit_certificates + /verify (exist) |
| 8 | Auto-contribution via MoMo deeplink | zero-willpower paying | MoMo intent links |
| 9 | Invite card (WhatsApp-optimized share image) | one-tap join | invite codes + QR (exist) |
| 10 | Inter-group savings challenge | competition without content creation | F5 recaps |

## Execution rules (every feature)

1. Branch `feat/susu-engagement-<n>-<slug>` off `master`; PR per feature; squash-merge; deploy (API worker + Pages) after merge.
2. API changes: run `pnpm -r run typecheck` + `npx vitest run` (must stay 300+/300+).
3. Verify in local stack (wrangler dev + vite) with scripted E2E and mobile-viewport screenshots before opening the PR.
4. No placeholders, no dead UI — every shipped button does something.
5. Migrations must run on D1 (no in-place CHECK edits, no writable_schema — see PR #5 postmortem).

## Feature 1 — Contribution streaks with stakes (FIRST)

Plan: `2026-07-27-feature-1-contribution-streaks.md`

- Surface `current_streak` (already maintained in `trust_scores`) in group detail + list payloads.
- Flame badge UI: per-member in MemberList, my-streak on GroupCard.
- System chat message when the last pending member contributes on time ("kept the round alive").
- Cron nudge: members with streak ≥ 2 who haven't contributed this round get a push when the round's due window is near.
