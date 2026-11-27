/* Reports — pick a document, preview it, print it as PDF, or push to Drive. */

import { WORKING_DAYS, SCHOOL } from '../data.js';
import { el, fmtDate, fmtDateLong, plural } from '../util.js';
import { icon, iconEl } from '../icons.js';
import { viewHead, card, emptyState, gradeBadge } from '../components.js';
import { schoolReport, teacherReport, batchReport, blankForm, attendanceSheet, renderPrint } from '../report.js';
import { scoreColor } from '../charts.js';
import { pushToSheets, openDrivePanel, saveToDrive } from '../sync.js';

const DOCS = [
  { key: 'school', title: 'Monthly school report', desc: 'Two-page consolidated finding: pillars, weakest items, teacher-wise table, cases for formal notice, principal\u2019s observation.' },
  { key: 'teacher', title: 'Teacher performance finding', desc: 'One teacher, letterhead format: finding, evidence, explanation of causes, improvement plan, follow-up dates, signature block.' },
  { key: 'batch', title: 'Batch case files', desc: 'Every teacher below 70%, one case file each, ready for signature and the personal file.' },
  { key: 'attendance', title: 'Attendance register sheet', desc: 'The page-2 weekly register in printable form with the month average.' },
  { key: 'form', title: 'Blank daily checklist', desc: 'A clean copy of the page-1 form to carry on the round.' },
];

export function renderReports(app) {
  const root = el('div');
  let selected = app.params.teacherId || app.school.ranked[0]?.id;

  root.append(viewHead({
    title: 'Reports & documents',
    subtitle: 'Every report is generated from the current marks. Preview it here, then print to PDF or send the workbook to Google Sheets.',
    actions: [
      el('button', { class: 'btn btn-gold', onclick: () => pushToSheets(app) }, iconEl('sheet'), 'Send workbook to Google Sheets'),
    ],
  }));

  const listCard = el('div');
  const previewHost = el('div');
  let activeDoc = 'school';

  const drawList = () => {
    listCard.innerHTML = '';
    listCard.append(card({
      title: 'Choose a document',
      pad: false,
      body: el('div', { style: 'padding:8px' },
        ...DOCS.map((d) => el('button', {
          class: 'nav-item',
          style: `width:100%;align-items:flex-start;padding:10px;${activeDoc === d.key ? 'background:var(--green-100);border-color:#c9ddd2' : ''}`,
          onclick: () => { activeDoc = d.key; drawList(); drawPreview(); },
        },
          el('span', { style: 'color:var(--green-700);flex:none', html: icon('file') }),
          el('span', { style: 'text-align:left' },
            el('span', { style: `display:block;font-weight:${activeDoc === d.key ? 700 : 600};font-size:13px` }, d.title),
            el('span', { style: 'display:block;font-size:11.5px;color:var(--ink-3);line-height:1.4;margin-top:2px' }, d.desc)),
        )),
      ),
    }));
  };

  const drawPreview = () => {
    previewHost.innerHTML = '';
    let node;
    let filename;

    if (activeDoc === 'teacher') {
      const rec = app.record(selected);
      if (!rec) { previewHost.append(card({ body: emptyState('Pick a teacher', 'Choose from the list.') })); return; }
      node = el('div', {},
        el('div', { class: 'toolbar mb14 no-print' },
          el('select', { class: 'select', style: 'max-width:300px', onchange: (e) => { selected = e.target.value; drawPreview(); } },
            ...app.school.records.map((r) => el('option', { value: r.id, selected: r.id === selected },
              `${r.teacher.name} — ${r.teacher.cls} (${r.daysObserved ? r.composite + '%' : 'no data'})`))),
          el('span', { class: 'spacer', style: 'flex:1' }),
          el('button', { class: 'btn btn-primary', onclick: () => printNode(node.querySelector('.report-sheet')) }, iconEl('print'), 'Print / Save as PDF'),
          el('button', { class: 'btn', onclick: () => saveToDrive(app, node.querySelector('.report-sheet'), `${rec.teacher.name} - finding`) }, iconEl('drive'), 'Save to Drive'),
        ),
        teacherReport(app, rec));
      filename = `finding-${rec.teacher.cls}`;
    } else if (activeDoc === 'batch') {
      const ids = app.school.ranked.filter((r) => r.composite < 70).map((r) => r.id);
      node = el('div', {},
        el('div', { class: 'toolbar mb14 no-print' },
          el('span', { class: 'small muted' }, `${plural(ids.length, 'case file', 'case files')} will print — every teacher below 70%.`),
          el('span', { class: 'spacer', style: 'flex:1' }),
          el('button', { class: 'btn btn-primary', onclick: () => printNode(node) }, iconEl('print'), 'Print all'),
        ),
        batchReport(app, ids));
      filename = 'batch-case-files';
    } else if (activeDoc === 'form') {
      node = el('div', {},
        el('div', { class: 'toolbar mb14 no-print' },
          el('select', { class: 'select', style: 'max-width:260px', onchange: (e) => { selected = e.target.value; drawPreview(); } },
            ...app.state.teachers.map((t) => el('option', { value: t.id, selected: t.id === selected }, `${t.name} — ${t.cls}`))),
          el('select', { class: 'select', style: 'max-width:200px', id: 'form-day' },
            ...WORKING_DAYS.map((d) => el('option', { value: d, selected: d === WORKING_DAYS[WORKING_DAYS.length - 1] }, fmtDate(d, { day: '2-digit', month: 'short', year: 'numeric' })))),
          el('span', { class: 'spacer', style: 'flex:1' }),
          el('button', { class: 'btn btn-primary', onclick: () => {
            const day = document.getElementById('form-day').value;
            printNode(blankForm(app, selected, day));
          } }, iconEl('print'), 'Print form'),
        ),
        blankForm(app, selected, WORKING_DAYS[WORKING_DAYS.length - 1]));
      filename = 'daily-checklist';
    } else {
      const builder = activeDoc === 'attendance' ? attendanceSheet : schoolReport;
      node = el('div', {},
        el('div', { class: 'toolbar mb14 no-print' },
          el('span', { class: 'small muted' }, activeDoc === 'attendance'
            ? 'Derived from the daily attendance bands.'
            : `School composite ${app.school.composite}% · Grade ${app.school.grade.grade}`),
          el('span', { class: 'spacer', style: 'flex:1' }),
          el('button', { class: 'btn btn-primary', onclick: () => printNode(node.querySelector('.report-sheet')) }, iconEl('print'), 'Print / Save as PDF'),
          el('button', { class: 'btn', onclick: () => saveToDrive(app, node.querySelector('.report-sheet'), activeDoc) }, iconEl('drive'), 'Save to Drive'),
        ),
        builder(app));
      filename = activeDoc;
    }

    previewHost.append(node);
  };

  drawList();
  drawPreview();

  root.append(el('div', { style: 'display:grid;grid-template-columns:330px 1fr;gap:16px;align-items:start' },
    el('div', {},
      listCard,
      el('div', { class: 'card card-pad mt14' },
        el('h4', { style: 'margin-top:0' }, 'Signature block'),
        el('div', { class: 'note' },
          'Every document closes with two signature lines — the monitoring in-charge and ',
          el('b', {}, SCHOOL.principal), '. Print, sign, and place a copy on the teacher\u2019s personal file.'),
        el('div', { class: 'mt10' },
          el('button', { class: 'btn btn-sm', onclick: () => openDrivePanel(app) }, iconEl('drive'), 'Drive archive')),
      ),
    ),
    previewHost,
  ));

  return root;
}

/* Prints whatever report is currently previewed (used by the masthead button). */
export function printCurrentReport() {
  const sheet = document.querySelector('#main .report-sheet');
  if (!sheet) { window.print(); return; }
  const printRoot = document.getElementById('print-root');
  printRoot.innerHTML = '';
  printRoot.append(sheet.cloneNode(true));
  window.print();
}

function printNode(node) {
  const printRoot = document.getElementById('print-root');
  printRoot.innerHTML = '';
  if (node.classList?.contains('report-sheet')) printRoot.append(node.cloneNode(true));
  else {
    // batch of sheets
    Array.from(node.querySelectorAll('.report-sheet')).forEach((s) => printRoot.append(s.cloneNode(true)));
  }
  window.print();
}

