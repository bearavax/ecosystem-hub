# Polaris data points vs the Hub schema

Polaris does not have its own tables. The seed and the `/polaris` tab use the models in `prisma/schema/events.prisma`, `hackathons.prisma`, `projects.prisma`, and `auth.prisma`. Nothing the tab shows is kept only in component state.

"Gap" means the product question is not a column, or the column does not match the brief. It is not a request to add a sponsors table.

| Data point | Needed for | Where it lives | Gap |
| --- | --- | --- | --- |
| Hackathon identity | One Polaris program | `Event` 1:1 `Hackathon`. Public URL is `/events/[slug]`. This test uses slug `polaris`. | An `Event` is a Luma or portal copy (`source`, `lumaEventId`, `lumaUrl`). No hub-native event. |
| Title, about, rules, terms | Public page | `Event.name`, `Hackathon.tagline`, `aboutMd`, `rulesMd`, `termsUrl` | None. Terms are a URL, not a stored document. |
| Run of 3 to 4 months | Hackathon, Accelerator, Finale | `Event.startAt` / `endAt`. Each `HackathonStage.opensAt` / `closesAt` (UTC). `Hackathon.timezone` for display. | None. Windows are not capped. Overlapping windows are allowed. The submit form picks the latest open stage the team qualifies for. |
| Registration window | Tundra | `registrationOpensAt`, `registrationClosesAt`, `maxParticipants` | Independent of stage dates. A person can register during Accelerator. |
| Registration approval | Optional gate | `Hackathon.requireApproval`. `Participant.status`: `active`, `pending`, `rejected`, `withdrawn`. | `rejected` is final unless the invite link is used. This is not stage rejection. |
| Registration answers | Extra questions | `FormField` with `stageId` null. `Participant.answers` JSON. | Works. The seed has one optional fake question. |
| Invite link | Auto-approve | `Hackathon.inviteToken` | Not used in the seed. |
| Builder profile | Name, country, role | `User.name`, `country`, `builderRoles` | Required before join (`hasCompleteBasicProfile`). |
| Socials and wallets | If judges need them | `User.githubAccount`, `xAccount`, `linkedinAccount`, `telegramAccount`, `otherSocials`, `wallets` | Not copied onto the submission. The judge page does not list them. |
| Team (igloo) | 1 to 5 people | `Project` + `ProjectMember` (`owner`, `writer`, `reader`). Readers are not on the hackathon team. | The team is the project team, not a separate igloo table. |
| One team per person | Dedupe | `Hackathon.allowMultipleSubmissions` (default **true**) | Off, a second active team is refused. No fuzzy name dedupe. Seed sets it false. |
| Project content | What gets judged | `ProjectVersion`: name, descriptions, maturity, country, `githubRepos`, `demoLinks`, `videoUrl`, `websiteUrl`, tech stack, categories | Submit seals the version (`sealedAt`). Later edits start a new draft and do not change the entry until the team submits again. |
| Link a Hub project | Existing or new | `Submission.projectId` unique per hackathon. New projects are normal `Project` rows. | Works on `/events/[slug]/submit` and on `/polaris/enter`. |
| Track | Six categories | `HackathonTrack`. `Submission.trackIds` (a team can enter more than one). | Chosen on the first submission. Later stages do not change tracks. |
| Sponsor per track | Placeholder | `HackathonTrack.sponsor` (string) and `sponsorLogoUrl` | One sponsor. A second sponsor has nowhere to go. Not built (CRM). |
| Stage | Hackathon, Accelerator, Finale | `HackathonStage` ordered by `order` | Cannot delete a stage that has entries. Criteria and scale lock after a score exists. |
| Who continues | Rejected team enters stage 2 | `HackathonStage.advancedOnly`. `StageEntry.advancedAt`, `advancedById` | No `rejected` value. Not advanced means judging is closed and `advancedAt` is null. `advancedOnly` false also allows teams that skipped the previous stage. |
| Per-stage status | Standing | Derived. See `stageStanding` in `src/app/(site)/polaris/_lib/rules.ts`. | Not a column. Recomputed from the stage window, the entry, and `advancedAt`. |
| Stage questions | Extra answers | `FormField.stageId`. `StageEntry.answers` JSON. | Works. Seed asks for a fake one-line pitch on stage 1. |
| Built during the event | builders-hub question | `StageEntry.preexistingIdea`, `builtDuringEvent` | Shown to judges. |
| Team at submit time | Frozen roster | `StageEntry.teamSnapshot` JSON `[{ userId, name }]` | Names only. |
| Deadlines | Per stage | `opensAt`, `closesAt`. Judging starts at `closesAt` until `judgingClosedAt`. | `stageState`: upcoming, open, judging, closed. |
| Criteria and weights | Different per stage | `Criterion` on the stage: `name`, `description`, `weight` (integer), `order`. `HackathonStage.scaleMax`, `showCriteria`. | Weights are not stored as percents. The UI divides by the stage total. Descriptions were not on the public page before this branch. |
| Judges | Shown on the page | `HackathonJudge`: email, `userId` once they sign in, `trackIds` (empty means every track), `termsAcceptedAt` | Public page now shows the name only. Email is not public. Track limit is organiser data, not printed on `/polaris`. |
| Assignment | Who scores whom | `JudgeAssignment`. `reviewMode` `all` or `random`, `judgesPerSubmission`, `sameTrackOnly`. | `all` creates every eligible pair when the stage is in judging, on read, with no pager. |
| Scores | Per judge, per criterion | `Review.scores` JSON `{ criterionId: number }`, `total` 0 to 100, `comment`, `conflictDeclared`, `submittedAt` | Total is null until every criterion has a score. Builders do not see this. |
| Conflict of interest | Judge on the team | `isConflicted` against the snapshot and current members | Works. Not a separate table. |
| Feedback | To the team or organisers | `Review.comment` | Organisers and the judge. Not the builder. |
| Timestamps | Audit of the run | `submittedAt`, `advancedAt`, `Participant.createdAt`, `Review.submittedAt`, row `createdAt` / `updatedAt` | No single "stage history" table. History is the set of `StageEntry` rows. |
| Advance / reject action | Review queue | `setAdvanced` sets `advancedAt`. Requires judging closed and a next stage. Up to 1000 ids. | Manual. The Polaris queue calls this action. It does not invent a new status. |
| Disqualify | Pull a team | `Submission.status`: `active`, `withdrawn`, `disqualified` | Whole hackathon, not one stage. |
| Prizes | Proposed amounts | `Hackathon.prizePool` text. `HackathonPrize.amount` text, `placement`, optional `trackId`. | `proposed` is display text. Prizes with an empty amount are hidden on the public prize list. |
| Winners (Stars) | Archive | `Award` plus `Hackathon.resultsPublishedAt` | One flag for every prize. No per-stage archive. |
| Organiser power | Review 300 teams | `HackathonOrganizer` or `hackathons.manage`. Data terms via `termsAcceptedAt`. | Staff with `hackathons.manage` skip the terms. External organisers do not. |
| Audit | State changes | `AuditLog` from `recordAudit` on submit, advance, judging close, awards | The Polaris queue does not add actions. Advance still audits `hackathon.entry.advance`. |
| Pagination | Hundreds of teams | Registrations are paged in SQL. Submissions and judging were not. | `/polaris/review` pages in SQL (`POLARIS_PAGE_SIZE` 25) and filters by track, stage, standing, status, and text. |

## Standing values

Computed, not stored:

| Standing | Meaning |
| --- | --- |
| `upcoming` | Stage has not opened. |
| `can_submit` | Stage is open and this team may enter. |
| `not_eligible` | Stage is open and `advancedOnly` blocks this team. |
| `submitted` | Entry exists and the stage is still open. |
| `in_review` | Entry exists and the stage is in judging. |
| `advanced` | `advancedAt` is set. |
| `not_advanced` | Judging is closed, entry exists, `advancedAt` is null. This is the stage-1 rejection. |
| `missed` | Stage is over and there is no entry. |
| `withdrawn` / `disqualified` | `Submission.status`. |

A team can be `not_advanced` on Hackathon and `submitted` on Accelerator in the same row set. Igloo South is that case in the seed.
