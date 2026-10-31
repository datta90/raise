# Raise MVP — Step 5 of the Product Management Capstone

A small, mobile-first, parent-first conversation preparation app. It turns a parent's real concern into a short, editable plan, then records whether the conversation happened and what the parent noticed.

## What is implemented

- Responsive mobile-browser UI and installable PWA shell.
- Parent onboarding: age band (14–15 or 16–18), topic category, concern, intended outcome, and conversation difficulty.
- Server-side OpenAI Responses API integration using structured JSON output. The API key is never sent to the browser.
- Conversation plan: an editable opening, its intention, three open questions, listening cues, options for quiet/pushback, a closing line, reminder, and support boundary.
- Outcome flow: happened / attempted / not yet; a completed conversation requires a meaningful reflection (minimum 15 characters) in addition to explicit confirmation that a real conversation happened.
- Local topic history, a reason to return, local progress counts, an anonymous-event export, and clear/delete controls.
- Safety gate for some urgent safety-related language; no ordinary plan is generated for those requests.
- No account, third-party analytics, database, or server-side retention of parent free-text. The browser stores the experience locally so the parent can return to it.
- Rate limiting, request-size validation, security headers, and basic automated smoke tests.

## Run locally

Requires Node.js 20 or newer. There are no npm dependencies.

```bash
npm test
npm start
```

Open `http://localhost:3000`.

### Preview mode versus AI mode

Without `OPENAI_API_KEY`, the app runs in **preview mode** and returns a clearly labelled template plan. This makes the journey testable without credentials, but it is not AI-generated and does not satisfy the live-AI part of the capstone by itself.

To enable live AI locally, set `OPENAI_API_KEY` in the server environment before starting the app. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.

PowerShell example:

```powershell
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_MODEL="gpt-4.1-mini"
npm start
```

macOS/Linux example:

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-4.1-mini"
npm start
```

Never paste a key into `public/app.js`, HTML, screenshots, or a repository. Do not commit `.env` files. API access/billing is separate from a ChatGPT subscription.

## Public deployment (Render)

A public deployment is not included in this source package because it requires the owner's hosting account, a repository and an API key. This project is prepared for deployment as a Node web service.

1. Create a private GitHub repository and upload the contents of this folder. Keep `.env` out of the repository.
2. In Render, create a new Web Service from that repository (or use the included `render.yaml` Blueprint).
3. Set the build command to `npm install` and the start command to `npm start`.
4. Add `OPENAI_API_KEY` in the service's environment settings. Add `OPENAI_MODEL=gpt-4.1-mini` if desired. Never put secrets in committed files.
5. Deploy and check `https://YOUR-APP.onrender.com/api/health`. For real AI, the response should contain `"mode":"ai-enabled"`; `"mode":"demo"` means no key reached the server.
6. Open the HTTPS URL on a physical phone using mobile data (not only the same Wi-Fi). Walk through one plan, a reflection and clear-data flow before using it with test participants.

Do not tell evaluators that the app is deployed until a public URL exists and the live AI path has been checked. A local smoke test is not the same thing as a deployment.

## Product and safety boundaries

- Parent/caregiver is the only intended user; the app is not a teen chat, tracking or disclosure tool.
- It is not therapy, diagnosis, medical/legal advice, crisis care or professional referral replacement.
- Do not enter names, schools, addresses, contact details, usernames, transcripts or identifying details.
- When generating a plan, the user's selected options and free-text context are sent to the configured AI provider. Review that provider's terms and data controls before real-world testing.
- LocalStorage is browser/device storage, not encrypted vault storage. Anyone with access to the same unlocked browser profile could potentially see its content. Use a personal device, delete topics when finished, and do not store highly sensitive detail.
- The safety filter is a lightweight prototype guardrail, not a reliable clinical risk detector. It may miss risk or flag a benign mention. Safety-sensitive deployment needs specialist review and more robust red-teaming.
- Anonymous export contains random local topic IDs, broad category, age band, event times and outcomes. It intentionally excludes concern, generated plan and reflection text. It only describes one browser/device; it is not a multi-user analytics backend.

## Content maintenance

The product rules live in `SYSTEM_PROMPT`, `PLAN_SCHEMA` and the safety patterns at the top of `server.mjs`. Version changes through source control. Before changing guidance, review the following:

1. Age appropriateness and non-judgemental language.
2. Whether advice invites listening and autonomy rather than coercion or compliance.
3. No diagnosis, therapy, explicit sexualised content involving minors, surveillance or crisis counselling.
4. Clear professional-support boundaries for high-risk contexts.
5. A regression test for the relevant risk and for the standard topic flow.

For a real release, nominate an accountable content/safeguarding reviewer, log the prompt/schema version (without storing parent text), and schedule a quarterly review plus an immediate review after any safety issue.

## Validation performed in this package

`npm test` checks the HTTP shell, security headers, health mode, a valid preview plan, validation errors and the safety gate. It does **not** call OpenAI because that requires a real API key. Real AI output, a public deployment, phone/mobile-data usability and sessions with five or more real parents must still be performed and recorded as actual tests—not claimed from source-code checks.
