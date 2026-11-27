/* Improvement Plans — the school action register. */

import { SCHOOL, WORKING_DAYS } from '../data.js';
import { el, fmtDate, plural, round } from '../util.js';
import { icon, iconEl } from '../icons.js';
import { viewHead, card, emptyState } from '../components.js';
import { buildExplanation } from '../narrative.js';
import { addAction } from '../store.js';
import { scoreColor } from '../charts.js';

export function renderActions(app) {
  const root = el('div');
  const actions = app.state.actions || [];
  const open = actions.filter((a) => !a.done);
  const done = actions.filter((a) => a.done);

  root.append(viewHead({
    title: 'Improvement plans & follow-up',
    subtitle: 'Every undertaking given to a teacher, with an owner, a measure and a date. Mark each one closed when the evidence is produced.',
    actions: [
      el('button', { class: 'btn', onclick: () => generateAll(app) }, iconEl('target'), 'Draft plans for all at-risk teachers'),
      el('button', { class: 'btn', onclick: () => window.print() }, iconEl('print'), 'Print register'),
    ],
  }));

  /* summary */
  root.append(el('div', { class: 'grid g-kpi mb14' },
    el('div', { class: 'card kpi red' },
      el('div', { class: 'label' }, 'Open undertakings'), el('div', { class: 'value' }, String(open.length)),
      el('div', { class: 'foot' }, 'Owed by teachers to the office')),
    el('div', { class: 'card kpi' },
      el('div', { class: 'label' }, 'Closed'), el('div', { class: 'value' }, String(done.length)),
      el('div', { class: 'foot' }, 'Evidence produced')),
    el('div', { class: 'card kpi gold' },
      el('div', { class: 'label' }, 'Teachers with a plan'),
      el('div', { class: 'value' }, String(new Set(actions.map((a) => a.teacherId).filter(Boolean)).size)),
      el('div', { class: 'foot' }, 'of 29 incharges')),
    el('div', { class: 'card kpi blue' },
      el('div', { class: 'label' }, 'At risk without a plan'),
      el('div', { class: 'value' }, String(app.school.ranked.filter((r) => r.composite < 70 && !actions.some((a) => a.teacherId === r.id)).length)),
      el('div', { class: 'foot' }, 'Below 70% and nothing on record')),
  ));

  const manual = el('div', { class: 'card card-pad mb14' },
    el('div', { class: 'split wrap' },
      el('select', { class: 'select', id: 'act-teacher', style: 'max-width:260px' },
        app.state.teachers.map((t) => el('option', { value: t.id }, `${t.name} — ${t.cls}`))),
      el('input', { class: 'input', id: 'act-title', placeholder: 'Undertaking, e.g. Submit lesson plan every Monday', style: 'flex:1;min-width:220px' }),
      el('input', { class: 'input', id: 'act-due', placeholder: 'Due, e.g. Week 2', style: 'max-width:150px' }),
      el('button', { class: 'btn btn-primary', onclick: () => {
        const t = app.teacher(document.getElementById('act-teacher').value);
        const title = document.getElementById('act-title').value.trim();
        if (!title) return;
        addAction(app.state, {
          title: `${t.name} — ${title}`,
          detail: '',
          teacherId: t.id,
          teacherName: t.name,
          due: document.getElementById('act-due').value.trim() || 'This month',
          done: false,
        });
        app.commit();
        app.render();
      } }, iconEl('plus'), 'Add undertaking'),
    ),
    el('div', { class: 'tiny muted mt6' }, 'Use this for undertakings agreed verbally in a meeting; the generated plans above carry fuller wording.'),
  );
  root.append(manual);

  const list = el('div');
  if (!actions.length) {
    list.append(card({ body: emptyState('No undertakings yet', 'Open a teacher\u2019s case file and use the Action plan tab, or draft plans for every at-risk teacher above.') }));
  }

  const byTeacher = new Map();
  actions.forEach((a) => {
    const key = a.teacherId || 'general';
    if (!byTeacher.has(key)) byTeacher.set(key, []);
    byTeacher.get(key).push(a);
  });

  byTeacher.forEach((items, tid) => {
    const teacher = app.teacher(tid);
    const rec = app.record(tid);
    const c = card({
      title: teacher ? teacher.name : 'School-wide',
      sub: teacher ? `${teacher.cls} · composite ${rec?.composite ?? '—'}% · Grade ${rec?.grade.grade ?? '—'}` : '',
      actions: [teacher ? el('button', { class: 'btn btn-sm', onclick: () => app.openTeacher(tid, 'plan') }, 'Case file') : null].filter(Boolean),
      pad: false,
      body: el('div', { style: 'padding:4px 8px 8px' },
        ...items.map((a) => el('div', {
          class: 'split',
          style: `padding:9px 8px;border-bottom:1px solid var(--line-soft);gap:10px;${a.done ? 'opacity:.6' : ''}`,
        },
          el('button', {
            class: 'btn btn-sm',
            style: a.done ? 'background:var(--ok-bg);border-color:#bcdccd;color:var(--ok)' : 'border-color:var(--line)',
            title: a.done ? 'Reopen' : 'Mark as done',
            onclick: () => { app.toggleAction(a.id); app.render(); },
          }, a.done ? '✓ Done' : 'Mark done'),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { style: `font-weight:600;font-size:13px;${a.done ? 'text-decoration:line-through' : ''}` },
              a.title.replace(`${a.teacherName} — `, '')),
            a.detail ? el('div', { class: 'tiny muted' }, a.detail) : null,
            a.metric ? el('div', { class: 'tiny', style: 'color:var(--green-700)' }, a.metric) : null),
          el('span', { class: 'chip muted' }, a.due || '—'),
          el('button', { class: 'btn btn-ghost btn-sm', title: 'Remove', onclick: () => { app.deleteAction(a.id); app.render(); } },
            el('span', { html: icon('close') })),
        ))),
    });
    list.append(el('div', { class: 'mb14' }, c));
  });

  root.append(list);
  return root;
}

function generateAll(app) {
  const atRisk = app.school.ranked.filter((r) => r.composite < 70);
  const existing = new Set((app.state.actions || []).map((a) => a.teacherId));
  let added = 0;
  atRisk.forEach((rec) => {
    if (existing.has(rec.id)) return;
    const narrative = buildExplanation(rec, app.school, app.state);
    narrative.plan.slice(0, 3).forEach((p) => {
      addAction(app.state, {
        title: `${rec.teacher.name} — ${p.title}`,
        detail: p.action,
        teacherId: rec.id,
        teacherName: rec.teacher.name,
        due: p.by,
        metric: p.metric,
        done: false,
      });
      added += 1;
    });
  });
  app.commit();
  app.render();
  alert(added ? `${added} undertakings drafted from the ${atRisk.length} at-risk case files.` : 'Every at-risk teacher already has undertakings on record.');
}
