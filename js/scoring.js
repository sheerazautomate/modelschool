/* =========================================================================
   Scoring engine
   Raw rubric points → pillar percentages → weighted composite → grade.
   Weights (per the principal's choice):
     Attendance & Punctuality 35%
     Classroom & Teaching Qual. 30%
     Compliance & Records      20%
     Activities & Engagement   15%
   ========================================================================= */

import {
  ITEMS, ITEM_BY_KEY, PILLARS, PILLAR_ITEMS, PILLAR_MAX, MAX_TOTAL,
} from './data.js';
import { weeksOf } from './period.js';
import { clamp, round, sum, avg } from './util.js';

export const GRADES = [
  { grade: 'A+', min: 90, label: 'Outstanding', tone: 'excellent',
    head: 'Exemplary performance. Hold up as a model for other incharges.' },
  { grade: 'A', min: 80, label: 'Very Good', tone: 'verygood',
    head: 'Strong, consistent performance with minor gaps only.' },
  { grade: 'B', min: 70, label: 'Good', tone: 'good',
    head: 'Satisfactory overall, but two or three items need attention.' },
  { grade: 'C', min: 60, label: 'Needs Improvement', tone: 'fair',
    head: 'Below the school standard. A written improvement plan is warranted.' },
  { grade: 'D', min: 0, label: 'Unsatisfactory', tone: 'poor',
    head: 'Serious deficiency. Principal\u2019s formal notice and weekly review required.' },
];

export function gradeFor(score) {
  return GRADES.find((g) => score >= g.min) || GRADES[GRADES.length - 1];
}

export const isFilled = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
export const getMark = (store, teacherId, day, itemKey) => {
  const v = store?.entries?.[teacherId]?.[day]?.[itemKey];
  return isFilled(v) ? Number(v) : null;
};

export const dayFilledCount = (store, teacherId, day) =>
  ITEMS.filter((i) => getMark(store, teacherId, day, i.key) !== null).length;

export const isDayComplete = (store, teacherId, day) => dayFilledCount(store, teacherId, day) === ITEMS.length;

/* --- one teacher's aggregate ------------------------------------------- */
/* `days` is the period being reported on — supplied by the caller from the
   state, never a constant. A teacher is measured against the days the school
   actually worked in that month, which is why this cannot be hardcoded. */
export function computeTeacher(teacher, store, days) {
  if (!days || !days.length) days = [];
  const rows = [];
  const itemStats = {};
  for (const item of ITEMS) itemStats[item.key] = { earned: 0, possible: 0, zeros: 0, days: 0 };

  for (const day of days) {
    let earned = 0;
    let possible = 0;
    let filled = 0;
    for (const item of ITEMS) {
      const v = getMark(store, teacher.id, day, item.key);
      if (v === null) continue;
      filled += 1;
      earned += v;
      possible += item.max;
      const st = itemStats[item.key];
      st.earned += v;
      st.possible += item.max;
      st.days += 1;
      if (v === 0) st.zeros += 1;
    }
    if (filled) {
      rows.push({
        day, earned, possible, filled,
        rawPct: possible ? (earned / possible) * 100 : 0,
        complete: filled === ITEMS.length,
      });
    }
  }

  const pillars = {};
  let weighted = 0;
  let weightUsed = 0;
  for (const key of Object.keys(PILLARS)) {
    const items = PILLAR_ITEMS[key];
    let e = 0;
    let p = 0;
    for (const item of items) {
      const st = itemStats[item.key];
      let earned = st.earned;
      let possible = st.possible;
      /* Monthly items (leave, donation, classroom features) are assessed once
         for the month on the printed form, so they are counted once here
         rather than once per day. Daily items keep their full month of marks. */
      if (item.monthly && st.days > 0) {
        earned /= st.days;
        possible /= st.days;
      }
      e += earned;
      p += possible;
    }
    const percent = p ? (e / p) * 100 : null;
    pillars[key] = {
      key, earned: round(e, 0), possible: round(p, 0), percent,
      max: PILLAR_MAX[key], weight: PILLARS[key].weight,
    };
    if (percent !== null) {
      weighted += percent * PILLARS[key].weight;
      weightUsed += PILLARS[key].weight;
    }
  }

  const composite = weightUsed > 0 ? weighted / weightUsed : 0;
  const rawPct = sum(rows.map((r) => r.earned)) && sum(rows.map((r) => r.possible))
    ? (sum(rows.map((r) => r.earned)) / sum(rows.map((r) => r.possible))) * 100 : 0;
  const attendancePct = pillars.attendance.percent;
  const studentAttendance = getStudentAttendance(teacher, store, days);

  const record = {
    id: teacher.id,
    teacher,
    daysObserved: rows.length,
    daysComplete: rows.filter((r) => r.complete).length,
    coverage: days.length ? (rows.length / days.length) * 100 : 0,
    periodDays: days.length,
    rows,
    itemStats,
    pillars,
    composite: round(composite, 1),
    rawPct: round(rawPct, 1),
    studentAttendance: round(studentAttendance, 1),
    teacherAttendance: round(attendancePct ?? 0, 1),
    earnedTotal: sum(rows.map((r) => r.earned)),
    possibleTotal: sum(rows.map((r) => r.possible)),
  };
  record.grade = gradeFor(record.composite);
  record.weakest = weakestItems(record, 3);
  record.strongest = strongestItems(record, 2);
  record.trend = trendOf(record, store);
  record.risk = riskFlags(record, store);
  return record;
}

/* Student attendance % — derived from the printed rubric band (0 / 80 / 85 / 92)
   so the register has a defensible number to show even without a full register. */
export function bandToPct(pts) {
  return { 0: 72, 1: 84, 2: 92 }[pts] ?? null;
}

export function getStudentAttendance(teacher, store, days = []) {
  const vals = [];
  for (const day of days) {
    const v = getMark(store, teacher.id, day, 'attendance');
    if (v !== null) vals.push(bandToPct(v));
  }
  return vals.length ? avg(vals) : 0;
}

/* Weekly student attendance from week blocks, for the register tab.
   The weeks are derived from the period's days, so they follow the calendar
   rather than the fixed October layout. */
export function weeklyAttendance(teacher, store, days = []) {
  return weeksOf(days).map((w) => {
    const vals = w.days.map((d) => getMark(store, teacher.id, d, 'attendance')).filter((v) => v !== null);
    return {
      key: w.key, label: w.label, range: w.range,
      pct: vals.length ? avg(vals.map(bandToPct)) : null,
      days: vals.length,
    };
  });
}

export function weakestItems(record, n = 3) {
  return ITEMS.map((item) => {
    const st = record.itemStats[item.key];
    return {
      item,
      lost: st.possible - st.earned,
      percent: st.possible ? (st.earned / st.possible) * 100 : null,
      zeros: st.zeros,
      days: st.days,
      per: st.days ? st.earned / st.days : 0,
    };
  })
    .filter((r) => r.percent !== null)
    .sort((a, b) => a.percent - b.percent)
    .slice(0, n);
}

export function strongestItems(record, n = 2) {
  return ITEMS.map((item) => {
    const st = record.itemStats[item.key];
    return {
      item,
      percent: st.possible ? (st.earned / st.possible) * 100 : null,
      days: st.days,
    };
  })
    .filter((r) => r.percent !== null)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, n);
}

/* Simple least-squares slope over daily percentage, scaled to "points per week" */
export function trendOf(record) {
  const rows = record.rows;
  if (rows.length < 4) return { slope: 0, direction: 'flat', delta: 0 };
  const xs = rows.map((_, i) => i);
  const ys = rows.map((r) => r.rawPct);
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  const perWeek = slope * 5;
  const direction = perWeek > 3 ? 'up' : perWeek < -3 ? 'down' : 'flat';
  const half = Math.floor(rows.length / 2);
  const first = avg(rows.slice(0, half).map((r) => r.rawPct));
  const last = avg(rows.slice(-half).map((r) => r.rawPct));
  return { slope: round(perWeek, 1), direction, delta: round(last - first, 1) };
}

export function riskFlags(record, store) {
  const flags = [];
  if (record.daysObserved === 0) {
    flags.push({ level: 'red', text: 'No monitoring record entered for this teacher.' });
    return flags;
  }
  if (record.composite < 60) flags.push({ level: 'red', text: `Composite ${record.composite}% — below the 60% school floor.` });
  else if (record.composite < 70) flags.push({ level: 'amber', text: `Composite ${record.composite}% — between 60% and 70%.` });

  if (record.coverage < 60) flags.push({ level: 'amber', text: `Checklist only filled on ${record.daysObserved} of ${record.periodDays} working days.` });

  for (const w of record.weakest.slice(0, 3)) {
    if (w.percent <= 40 && w.days >= 3) {
      flags.push({ level: w.item.pillar === 'attendance' ? 'red' : 'amber', text: `${w.item.en} scoring ${Math.round(w.percent)}% across ${w.days} checks.` });
    }
  }
  const absent = record.rows.filter((r) => getMark(store, record.id, r.day, 'attendance') === 0).length;
  if (absent >= 5) flags.push({ level: 'red', text: `Student attendance below 80% on ${absent} days.` });
  if (record.trend.direction === 'down') flags.push({ level: 'amber', text: `Falling trend: ${record.trend.delta}% lower in the second half of the month.` });
  if (!flags.length) flags.push({ level: 'green', text: 'No material risk indicators in the current period.' });
  return flags;
}

/* --- school-wide ------------------------------------------------------- */
export function computeSchool(teachers, store, days = []) {
  const records = teachers.map((t) => computeTeacher(t, store, days));
  const withData = records.filter((r) => r.daysObserved > 0);
  const composite = withData.length ? avg(withData.map((r) => r.composite)) : 0;

  const pillarAvg = {};
  for (const key of Object.keys(PILLARS)) {
    const vals = withData.map((r) => r.pillars[key].percent).filter((v) => v !== null);
    pillarAvg[key] = vals.length ? round(avg(vals), 1) : null;
  }

  const distribution = GRADES.map((g) => ({
    ...g,
    count: withData.filter((r) => r.grade.grade === g.grade).length,
    teachers: withData.filter((r) => r.grade.grade === g.grade),
  }));

  const weakestSchool = ITEMS.map((item) => {
    const e = sum(withData.map((r) => r.itemStats[item.key].earned));
    const p = sum(withData.map((r) => r.itemStats[item.key].possible));
    return { item, percent: p ? (e / p) * 100 : 0, lost: p - e, earned: e, possible: p };
  }).sort((a, b) => a.percent - b.percent);

  const dayAvg = days.map((day) => {
    const vals = [];
    let filled = 0;
    for (const t of teachers) {
      const filledToday = dayFilledCount(store, t.id, day);
      if (filledToday) filled += 1;
      let e = 0;
      let p = 0;
      for (const item of ITEMS) {
        const v = getMark(store, t.id, day, item.key);
        if (v === null) continue;
        e += v;
        p += item.max;
      }
      if (p) vals.push((e / p) * 100);
    }
    return { day, pct: vals.length ? round(avg(vals), 1) : null, filled };
  });

  return {
    records,
    ranked: [...withData].sort((a, b) => b.composite - a.composite),
    composite: round(composite, 1),
    grade: gradeFor(composite),
    pillarAvg,
    distribution,
    weakestSchool,
    dayAvg,
    totalTeachers: teachers.length,
    withData: withData.length,
    studentAttendance: withData.length ? round(avg(withData.map((r) => r.studentAttendance)), 1) : 0,
    enrollment: sum(teachers.map((t) => t.enrollment)),
  };
}

export const compositeOf = (r) => r.composite;

export function statusTone(score) {
  if (score === null || score === undefined) return 'muted';
  if (score >= 85) return 'excellent';
  if (score >= 75) return 'verygood';
  if (score >= 65) return 'good';
  if (score >= 55) return 'fair';
  return 'poor';
}

export const teacherById = (teachers, id) => teachers.find((t) => t.id === id);
export { ITEMS, ITEM_BY_KEY, PILLARS, PILLAR_ITEMS, PILLAR_MAX, MAX_TOTAL, clamp };
