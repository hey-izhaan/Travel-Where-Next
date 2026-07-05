# Webflow Integration

## Webflow Domain

Allowed browser origin:

```text
https://where-next-dev.webflow.io
```

The Cloudflare Worker allows this origin for `POST /api/chat` and `OPTIONS` preflight requests.

## Required Webflow Attributes

Use `data-travel` attributes as JavaScript hooks. Classes can stay focused on Webflow styling.

Create one wrapper element with `data-travel="component"`. Inside it, add one child with `data-travel="contain"`. The JavaScript initializes every component wrapper that contains a matching contain element.

Use these exact attributes for interactive elements:

| Attribute | Element type | Purpose |
| --- | --- | --- |
| `data-travel="messages"` | Div | Holds the current question/answer pair. |
| `data-travel="message-stage"` | Div | Scroll container around the messages element. |
| `data-travel="board-form"` | Form | First-screen question form. |
| `data-travel="board-input"` | Text input | First-screen question input. |
| `data-travel="board-submit"` | Button | First-screen submit button. |
| `data-travel="suggestions"` | Div | Holds starter buttons. |
| `data-travel="chat-form"` | Form | Follow-up chat form. |
| `data-travel="chat-input"` | Text input | Follow-up input. |
| `data-travel="chat-submit"` | Button | Follow-up submit button. |
| `data-travel="status"` | Text element | Shows `Ready` or `Planning`. |
| `data-travel="new-topic"` | Button | Resets the chat. |
| `data-travel="templates"` | Div | Hidden template container. |

Starter buttons inside `data-travel="suggestions"` need a `data-question` attribute. Add `data-travel-disable-during-request` if the button should be disabled while a response is loading. For example:

```html
<button data-travel-disable-during-request data-question="I want to find a warm beach trip" type="button">find a warm beach trip</button>
```

## Required Hidden Templates

Add these elements inside `data-travel="templates"`:

```html
<div class="travel_question_wrap" data-travel="question-template">
  <div class="travel_message is-user" data-travel="message"></div>
</div>
<div class="travel_answer_wrap" data-travel="answer-template">
  <div class="travel_message is-bot is-answer" data-travel="message"></div>
</div>
<div class="travel_loading_wrap" data-travel="loading-template">
  <div class="dots"><span></span><span></span><span></span></div>
  Planning your answer...
</div>
<div class="travel_action_list_wrap" data-travel="action-list-template"></div>
<button class="travel_action_button" data-travel="action-button-template" type="button"></button>
```

## JavaScript-Controlled Classes

The JavaScript still creates or toggles these classes for styling and animation:

```text
is-active
is-entering
is-exiting
is-loading
is-answering
is-notice
is-hotel
travel_question_wrap
travel_answer_wrap
travel_message
travel_action_list_wrap
travel_action_button
```

## Footer Code

Add this in Webflow Page settings > Custom code > Before `</body>` tag.

Replace both `YOUR_WORKER_URL` values with the deployed Worker origin, for example:

```text
https://patient-hat-3fe2.YOUR_SUBDOMAIN.workers.dev
```

```html
<script>
  window.TRAVEL_HELPER_API_URL = "https://YOUR_WORKER_URL/api/chat";
</script>
<script src="https://YOUR_WORKER_URL/chat.js"></script>
```

Do not paste `<html>`, `<head>`, or `<body>` tags into Webflow custom code.

## Deployment Steps

1. Deploy the Worker with `npm run deploy` or `npx wrangler deploy`.
2. Copy the deployed Worker URL from Wrangler output.
3. Set `window.TRAVEL_HELPER_API_URL` to `${WORKER_URL}/api/chat` in Webflow footer code.
4. Load `${WORKER_URL}/chat.js` after the API URL script.
5. Publish the Webflow site.
6. Test from `https://where-next-dev.webflow.io`, not only Webflow Designer preview.

## Notes

- Webflow runs the UI only. Workers AI stays on Cloudflare Worker.
- The Worker only allows CORS from `https://where-next-dev.webflow.io`.
- If you later add a custom domain, add that origin to `ALLOWED_CORS_ORIGINS` in `src/index.ts`.
- Webflow custom code supports HTML, CSS, and JavaScript only; server-side code stays outside Webflow.
