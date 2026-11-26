# Polaris

A plain wireframe over the existing hackathon models. It does not add tables. Submissions, stages, scores, invites, and members are the Hub rows in `src/app/(site)/events/AGENTS.md` and `src/app/(app)/projects`.

- Routes: `/polaris` overview, `/polaris/dens` teams, `/polaris/lodge` teammates, `/polaris/stages` rules, `/polaris/den` my team, `/polaris/enter` seal a submission, `/polaris/review` organiser queue. `/events/polaris` redirects to `/polaris`.
- Seat requests live in `Participant.answers`. Invites are `ProjectInvite`. Scores are `Review`. Switching the open stage updates the three `HackathonStage` windows.
- Pure rules: `_lib/process.ts`, `_lib/rules.ts`. Tests: `tests/polaris.test.ts`, `tests/polaris-process.test.ts`.
- Local fake data: `pnpm seed:polaris`. Walkthrough: `docs/polaris/POLARIS_PROCESS_TEST_GUIDE.md`.
- 3D files under `_components` are not mounted by these routes.
