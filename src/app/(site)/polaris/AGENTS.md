# Polaris

A plain tab over the hackathon models. It is not a second store: submissions, stages, scores and awards are the Hub rows documented in `src/app/(site)/events/AGENTS.md`.

- Public page `/polaris` (event slug `polaris`), enter `/polaris/enter`, organiser queue `/polaris/review`. `/events/polaris` uses the same compact view. Other hackathons keep `HackathonView`.
- Enter reuses `submitToStage`. Review reuses `setAdvanced` and `getManagedHackathon` (same guard and data terms as `/manage`).
- Pure standing and filter rules live in `_lib/rules.ts` and `tests/polaris.test.ts`.
- Local fake data: `pnpm seed:polaris`. Do not point it at a shared database.
- One sponsor string per track is the existing column. Do not add a sponsors table here.
