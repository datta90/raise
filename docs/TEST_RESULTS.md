# Local test record

Date: 30 October 2026

Command: `npm test`

Result: **6 tests passed, 0 failed**.

Verified locally:

- HTTP home shell loads and security headers are present.
- JavaScript and CSS assets are served with the expected content types.
- Health endpoint reports `demo` when no API key is configured.
- A valid request returns a plan explicitly tagged `demo`.
- Invalid age/topic input is rejected with HTTP 400.
- A self-harm-related request returns the safety-boundary response rather than an ordinary plan.

Not verified by this test record: live OpenAI response generation, hosting deployment, physical phone testing over mobile data, or parent usability sessions. These require a valid server-side key, public host, device and real participants.
