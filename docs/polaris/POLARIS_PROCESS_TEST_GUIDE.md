# Polaris process test guide

Plain walkthrough for the local wireframe on branch `polaris-hackathon-test`. Nothing here is an announced event. Dates are TBC. Every dollar figure is proposed. There is no schema migration: teams, invites, submissions, scores, and stage windows are existing Hub rows.

## Start

1. Postgres on `127.0.0.1:5432`, database `hub`, as in `.env.example`.
2. `pnpm install`
3. `pnpm db:migrate` if this database has never been migrated.
4. `pnpm seed:polaris` (localhost only; it wipes and recreates the fake Polaris rows).
5. `pnpm dev`
6. Open `http://localhost:3000/polaris`.
7. Sign in with an email code. The code is printed in the `pnpm dev` console. Seed accounts:
   - Organiser: `organiser@polaris.example.test`
   - Builder: `igloo-001@polaris.example.test`
   - Second builder: `igloo-002@polaris.example.test`

Automated checks, no database required:

```
pnpm typecheck && pnpm lint && pnpm test
```

## 1. Overview

`/polaris` shows the open stage, what to do now, and counts read from the database: builders, teams, open seats, sealed submissions. Use the links. Do not expect a 3D scene.

## 2. Teams and projects

`/polaris/dens`

- Filter by name, discovery track, stage standing, and open seats.
- Sign in as `igloo-002@polaris.example.test`, register if needed (`/events/polaris/join`), then Request to join a team that has a free seat.
- Sign in as that team's owner. Open My Team (`/polaris/den`). Approve or Decline.
- Approve adds a writer on the existing project members table. Decline only removes the request. The request itself is stored on the builder's Polaris registration answers.

## 3. Teammates

`/polaris/lodge`

- Opt in, set a timezone, skills, and a short bio. Skills and bio are the Hub profile. Timezone and the opt-in live on the registration answers.
- As a team owner, Invite to team. That creates a normal project invite.
- Sign in as the invited builder. Accept it from the Hub projects page (pending invites). You do not need a new table.

## 4. Stages and prizes

`/polaris/stages`

Confirm the copy:

- Stage 1: 20 × $1,500 = $30,000 proposed
- Stage 2: 15 × $5,000 = $75,000 proposed. Stage 1 teams that were not advanced can enter. Repeat winners are allowed.
- Stage 3: $45,000 / $25,000 / $15,000 / $5,000 / $5,000 = $95,000 proposed. Advanced teams only.
- Total prize money: $200,000 proposed across 40 awards
- $50,000 proposed ops, marked as operations, not prize money
- Six discovery tracks, not separate prize pools
- Rubric 30 / 25 / 20 / 15 / 10
- Judges TBC. Dates TBC.

## 5. My team and submit

- `/polaris/den` shows your team and pending join requests.
- `/polaris/enter` links a Hub project and seals the current project version into the open stage. The sealed row does not change afterwards. A later edit creates a new draft.

## 6. Organiser queue

Sign in as `organiser@polaris.example.test`. Open `/polaris/review`.

- Switch the open stage. This updates the three existing stage windows. It does not add a column.
- Filter sealed submissions. Score a row on that stage's criteria, 0 to 10. The score is a normal review.
- After you switch forward, the previous stage is closed, so Advance works for the closed stage when you filter to it. Stage 2 must stay open to teams that were not advanced. Stage 3 must not.

## What this does not do

- No new tables and no migration.
- No production deploy and no pull request.
- The 3D files under `src/app/(site)/polaris/_components` are unused by these routes.
