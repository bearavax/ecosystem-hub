# Polaris test run

Local only. Fake seed data (Sponsor A, Judge 1, prize amounts `proposed`). No production database, no Luma call, no member-portal call, no deploy.

The hackathon lives in the existing Hub tables. The Polaris tab (`/polaris`) is a plain view over those rows. See `DATA_MODEL.md` for each field.

## Setup

This machine did not match the repo's documented toolchain. What actually worked:

1. Node **24** is required (`package.json` engines). The image had Node 22. Node 24.22.3 was installed under `/opt/node-v24` and put on `PATH`. pnpm 12.16.1 came from corepack.
2. Postgres is documented as `docker compose up -d` (Postgres 18 on port 5432). **Docker is not installed here.** PostgreSQL 16 from apt was used instead. The package did not start the cluster (`policy-rc.d` denied the service). `sudo pg_ctlcluster 16 main start` started it. Role and database: `hub` / `hub` / `hub` on `127.0.0.1:5432`. All 13 existing migrations applied with `pnpm exec prisma migrate deploy`.
3. Copy `.env.example` to `.env`. Values used: `DATABASE_URL`, `BETTER_AUTH_SECRET` (local dummy, 32+ chars), `BETTER_AUTH_URL=http://localhost:3000`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `SUPER_ADMIN_EMAILS=organiser@polaris.example.test`. `SMTP_HOST` left empty so sign-in codes are printed by the dev server. `MEMBER_PORTAL_URL` was set to `http://127.0.0.1:9` so a stray portal call cannot reach `members.team1.network`. No Sentry, no storage keys, no OAuth clients.
4. `pnpm install`, then `pnpm seed:polaris`, then `pnpm dev`.
5. The seed script refuses to run unless the database host is `localhost` or `127.0.0.1`.

Sign-in is email OTP. `POST /api/auth/email-otp/send-verification-otp` rejects a wrong `Origin` (`Invalid origin`) and then rate-limits that address for about a minute (`Please wait 53s before requesting another code`). With `SMTP_HOST` unset, `src/lib/mailer.ts` prints the message on the dev server. This run did not finish an OTP in the browser: the walkthrough used session rows for the fake users and the same signed `better-auth.session_token` cookie. Protected pages returned 200. In `pnpm dev`, an address in `SUPER_ADMIN_EMAILS` is a super admin without a second factor. That exception is dev-only.

`pnpm typecheck`, `pnpm lint`, and `pnpm test` passed after the changes (306 tests).

## What was exercised

`pnpm seed:polaris` writes one published event (`slug` `polaris`, 1 Sep 2026 through 31 Dec 2026, fake dates) and a published hackathon:

- Registration open across that window. Team size 1 to 5. One active submission per person (`allowMultipleSubmissions` off).
- Stages: Hackathon (closed, judging closed), Accelerator (open on 25 Nov 2026, `advancedOnly` off), Finale (upcoming, `advancedOnly` on).
- Six tracks, each with one placeholder sponsor. Three judges. Judge 3 is limited to Payments.
- 303 submissions. 152 advanced from Hackathon, 151 not advanced. Igloo South was not advanced and still has an Accelerator entry. Igloo North and Igloo Star were advanced and have Accelerator entries. Igloo Star holds the proposed overall prize, and results are published.
- One registration is `rejected` (Builder Camp Rejected). That is separate from stage non-advancement.
- Builder New is registered and has no project, so Enter offers "New project".

Pages opened: `/polaris`, `/polaris/enter`, `/polaris/review` (all 303, and Hackathon + not advanced = 151), `/events`, `/events/polaris`, manage submissions, manage judging, the south submission, the judge queue, and Judge 1's score for Igloo South (Clarity 4, Build 3, Demo 5, weights 1/3/2, total **38.33**).

Not done, on purpose: creating the event in the admin UI (that calls Luma or the member portal), running the worker (it would refresh this fake event from Luma), clicking Advance (it emails and changes the seed), completing the OTP form, opening the New project dialog (the button is the existing project form; the click did not open it in the headless capture).

Screenshots: `docs/polaris/screenshots/`.

## Works today

These already worked in the Hub models. The seed used them. No new tables.

- An event becomes one hackathon with tracks, prizes, stages, criteria, questions, organisers, judges, participants, submissions, and awards.
- Each stage has its own open and close (`closesAt` is exclusive), review mode, scale, and weighted criteria. Windows may overlap and may span months. Nothing in `validateStages` caps the length.
- A track has a name, description, one sponsor string, and one sponsor logo.
- Builders register, then submit a Hub project. The submit form can pick an existing project or create a new one. Submitting seals the current project version and stores a team snapshot. Readers are not on the team.
- `advancedOnly` on a later stage. Off means a team that was not advanced can submit, and so can a team that never entered the previous stage.
- Judges can be limited to tracks. Scores are per criterion. `weightedTotal` is 0 to 100. Comments exist. Judging stays closed until an organiser closes it, then they advance teams by hand.
- Awards and a single `resultsPublishedAt` flag. Prize amounts are display text, so `proposed` is valid.
- Organiser console, judge queue, CSV export, data terms, per-hackathon organiser and judge rows.

## Issues

| Area | Issue | Severity | Suggested fix |
| --- | --- | --- | --- |
| Events | A hackathon cannot be created without a Luma or member-portal event. Admin import calls those services. There is no hub-native event. Refresh always re-fetches Luma unless `source` is `portal`. This test inserted the `Event` row. Running the worker would call Luma for `evt-fake-polaris` and store a `syncError`. | High | Add a local event source that is not refreshed from Luma, or accept that Polaris must be a real Luma event. Do not build it until Armin decides. |
| Judging scale | `/manage/hackathons/[id]/judging` loads every entry of every stage and renders a judge matrix. With 303 entries and judging already closed, the HTML was about 760KB and the response about 1.4s on this machine. `ensureAllJudgesAssigned` runs when a stage is in judging and `reviewMode` is `all`: one assignment row per eligible judge per entry, created on read. The judge queue then lists all of them with no pager. | High | Page the judging and judge queues. Do not materialise "all judges" rows for hundreds of teams on the first page view. The Polaris review list is a separate, paged queue for advance/reject. It does not replace scoring. |
| Sponsors | `HackathonTrack.sponsor` is one string, plus one logo. Several sponsors on one track cannot be stored. Armin will build this against the CRM. | High | Leave it. The Polaris page labels the single slot as a placeholder. |
| Stage result | There is no `rejected` status on a stage entry. After judging is closed, "not advanced" is `advancedAt` null. Scores do not advance or reject anyone. There is no cutoff. | Medium | Keep the manual advance, and show "Not advanced" (this branch does, on the hackathon card and on `/polaris`). Add a cutoff only if Armin wants one. |
| Who may enter the next stage | `advancedOnly` false is the only way a non-advanced team continues. It also lets a new team skip stage 1. There is no mode for "must have submitted to stage 1, even if not advanced". | Medium | Decide which rule Polaris wants. The seed uses `advancedOnly` false on Accelerator and true on Finale. |
| Public hackathon page | Before this branch the timeline always said only advanced teams can continue, including when `advancedOnly` is off. Criterion names and weight percents were already shown when `showCriteria` is on (the default). Descriptions were stored and not rendered. Judges were not on the page. | Medium | This branch shows judges (name only), criterion descriptions, the real per-stage rule, and "Not advanced" on the signed-in team card. |
| Builder feedback | Participants do not see scores or comments. Organisers see them after judging is closed. Judge 1's comment on Igloo South is stored and visible on the judge page and the organiser submission page. | Medium | Decide if builders should see comments after a stage closes. Do not show them on the public page by default. |
| Submissions list | `/manage/.../submissions` loads every submission, then sorts and pages in memory. Search is name or teammate only. No track, stage, or standing filter. About 1.6s for 303 rows here. | Medium | The new `/polaris/review` list filters in SQL, 25 per page (about 0.2s warm for 303, and the not-advanced filter returned 151). The manage list can move to the same query later. |
| Registration vs stage | A rejected **registration** is final unless the organiser invite link is used (`canJoin`). That is not the same as failing stage 1. The public page says "Your registration wasn't accepted." | Medium | Keep both, and use different words in the UI. Polaris uses "Not advanced" for the stage and leaves registration rejection as it is. |
| Team snapshot | `StageEntry.teamSnapshot` is `{ userId, name }`. Wallets and socials stay on `User`. The judge screen shows the sealed project (repo, demo, video, website) and not the teammate list. | Medium | If judges must see teammates, render the snapshot on the review page. Copy wallets only if Armin wants them frozen at submit time. |
| Results | `resultsPublishedAt` is one flag for the whole hackathon. This seed publishes a proposed winner while Accelerator is still open. There is no per-stage winners archive. | Medium | Add a per-stage publish flag if Stars should remember stage winners before the finale. |
| Dedupe | `allowMultipleSubmissions` defaults to **true**, so one person can be on many teams. Off, the submit action refuses a second active team. There is no fuzzy match on project name. This seed turns the flag off. The review page counts people on more than one active team (0 here). | Low | Decide the Polaris default. The flag already exists. |
| Event shape | Every event has a `lumaUrl`. The public page offers "Event page on Luma" even for this fake URL (`example.test`). | Low | Hide that link when the event was not imported, together with the native-event decision. |
| Profile gate | Join requires name, country, and a builder role. The join page explains it. The hackathon button does not, until the action errors. | Low | One line on the register button. |
| Scale later | `trackIds` is a Postgres array with no GIN index. Fine at 300. | Low | Add a GIN index if a hackathon passes a few thousand submissions. |

## Needs Armin decision

- Is Polaris a Luma (or portal) event, or does the Hub need an event that is not refreshed from outside?
- Accelerator eligibility: anyone, or only people who submitted to Hackathon?
- Is "not advanced" the rejection, or do you want an explicit status and a score cutoff?
- Should builders see judge comments after a stage closes?
- One team per person? The column defaults to many.
- Publish stage winners before the finale, or one results flag at the end?
- Multiple sponsors stay with Armin and the CRM. This branch does not add them.

## What this branch adds

No Prisma migration. New routes under `src/app/(site)/polaris/`:

- `/polaris` reads the `polaris` hackathon (Tundra, Mountains, Stars, tracks, judges, proposed prizes).
- `/polaris/enter` registers the link to join, shows per-stage standing, and submits an existing or new Hub project through `submitToStage`.
- `/polaris/review` is an organiser list: SQL filters for track, stage, standing, and status, 25 per page, and bulk advance through the existing `setAdvanced` action.

Also on the existing hackathon page: judge names, criterion descriptions, an accurate line about who can enter the next stage, and "Not advanced" when judging is closed. Tests in `tests/polaris.test.ts` cover standing, the stage-1 rejection then stage-2 submit, different weights per stage, and review filters.
