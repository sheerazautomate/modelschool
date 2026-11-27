/* Teachers — the full roster, sortable and filterable. */

import { PILLARS, ITEMS, WORKING_DAYS } from '../data.js';
import { el, round, debounce, plural } from '../util.js';
import { icon, iconEl } from '../icons.js';
import { viewHead, card, teacherRow, scoreChip, trendPill, emptyState } from '../components.js';
import { scatter, scoreColor } from '../charts.js';

const SORTS = {
  composite: (a, b) => b.composite - a.composite,
  name: (a, b) => a.teacher.name.localeCompare(b.teacher.name),
  attendance: (a, b) => b.studentAttendance - a.studentAttendance,
  weak: (a, b) => (a.weakest[0]?.percent ?? 101) - (b.weakest[0]?.percent ?? 101),
  enrollment: (a, b) => b.teacher.enrollment - a.teacher.enrollment,
};

export function renderLeaderboard(app) {
  const root = el('div');
  const f = app.filters;
  let rows = app.school.records.slice();
  let shown = app.filters.filter === 'risk'
    ? rows.filter((r) => r.daysObserved && r.composite < 70)
    : rows;

  const applySearch = (list) => {
    const q = app.search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => `${r.teacher.name} ${r.teacher.cls} ${r.teacher.designation}`.toLowerCase().includes(q));
  };
  const applyCourse = (list) => {
    if (f.grade === 'all') return list;
    if (f.grade === 'none') return list.filter((r) => !r.daysObserved);
    return list.filter((r) => r.grade.grade === f.grade);
  };

  const counts = {
    all: rows.length,
    risk: rows.filter((r) => r.daysObserved && r.composite < 70).length,
  };

  const body = el('div');
  const tableHost = el('div');

  const drawTable = () => {
    tableHost.innerHTML = '';
    const list = applySearch(applyCourse(shown)).sort(SORTS[f.sort] || SORTS.composite);
    if (f.dir === 'asc') list.reverse();

    tableHost.append(el('div', { class: 'toolbar', style: 'padding:12px 16px;border-bottom:1px solid var(--line-soft)' },
      el('div', { class: 'searchbox' },
        el('span', { html: icon('search') }),
        el('input', {
          class: 'input', type: 'search', placeholder: 'Search name, class or designation…',
          value: app.search,
          oninput: debounce((e) => {
            app.search = e.target.value;
            const el2 = document.activeElement;
            drawTable();
            const inp = document.querySelector('.searchbox .input');
            if (inp && document.activeElement !== inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
          }, 180),
        })),
      el('div', { class: 'seg' },
        ...[['all', 'All teachers'], ['risk', 'At risk only']].map(([k, lbl]) =>
          el('button', {
            class: f.filter === k ? 'on' : '',
            onclick: () => { app.filters.filter = k; drawTable(); },
          }, lbl)),
      ),
      el('div', { class: 'spacer', style: 'flex:1' }),
      el('select', {
        class: 'select', style: 'width:auto',
        onchange: (e) => { app.filters.grade = e.target.value; drawTable(); },
      },
        ...[['all', 'Every grade'], ['A+', 'Grade A+ only'], ['A', 'Grade A only'], ['B', 'Grade B only'], ['C', 'Grade C only'], ['D', 'Grade D only'], ['none', 'Not yet monitored']]
          .map(([v, lbl]) => el('option', { value: v, selected: f.grade === v }, lbl))),
      el('button', { class: 'btn btn-sm', onclick: () => { app.exportBackup(); } }, iconEl('download'), 'Export data'),
    ));

    const table = el('table', { class: 'data' });
    const headFor = (key, label, cls = '') => el('th', {
      class: `sortable ${cls}`, onclick: () => {
        if (f.sort === key) f.dir = f.dir === 'desc' ? 'asc' : 'desc';
        else { f.sort = key; f.dir = 'desc'; }
        drawTable();
      },
    }, label, el('span', { class: 'arrow' }, f.sort === key ? (f.dir === 'desc' ? '▼' : '▲') : ''));

    table.append(el('thead', {}, el('tr', {},
      el('th', { class: 'num' }, '#'),
      headFor('name', 'Teacher / class'),
      headFor('enrollment', 'Roll', 'num'),
      headFor('composite', 'Composite', 'num'),
      el('th', {}, 'Grade'),
      headFor('attendance', 'Attendance', 'num'),
      el('th', {}, 'Trend'),
      headFor('weak', 'Weakest area'),
      el('th', {}),
    )));

    const tbody = el('tbody');
    if (!list.length) {
      tbody.append(el('tr', {}, el('td', { colspan: 9 }, emptyState('No teachers match', 'Clear the search or change the grade filter.'))));
    }
    list.forEach((r) => tbody.append(teacherRow(r, app)));
    table.append(tbody);

    const withData = list.filter((r) => r.daysObserved);
    if (withData.length > 1) {
      table.append(el('tfoot', {}, el('tr', {},
        el('td', {}, ''),
        el('td', {}, `${plural(list.length, 'teacher', 'teachers')} shown`),
        el('td', { class: 'num' }, String(list.reduce((a, r) => a + r.teacher.enrollment, 0))),
        el('td', { class: 'num' }, `${round(withData.reduce((a, r) => a + r.composite, 0) / withData.length, 1)}%`),
        el('td', { colspan: 5 }, `School average · ${withData.length} with data`),
      )));
    }
    tableHost.append(el('div', { class: 'table-wrap' }, table));
  };

  drawTable();

  root.append(viewHead({
    title: 'Incharge roster',
    subtitle: `${plural(app.school.totalTeachers, 'teacher', 'teachers')} · weighted composite, grade and weakest area for each`,
    actions: [
      el('button', { class: 'btn', onclick: () => app.navigate('reports') }, iconEl('print'), 'Batch report'),
    ],
  }));

  /* The roster table */
  const roster = card({ body: tableHost, pad: false });
  root.append(roster);

  /* Scatter comparison */
  const scatterCard = card({
    title: 'Attendance against overall performance',
    sub: 'Each dot is a teacher. Low-left means both attendance and delivery are weak — those cases are the priority.',
    body: [
      el('div', { class: 'split', style: 'gap:24px;align-items:flex-start' },
        scatter(app.school.records, { width: 470, height: 300 }),
        el('div', { class: 'note', style: 'flex:1;min-width:200px' },
          el('p', { style: 'margin:0 0 8px' },
            el('b', {}, 'How to read this: '),
            'a teacher can score well on paper while their class attendance is poor. The upper-left quadrant (good delivery, weak attendance) usually means the incharge is not chasing absentees.'),
          el('p', { style: 'margin:0' },
            el('b', {}, 'The lower-left quadrant is the priority list: '),
            'both the class and the delivery need intervention, and those teachers appear first in the improvement plans.'),
        ),
      ),
    ],
  });
  root.append(el('div', { class: 'mt14' }, scatterCard));

  return root;
}
