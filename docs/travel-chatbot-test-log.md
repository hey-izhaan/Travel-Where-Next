# Travel Helper Test Log

## Automated Checks

- [x] `npm run check` - Passed on 2026-07-05 after restore. TypeScript compile and Wrangler dry-run completed successfully.
- [x] `npm test` - Passed on 2026-07-05 after restore. 8 Vitest tests covered one-model calls, booking actions, malformed output fallback, removed classifier/state logic, and frontend starter/action checks.

## Manual QA Scenarios

Record each result with date, outcome, and notes.

| Scenario | Expected Result | Status | Notes |
| --- | --- | --- | --- |
| New chat loaded | Shows welcome message and hardcoded popular questions. | Not run | Requires local/live UI session. |
| Click popular starter question | Sends that question as the first user message and hides starter questions. | Not run | Requires local/live UI session. |
| Ask for beach recommendations | Gives useful travel answer; no generated suggestion bubbles appear. | Not run | Requires local/live UI session. |
| Ask unrelated question | Model returns the short travel-only redirect from the system prompt. | Not run | Prompt-level behavior, no classifier path. |
| Type `maldives` or another destination | Shows exactly `Book flight to {destination}` and `Book hotel in {destination}`. | Not run | Covered by automated API test. |
| Click flight booking action | Opens Google Flights in a new tab and keeps chat open. | Not run | Requires browser session. |
| Click hotel booking action | Opens Google Hotels in a new tab and keeps chat open. | Not run | Requires browser session. |
| Malformed model output fallback | UI still shows a useful travel-helper answer and does not break. | Not run | Covered by automated API test. |

