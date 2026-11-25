# Hackathon page research

Short notes from a few public landing pages, fetched once each. Not a crawl. Prize figures below are what those sites published. Polaris still uses the fake seed (`proposed`, Sponsor A). Nothing here was copied in as real Polaris data.

## Pages looked at

- GitHub Game Off 2026, https://itch.io/jam/game-off-2026 (GitHub hosts the jam on itch.io). Also the original 2012 blog post for section order.
- Colosseum Radar, https://colosseum.com/radar (Solana, Sep-Oct 2024).
- ETHGlobal event homes, https://ethglobal.com/events/ethonline2026/ and https://ethglobal.com/events/mumbai (prizes and judging live on linked subpages).
- ETHIstanbul, https://ethistanbul.io/ (tracks, schedule, FAQ). MegaETH does not publish a hackathon landing page. MegaForge is an apply-and-join builder program (benefits, then how to apply), so it was not used as a layout.
- Devpost was not fetched. One attempt was skipped after the others already agreed on section order.

## Patterns

| Site | Order | How they show it |
| --- | --- | --- |
| Game Off | Pitch, dates, how to join (numbered), judging categories, rules | Steps are 1-2-3. Categories are a short list of names, not essays. No prize wall. |
| Colosseum Radar | Dates, what winners get next, prize pool, tracks, per-track prize ladder, named people, sponsor strip | Tracks are a row of names, then a block per track with a one-line brief and place prizes. People are name plus role, not bios. Sponsors are a logo strip at the end. |
| ETHGlobal | Dates and place, prize total, partner prize cards, schedule, judges/mentors | Partner prizes are amount cards. Schedule is a dated list. Judges are an avatar, name, and org grid. Prizes and "how to submit" are separate pages, linked from the home, not hidden. |
| ETHIstanbul | Schedule by day, tracks with 1st/2nd/3rd, FAQ groups | Each track is a card: one sentence, then the places. FAQ is real event questions, grouped, not a dump of rules. |

Shared habits: one primary register action up top and again at the bottom, section titles you can scan, cards and grids, timeline as dates not paragraphs, criteria as names (sometimes with weight implied by the category list), sponsors as a row not a story, FAQ only when they have real answers.

## Adopted for `/polaris`

- Header stays the decision: name, one-line pitch, dates, current stage, one Register or Enter button.
- Sticky anchor nav, same idea as ETHGlobal's section links, instead of tabs that hide the page.
- Body order: schedule, tracks, prizes, how to submit, criteria, judges, sponsor slots, resources, rules, FAQ, register again.
- Tracks and prizes as cards (Radar and ETHIstanbul). Criteria as a small weight table per stage (Game Off's category list, plus the weights the Hub already stores).
- How to submit is three steps from the real Hub flow: register, team is the project, submit an existing project or create one.
- Judges stay an initials row with names. No bios, because the Hub only has a name.
- Sponsor slots are one placeholder name per track. Not a logo wall, because there is no second sponsor and no real logo in the seed.
- FAQ is a labeled placeholder with no questions. The seed has no FAQ field, and the rules text is not a Q&A list.
- The only Polaris accent remains the Tundra, Mountains, and Stars labels on the header timeline.
