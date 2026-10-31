# Deployment Quick Start

This app requires a public Node.js host for the live API endpoint. The source ZIP does not itself create a public site.

## Local preview

1. Install Node.js 20+.
2. Unzip the archive and open a terminal in the `raise_mvp` directory.
3. Run `npm test`.
4. Run `npm start` and open `http://localhost:3000`.
5. With no OpenAI key, the app uses clearly labelled preview mode.

## Enable live AI

Set `OPENAI_API_KEY` in the Node process environment. Optionally set `OPENAI_MODEL=gpt-4.1-mini`. The API key must remain on the server and must never be put in any file inside `public/`.

## Deploy on Render

1. Upload the contents of this folder to a private GitHub repository.
2. Create a Render Web Service from the repo or create a Blueprint from `render.yaml`.
3. Use `npm install` as the build command and `npm start` as the start command.
4. Add `OPENAI_API_KEY` in Render Environment settings as a secret. The included `render.yaml` intentionally uses `sync: false` so the secret must be entered in the hosting account.
5. Deploy. Visit `/api/health` on the new HTTPS domain.
6. Confirm it returns `"mode":"ai-enabled"`. Generate a real plan and check that the screen does not show the preview-mode banner.
7. Open the same HTTPS URL from a physical phone using mobile data. Test onboarding, plan generation, reflection, local history, export and deletion.

## Capstone evidence

Save the actual URL, a date-stamped phone test note and a few screenshots only after completing those checks. Do not claim a public deployment or live AI test before then. Parent usability metrics must come from real, consented adult participants; the source-level automated tests are not user validation.
