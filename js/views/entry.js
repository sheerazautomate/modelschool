/* Daily Checklist — the marking screen, laid out like page 1 of the form. */

import { ITEMS, SCHOOL } from '../data.js';
import { el, fmtDate, weekday, round, initials, plural } from '../util.js';
import { icon, iconEl } from '../icons.js';
import { viewHead, card, avatar, emptyState } from '../components.js';
import { dayStrip, rubricPanel } from '../components-scoring.js';
import { dayFilledCount, getMark, computeTeacher } from '../scoring.js';
import { scoreColor } from '../charts.js';

export function renderEntry(app) {
  const root = el('div');
  const days = app.days;
  /* The day must be re-read on every redraw: the principal can move between
     days without leaving the screen, and the strip, the header score and the
     picker counter all follow whichever day is selected. */
  let day = app.params.day || app.selectedDay || days[days.length - 1];
  let teacherId = app.params.teacherId
    || app.selectedTeacher
    || app.state.teachers[0]?.id;

  root.append(viewHead({
    title: 'Daily checklist',
    subtitle: `Mark each of the fifteen items exactly as the printed form scores them, for ${app.periodLabel}. Leave an item blank if it was not checked — a blank is not the same as a zero.`,
    actions: [
      el('button', { class: 'btn', onclick: () => app.navigate('reports') }, iconEl('print'), 'Print a blank form'),
    ],
  }));

  /* --- teacher picker as a sidebar -------------------------------- */
  const picker = el('div', { class: 'card entry-picker' });
  const counter = el('span', { class: 'chip muted' });
  const pickerHead = el('div', { class: 'card-head', style: 'align-items:center' },
    el('h3', {}, 'Select incharge'),
    el('div', { class: 'spacer' }),
    counter,
  );
  const drawCounter = () => {
    const pendingCount = app.state.teachers
      .filter((t) => dayFilledCount(app.state, t.id, day) < ITEMS.length).length;
    counter.textContent = pendingCount ? `${pendingCount} left` : 'all marked';
    counter.title = `${app.state.teachers.length} incharges; ${pendingCount} still to mark on ${day}`;
  };
  picker.append(pickerHead);
  const list = el('div', { style: 'padding:6px' });
  picker.append(list);

  const drawPicker = () => {
    drawCounter();
    list.innerHTML = '';
    app.state.teachers.forEach((t) => {
      const filled = dayFilledCount(app.state, t.id, day);
      const rec = app.records[t.id];
      const active = t.id === teacherId;
      list.append(el('button', {
        class: `nav-item ${active ? 'active' : ''}`,
        dataset: { teacher: t.id },
        style: 'width:100%;padding:7px 8px',
        onclick: () => {
          teacherId = t.id;
          app.selectedTeacher = t.id;
          app.params.teacherId = t.id;
          drawPicker();
          drawPanel();
          /* Keep the chosen incharge in view in a long roster. Guarded: an
             embedded webview may not implement scrollIntoView, and a throw
             here would abort the rest of the handler. */
          const row = list.querySelector(`[data-teacher="${t.id}"]`);
          if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
        },
      },
        el('div', { class: 'avatar', style: active ? 'background:rgba(255,255,255,.18);color:#fff;border-color:rgba(255,255,255,.3)' : '' }, initials(t.name)),
        el('div', { style: 'flex:1;min-width:0;text-align:left' },
          el('div', { style: 'font-size:12.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, t.name),
          el('div', { class: 'tiny', style: `opacity:.75` }, `${t.cls} · ${filled}/${ITEMS.length} today`)),
        el('span', {
          class: 'tiny',
          style: `padding:1px 6px;border-radius:99px;font-weight:700;background:${filled === ITEMS.length ? 'rgba(111,211,165,.25)' : filled ? 'rgba(220,193,137,.3)' : 'rgba(255,255,255,.12)'}`,
        }, filled === ITEMS.length ? '✓' : filled ? String(filled) : '·'),
      ));
    });
  };

  const panelHost = el('div');
  let headHost = null;

  /* Rebuild just the incharge header, leaving the rubric the principal is
     tapping in place. Rebuilding the whole panel would lose scroll position
     and re-number the items mid-entry. */
  const refreshHead = () => {
    const teacher = app.teacher(teacherId);
    if (!teacher || !headHost) return;
    const rec = computeTeacher(teacher, app.state, app.days);
    const box = headHost.querySelector('[data-score]');
    if (!box) return;
    box.innerHTML = '';
    box.append(
      el('div', { class: 'tiny muted' }, 'Month to date'),
      el('div', { style: `font-family:var(--serif);font-size:22px;font-weight:600;color:${scoreColor(rec.composite)}` },
        rec.daysObserved ? `${rec.composite}%` : '—'),
      el('div', { class: 'tiny muted' }, rec.daysObserved
        ? `Grade ${rec.grade.grade} · ${rec.daysObserved} days`
        : 'no entries yet'),
    );
  };

  const drawPanel = () => {
    panelHost.innerHTML = '';
    const teacher = app.teacher(teacherId);
    if (!teacher) {
      panelHost.append(card({ body: emptyState('No teacher selected', 'Choose an incharge from the list.') }));
      return;
    }
    const rec = computeTeacher(teacher, app.state, app.days);

    const head = el('div', { class: 'card', style: 'margin-bottom:14px' },
      el('div', { class: 'card-pad split', style: 'flex-wrap:wrap;gap:14px' },
        avatar(teacher.name, true),
        el('div', {},
          el('div', { style: 'font-family:var(--serif);font-size:18px;font-weight:600' }, teacher.name),
          el('div', { class: 'small muted' }, `${teacher.designation} · class ${teacher.cls} · ${plural(teacher.enrollment, 'student', 'students')}`)),
        el('div', { style: 'flex:1' }),
        el('div', { style: 'text-align:right', dataset: { score: '1' } },
          el('div', { class: 'tiny muted' }, 'Month to date'),
          el('div', { style: `font-family:var(--serif);font-size:22px;font-weight:600;color:${scoreColor(rec.composite)}` },
            rec.daysObserved ? `${rec.composite}%` : '—'),
          el('div', { class: 'tiny muted' }, rec.daysObserved ? `Grade ${rec.grade.grade} · ${rec.daysObserved} days` : 'no entries yet')),
        el('button', { class: 'btn btn-sm', onclick: () => app.openTeacher(teacher.id) }, 'Case file', el('span', { html: icon('arrowRight') })),
      ),
    );
    panelHost.append(head);
    headHost = head;

    panelHost.append(card({
      title: 'Choose the day',
      sub: 'Green means the day is fully marked, amber means partly marked',
      body: dayStrip(app, teacher.id, day, (d) => {
        day = d;
        app.selectedDay = d;
        app.params.day = d;
        drawPicker();
        drawPanel();
      }),
    }));

    const rubric = rubricPanel(app, teacher.id, day, {
      onChange: () => {
        /* The month-to-date grade in the header is derived from these marks,
           so refresh it alongside the roster progress. */
        drawPicker();
        refreshHead();
      },
    });

    panelHost.append(el('div', { class: 'mt14' }, card({
      title: 'Fifteen checklist items',
      sub: 'Tap an option to score it; tap the same option again to clear it',
      body: rubric,
    })));
  };

  drawPicker();
  drawPanel();

  root.append(el('div', { class: 'entry-split' },
    picker,
    el('div', {}, panelHost),
  ));

  /* Weekly summary table under the panel */
  const summary = el('table', { class: 'data' });
  summary.append(el('thead', {}, el('tr', {},
    el('th', {}, 'Item'),
    el('th', { class: 'num' }, 'Max'),
    ...days.slice(-5).map((d) => el('th', { class: 'num' }, fmtDate(d))),
    el('th', { class: 'num' }, 'Month avg'),
  )));
  const tb = el('tbody');
  ITEMS.forEach((item) => {
    const tr = el('tr', {},
      el('td', {}, el('div', { class: 'bold' }, item.en)),
      el('td', { class: 'num' }, String(item.max)),
    );
    const vals = [];
    days.forEach((d) => {
      const v = getMark(app.state, teacherId, d, item.key);
      if (v !== null) vals.push(v);
    });
    days.slice(-5).forEach((d) => {
      const v = getMark(app.state, teacherId, d, item.key);
      tr.append(el('td', { class: 'num', style: v === null ? 'color:var(--ink-4)' : v === 0 ? 'color:var(--red);font-weight:700' : '' },
        v === null ? '—' : String(v)));
    });
    tr.append(el('td', { class: 'num' }, vals.length ? `${round(vals.reduce((a, b) => a + b, 0) / vals.length, 1)}/${item.max}` : '—'));
    tb.append(tr);
  });
  summary.append(tb);

  root.append(el('div', { class: 'mt20' }, card({
    title: 'Item-by-item record for the last five working days',
    sub: 'Use this to confirm a pattern before writing a remark',
    pad: false,
    body: el('div', { class: 'table-wrap' }, summary),
  })));

  return root;
}
