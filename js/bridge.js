/* =========================================================================
   Bridge to the Google Sheet.

   Two channels, because a browser cannot read a cross-origin response from
   Apps Script without a preflight the deployment does not answer:

     · writes  — POST, content-type text/plain, sent blind. Safelisted, so no
                 preflight, and we do not need to read the reply.
     · reads   — GET in a <script> tag (JSONP), which is not subject to CORS.

   A write is not considered delivered until a later read shows it in the log,
   so a dropped request simply stays queued and is retried.
   ========================================================================= */

import { ensure, newOp, enqueue, takeOps, clearOps, applyAll, seedStamps } from './ops.js';

const SETTINGS_KEY = 'gbmhs-layyah-bridge-v1';

const settings = {
  url: '',
  token: '',
  auto: true,
  enabled: false,
};

export const status = {
  state: 'off',       // off | idle | syncing | error
  message: 'Not connected',
  lastPull: null,
  lastPush: null,
  queued: 0,
  conflicts: 0,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(patch = {}) {
  Object.assign(status, patch);
  listeners.forEach((fn) => { try { fn(status); } catch { /* ignore */ } });
}

/* --- settings ---------------------------------------------------------- */

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch { /* ignore */ }
  return settings;
}

export function saveSettings(patch = {}) {
  Object.assign(settings, patch);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  refreshStatus();
  return settings;
}

export function getSettings() {
  return { ...settings };
}

export function isConnected() {
  return !!(settings.enabled && settings.url && settings.token);
}

/* --- clock ------------------------------------------------------------- */

/* School devices are rarely time-synced. The sheet's timestamps are the ones
   both devices compare against, so the offset is measured on every read and
   applied to every timestamp this browser writes. */
export function now(state) {
  const s = ensure(state);
  return Date.now() + (s.skew || 0);
}

/* --- transport --------------------------------------------------------- */

let jsonpSeq = 0;

function jsonp(url, params, timeout = 15000) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new Error('No document for JSONP.')); return; }
    const cb = `__gbmhsBridge${(jsonpSeq += 1)}${Date.now().toString(36)}`;
    const qs = new URLSearchParams({ ...params, callback: cb }).toString();
    const script = document.createElement('script');
    let done = false;

    const cleanup = () => {
      done = true;
      delete window[cb];
      script.remove();
    };

    window[cb] = (data) => { if (!done) { cleanup(); resolve(data); } };

    script.onerror = () => {
      if (done) return;
      cleanup();
      reject(new Error('The sheet did not respond. Check the deployment URL and that it is set to "Anyone".'));
    };

    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error('The sheet took too long to answer.'));
    }, timeout);

    const wrapped = window[cb];
    window[cb] = (data) => { clearTimeout(timer); wrapped(data); };

    script.src = `${url}?${qs}`;
    document.head.append(script);
  });
}

/* Blind write. `mode: no-cors` gives an opaque response — we cannot read it,
   and we do not want to. Success here means "the request left the browser". */
async function post(payload) {
  if (typeof fetch !== 'function') throw new Error('This browser cannot send to the sheet.');
  await fetch(settings.url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: settings.token, ...payload }),
  });
}

/* --- operations -------------------------------------------------------- */

/* Called by the app for every edit. Returns the queued op so callers can
   report it. */
export function queue(state, op) {
  enqueue(state, op);
  refreshStatus();
  return op;
}

export function refreshStatus() {
  const queued = status.queued;
  emit({
    state: !isConnected() ? 'off' : status.state === 'off' ? 'idle' : status.state,
    message: !isConnected() ? 'Not connected' : status.message,
    queued,
  });
}

/* --- push -------------------------------------------------------------- */

let pushTimer = null;
let pushing = false;

export function schedule(app, delay = 2500) {
  if (!isConnected() || !settings.auto) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { push(app).catch(() => {}); }, delay);
}

export function describeOps(state) {
  const ops = takeOps(state);
  return ops.map(({ _key, ...rest }) => rest);
}

export async function push(app, { tabs = null, quiet = true } = {}) {
  if (!isConnected()) throw new Error('Connect the sheet first.');
  if (pushing) return { skipped: true };
  pushing = true;
  const s = ensure(app.state);
  try {
    emit({ state: 'syncing', message: 'Sending to the sheet…' });
    const ops = describeOps(app.state);
    const packet = {
      action: 'push',
      ops,
      tabs,
      client: { pushedAt: new Date().toISOString(), pending: ops.length },
    };
    await post(packet);

    /* Not yet confirmed — a later pull proves these reached the log. */
    if (ops.length) {
      s.sent = [...(s.sent || []), ...ops].slice(-500);
      clearOps(app.state, ops.map((o) => o.id));
    }
    s.pushedAt = new Date().toISOString();
    if (!quiet) emit({ message: 'Saved to the sheet.' });
    emit({ state: 'idle', lastPush: s.pushedAt, message: ops.length ? 'Sent to the sheet' : 'Sheet up to date' });
    return { sent: ops.length };
  } catch (err) {
    emit({ state: 'error', message: err.message || 'Could not reach the sheet' });
    throw err;
  } finally {
    pushing = false;
    updateQueue(app);
  }
}

function updateQueue(app) {
  const n = takeOps(app.state).length;
  emit({ queued: n });
}

/* --- pull -------------------------------------------------------------- */

export async function pull(app, { apply = true, quiet = true } = {}) {
  if (!isConnected()) throw new Error('Connect the sheet first.');
  const s = ensure(app.state);
  try {
    emit({ state: 'syncing', message: 'Reading the sheet…' });
    const res = await jsonp(settings.url, {
      action: 'pull',
      since: String(s.since || 0),
      token: settings.token,
    });

    if (!res || res.ok === false) {
      throw new Error(res?.error || 'The sheet refused the request. Check the token in its Script Properties.');
    }

    if (typeof res.serverTime === 'number') {
      s.skew = res.serverTime - Date.now();
      s.serverTime = res.serverTime;
    }

    const incoming = Array.isArray(res.ops) ? res.ops : [];
    const seen = new Set([...incoming.map((o) => o.id), ...(res.recent || [])]);

    /* A write is delivered once its id shows up in the log's recent ids. Any
       that do not are put back in the queue — the server de-duplicates by id,
       so re-sending can never double-count a mark. */
    const unconfirmed = [];
    for (const sent of s.sent || []) {
      if (seen.has(sent.id)) continue;
      unconfirmed.push(sent);
      enqueue(app.state, sent);
    }
    s.sent = [];

    /* The log was rebuilt: everything is being replayed, and timestamps —
       not row order — are what decide which version of a cell survives. */
    if (res.replayed) s.replayedAt = new Date().toISOString();

    const conflicts = conflictsWithQueue(app.state, incoming);
    const changed = apply ? applyAll(app.state, incoming) : 0;

    /* Normally the cursor only moves forward. After a replay it must be
       allowed to move back to the log's real length, or every later poll
       would re-send the whole month. */
    if (typeof res.cursor === 'number') {
      if (res.replayed || res.cursor > (s.since || 0)) s.since = res.cursor;
    }
    s.pulledAt = new Date().toISOString();
    s.renderAt = s.since;
    s.version = res.version || s.version || 0;
    status.conflicts = conflicts;
    status.lastPull = s.pulledAt;

    emit({
      state: 'idle',
      lastPull: s.pulledAt,
      message: changed ? `Read ${changed} change${changed === 1 ? '' : 's'} from the sheet` : 'Sheet up to date',
    });

    return { changed, conflicts, ops: incoming.length, tabs: res.tabs || null };
  } catch (err) {
    emit({ state: 'error', message: err.message || 'Could not read the sheet' });
    throw err;
  }
}

/* A remote change to a cell the principal has edited but not yet sent. The
   newer timestamp wins, but the fact that two people disagreed is worth
   showing rather than hiding. */
function conflictsWithQueue(state, incoming) {
  const pendingOps = takeOps(state);
  if (!pendingOps.length) return 0;
  const mine = new Map();
  for (const op of pendingOps) {
    if (op.kind === 'mark') mine.set(`${op.teacherId}|${op.day}|${op.itemKey}`, op.ts);
    if (op.kind === 'remark') mine.set(`remark|${op.teacherId}`, op.ts);
  }
  let n = 0;
  for (const op of incoming) {
    const key = op.kind === 'mark' ? `${op.teacherId}|${op.day}|${op.itemKey}`
      : op.kind === 'remark' ? `remark|${op.teacherId}` : null;
    if (key && mine.has(key)) n += 1;
  }
  return n;
}

/* --- Drive files ------------------------------------------------------- */

/* Generate a report here, where the calculation lives, then hand the finished
   file to the script, which drops it in the school's Drive folder. */
export async function saveFile({ name, content, mimeType = 'text/html' }) {
  if (!isConnected()) throw new Error('Connect the sheet first.');
  await post({ action: 'file', name, content, mimeType });
  return { ok: true, name };
}

/* --- connection test --------------------------------------------------- */

export async function test(url = settings.url, token = settings.token) {
  if (!url) throw new Error('Paste the deployment URL first.');
  const res = await jsonp(url, { action: 'ping', token: token || '' });
  if (!res || !res.ok) throw new Error(res?.error || 'The deployment answered, but not with a monitoring response.');
  saveSettings({ url, token: token || settings.token, enabled: !!(token || settings.token) });
  return res;
}

export function disconnect() {
  saveSettings({ enabled: false });
  emit({ state: 'off', message: 'Not connected' });
}

/* --- first connection -------------------------------------------------- */

/* Called once when a deployment URL is entered. Seeds stamps from whatever is
   already stored locally, so the first merge cannot silently discard marks
   that predate the connection. */
export function adopt(app, res) {
  const s = ensure(app.state);
  seedStamps(app.state);
  if (res?.serverTime) s.skew = res.serverTime - Date.now();
  if (res?.maxTs && !s.since) s.since = res.maxTs;
  return s;
}

export { newOp };
