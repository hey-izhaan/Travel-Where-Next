# Webflow Integration

## Webflow Domain

Allowed browser origin:

```text
https://where-next-dev.webflow.io
```

The Cloudflare Worker allows this origin for `POST /api/chat` and `OPTIONS` preflight requests.

## Required Webflow Structure

Create one wrapper element with class `travel_wrap`. Inside it, add one child with class `travel_contain`. The JavaScript initializes every `.travel_wrap` that contains `.travel_contain`.

Use these exact classes for interactive elements:

| Class | Element type | Purpose |
| --- | --- | --- |
| `travel_message_set_wrap` | Div | Holds the current question/answer pair. |
| `travel_message_stage_wrap` | Div | Scroll container around `travel_message_set_wrap`. |
| `travel_form_wrap is-board` | Form | First-screen question form. |
| `travel_input is-board` | Text input | First-screen question input. |
| `travel_suggestion_list` | Div | Holds starter buttons. |
| `travel_form_wrap is-chat` | Form | Follow-up chat form. |
| `travel_input is-chat` | Text input | Follow-up input. |
| `travel_submit_button is-chat` | Button | Follow-up submit button. |
| `travel_status_text` | Text element | Shows `Ready` or `Planning`. |
| `travel_topic_button` | Button | Resets the chat. |
| `travel_hidden` | Div | Hidden template container. |

Starter buttons inside `travel_suggestion_list` need a `data-question` attribute, for example:

```html
<button data-question="I want to find a warm beach trip" type="button">find a warm beach trip</button>
```

## Required Hidden Templates

Add these elements inside `.travel_hidden`:

```html
<div class="travel_question_wrap">
  <div class="travel_message is-user"></div>
</div>
<div class="travel_answer_wrap">
  <div class="travel_message is-bot is-answer"></div>
</div>
<div class="travel_loading_wrap">
  <div class="dots"><span></span><span></span><span></span></div>
  Planning your answer...
</div>
<div class="travel_action_list_wrap"></div>
<button class="travel_action_button" type="button"></button>
```

## JavaScript-Controlled Classes

The JavaScript creates or toggles these classes, so style them in Webflow or custom CSS:

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