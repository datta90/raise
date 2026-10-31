# Raise MVP — Safety and privacy notes

## Core boundary
Raise prepares parents for a conversation. It does not make decisions for a parent, manage a teenager, promise behaviour change or replace professional support.

## Data flow

1. Parent enters a broad age band, category, concern, intended outcome and difficulty.
2. The browser sends those fields to this app's `/api/prepare` endpoint.
3. The server validates fields, checks for a limited set of urgent safety phrases, then (if configured) sends the context to the OpenAI Responses API for structured generation.
4. The API key remains on the server. The app server does not persist request bodies or plans.
5. Browser history and reflections are stored in localStorage to allow the parent to return. They remain on that browser profile until deleted or browser data is cleared.
6. Optional anonymous event export omits free-text and plan text. No event is sent to an analytics server.

## Safety behaviours

- Basic input validation, request size limit, in-memory rate limit.
- Structured response schema to reduce unpredictable output shapes.
- System prompt instructs a calm, respectful tone; listening and autonomy; no shaming, coercion, surveillance, diagnosis, therapy, or compliance promises.
- Limited keyword guard declines ordinary plan generation for selected self-harm/abuse/exploitation/violence terms and advises appropriate local emergency or qualified support.
- App interface includes safety and privacy notices.

## Known limitations; do not overstate readiness

- The keyword gate is neither a clinical risk assessment nor a comprehensive moderation solution. It can miss important contexts and can interrupt benign mentions.
- Model output is not guaranteed correct, culturally appropriate, or safe in every edge case. Human evaluation and red-teaming are required before wider release.
- LocalStorage is not encrypted storage and the app has no identity, consent ledger, secure multi-user account or remote deletion mechanism.
- There is no global analytics store. Progress counts reflect a single local device only.
- No real user test, clinical review, external security assessment or public deployment is asserted by this package.

## Pre-pilot release gate

- Verify OpenAI key is server-side only; test `/api/health` shows `ai-enabled`.
- Test representative low-risk topics, ambiguous mentions of high-risk topics, direct safety disclosures, prompt-injection attempts, offensive content, network errors and rate-limit behaviour.
- Have an appropriate safeguarding professional review escalation wording.
- Use consented adult-parent testing, do not solicit teen disclosures, and avoid collecting identifiable child information.
- Confirm the actual privacy and data-retention terms of the selected AI and hosting providers.
