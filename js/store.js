/* =========================================================================
   Store: state, persistence, demo-data generation, import/export.
   ========================================================================= */

import {
  ITEMS, SEED_TEACHERS, WORKING_DAYS, SCHOOL,
} from './data.js';
import { rng, hashString, noise, clamp, round } from './util.js';

const KEY = 'gbmhs-layyah-monitor-v1';
const SCHEMA = 1;

export const PROFILES = {
  strong: {
    label: 'Strong performer',
    target: 0.93, spread: 0.035, leaveRate: 0.05, dayDropout: 0.01, lateMonthDip: 0.008,
  },
  average: {
    label: 'Average performer',
    target: 0.79, spread: 0.07, leaveRate: 0.2, dayDropout: 0.07, lateMonthDip: 0.03,
  },
  weak: {
    label: 'Under performer',
    target: 0.63, spread: 0.08, leaveRate: 0.45, dayDropout: 0.22, lateMonthDip: 0.06,
  },
};

export function uid() {
  return `t${Math.random().toString(36).slice(2, 9)}`;
}

export function blankState() {
  return {
    schema: SCHEMA,
    mode: 'blank',
    updatedAt: new Date().toISOString(),
    teachers: SEED_TEACHERS.map((t) => ({ ...t, id: `t${String(t.sr).padStart(2, '0')}` })),
    entries: {},
    observations: {},
    actions: [],
    notes: {},
    meta: {
      observer: SCHOOL.principal,
      remarkBank: {},
    },
  };
}

/* Per-item behaviour knobs. `gap` is how far below the teacher's overall
   quality this item tends to sit — so a weak teacher fails specific items,
   not everything, which is what real monitoring records look like. */
const ITEM_TUNING = {
  attendance: { gap: 0.02 },
  uniform: { gap: 0.02 },
  personal_file: { gap: 0.08 },
  training_card: { gap: 0.07 },
  zamaat_file: { gap: 0.1 },
  assembly_photo: { gap: 0.06 },
  extra_activity: { gap: 0.09 },
  classroom: { gap: 0.1 },
  transport: { gap: -0.03 },
  leave: { gap: 0 },
  daily_dress: { gap: 0.01 },
  donation: { gap: 0.1 },
  lesson_plan: { gap: 0.12 },
  scout: { gap: -0.04 },
  social_media: { gap: 0.07 },
};

function rawForItem(item, profile, r, dayIndex, profileCfg) {
  if (r() < profileCfg.dayDropout) return 0;
  const progress = dayIndex / (WORKING_DAYS.length - 1);
  const drift = -profileCfg.lateMonthDip * progress;
  const gap = ITEM_TUNING[item.key]?.gap ?? 0.08;
  const quality = profileCfg.target + noise(r, profileCfg.spread) + drift;
  return clamp(quality - gap + noise(r, 0.045), 0.03, 0.995);
}

/* Map an earned proportion onto the item's coarse ladder with stochastic
   rounding: if the proportion sits between two rungs, the higher rung is
   chosen with the matching probability. Expected points equal p × max, so a
   month of marks lands where the teacher's quality actually is. */
function scaledPoints(item, p, r) {
  const ladder = [...item.options].sort((a, b) => a.pts - b.pts);
  const norm = ladder.map((o) => o.pts / item.max);
  if (p <= norm[0]) return ladder[0].pts;
  if (p >= norm[norm.length - 1]) return ladder[ladder.length - 1].pts;
  for (let i = 0; i < norm.length - 1; i += 1) {
    if (p >= norm[i] && p <= norm[i + 1]) {
      const span = norm[i + 1] - norm[i];
      const t = span === 0 ? 0 : (p - norm[i]) / span;
      return r() < t ? ladder[i + 1].pts : ladder[i].pts;
    }
  }
  return ladder[ladder.length - 1].pts;
}

export function generateDemo(state = blankState()) {
  const next = { ...state, mode: 'demo', entries: {}, observations: {}, notes: {} };
  next.teachers = SEED_TEACHERS.map((t) => ({ ...t, id: `t${String(t.sr).padStart(2, '0')}` }));

  for (const teacher of next.teachers) {
    const cfg = PROFILES[teacher.profile] || PROFILES.average;
    const r = rng(hashString(teacher.name) ^ 0x9e3779b9);
    next.entries[teacher.id] = {};
    let leaveUsed = 0;
    WORKING_DAYS.forEach((day, di) => {
      const marks = {};
      for (const item of ITEMS) {
        if (item.key === 'leave') {
          // month-level item: no leave = 2, one = 1, two or more = 0
          continue;
        }
        const p = rawForItem(item, teacher.profile, r, di, cfg);
        marks[item.key] = scaledPoints(item, p, r);
      }
      // leave decided once, then repeated for the month
      if (di === 0) leaveUsed = r() < cfg.leaveRate ? (r() < 0.45 ? 2 : 1) : 0;
      marks.leave = leaveUsed === 0 ? 2 : leaveUsed === 1 ? 1 : 0;
      next.entries[teacher.id][day] = marks;
    });

    next.observations[teacher.id] = demoObservation(teacher, cfg, r);
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

const REMARKS_SAMPLE = {
  strong: [
    'Class file complete and well indexed. Lesson plans submitted every Monday. Assembly line punctual.',
    'Excellent classroom display; learning corner updated with student work this week.',
    'Attendance above 90% on all checked days. Uniform compliance very good.',
  ],
  average: [
    'Lesson plan submitted late twice this month. Attendance hovering around 85%.',
    'Classroom features present but display board not updated since September.',
    'Good teaching, however the monthly donation register needs receipts issued.',
  ],
  weak: [
    'Repeatedly without lesson plan. Class file incomplete. Attendance below 80% on five days.',
    'Training card not produced. Assembly photographs not shared for two weeks.',
    'Classroom display boards empty. Scout contingent not nominated. Serious follow-up required.',
  ],
};

function demoObservation(teacher, cfg, r) {
  const bank = REMARKS_SAMPLE[teacher.profile] || REMARKS_SAMPLE.average;
  const remark = bank[Math.floor(r() * bank.length)];
  return {
    remark,
    notedOn: WORKING_DAYS[WORKING_DAYS.length - 1],
    by: SCHOOL.principal,
  };
}

/* --- persistence ------------------------------------------------------- */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.schema !== SCHEMA) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function save(state) {
  try {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearStorage() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/* --- mutations --------------------------------------------------------- */
export function setMark(state, teacherId, day, itemKey, value) {
  state.entries[teacherId] ||= {};
  state.entries[teacherId][day] ||= {};
  if (value === null || value === undefined || value === '') delete state.entries[teacherId][day][itemKey];
  else state.entries[teacherId][day][itemKey] = Number(value);
  return state;
}

export function setObservation(state, teacherId, remark) {
  state.observations[teacherId] ||= {};
  state.observations[teacherId].remark = remark;
  state.observations[teacherId].notedOn = new Date().toISOString().slice(0, 10);
  state.observations[teacherId].by = state.meta?.observer || SCHOOL.principal;
  return state;
}

export function addAction(state, action) {
  state.actions ||= [];
  state.actions.unshift({
    id: `a${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    ...action,
  });
  return state;
}

export function removeAction(state, id) {
  state.actions = (state.actions || []).filter((a) => a.id !== id);
  return state;
}

export function toggleActionDone(state, id) {
  const a = (state.actions || []).find((x) => x.id === id);
  if (a) a.done = !a.done;
  return state;
}

export function saveNote(state, key, text) {
  state.notes ||= {};
  state.notes[key] = text;
  return state;
}

/* --- import / export --------------------------------------------------- */
export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export function normalizeImport(data) {
  if (!data || typeof data !== 'object') throw new Error('File is not a monitoring backup.');
  if (!Array.isArray(data.teachers)) throw new Error('Backup has no teacher list.');
  const base = blankState();
  const teachers = data.teachers.map((t, i) => ({
    ...t,
    id: t.id || `t${String(i + 1).padStart(2, '0')}`,
    enrollment: Number(t.enrollment) || 0,
  }));
  return {
    ...base,
    ...data,
    schema: SCHEMA,
    teachers,
    entries: data.entries || {},
    observations: data.observations || {},
    actions: data.actions || [],
    notes: data.notes || {},
    mode: data.mode || 'imported',
  };
}

export function entriesFromCSV(rows, teachers) {
  // rows: array of arrays from a pasted/uploaded CSV with headers
  const header = rows[0].map((h) => String(h).trim());
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const dayCol = idx('Date');
  const nameCol = idx('Teacher');
  if (dayCol < 0 || nameCol < 0) throw new Error('CSV must have "Date" and "Teacher" columns.');
  const pairs = [];
  for (const item of ITEMS) {
    const c = idx(item.key);
    if (c >= 0) pairs.push([item.key, c]);
  }
  if (!pairs.length) throw new Error('CSV has no rubric columns (attendance, uniform, …).');
  const out = [];
  for (const row of rows.slice(1)) {
    const name = String(row[nameCol] || '').trim();
    const day = String(row[dayCol] || '').trim();
    if (!name || !day) continue;
    const teacher = teachers.find((t) => t.name.toLowerCase() === name.toLowerCase())
      || teachers.find((t) => t.name.toLowerCase().includes(name.toLowerCase()));
    if (!teacher) continue;
    const marks = {};
    for (const [key, c] of pairs) {
      const v = row[c];
      if (v !== undefined && v !== '' && !Number.isNaN(Number(v))) marks[key] = Number(v);
    }
    out.push({ teacherId: teacher.id, day, marks });
  }
  return out;
}

export { round };
