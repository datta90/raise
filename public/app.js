const STORAGE_KEY = 'raise.local.v1';
const app = document.getElementById('app');
const historyCount = document.getElementById('history-count');
const toastEl = document.getElementById('toast');
const privacyDialog = document.getElementById('privacy-dialog');

const state = { view: 'home', activeId: null, busy: false, toastTimer: null, openingEdit: false };

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"version":1,"topics":[]}');
    if (!parsed || !Array.isArray(parsed.topics)) return { version: 1, topics: [] };
    return parsed;
  } catch { return { version: 1, topics: [] }; }
}
let store = loadStore();

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    historyCount.textContent = String(store.topics.length);
  } catch {
    showToast('Your browser storage is full. Export or clear older topics to continue.');
  }
}

function makeId() { return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
function byId(id) { return store.topics.find(t => t.id === id); }
function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
function topicTitle(topic) {
  if (topic.topic && topic.topic !== 'Something else') return topic.topic;
  const short = (topic.concern || '').trim().replace(/\s+/g, ' ');
  return short ? (short.length > 48 ? short.slice(0, 45) + '…' : short) : 'A conversation to prepare for';
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}
function setView(view) {
  state.view = view;
  state.openingEdit = false;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setBusy(busy) {
  state.busy = busy;
  app.setAttribute('aria-busy', busy ? 'true' : 'false');
}
function currentTopic() { return byId(state.activeId); }
function getIncompleteTopic() {
  return [...store.topics].reverse().find(t => t.status !== 'completed' && t.status !== 'safety_redirect');
}
function statusLabel(topic) {
  if (topic.status === 'completed') return ['Conversation reflected', ''];
  if (topic.status === 'attempted') return ['Attempted', 'attempted'];
  if (topic.status === 'deferred') return ['Saved for later', 'deferred'];
  return ['Plan ready', 'started'];
}

function homeView() {
  const topicCount = store.topics.length;
  const completed = store.topics.filter(t => t.status === 'completed' && isQualifying(t)).length;
  const open = getIncompleteTopic();
  return `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">For the conversations that matter</div>
        <h1>The hard part isn't caring.<br>It's knowing how to <em>start.</em></h1>
        <p>Prepare for one real conversation with your teenager. Find words that feel like you, make room to listen, and take the next step at your pace.</p>
        <button class="button button-primary" type="button" data-action="start">Prepare a conversation <span class="arrow">→</span></button>
        <div class="trust-row"><span><i class="tiny-check">✓</i> No perfect script</span><span><i class="tiny-check">✓</i> Your pace, your words</span><span><i class="tiny-check">✓</i> Parent-first</span></div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="art-orbit"><span class="art-spark">✳</span><div class="art-people"><div class="person"><span class="person-head"></span><span class="person-body"></span></div><div class="person younger"><span class="person-head"></span><span class="person-body"></span></div></div><div class="speech-dot"><span></span><span></span><span></span></div></div>
      </div>
    </section>
    ${open ? `<section class="section-heading"><div><h2>Pick up where you left off</h2><p>Your preparation stays here on this device.</p></div></section><section class="history-item resume-card"><div class="history-info"><h3>${esc(topicTitle(open))}</h3><div class="history-meta"><span>${esc(open.ageBand)} years</span><span>Started ${esc(formatDate(open.startedAt))}</span><span>${open.plan ? 'Plan ready' : 'In progress'}</span></div></div><button class="button button-secondary" data-action="resume" data-id="${esc(open.id)}">Continue <span class="arrow">→</span></button></section>` : ''}
    <section class="section-heading"><div><div class="eyebrow">Small steps, not perfect speeches</div><h2>A little preparation can change the tone.</h2><p>Raise helps you get ready for the first few minutes—not control how the whole conversation goes.</p></div></section>
    <section class="steps-grid" aria-label="How Raise works">
      <article class="step-card"><span class="step-no">01</span><h3>Start with your concern</h3><p>Choose the context, your teenager's age band, and what you hope the conversation can do.</p></article>
      <article class="step-card"><span class="step-no">02</span><h3>Prepare a way in</h3><p>Get an editable opening, questions to invite their perspective, and a few calm ways to respond.</p></article>
      <article class="step-card"><span class="step-no">03</span><h3>Reflect, without judgement</h3><p>Record what happened and one thing you learned. Agreement isn't required for a conversation to count.</p></article>
    </section>
    <section class="side-card tint" style="margin-top:19px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
      <div><div class="eyebrow">Your space</div><h3 style="margin:5px 0 4px">${topicCount ? 'Every small step counts.' : 'Your conversations, in one place.'}</h3><p>${topicCount ? `${topicCount} topic${topicCount === 1 ? '' : 's'} started · ${completed} conversation${completed === 1 ? '' : 's'} reflected on this device.` : 'Your plans and reflections are saved in this browser. No account needed.'}</p></div>
      <button class="button button-secondary" data-action="space">Open my space <span class="arrow">→</span></button>
    </section>
    <p class="form-note" style="text-align:center;margin-top:18px;">Please don't enter names or identifying details. Raise is a preparation tool—not therapy, diagnosis or crisis support.</p>
  `;
}

const topics = [
  ['Growing up & relationships', '♡', 'Relationships, growing up, identity or changing feelings'],
  ['Online content & peer pressure', '⌁', 'Online content, friends, social pressure or influence'],
  ['Behaviour & language', '◌', 'Language, boundaries, repeated conflict or behaviour'],
  ['School, stress & wellbeing', '☼', 'School pressure, stress, routines or wellbeing'],
  ['Something else', '✳', "A concern that doesn't fit the options above"],
];
const goals = [
  'Understand their perspective', 'Share a concern calmly', 'Set a respectful boundary',
  'Ask an important question', 'Repair after a disagreement'
];
const hardestChoices = [
  'Finding the right words', 'Worried they will shut down', 'Worried they will push back',
  'Not sure they are ready', 'We have talked before'
];

function formView(topic = null) {
  const editId = topic ? topic.id : '';
  const ageBand = topic?.ageBand || '14–15';
  const selectedTopic = topic?.topic || '';
  const selectedGoal = topic?.goal || 'Understand their perspective';
  const selectedHardest = topic?.hardest || [];
  return `
    <div class="page-intro"><div class="eyebrow">Step 1 of 2 · Prepare</div><h1>Let's start with what's on your mind.</h1><p>You don't need to explain everything. A little context is enough to build a useful first step.</p></div>
    <div class="form-layout">
      <form class="form-card" id="concern-form" data-edit-id="${esc(editId)}">
        <div class="form-top"><span class="step-badge">01</span><div><h2>Your conversation</h2><p>Keep it general. No names or identifying details needed.</p></div></div>
        <div class="form-section">
          <label class="field-label" for="age-band">How old is your teenager?<span class="field-hint">A broad age band helps keep the guidance age-aware.</span></label>
          <div class="select-wrap"><select id="age-band" name="ageBand" required><option value="14–15" ${ageBand === '14–15' ? 'selected' : ''}>14–15 years</option><option value="16–18" ${ageBand === '16–18' ? 'selected' : ''}>16–18 years</option></select></div>
        </div>
        <div class="form-section">
          <span class="field-label">Which area is closest to the concern?</span>
          <div class="choice-grid">${topics.map(([name, icon, desc], i) => `<div class="choice"><input type="radio" id="topic-${i}" name="topic" value="${esc(name)}" ${selectedTopic === name || (!selectedTopic && i === 0) ? 'checked' : ''} required><label for="topic-${i}"><span class="choice-icon" aria-hidden="true">${icon}</span><span><strong>${esc(name)}</strong><span class="field-hint">${esc(desc)}</span></span></label></div>`).join('')}</div>
        </div>
        <div class="form-section">
          <label class="field-label" for="concern">What's on your mind?<span class="field-hint">Share the situation in your own words. Avoid names, exact ages beyond the band, school names or identifying details.</span></label>
          <textarea class="text-area" id="concern" name="concern" maxlength="1200" minlength="10" required placeholder="For example: We keep talking about online content, but I worry our conversations become a lecture. I'd like to understand what my teenager thinks without ignoring my concern.">${esc(topic?.concern || '')}</textarea>
          <div class="char-count"><span id="concern-count">${(topic?.concern || '').length}</span> / 1,200</div>
        </div>
        <div class="form-section">
          <label class="field-label" for="goal">What would a good first conversation do?</label>
          <div class="select-wrap"><select id="goal" name="goal" required>${goals.map(g => `<option value="${esc(g)}" ${selectedGoal === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
        </div>
        <div class="form-section">
          <span class="field-label">What feels hardest right now? <span class="field-hint">Choose any that fit.</span></span>
          <div class="chip-grid">${hardestChoices.map((name, i) => `<div class="check-chip"><input type="checkbox" id="hard-${i}" name="hardest" value="${esc(name)}" ${selectedHardest.includes(name) ? 'checked' : ''}><label for="hard-${i}">${esc(name)}</label></div>`).join('')}</div>
        </div>
        <div class="form-actions"><button class="button button-primary" type="submit">Create my conversation plan <span class="arrow">→</span></button><button class="button button-quiet" type="button" data-action="home">Cancel</button></div>
        <p class="form-note">When you continue, this context is sent to the configured AI provider to create the plan. Your browser stores a local copy so you can return to it. <button class="inline-link" type="button" data-action="privacy">Read privacy & safety</button>.</p>
        <div id="form-error" class="error-text" role="alert"></div>
      </form>
      <aside class="side-stack">
        <section class="side-card tint"><div class="eyebrow">A good first step</div><h3>You don't need the perfect words.</h3><p>Try starting from your care, not your conclusion. The goal is an invitation to talk—not a speech that guarantees a result.</p></section>
        <section class="side-card"><h3>Before you type</h3><ul><li>Keep the situation brief and general.</li><li>Share what you hope to understand or communicate.</li><li>Leave out names and private details.</li></ul></section>
        <section class="side-card warm"><div class="side-quote">“Connection before correction.”<small>A reminder, not a rule for every situation.</small></div></section>
      </aside>
    </div>
  `;
}

function loadingView(isRegenerate = false) {
  return `<section class="loading-card"><div class="loader" aria-hidden="true"><span></span><span></span><span></span></div><div class="eyebrow">A moment to prepare</div><h2>${isRegenerate ? 'Finding another way in…' : 'Putting together your first step…'}</h2><p>Creating a short plan built around your concern—not a one-size-fits-all script.</p></section>`;
}

function planView(topic) {
  if (!topic || !topic.plan) return `<section class="empty-state"><h2>Your plan isn't here yet.</h2><p>Start with your concern and we'll prepare a simple plan.</p><button class="button button-primary" data-action="start">Prepare a conversation →</button></section>`;
  const p = topic.plan;
  const demo = topic.source === 'demo';
  const edited = state.openingEdit;
  return `
    <div class="page-intro"><div class="eyebrow">Step 1 of 2 · Your conversation plan</div><h1>Start with understanding.</h1><p>A few grounded options for <strong>${esc(topicTitle(topic))}</strong>. Keep what feels true to you and edit the rest.</p></div>
    <div class="flow-track" aria-label="Progress"><span class="track-step current"><span class="track-dot">1</span> Prepare</span><span class="track-line"></span><span class="track-step"><span class="track-dot">2</span> Reflect</span></div>
    ${demo ? `<div class="notice demo"><span class="notice-icon">ⓘ</span><div><strong>Preview mode — sample plan, not AI-generated.</strong><br>This environment has no OpenAI API key configured. Add a server-side API key to generate context-specific plans.</div></div>` : `<div class="notice" style="background:#e8f4e9;border:1px solid #d7e9d9;color:#315e4b"><span class="notice-icon">✦</span><div><strong>AI-generated draft.</strong> Read it through and change any wording that doesn't sound like you.</div></div>`}
    <div class="result-layout">
      <div class="result-main">
        <section class="plan-card featured">
          <div class="card-kicker">Your opening · Keep it natural</div>
          <div id="opening-display" class="opening-quote">${esc(p.opening_line)}</div>
          <p class="small-copy">${esc(p.opening_intent)}</p>
          <div class="divider" style="background:rgba(255,255,255,.2)"></div>
          ${edited ? `<div class="edit-opening"><label class="field-label" for="opening-edit" style="color:white">Edit the opening in your own words</label><textarea id="opening-edit" maxlength="650">${esc(p.opening_line)}</textarea><div class="inline-actions" style="margin-top:9px"><button class="button button-secondary" data-action="save-opening">Save wording</button><button class="button button-quiet" style="color:#e3f0e9" data-action="cancel-opening">Cancel</button></div></div>` : `<div class="inline-actions"><button class="button button-secondary" data-action="edit-opening">✎ Make it sound like me</button><button class="button button-quiet" style="color:#e3f0e9" data-action="copy-opening">Copy opening</button></div>`}
        </section>
        <div class="result-two-col">
          <section class="plan-card"><div class="card-kicker">Invite their view</div><h2>Three questions, not a quiz.</h2><ol class="number-list">${p.questions.map((q,i) => `<li><span class="num">${i+1}</span><span>${esc(q)}</span></li>`).join('')}</ol></section>
          <section class="plan-card"><div class="card-kicker">While they speak</div><h2>Make room to listen.</h2><ol class="number-list">${p.listening_cues.map((q,i) => `<li><span class="num">${i+1}</span><span>${esc(q)}</span></li>`).join('')}</ol></section>
        </div>
        <section class="plan-card"><div class="card-kicker">If the moment shifts</div><h2>Have a gentle next line ready.</h2><div class="response-pair"><div class="response-option"><span class="response-label">If they go quiet</span><p>${esc(p.if_quiet)}</p></div><div class="response-option"><span class="response-label">If they push back</span><p>${esc(p.if_pushback)}</p></div></div></section>
        <section class="plan-card"><div class="card-kicker">Close without forcing an answer</div><h2>Leave the door open.</h2><p style="font:17px/1.5 Georgia,serif;margin:0 0 14px">${esc(p.close_with)}</p><div class="prompt-box"><h3>A gentle reminder</h3><p>${esc(p.gentle_reminder)}</p></div></section>
        <section class="plan-card"><div class="eyebrow">One last note</div><p class="small-copy" style="margin:8px 0 0">${esc(p.professional_support_note)}</p></section>
        <div class="form-actions"><button class="button button-primary" data-action="reflect" data-id="${esc(topic.id)}">Reflect after the conversation <span class="arrow">→</span></button><button class="button button-secondary" data-action="not-yet" data-id="${esc(topic.id)}">Save for later</button></div>
        <p class="form-note">Your plan is a starting point, not a script to follow perfectly. A conversation can count even if you and your teenager disagree.</p>
      </div>
      <aside class="result-sidebar">
        <section class="side-card tint"><div class="eyebrow">Your intention</div><h3>${esc(topic.goal || 'Start with understanding')}</h3><p>The first conversation doesn't have to solve the whole issue. Focus on one small step that fits this intention.</p></section>
        <section class="side-card"><h3>Before you begin</h3><ul><li>Choose a moment when neither of you is rushing.</li><li>Ask whether it's a good time to talk.</li><li>Be ready to pause and return to it later.</li></ul></section>
        <section class="side-card warm"><h3>Try another approach</h3><p>Would a softer or more direct opening feel more natural?</p><button class="button button-secondary button-full" style="margin-top:14px" data-action="regenerate" data-id="${esc(topic.id)}">Create another take ↻</button></section>
        <button class="button button-quiet button-full" data-action="space">← Back to my space</button>
      </aside>
    </div>
  `;
}

function reflectionView(topic) {
  if (!topic) return `<section class="empty-state"><h2>No conversation selected.</h2><p>Open a plan first, then come back to reflect on what happened.</p><button class="button button-primary" data-action="space">Go to my space →</button></section>`;
  return `
    <div class="page-intro"><div class="eyebrow">Step 2 of 2 · Reflect</div><h1>What happened matters. So does what you noticed.</h1><p>This is a moment to learn, not grade yourself. A completed conversation doesn't need to end in agreement.</p></div>
    <div class="flow-track" aria-label="Progress"><span class="track-step done"><span class="track-dot">✓</span> Prepare</span><span class="track-line"></span><span class="track-step current"><span class="track-dot">2</span> Reflect</span></div>
    <div class="reflection-layout">
      <form id="reflection-form" class="form-card reflection-card" data-id="${esc(topic.id)}">
        <div class="form-top"><span class="step-badge">02</span><div><h2>One honest reflection</h2><p>${esc(topicTitle(topic))}</p></div></div>
        <div class="form-section" style="border-top:0;padding-top:0;margin-top:0">
          <span class="field-label">What best describes what happened?</span>
          <div class="outcome-options">
            <div class="outcome-option"><input type="radio" name="outcome" id="outcome-happened" value="happened" ${topic.status === 'completed' ? 'checked' : ''} required><label for="outcome-happened"><span class="outcome-icon">✓</span><span><strong>We had the conversation</strong><small>Even if it was short or didn't end in agreement.</small></span></label></div>
            <div class="outcome-option"><input type="radio" name="outcome" id="outcome-attempted" value="attempted" ${topic.status === 'attempted' ? 'checked' : ''}><label for="outcome-attempted"><span class="outcome-icon">↗</span><span><strong>I tried, but we couldn't finish</strong><small>The timing or moment wasn't right.</small></span></label></div>
            <div class="outcome-option"><input type="radio" name="outcome" id="outcome-later" value="later" ${topic.status === 'deferred' || topic.status === 'plan_ready' ? 'checked' : ''}><label for="outcome-later"><span class="outcome-icon">◷</span><span><strong>Not yet — I'll return to it</strong><small>It may need a better moment or more preparation.</small></span></label></div>
          </div>
        </div>
        <div class="reflection-fields" id="reflection-details">
          <div class="form-section">
            <label class="field-label" id="reflection-label" for="reflection">What did you notice, learn, or find difficult?<span class="field-hint" id="reflection-hint">A small detail is enough. Please do not include names or identifying information.</span></label>
            <textarea class="text-area" id="reflection" name="reflection" maxlength="1000" placeholder="For example: I paused instead of correcting right away. They asked a question I hadn't expected, and I realised I should listen before offering advice.">${esc(topic.reflection || '')}</textarea>
            <div class="char-count"><span id="reflection-count">${(topic.reflection || '').length}</span> / 1,000</div>
          </div>
          <div class="form-section">
            <label class="field-label" for="next-step">What would be useful next?</label>
            <div class="select-wrap"><select id="next-step" name="nextStep"><option value="" ${!topic.nextStep ? 'selected' : ''}>Not sure yet</option>${['Check in again','Read a trusted, age-appropriate source','Agree a clear boundary or next action','Give it time and leave the door open','Seek support from a qualified professional'].map(x => `<option value="${esc(x)}" ${topic.nextStep === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
          </div>
        </div>
        <div class="form-actions"><button class="button button-primary" type="submit">Save my reflection <span class="arrow">→</span></button><button class="button button-quiet" type="button" data-action="view-plan" data-id="${esc(topic.id)}">Back to my plan</button></div>
        <div id="reflection-error" class="error-text" role="alert"></div>
      </form>
      <aside class="side-stack">
        <section class="side-card tint"><div class="eyebrow">What counts</div><h3>A meaningful attempt, not a perfect result.</h3><p>For this MVP, a conversation is recorded as completed only when it actually happened and you capture at least one meaningful observation. A tick by itself doesn't count.</p></section>
        <section class="side-card"><h3>Reflection ideas</h3><ul><li>What did your teenager ask?</li><li>Where did the conversation stall?</li><li>What surprised you?</li><li>What would you do differently next time?</li></ul></section>
        <section class="side-card warm"><div class="side-quote">You can make room for their point of view and still hold an appropriate boundary.</div></section>
      </aside>
    </div>
  `;
}

function isQualifying(topic) {
  if (!topic || topic.status !== 'completed' || !topic.completedAt || !topic.startedAt) return false;
  const started = new Date(topic.startedAt).getTime();
  const completed = new Date(topic.completedAt).getTime();
  return completed >= started && completed - started <= 14 * 24 * 60 * 60 * 1000 && String(topic.reflection || '').trim().length >= 15;
}

function spaceView() {
  const all = [...store.topics].sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt));
  const total = all.length;
  const plans = all.filter(t => !!t.plan).length;
  const completed = all.filter(t => t.status === 'completed' && isQualifying(t)).length;
  const items = all.filter(t => t.status !== 'safety_redirect');
  return `
    <div class="history-top"><div><div class="eyebrow">Your space · Stored on this device</div><h1>Every conversation is a step.</h1><p>Your plans and reflections are saved in this browser only. They are not synced across devices.</p></div><button class="button button-primary" data-action="start">Prepare a new conversation <span class="arrow">→</span></button></div>
    <section class="stats-grid" aria-label="Your local progress"><div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Topics started on this device</div></div><div class="stat-card"><div class="stat-value">${plans}</div><div class="stat-label">Plans generated or previewed</div></div><div class="stat-card"><div class="stat-value">${completed}</div><div class="stat-label">Qualifying reflections within 14 days</div></div></section>
    ${items.length ? `<div class="section-heading" style="margin-top:15px"><div><h2>Your topics</h2><p>Continue, reflect, or remove a topic from this device.</p></div></div><div class="history-list">${items.map(t => {
      const [label, cls] = statusLabel(t);
      let action = t.status === 'completed' ? 'view-plan' : (t.plan ? 'view-plan' : 'resume');
      let actionLabel = t.status === 'completed' ? 'View plan' : (t.plan ? 'Continue' : 'Resume');
      return `<article class="history-item"><div class="history-info"><h3>${esc(topicTitle(t))}</h3><div class="history-meta"><span>${esc(t.ageBand)} years</span><span>Started ${esc(formatDate(t.startedAt))}</span><span class="status-pill ${cls}">${esc(label)}</span></div></div><div class="history-actions"><button class="button button-secondary" style="padding:9px 13px;min-height:36px;font-size:11px" data-action="${action}" data-id="${esc(t.id)}">${actionLabel}</button><button class="icon-button" data-action="delete-topic" data-id="${esc(t.id)}" aria-label="Delete ${esc(topicTitle(t))}" title="Delete topic">⌫</button></div></article>`;
    }).join('')}</div>` : `<section class="empty-state"><div class="empty-illustration">✳</div><h2>Nothing here yet — and that's okay.</h2><p>When a conversation is on your mind, start a plan here. You can come back after trying it and reflect on what you learned.</p><button class="button button-primary" data-action="start">Prepare your first conversation →</button></section>`}
    <section class="history-tools"><p><strong>Want to use the MVP for capstone testing?</strong><br>Export a small anonymous event summary for this device. It excludes your concern text and reflection text; it is not a cross-user analytics dashboard.</p><div class="tools-actions"><button class="button button-secondary" data-action="export">Export anonymous events</button><button class="button button-quiet" data-action="clear">Clear all local data</button></div></section>
    <p class="form-note">These numbers describe this browser only. They are not product-wide results or evidence of product-market fit. For a multi-user test, record participants and outcomes separately with appropriate consent.</p>
  `;
}

function savedView(topic) {
  const completed = topic?.status === 'completed' && isQualifying(topic);
  const title = completed ? 'You made space for a conversation.' : topic?.status === 'attempted' ? 'You made an attempt. That matters.' : 'It is okay to choose a better moment.';
  const desc = completed ? 'Your reflection is saved on this device. The conversation does not have to end in agreement to count.' : topic?.status === 'attempted' ? 'You can return to this plan when the moment is better. Notice what made it difficult and choose a smaller next step.' : 'Your plan is saved. Returning to it later is part of the process—not a failure.';
  return `<section class="empty-state" style="margin:28px auto;max-width:720px"><div class="empty-illustration">${completed ? '✓' : '♡'}</div><div class="eyebrow">Reflection saved</div><h2>${esc(title)}</h2><p>${esc(desc)}</p>${completed ? `<div class="prompt-box" style="text-align:left;max-width:500px;margin:0 auto 22px"><h3>Your next step</h3><p>${esc(topic.nextStep || 'No next step selected — you can decide later.')}</p></div>` : ''}<div class="inline-actions" style="justify-content:center"><button class="button button-primary" data-action="start">Prepare another conversation →</button><button class="button button-secondary" data-action="space">Open my space</button></div></section>`;
}

function safetyView(message) {
  return `<section class="empty-state" style="max-width:700px;margin:25px auto;background:#fff3ef;border:1px solid #efd0c6"><div class="empty-illustration" style="background:#f6ddd3;color:#873f2d">!</div><div class="eyebrow" style="color:#9c4934">Beyond Raise's scope</div><h2>This may need more support than a conversation plan.</h2><p>${esc(message)}</p><button class="button button-secondary" data-action="home">Return to Raise</button><p class="form-note">Your concern was not added to your Raise history.</p></section>`;
}

function render() {
  historyCount.textContent = String(store.topics.length);
  document.getElementById('nav-home').classList.toggle('active', ['home','form','loading','plan','reflect','saved','safety'].includes(state.view));
  document.getElementById('nav-space').classList.toggle('active', state.view === 'space');
  if (state.view === 'home') app.innerHTML = homeView();
  else if (state.view === 'form') app.innerHTML = formView();
  else if (state.view === 'edit-form') app.innerHTML = formView(currentTopic());
  else if (state.view === 'loading') app.innerHTML = loadingView();
  else if (state.view === 'regenerating') app.innerHTML = loadingView(true);
  else if (state.view === 'plan') app.innerHTML = planView(currentTopic());
  else if (state.view === 'reflect') app.innerHTML = reflectionView(currentTopic());
  else if (state.view === 'space') app.innerHTML = spaceView();
  else if (state.view === 'saved') app.innerHTML = savedView(currentTopic());
  else if (state.view === 'safety') app.innerHTML = safetyView(state.safetyMessage || 'Please contact local emergency services if someone is in immediate danger, or connect with an appropriate trusted adult or qualified professional.');
  bindDynamicEvents();
}

function bindDynamicEvents() {
  const concern = document.getElementById('concern');
  if (concern) concern.addEventListener('input', () => { const count = document.getElementById('concern-count'); if (count) count.textContent = String(concern.value.length); });
  const reflection = document.getElementById('reflection');
  if (reflection) reflection.addEventListener('input', () => { const count = document.getElementById('reflection-count'); if (count) count.textContent = String(reflection.value.length); });
  const form = document.getElementById('concern-form');
  if (form) form.addEventListener('submit', onConcernSubmit);
  const reflectionForm = document.getElementById('reflection-form');
  if (reflectionForm) {
    reflectionForm.addEventListener('submit', onReflectionSubmit);
    reflectionForm.querySelectorAll('input[name="outcome"]').forEach(input => input.addEventListener('change', updateReflectionPrompt));
  }
}

function updateReflectionPrompt() {
  const outcome = document.querySelector('input[name="outcome"]:checked')?.value;
  const label = document.getElementById('reflection-label');
  const hint = document.getElementById('reflection-hint');
  const area = document.getElementById('reflection');
  if (!label || !hint || !area) return;
  if (outcome === 'happened') {
    label.childNodes[0].textContent = 'What did you notice, learn, or find difficult?';
    hint.textContent = 'A meaningful detail is required to count a completed conversation. Do not include identifying information.';
    area.placeholder = 'For example: I paused instead of correcting right away. They asked a question I hadn’t expected, and I realised I should listen before offering advice.';
  } else if (outcome === 'attempted') {
    label.childNodes[0].textContent = 'What got in the way, or what did you notice?';
    hint.textContent = 'Optional for an attempt. You can save this and return later.';
    area.placeholder = 'For example: We started, but we were both rushing. I may ask if we can talk after dinner tomorrow.';
  } else {
    label.childNodes[0].textContent = 'What might help you return to this?';
    hint.textContent = 'Optional. Choosing a better moment is a valid next step.';
    area.placeholder = 'For example: I want to think through what I most need them to understand before I begin.';
  }
}

async function onConcernSubmit(event) {
  event.preventDefault();
  if (state.busy) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const input = {
    ageBand: formData.get('ageBand'),
    topic: formData.get('topic'),
    concern: String(formData.get('concern') || '').trim(),
    goal: formData.get('goal'),
    hardest: formData.getAll('hardest'),
  };
  const errEl = document.getElementById('form-error');
  if (input.concern.length < 10) { errEl.textContent = 'Add a little more context (at least 10 characters), without names or identifying details.'; return; }
  if (input.concern.length > 1200) { errEl.textContent = 'Please keep the context under 1,200 characters.'; return; }
  const editId = form.dataset.editId;
  let topic;
  if (editId && byId(editId)) {
    topic = byId(editId);
    Object.assign(topic, input);
    topic.updatedAt = new Date().toISOString();
  } else {
    topic = { id: makeId(), ...input, startedAt: new Date().toISOString(), status: 'started', plan: null, source: null, planGeneratedAt: null, outcome: null, reflection: '', nextStep: '', completedAt: null };
    store.topics.push(topic);
  }
  state.activeId = topic.id;
  saveStore();
  setBusy(true); state.view = 'loading'; render();
  try {
    const result = await fetch('/api/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(payload.error || 'We could not create your plan. Please try again.');
    if (payload.safetyEscalation) {
      store.topics = store.topics.filter(t => t.id !== topic.id);
      saveStore();
      state.safetyMessage = payload.message;
      state.view = 'safety';
      setBusy(false); render(); return;
    }
    if (!payload.plan) throw new Error('The service did not return a conversation plan. Please try again.');
    topic.plan = payload.plan;
    topic.source = payload.source || 'ai';
    topic.model = payload.model || null;
    topic.planGeneratedAt = new Date().toISOString();
    topic.status = 'plan_ready';
    saveStore();
    state.activeId = topic.id; state.view = 'plan'; setBusy(false); render();
  } catch (error) {
    setBusy(false);
    state.view = 'edit-form';
    render();
    const message = error?.message || 'Something went wrong. Please try again.';
    const target = document.getElementById('form-error'); if (target) target.textContent = message;
    showToast('Your topic is saved on this device. You can retry.');
  }
}

async function regenerate(topic) {
  if (!topic || state.busy) return;
  setBusy(true); state.view = 'regenerating'; render();
  try {
    const input = { ageBand: topic.ageBand, topic: topic.topic, concern: topic.concern, goal: topic.goal, hardest: topic.hardest || [] };
    const response = await fetch('/api/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not create another take.');
    if (payload.safetyEscalation) {
      store.topics = store.topics.filter(t => t.id !== topic.id); saveStore();
      state.safetyMessage = payload.message; state.view = 'safety'; setBusy(false); render(); return;
    }
    topic.plan = payload.plan; topic.source = payload.source || 'ai'; topic.model = payload.model || null; topic.planGeneratedAt = new Date().toISOString(); topic.status = 'plan_ready'; saveStore();
    state.view = 'plan'; setBusy(false); render();
  } catch (error) {
    setBusy(false); state.view = 'plan'; render(); showToast(error.message || 'Could not create another take.');
  }
}

function onReflectionSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const topic = byId(form.dataset.id);
  const errorEl = document.getElementById('reflection-error');
  if (!topic) { errorEl.textContent = 'This topic could not be found. Return to My space and open it again.'; return; }
  const data = new FormData(form);
  const outcome = data.get('outcome');
  const reflection = String(data.get('reflection') || '').trim();
  const nextStep = String(data.get('nextStep') || '');
  if (!outcome) { errorEl.textContent = 'Choose what best describes what happened.'; return; }
  if (outcome === 'happened' && reflection.length < 15) {
    errorEl.textContent = 'To count as a completed conversation, add at least one meaningful detail (15 characters or more) about what happened, what you noticed, or what you learned.';
    return;
  }
  topic.outcome = outcome;
  topic.reflection = reflection;
  topic.nextStep = nextStep;
  topic.reflectedAt = new Date().toISOString();
  if (outcome === 'happened' && reflection.length >= 15) {
    topic.status = 'completed'; topic.completedAt = topic.reflectedAt;
  } else if (outcome === 'attempted') {
    topic.status = 'attempted'; topic.completedAt = null;
  } else {
    topic.status = 'deferred'; topic.completedAt = null;
  }
  saveStore();
  state.activeId = topic.id; state.view = 'saved'; render();
}

function buildAnonymousExport() {
  const events = store.topics.filter(t => t.status !== 'safety_redirect').map(t => ({
    topic_id: t.id,
    topic_category: t.topic,
    age_band: t.ageBand,
    started_at: t.startedAt,
    plan_generated: Boolean(t.planGeneratedAt),
    plan_generated_at: t.planGeneratedAt || null,
    plan_source: t.source || null,
    outcome: t.outcome || null,
    reflected_at: t.reflectedAt || null,
    qualifying_completed_conversation: isQualifying(t),
    next_step_selected: Boolean(t.nextStep),
    days_from_start_to_outcome: t.reflectedAt ? Math.round((new Date(t.reflectedAt).getTime() - new Date(t.startedAt).getTime()) / 86400000 * 10) / 10 : null,
  }));
  return { export_version: 1, exported_at: new Date().toISOString(), notice: 'This export intentionally excludes free-text concerns, generated plan text, and reflection text. topic_id is a random local identifier and has no account mapping.', local_device_only: true, counts: { topics_started: events.length, plans_generated: events.filter(e => e.plan_generated).length, qualifying_completed_conversations: events.filter(e => e.qualifying_completed_conversation).length, attempted: events.filter(e => e.outcome === 'attempted').length, deferred: events.filter(e => e.outcome === 'later').length }, events };
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function handleAction(action, id) {
  const topic = id ? byId(id) : currentTopic();
  switch (action) {
    case 'start': state.activeId = null; setView('form'); break;
    case 'home': setView('home'); break;
    case 'space': setView('space'); break;
    case 'privacy': privacyDialog.showModal(); break;
    case 'resume':
      if (topic?.plan) { state.activeId = topic.id; setView('plan'); }
      else if (topic) { state.activeId = topic.id; state.view = 'edit-form'; render(); }
      break;
    case 'view-plan': state.activeId = topic?.id || state.activeId; setView('plan'); break;
    case 'reflect': state.activeId = topic?.id || state.activeId; setView('reflect'); break;
    case 'not-yet': if (topic) { topic.status = 'plan_ready'; saveStore(); state.activeId = topic.id; setView('space'); showToast('Plan saved for when the moment feels right.'); } break;
    case 'edit-opening': state.openingEdit = true; render(); break;
    case 'cancel-opening': state.openingEdit = false; render(); break;
    case 'save-opening': {
      const active = currentTopic(); const area = document.getElementById('opening-edit');
      if (active && area && area.value.trim()) { active.plan.opening_line = area.value.trim(); active.editedOpening = true; saveStore(); state.openingEdit = false; render(); showToast('Your wording has been saved.'); }
      break;
    }
    case 'copy-opening': {
      const active = currentTopic();
      const text = active?.plan?.opening_line || '';
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => showToast('Opening copied.')).catch(() => showToast('Copy is unavailable in this browser.'));
      else showToast('Copy is unavailable in this browser.');
      break;
    }
    case 'regenerate': regenerate(topic); break;
    case 'export': downloadJson('raise-anonymous-events.json', buildAnonymousExport()); showToast('Anonymous event summary exported.'); break;
    case 'clear': clearAll(); break;
    case 'delete-topic': deleteTopic(id); break;
    default: break;
  }
}

function deleteTopic(id) {
  const topic = byId(id);
  if (!topic) return;
  if (!confirm(`Delete “${topicTitle(topic)}” from this device? This cannot be undone.`)) return;
  store.topics = store.topics.filter(t => t.id !== id); saveStore();
  if (state.activeId === id) state.activeId = null;
  render(); showToast('Topic deleted from this device.');
}
function clearAll() {
  if (!confirm('Clear all Raise plans and reflections saved in this browser? This cannot be undone.')) return;
  store = { version: 1, topics: [] }; saveStore(); state.activeId = null; setView('home'); showToast('Your local Raise data has been cleared.');
}

app.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.disabled) return;
  event.preventDefault();
  handleAction(target.dataset.action, target.dataset.id);
});

document.getElementById('brand-home').addEventListener('click', () => setView('home'));
document.getElementById('nav-home').addEventListener('click', () => setView('home'));
document.getElementById('nav-space').addEventListener('click', () => setView('space'));
document.getElementById('footer-privacy').addEventListener('click', () => privacyDialog.showModal());
document.getElementById('privacy-close').addEventListener('click', () => privacyDialog.close());
document.getElementById('privacy-done').addEventListener('click', () => privacyDialog.close());
document.getElementById('footer-clear').addEventListener('click', clearAll);
privacyDialog.addEventListener('click', event => { if (event.target === privacyDialog) privacyDialog.close(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

render();
