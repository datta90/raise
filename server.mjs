import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

// Load .env automatically using existing fs/promises (zero extra imports needed)
try {
  const envContent = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // No .env file present; rely on process.env
}

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 8 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 12;
const requests = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const SAFE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; manifest-src 'self'; base-uri 'self'; frame-ancestors 'none'",
};

const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    opening_line: { type: 'STRING' },
    opening_intent: { type: 'STRING' },
    questions: { type: 'ARRAY', items: { type: 'STRING' } },
    listening_cues: { type: 'ARRAY', items: { type: 'STRING' } },
    if_quiet: { type: 'STRING' },
    if_pushback: { type: 'STRING' },
    close_with: { type: 'STRING' },
    gentle_reminder: { type: 'STRING' },
    professional_support_note: { type: 'STRING' },
  },
  required: [
    'opening_line',
    'opening_intent',
    'questions',
    'listening_cues',
    'if_quiet',
    'if_pushback',
    'close_with',
    'gentle_reminder',
    'professional_support_note',
  ],
};

const SYSTEM_PROMPT = `You are Raise, a parent-first conversation preparation assistant. You do not speak to the teenager; you help an adult prepare for a respectful conversation with their teenager aged 14–18. You are not a therapist, counsellor, doctor, lawyer, crisis service, or diagnostic tool.
PRODUCT PROMISE: help a parent prepare one natural opening, invite the teenager's perspective, listen without lecturing, and decide a thoughtful next step. Do not promise agreement, obedience, or behaviour change.
TONE: calm, warm, clear, culturally flexible, non-judgemental, not preachy. Use natural everyday language. Never shame a parent or teenager. Offer options rather than rigid instructions. Do not assume heterosexuality, gender roles, family structure, religious beliefs, or that the parent is always right. Respect a teenager's dignity and growing autonomy. Keep output concise and actionable.
SAFETY: Do not provide therapy, diagnosis, medical/legal advice, or crisis counselling. If the concern indicates immediate danger, self-harm/suicidality, abuse, exploitation, or violence, do not produce an ordinary conversation plan; the server is intended to intercept those inputs first, but if they remain, use professional_support_note to say Raise is not appropriate for urgent safety needs and recommend immediate local emergency/qualified professional support. Never advise confrontation with an abuser, secrecy around danger, punishment, coercion, humiliation, surveillance, accessing private accounts, or extracting disclosures. Do not sexualise minors or give explicit sexual instructions. For a safety boundary or conflict, support calm, non-coercive communication while prioritising safety and professional help when needed.
PRIVACY: The parent has been asked not to enter names, school names, addresses, contact details, usernames, or identifiable details. Do not ask for more personal information. Do not repeat sensitive details unnecessarily.
OUTPUT: Return only a JSON object matching the supplied schema. Include one short opening line, the intention behind it, exactly 3 open questions, 3 listening cues, a gentle response if the teen is quiet, a calm response if there is pushback, a respectful closing line, one gentle reminder, and a brief support-boundary note. Never make a response sound guaranteed. If the topic is sensitive, use plain language and keep it proportionate.`;

function send(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    ...SAFE_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

//function getClientKey(req) {
//  return req.socket.remoteAddress || 'unknown';
//}

function getClientKey(req) {
  // 1. Check Render / Cloudflare verified client IP headers first
  const cfIp = req.headers['true-client-ip'] || req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();

  // 2. Fallback to X-Forwarded-For set by Render's reverse proxy
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips[0];
  }

  // 3. Localhost / direct socket fallback
  return req.socket.remoteAddress || 'unknown';
}

function rateLimited(req) {
  const key = getClientKey(req);
  const now = Date.now();

  // Prune expired windows so the in-memory Map doesn't leak RAM over time
  if (requests.size > 500) {
    for (const [k, v] of requests.entries()) {
      if (now - v.start > WINDOW_MS) requests.delete(k);
    }
  }

  const row = requests.get(key);
  if (!row || now - row.start > WINDOW_MS) {
    requests.set(key, { start: now, count: 1 });
    return false;
  }
  row.count += 1;
  return row.count > LIMIT;
}

// function rateLimited(req) {
//   const key = getClientKey(req);
//   const now = Date.now();
//   const row = requests.get(key);
//   if (!row || now - row.start > WINDOW_MS) {
//     requests.set(key, { start: now, count: 1 });
//     return false;
//   }
//   row.count += 1;
//   return row.count > LIMIT;
// }

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw Object.assign(new Error('Please submit a valid request.'), { status: 400 });
  }
}

function normaliseInput(input) {
  const topicSet = new Set([
    'Growing up & relationships',
    'Online content & peer pressure',
    'Behaviour & language',
    'School, stress & wellbeing',
    'Something else',
  ]);
  const ageSet = new Set(['14–15', '16–18', '14 15', '16 18']);
  const goalSet = new Set([
    'Understand their perspective',
    'Share a concern calmly',
    'Set a respectful boundary',
    'Ask an important question',
    'Repair after a disagreement',
  ]);
  const hardSet = new Set([
    'Finding the right words',
    'Worried they will shut down',
    'Worried they will push back',
    'Not sure they are ready',
    'We have talked before',
  ]);

  const ageBand = String(input.ageBand || '');
  const topic = String(input.topic || '');
  const concern = String(input.concern || '').trim();
  const goal = String(input.goal || '');
  const hardest = Array.isArray(input.hardest) ? input.hardest.filter(v => hardSet.has(v)).slice(0, 5) : [];

  if (!ageSet.has(ageBand)) throw Object.assign(new Error('Choose an age band to continue.'), { status: 400 });
  if (!topicSet.has(topic)) throw Object.assign(new Error('Choose the topic closest to your concern.'), { status: 400 });
  if (!goalSet.has(goal)) throw Object.assign(new Error('Choose what you want the first conversation to do.'), { status: 400 });
  if (concern.length < 10) throw Object.assign(new Error('Add a little more context (at least 10 characters), without names or identifying details.'), { status: 400 });
  if (concern.length > 1200) throw Object.assign(new Error('Please keep the context under 1,200 characters.'), { status: 400 });

  return { ageBand, topic, concern, goal, hardest };
}

const SAFETY_PATTERNS = [
  /\bsuicid(e|al)\b/i,
  /\bself[ -]?harm\b/i,
/\bwant to die\b/i,
/\bkill (myself|themself|himself|herself|themselves)\b/i,
/\b(being|was|were|is|are) (sexually )?abused\b/i,
/\b(sexual abuse|abusive relationship|child abuse|domestic abuse)\b/i,
/\b(grooming|being groomed)\b/i,
/\b(exploitation|exploited|assaulted|molested|sexually assaulted)\b/i,
/\bunsafe at home\b/i,
/\b(immediate|physical) danger\b/i,
/\b(threatened to hurt|threatening violence|being hit at home)\b/i,
];

function safetyGate(text) {
  return SAFETY_PATTERNS.some(pattern => pattern.test(text));
}

function demoPlan(input) {
  const subject = input.topic === 'Something else' ? 'this' : input.topic.toLowerCase();
  return {
    opening_line: `“There’s something about ${subject} I’d like to understand together. Is now an okay time to talk for a few minutes?”`,
    opening_intent: 'This asks permission, signals curiosity, and gives your teenager some choice about timing rather than beginning with a lecture.',
    questions: [
      '“What have you heard or thought about this so far?”',
      '“What part of this feels important from your point of view?”',
      '“What would make it easier for us to talk about this?”',
    ],
    listening_cues: [
      'Let them finish before responding; a pause is not a failure.',
      'Reflect back one thing you heard before adding your own view.',
      'Ask whether they want your perspective now or would rather think first.',
    ],
    if_quiet: '“You don’t have to answer straight away. We can pause and come back to it when you feel ready.”',
    if_pushback: '“I hear that you see this differently. I want to understand that, even though I may still have a concern I need to explain.”',
    close_with: '“Thank you for talking with me. We don’t have to solve everything right now. What would feel like a useful next step?”',
    gentle_reminder: 'Aim for connection and understanding, not instant agreement. A short, respectful first conversation can be enough for today.',
    professional_support_note: 'If this involves safety, abuse, self-harm, or a situation that needs specialist support, Raise is not a substitute for immediate local help or a qualified professional.',
  };
}

function isPlanValid(plan) {
  return (
    plan &&
    typeof plan.opening_line === 'string' &&
    typeof plan.opening_intent === 'string' &&
    Array.isArray(plan.questions) &&
    plan.questions.length >= 2 &&
    Array.isArray(plan.listening_cues) &&
    plan.listening_cues.length >= 2 &&
    typeof plan.if_quiet === 'string' &&
    typeof plan.if_pushback === 'string' &&
    typeof plan.close_with === 'string' &&
    typeof plan.gentle_reminder === 'string' &&
    typeof plan.professional_support_note === 'string'
  );
}

async function generateWithGemini(input) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return { plan: demoPlan(input), source: 'demo' };

  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: JSON.stringify(input) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: PLAN_SCHEMA,
      maxOutputTokens: 4096,
      ...(model.startsWith('gemini-3.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
                                 signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const upstreamMsg = payload?.error?.message || `HTTP ${response.status}`;
      console.error('[Gemini API Error]:', response.status, upstreamMsg);

      const isAuthError =
      response.status === 401 ||
      response.status === 403 ||
      (response.status === 400 && /API_KEY|key/i.test(upstreamMsg));

      const safeMessage = isAuthError
      ? 'The Gemini API key is not accepted. Check your GEMINI_API_KEY configuration.'
      : response.status === 429
      ? 'The AI service is busy or its rate limit has been reached. Please try again shortly.'
      : `The AI service could not create a plan (${upstreamMsg}).`;
      const err = new Error(safeMessage);
      err.status = response.status === 429 ? 429 : 502;
      throw err;
    }

    const candidate = payload?.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
      const err = new Error('The AI safety filter blocked this request. Try rephrasing with general context.');
      err.status = 422;
      throw err;
    }

    const outputText = candidate?.content?.parts
    ?.filter(part => !part.thought && typeof part.text === 'string')
    .map(part => part.text)
    .join('')
    .trim();

    if (!outputText) {
      console.error('[Gemini Empty Output]:', JSON.stringify(payload));
      throw Object.assign(new Error('The AI service returned an empty response.'), { status: 502 });
    }

    const cleanedJson = outputText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let plan;
    try {
      plan = JSON.parse(cleanedJson);
    } catch (parseErr) {
      console.error('[Gemini JSON Parse Error]:', parseErr.message, 'Raw output:', outputText);
      throw Object.assign(new Error('The AI service returned a response that could not be read.'), { status: 502 });
    }

    if (!isPlanValid(plan)) {
      console.error('[Gemini Invalid Plan Shape]:', plan);
      throw Object.assign(new Error('The AI service returned an incomplete plan.'), { status: 502 });
    }

    return { plan, source: 'ai', model };
  } finally {
    clearTimeout(timeout);
  }
}

async function handlePrepare(req, res) {
  if (rateLimited(req)) {
    return send(res, 429, { error: 'Too many requests. Please pause for a few minutes before trying again.' });
  }
  let raw;
  try {
    raw = await readJson(req);
  } catch (error) {
    return send(res, error.status || 400, { error: error.message || 'Invalid request.' });
  }
  let input;
  try {
    input = normaliseInput(raw);
  } catch (error) {
    return send(res, error.status || 400, { error: error.message || 'Please check the form.' });
  }

  if (safetyGate(input.concern)) {
    return send(res, 200, {
      safetyEscalation: true,
      source: 'safety_gate',
      message: 'This concern may need support beyond conversation preparation. Raise is not designed for urgent safety concerns, self-harm, abuse, exploitation or violence. If someone may be in immediate danger, contact local emergency services now. Otherwise, reach out to a trusted adult or qualified professional who can help assess the situation. Please do not rely on this app as the only support.',
    });
  }

  try {
    const result = await generateWithGemini(input);
    return send(res, 200, result);
  } catch (error) {
    const status = error.status || (error.name === 'AbortError' ? 504 : 502);
    const message =
    error.name === 'AbortError'
    ? 'The AI service took too long to respond. Please try again.'
    : error.status
    ? error.message
    : 'Something went wrong while creating the plan. Please try again.';
    return send(res, status, { error: message });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, {
        ok: true,
        app: 'raise-mvp',
        mode: process.env.GEMINI_API_KEY ? 'ai-enabled' : 'demo',
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/prepare') return await handlePrepare(req, res);
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'API route not found.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const resolved = path.resolve(PUBLIC, `.${pathname}`);
    if (!resolved.startsWith(PUBLIC + path.sep) && resolved !== path.join(PUBLIC, 'index.html')) {
      res.writeHead(403, SAFE_HEADERS);
      res.end('Forbidden');
      return;
    }

    let data;
    try {
      data = await fs.readFile(resolved);
    } catch {
      data = await fs.readFile(path.join(PUBLIC, 'index.html'));
      pathname = '/index.html';
    }

    res.writeHead(200, {
      ...SAFE_HEADERS,
      'Content-Type': MIME[path.extname(pathname)] || 'application/octet-stream',
                  'Cache-Control': pathname === '/index.html' ? 'no-cache' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  } catch {
    if (!res.headersSent) send(res, 500, { error: 'Unexpected server error.' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Raise MVP listening on ${HOST}:${PORT}; mode=${process.env.GEMINI_API_KEY ? 'AI enabled (Gemini)' : 'demo preview'}`);
});
