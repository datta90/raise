import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url, child) {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error('Server exited before becoming ready.');
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server did not start in time.');
}

test('Raise MVP HTTP smoke tests', async t => {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
                      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', GEMINI_API_KEY: '' },
                      stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitFor(`${base}/api/health`, child);
    await t.test('serves the mobile web shell and security headers', async () => {
      const response = await fetch(base);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      const html = await response.text();
      assert.match(html, /id="app"/);
      const js = await fetch(`${base}/app.js`);
      assert.equal(js.status, 200);
      assert.match(js.headers.get('content-type'), /javascript/);
      const css = await fetch(`${base}/styles.css`);
      assert.equal(css.status, 200);
      assert.match(css.headers.get('content-type'), /text\/css/);
    });
    await t.test('health endpoint states preview mode without a server key', async () => {
      const response = await fetch(`${base}/api/health`);
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.equal(body.mode, 'demo');
    });
    await t.test('valid input returns a clearly labelled preview plan', async () => {
      const response = await fetch(`${base}/api/prepare`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ageBand: '14–15', topic: 'Behaviour & language', concern: 'We keep repeating the same argument about language and I want to listen more.', goal: 'Understand their perspective', hardest: ['We have talked before'] }),
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.source, 'demo');
      assert.equal(typeof body.plan.opening_line, 'string');
      assert.equal(body.plan.questions.length, 3);
    });
    await t.test('invalid input is rejected', async () => {
      const response = await fetch(`${base}/api/prepare`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ageBand: '9', topic: 'Wrong', concern: 'Too short', goal: 'Wrong' }),
      });
      assert.equal(response.status, 400);
    });
    await t.test('safety gate declines ordinary plan and returns support boundary', async () => {
      const response = await fetch(`${base}/api/prepare`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ageBand: '16–18', topic: 'Something else', concern: 'My teenager mentioned self-harm and I am worried about immediate safety.', goal: 'Understand their perspective', hardest: [] }),
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.safetyEscalation, true);
      assert.match(body.message, /not designed for urgent safety concerns/i);
    });
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => { if (child.exitCode !== null) resolve(); else { child.once('exit', resolve); setTimeout(resolve, 1200).unref(); } });
  }
  if (logs.includes('Unhandled')) throw new Error(logs);
});
