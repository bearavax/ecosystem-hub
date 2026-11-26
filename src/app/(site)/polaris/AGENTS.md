# Polaris

A plain tab over the hackathon models. It is not a second store: submissions, stages, scores and awards are the Hub rows documented in `src/app/(site)/events/AGENTS.md`.

- `/polaris` is the command hub (sidebar: Live, My Den, Submit, Stages, Lodge, Stars, Review). `/polaris/enter` and `/polaris/review` stay real routes inside that shell. `/events/polaris` redirects to `/polaris`. Other hackathons keep `HackathonView`.
- Enter reuses `submitToStage`. Review reuses `setAdvanced` and `getManagedHackathon` (same guard and data terms as `/manage`).
- Pure standing and filter rules live in `_lib/rules.ts` and `tests/polaris.test.ts`.
- Local fake data: `pnpm seed:polaris`. Do not point it at a shared database.
- One sponsor string per track is the existing column. Do not add a sponsors table here.
