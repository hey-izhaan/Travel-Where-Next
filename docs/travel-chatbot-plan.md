# Travel Helper Chatbot Plan

## Goal

Keep Travel Helper focused on three simple behaviors: answer travel questions, show hardcoded popular starter questions on the first screen, and show booking redirect actions after destination intent is detected.

## Phase Checklist

- [x] Phase 1: Restore project tracking files.
- [x] Phase 2: Restore the structured travel chat API.
- [x] Phase 3: Restore hardcoded popular starter questions.
- [x] Phase 4: Restore Google booking actions.
- [x] Phase 5: Keep the Worker minimal: no classifier, no planning state, no generated suggestions, no known destination list.
- [ ] Phase 6: Run automated checks and record manual QA results.

## Decisions

- Use the existing Cloudflare Workers AI binding and current main model.
- Call only the main chat model for `/api/chat`.
- Keep travel-only behavior as a short system-prompt instruction, not a separate classifier or keyword filter.
- Keep the UI as plain HTML, CSS, and JavaScript.
- Do not add persistent memory, browser-session planning state, or a database.
- Do not maintain a hardcoded destination list in the Worker.
- Do not render generated suggestion/task bubbles after assistant replies.
- Show hardcoded popular questions only on the initial screen.
- Generate exactly two destination actions in the Worker: Google Flights and Google Hotels.
- Open booking actions in a new tab so the chat remains open.

## Acceptance Criteria

- `/api/chat` makes one Workers AI chat-model call for valid chat requests.
- The frontend sends only `{ messages }` to the chat API.
- The API response includes only `reply`, `intent`, and `actions`.
- Destination action buttons appear only when the model reports destination intent with a destination name.
- Destination actions are exactly `Book flight to {destination}` and `Book hotel in {destination}`.
- Booking buttons open Google travel URLs in a new tab.
- The Worker contains no classifier prompt, keyword travel regex, planning state, generated suggestions, readiness, recommendation fallback, or known destination list.
- Safe fallback behavior keeps the app usable if model output is malformed.
- `npm run check` and `npm test` are run before handoff.
