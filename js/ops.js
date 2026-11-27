/* =========================================================================
   Operations — the unit of change that travels between this browser and the
   Google Sheet.

   Every edit is expressed as a small, self-describing record carrying a
   timestamp. The sheet is an append-only log of these records, so two devices
   can write at the same time without a lock: whoever edited a given cell most
   recently wins, and that decision is made by comparing timestamps, not by
   asking the server. Nothing is ever lost except a deliberate overwrite.

   The same rules are implemented in apps-script/Code.gs. Keep them in step.
   ========================================================================= */

import { ITEMS } from './data.js';
import { setMark, setObservation, addAction, removeAction } from './store.js';

const KINDS = new Set(['mark', 'remark', 'action.add', 'action.done', 'action.del', 'note', 'meta']);

export function cellKey(teacherId, day, itemKey) {
  return `${teacherId}|${day}|${itemKey}`;
}

/* Every state object carries a sync block. Older saves do not, so this is
   called before any read and repairs whatever is missing. */
export function ensure(state) {
  state.sync ||= {};
  const s = state.sync;
  s.ops ||= [];
  s.stamps ||= {};
  s.stamps.marks ||= {};
  s.stamps.obs ||= {};
  s.stamps.actions ||= {};
  s.stamps.notes ||= {};
  s.since ||= 0;
  s.pushedAt ||= null;
  s.pulledAt ||= null;
  s.renderAt ||= 0;
  return s;
}

export function newOp(kind, payload, ts = Date.now()) {
  if (!KINDS.has(kind)) throw new Error(`Unknown operation: ${kind}`);
  return {
    id: `${ts.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ts,
    kind,
    ...payload,
  };
}

/* --- queue ------------------------------------------------------------- */

/* Marks are coalesced: holding a key down, or correcting the same cell five
   times in a row, should still send one record. */
export function enqueue(state, op) {
  const s = ensure(state);
  const key = op.kind === 'mark'
    ? `mark|${cellKey(op.teacherId, op.day, op.itemKey)}`
    : op.kind.startsWith('action.')
      ? `${op.kind}|${op.actionId || op.action?.id}`
      : `${op.kind}|${op.teacherId || op.key || ''}`;
  const at = s.ops.findIndex((o) => o._key === key);
  if (at >= 0 && op.kind !== 'action.add') {
    s.ops[at] = { ...op, _key: key };
  } else {
    s.ops.push({ ...op, _key: key });
  }
  return s.ops;
}

export function pending(state) {
  return ensure(state).ops.length;
}

export function takeOps(state) {
  return ensure(state).ops.slice();
}

export function clearOps(state, ids) {
  const s = ensure(state);
  const drop = new Set(ids);
  s.ops = s.ops.filter((o) => !drop.has(o.id));
  return s.ops;
}

/* --- applying ---------------------------------------------------------- */

function newer(ts, existing) {
  return ts > (existing || 0);
}

/* Apply one remote or local operation. Returns true when it changed
   something, so callers can skip a re-render. */
export function applyOp(state, op) {
  if (!op || !KINDS.has(op.kind)) return false;
  const s = ensure(state);

  if (op.kind === 'mark') {
    const k = cellKey(op.teacherId, op.day, op.itemKey);
    if (!newer(op.ts, s.stamps.marks[k])) return false;
    s.stamps.marks[k] = op.ts;
    if (op.value === null || op.value === undefined) {
      const day = state.entries?.[op.teacherId]?.[op.day];
      if (day) delete day[op.itemKey];
    } else {
      setMark(state, op.teacherId, op.day, op.itemKey, op.value);
    }
    return true;
  }

  if (op.kind === 'remark') {
    if (!newer(op.ts, s.stamps.obs[op.teacherId])) return false;
    s.stamps.obs[op.teacherId] = op.ts;
    setObservation(state, op.teacherId, op.text || '');
    return true;
  }

  if (op.kind === 'action.add') {
    const id = op.action?.id;
    if (!id || !newer(op.ts, s.stamps.actions[id])) return false;
    s.stamps.actions[id] = op.ts;
    if (!(state.actions || []).some((a) => a.id === id)) addAction(state, op.action);
    return true;
  }

  if (op.kind === 'action.done') {
    if (!newer(op.ts, s.stamps.actions[op.actionId])) return false;
    s.stamps.actions[op.actionId] = op.ts;
    const a = (state.actions || []).find((x) => x.id === op.actionId);
    if (a) a.done = !!op.done;
    return true;
  }

  if (op.kind === 'action.del') {
    if (!newer(op.ts, s.stamps.actions[op.actionId])) return false;
    s.stamps.actions[op.actionId] = op.ts;
    removeAction(state, op.actionId);
    return true;
  }

  if (op.kind === 'note') {
    if (!newer(op.ts, s.stamps.notes[op.key])) return false;
    s.stamps.notes[op.key] = op.ts;
    state.notes ||= {};
    state.notes[op.key] = op.text || '';
    return true;
  }

  if (op.kind === 'meta') {
    state.meta ||= {};
    Object.assign(state.meta, op.patch || {});
    return true;
  }

  return false;
}

export function applyAll(state, ops) {
  let changed = 0;
  for (const op of ops || []) if (applyOp(state, op)) changed += 1;
  return changed;
}

/* A backup from an older build has no stamps. Give every existing value one,
   so the first merge does not treat it as infinitely old and discard it. */
export function seedStamps(state) {
  const s = ensure(state);
  const ts = Date.parse(state.updatedAt || '') || Date.now();
  for (const [tid, days] of Object.entries(state.entries || {})) {
    for (const [day, marks] of Object.entries(days || {})) {
      for (const k of Object.keys(marks || {})) {
        const key = cellKey(tid, day, k);
        if (!s.stamps.marks[key]) s.stamps.marks[key] = ts;
      }
    }
  }
  for (const tid of Object.keys(state.observations || {})) {
    if (!s.stamps.obs[tid]) s.stamps.obs[tid] = ts;
  }
  for (const a of state.actions || []) {
    if (!s.stamps.actions[a.id]) s.stamps.actions[a.id] = Date.parse(a.createdAt || '') || ts;
  }
  for (const k of Object.keys(state.notes || {})) {
    if (!s.stamps.notes[k]) s.stamps.notes[k] = ts;
  }
  return s;
}

/* --- readable projection ----------------------------------------------- */

/* The daily checklist as a grid of marks, used by the sheet writer and by the
   offline fallback that rebuilds state from the sheet itself. */
export function marksFromState(state) {
  const out = [];
  for (const t of state.teachers) {
    for (const [day, marks] of Object.entries(state.entries?.[t.id] || {})) {
      for (const item of ITEMS) {
        if (marks[item.key] === undefined) continue;
        out.push({
          teacherId: t.id,
          teacher: t.name,
          day,
          itemKey: item.key,
          value: marks[item.key],
        });
      }
    }
  }
  return out;
}
