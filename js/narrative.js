/* =========================================================================
   Narrative engine — turns numbers into the principal's written finding.
   Produces: verdict, explanation paragraphs, evidence lines, causes,
   an improvement plan with dates, and a follow-up schedule.
   ========================================================================= */

import { PILLARS, PILLAR_ITEMS, SCHOOL } from './data.js';
import { avg, fmtDateLong, fmtDate, sum, round } from './util.js';

const nf = new Intl.NumberFormat('en-GB');

function pillarSentence(pillarKey, p) {
  const pillar = PILLARS[pillarKey];
  if (p.percent === null) return null;
  const v = Math.round(p.percent);
  const band = v >= 85 ? 'exceeds' : v >= 70 ? 'meets' : v >= 60 ? 'falls slightly short of' : 'falls well short of';
  return `${pillar.name} stands at ${v}% (${p.earned} of ${p.possible} points), which ${band} the school benchmark of 70%.`;
}

export function buildExplanation(record, school, store) {
  const t = record.teacher;
  const g = record.grade;
  const nameShort = t.name.replace(/^(Mr\.|Mrs\.|Miss|Ms\.)\s*/i, '');
  const paragraphs = [];

  /* 1. Verdict --------------------------------------------------------- */
  if (record.daysObserved === 0) {
    paragraphs.push({
      kind: 'verdict',
      title: 'No monitoring data on record',
      text: `No entries have been made against ${t.name} (${t.cls}) for the period ${SCHOOL.monitorPeriod}. `
        + 'A performance finding cannot be recorded until the class is monitored. Recommend an immediate visit and completion of the daily checklist for at least five working days.',
    });
    return { paragraphs, plan: [], followups: [], severity: 'unknown' };
  }

  const rank = school.ranked.findIndex((r) => r.id === record.id) + 1;
  const gap = round(70 - record.composite, 1);

  paragraphs.push({
    kind: 'verdict',
    title: `Grade ${g.grade} — ${g.label} (composite ${record.composite}%)`,
    text: `${t.name}, ${t.designation}, incharge of class ${t.cls} with an enrolled strength of ${t.enrollment} students, `
      + `is placed in Grade ${g.grade} for ${SCHOOL.monitorPeriod}. The composite score of ${record.composite}% is calculated from `
      + `${record.daysObserved} monitoring days across the fifteen checklist items, weighted by pillar. `
      + (rank ? `This places the teacher at position ${rank} of ${school.ranked.length} incharges monitored. ` : '')
      + (record.composite >= 70
        ? `The teacher clears the 70% school benchmark with a margin of ${round(record.composite - 70, 1)} percentage points.`
        : `The teacher is ${Math.abs(gap)} percentage points below the 70% school benchmark.`),
  });

  /* 2. Pillar breakdown ------------------------------------------------ */
  const pillarLines = Object.keys(PILLARS)
    .map((k) => pillarSentence(k, record.pillars[k]))
    .filter(Boolean);
  paragraphs.push({
    kind: 'pillars',
    title: 'Where the score comes from',
    text: pillarLines.join(' '),
    list: Object.keys(PILLARS).map((k) => ({
      label: PILLARS[k].name,
      weight: PILLARS[k].weight,
      percent: record.pillars[k].percent,
      earned: record.pillars[k].earned,
      possible: record.pillars[k].possible,
    })),
  });

  /* 3. The evidence — weakest items ------------------------------------ */
  const weak = record.weakest.filter((w) => w.percent < 80);
  if (weak.length) {
    paragraphs.push({
      kind: 'evidence',
      title: 'Items that pulled the score down',
      text: weak.length === 1
        ? 'One checklist item is materially below standard and accounts for most of the shortfall.'
        : `${weak.length} checklist items are materially below standard and together account for most of the shortfall.`,
      list: weak.map((w) => ({
        label: w.item.en,
        urdu: w.item.ur,
        percent: Math.round(w.percent),
        lost: round(w.lost, 0),
        max: w.item.max,
        zeros: w.zeros,
        days: w.days,
        detail: `${Math.round(w.percent)}% of available points${w.item.monthly ? ' (assessed once for the month)' : ` over ${w.days} checks`}`
          + (w.zeros ? ` — scored zero on ${w.zeros} ${w.zeros === 1 ? 'day' : 'days'}` : ''),
      })),
    });
  }

  /* 4. Attendance and trend ------------------------------------------- */
  const att = record.studentAttendance;
  const attText = att
    ? `Student attendance averaged ${Math.round(att)}% over the monitored days (school average ${Math.round(school.studentAttendance)}%). `
    : '';
  const trendText = {
    up: `Performance is improving — the second half of the month is ${Math.abs(record.trend.delta)}% higher than the first half.`,
    down: `Performance is declining — the second half of the month is ${Math.abs(record.trend.delta)}% lower than the first half. This is more serious than a uniformly low score because it shows a deteriorating habit, not a one-off bad week.`,
    flat: `Performance is steady across the month with no marked rise or fall, which suggests the current level is the teacher's settled routine.`,
  }[record.trend.direction];

  paragraphs.push({
    kind: 'attendance',
    title: 'Attendance and month-on-month movement',
    text: `${attText}${trendText}`,
  });

  /* 5. Causes — attribution -------------------------------------------- */
  const causes = attributeCauses(record);
  paragraphs.push({
    kind: 'causes',
    title: 'Probable causes',
    text: causes.intro,
    list: causes.items,
  });

  /* 6. What the teacher does well — keeps the finding defensible ------- */
  const strong = record.strongest.filter((s) => s.percent >= 70);
  if (strong.length) {
    paragraphs.push({
      kind: 'credit',
      title: 'Credit where due',
      text: 'The finding is qualified by the following strengths, which should be recorded in the teacher\u2019s favour: '
        + strong.map((s) => `${s.item.en} at ${Math.round(s.percent)}%`).join(', ') + '.',
    });
  }

  /* 7. Data quality note ----------------------------------------------- */
  if (record.coverage < 100 || record.daysComplete < record.daysObserved) {
    paragraphs.push({
      kind: 'data',
      title: 'Reliability of this finding',
      text: `The checklist was completed on ${record.daysObserved} of ${record.periodDays} working days (${Math.round(record.coverage)}% coverage), `
        + `and all fifteen items were present on ${record.daysComplete} of those days. `
        + (record.coverage >= 80
          ? 'Coverage is sufficient to treat this finding as reliable.'
          : 'Coverage is below 80%; treat the composite as indicative and complete the record before any adverse entry is made in the service file.'),
    });
  }

  return {
    paragraphs,
    plan: buildPlan(record),
    followups: buildFollowups(record),
    severity: record.composite < 60 ? 'high' : record.composite < 70 ? 'medium' : 'low',
  };
}

function attributeCauses(record) {
  const items = [];
  const st = record.itemStats;
  const attPts = st.attendance;
  const items0 = (key) => st[key]?.zeros || 0;

  if (attPts.possible && attPts.earned / attPts.possible < 0.75) {
    items.push({
      label: 'Class-level student attendance',
      text: `Attendance lost ${round(attPts.possible - attPts.earned, 0)} of ${attPts.possible} points. `
        + (items0('attendance') >= 4
          ? 'The class fell below 80% on multiple days, which usually points to weak follow-up on absentees rather than a single cause.'
          : 'Attendance dipped on specific days; check whether those were local holidays, weather or assessment days.'),
    });
  }
  if (st.lesson_plan.possible && st.lesson_plan.earned / st.lesson_plan.possible < 0.7) {
    items.push({
      label: 'Lesson planning discipline',
      text: `Lesson plans were missing on ${items0('lesson_plan')} checks. This is the single strongest predictor of weak classroom delivery in the checklist.`,
    });
  }
  if (st.personal_file.possible && st.personal_file.earned / st.personal_file.possible < 0.7) {
    items.push({
      label: 'Record keeping',
      text: 'Personal file and/or class file were incomplete. Teachers with weak filing usually also lag on registers and result compilation.',
    });
  }
  if (st.classroom.possible && st.classroom.earned / st.classroom.possible < 0.55) {
    items.push({
      label: 'Classroom environment',
      text: 'Classroom features scored low. An unstimulating room is often a resourcing issue as much as a supervision issue — verify whether display material was supplied.',
    });
  }
  if (st.leave.earned !== undefined && st.leave.possible && st.leave.earned / st.leave.possible < 0.6) {
    items.push({
      label: 'Leave pattern',
      text: 'Leave was taken above the permitted level in the month. Repeated short leave disrupts continuity more than a single long absence.',
    });
  }
  if (st.donation.possible && st.donation.earned / st.donation.possible < 0.4) {
    items.push({
      label: 'Class fund collection',
      text: 'Monthly donation collection is well below the class norm. Confirm whether receipts are being issued, as parents resist payment without them.',
    });
  }
  if (st.scout.possible && st.scout.earned / st.scout.possible < 0.4) {
    items.push({
      label: 'Scout and co-curricular participation',
      text: 'Scout nominations are short. This usually reflects a class that has not been engaged in school-level events at all.',
    });
  }
  if (st.assembly_photo.possible && st.assembly_photo.earned / st.assembly_photo.possible < 0.7) {
    items.push({
      label: 'Assembly reporting',
      text: 'Assembly photographs were not submitted regularly, which also means the class is invisible in the school\u2019s daily record.',
    });
  }
  if (!items.length) {
    items.push({
      label: 'No single dominant cause',
      text: 'The shortfall is spread thinly across items rather than concentrated in one. The likely cause is general drift in routine rather than one specific failure.',
    });
  }
  return {
    intro: items.length > 1
      ? 'The shortfall is not attributable to a single failure. The pattern below is what the checklist evidence supports.'
      : 'The checklist evidence points to one dominant cause.',
    items,
  };
}

/* --- Improvement plan with dated action points ------------------------- */
export function buildPlan(record) {
  const weak = record.weakest.filter((w) => w.percent < 80);
  const plan = [];
  let week = 1;
  for (const w of weak) {
    plan.push({
      id: `${record.id}-${w.item.key}`,
      itemKey: w.item.key,
      title: `Correct ${w.item.en.toLowerCase()}`,
      action: w.item.remedy,
      metric: `Raise ${w.item.en.toLowerCase()} from ${Math.round(w.percent)}% to at least 85% of available points.`,
      by: `Week ${Math.min(week, 4)}`,
      owner: record.teacher.name,
      verify: 'Classroom observation sheet + checklist entry',
    });
    week += weak.length > 2 ? 1 : 0.5;
  }
  if (record.composite < 60) {
    plan.push({
      id: `${record.id}-formal`,
      itemKey: null,
      title: 'Formal notice and written explanation',
      action: 'Issue a written explanation notice under the school monitoring policy, obtain the teacher\u2019s signed reply, and place both on the personal file.',
      metric: 'Signed reply on file within 3 working days.',
      by: 'Week 1',
      owner: `${SCHOOL.principal} (Principal)`,
      verify: 'Office file copy',
    });
  }
  if (record.trend.direction === 'down') {
    plan.push({
      id: `${record.id}-trend`,
      itemKey: null,
      title: 'Arrest the declining trend',
      action: 'Weekly review meeting every Monday with the class incharge; compare the week\u2019s checklist average against the previous week.',
      metric: 'No further fall for two consecutive weeks.',
      by: 'Weeks 1–4',
      owner: `${SCHOOL.principal} (Principal)`,
      verify: 'Weekly review note',
    });
  }
  if (record.coverage < 80) {
    plan.push({
      id: `${record.id}-coverage`,
      itemKey: null,
      title: 'Complete the monitoring record',
      action: 'Enter the checklist for every remaining working day of the month so the finding rests on a full record.',
      metric: 'Coverage at or above 90% of working days.',
      by: 'Week 1',
      owner: 'Monitoring in-charge',
      verify: 'Console coverage figure',
    });
  }
  if (!plan.length) {
    plan.push({
      id: `${record.id}-sustain`,
      itemKey: null,
      title: 'Sustain and stretch',
      action: 'No remediation required. Continue monthly monitoring and ask the teacher to mentor one weaker class incharge.',
      metric: 'Composite maintained above 80%.',
      by: 'Next month',
      owner: record.teacher.name,
      verify: 'Monthly checklist',
    });
  }
  return plan;
}

export function buildFollowups(record) {
  const today = new Date();
  const base = new Date(`${record.rows.slice(-1)[0]?.day || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const start = today > base ? today : base;
  const steps = [
    { when: 3, title: 'Written intimation', text: 'Teach the teacher the specific findings and hand over a copy of this report.' },
    { when: 10, title: 'First re-check', text: 'Re-monitor the weakest three items and record fresh checklist entries.' },
    { when: 24, title: 'Second re-check', text: 'Assess whether the improvement plan has moved the composite above the floor.' },
    { when: 38, title: 'Review before Principal', text: 'Decide whether to close the case, extend the plan, or escalate to the DEO office.' },
  ];
  return steps.map((s) => {
    const d = new Date(start);
    d.setDate(d.getDate() + s.when);
    return {
      ...s,
      date: d.toISOString().slice(0, 10),
      display: fmtDateLong(d.toISOString().slice(0, 10)),
    };
  });
}

/* --- one-line summaries for cards / tables ---------------------------- */
export function shortVerdict(record) {
  if (!record.daysObserved) return 'No data entered.';
  const w = record.weakest[0];
  if (!w) return `${record.composite}% composite.`;
  return `${record.composite}% composite; weakest is ${w.item.en.toLowerCase()} at ${Math.round(w.percent)}%.`;
}

export function headlineFor(record) {
  if (!record.daysObserved) return 'Awaiting first monitoring entry';
  if (record.composite >= 85) return 'Exemplary — a model class for the school';
  if (record.composite >= 70) return 'Above benchmark — hold the standard';
  if (record.composite >= 60) return 'Marginal — needs a written improvement plan';
  return 'Critical — formal notice required';
}

/* Monthly items are assessed once, so a percentage of the month is meaningless
   to a reader — report the mark actually given instead. */
export function weakestText(entry) {
  if (!entry) return '—';
  const { item, percent, per } = entry;
  if (item.monthly) {
    let best = item.options[0];
    let dist = Infinity;
    for (const o of item.options) {
      const d = Math.abs(o.pts - per);
      if (d < dist) { dist = d; best = o; }
    }
    return `${item.en} — ${best.label} (${best.pts}/${item.max} pts)`;
  }
  if (percent >= 85) return `${item.en} — no material gap (${Math.round(percent)}%)`;
  return `${item.en} (${Math.round(percent)}%)`;
}

export function fmtRange(rows) {
  if (!rows.length) return '—';
  const first = rows[0].day;
  const last = rows[rows.length - 1].day;
  return `${fmtDate(first)} – ${fmtDate(last)}`;
}

export { nf };
