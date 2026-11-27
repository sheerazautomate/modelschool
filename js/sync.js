/* =========================================================================
   Google Sheets / Drive bridge.

   The console runs entirely in the browser, so it cannot hold Google
   credentials. Instead it produces a workbook that maps one-to-one onto the
   live spreadsheet, which is linked below. The office either refreshes the
   sheet by importing the workbook, or keeps printing from here.
   ========================================================================= */

import { SCHOOL, ITEMS, PILLARS, WORKING_DAYS, WEEKS } from './data.js';
import { el, fmtDate, toCSV, downloadFile, round, avg, toast } from './util.js';
import { icon, iconEl } from './icons.js';
import { weeklyAttendance } from './scoring.js';

export const LINKS = {
  folder: 'https://drive.google.com/drive/folders/1scGOXrHtu7aC255lcaX-YfeIYySxPQBT',
  folderId: '1scGOXrHtu7aC255lcaX-YfeIYySxPQBT',
  sheet: 'https://docs.google.com/spreadsheets/d/1jqDC2AqgoCmKjdgOg4MGJomjmR1upXKahRgGPWQXrkw/edit',
  sheetId: '1jqDC2AqgoCmKjdgOg4MGJomjmR1upXKahRgGPWQXrkw',
};

export function setLinks({ sheet, sheetId, folder, folderId } = {}) {
  if (sheet) LINKS.sheet = sheet;
  if (sheetId) LINKS.sheetId = sheetId;
  if (folder) LINKS.folder = folder;
  if (folderId) LINKS.folderId = folderId;
}

/* --- workbook definition ---------------------------------------------- */
export function workbook(app) {
  const { school, state } = app;
  const sheets = [];

  sheets.push({
    name: 'Summary',
    rows: [
      ['GOVT. BOYS MODEL HIGH SCHOOL, LAYYAH'],
      [`EMIS ${SCHOOL.emis} · ${SCHOOL.session}`],
      ['Principal', SCHOOL.principal],
      ['Monitoring period', SCHOOL.monitorPeriod],
      [],
      ['Metric', 'Value'],
      ['School composite (%)', school.composite],
      ['School grade', `${school.grade.grade} — ${school.grade.label}`],
      ['Teachers with data', school.ranked.length],
      ['Teachers total', school.totalTeachers],
      ['Teachers below 70%', school.ranked.filter((r) => r.composite < 70).length],
      ['Teachers below 60%', school.ranked.filter((r) => r.composite < 60).length],
      ['Student attendance (%)', Math.round(school.studentAttendance)],
      ['Total on roll', school.enrollment],
      ...Object.keys(PILLARS).map((k) => [`Pillar — ${PILLARS[k].name} (%)`, school.pillarAvg[k]]),
      [],
      ['Generated', new Date().toISOString().slice(0, 16).replace('T', ' ')],
    ],
  });

  sheets.push({
    name: 'Teachers',
    rows: [
      ['Sr', 'Teacher', 'Designation', 'Class', 'Enrolment', 'Composite %', 'Grade', 'Grade label',
        'Attendance %', ...Object.keys(PILLARS).map((k) => `${PILLARS[k].short} %`),
        'Days monitored', 'Coverage %', 'Trend', 'Weakest item', 'Weakest %', 'Second weakest', 'Remark'],
      ...state.teachers.map((t) => {
        const r = app.records[t.id];
        return [
          t.sr, t.name, t.designation, t.cls, t.enrollment,
          r.daysObserved ? r.composite : '',
          r.daysObserved ? r.grade.grade : '',
          r.daysObserved ? r.grade.label : '',
          r.daysObserved ? Math.round(r.studentAttendance) : '',
          ...Object.keys(PILLARS).map((k) => (r.pillars[k].percent === null ? '' : round(r.pillars[k].percent, 1))),
          r.daysObserved,
          round(r.coverage, 0),
          r.trend.direction,
          r.weakest[0]?.item.en || '',
          r.weakest[0] ? round(r.weakest[0].percent, 0) : '',
          r.weakest[1]?.item.en || '',
          state.observations?.[t.id]?.remark || '',
        ];
      }),
    ],
  });

  sheets.push({
    name: 'Daily checklist',
    rows: [
      ['Date', 'Teacher', 'Class', ...ITEMS.map((i) => i.key), 'Points', 'Available', '%'],
      ...WORKING_DAYS.flatMap((d) => state.teachers.map((t) => {
        const e = state.entries?.[t.id]?.[d];
        if (!e) return null;
        const marks = ITEMS.map((i) => (e[i.key] === undefined ? '' : e[i.key]));
        const pts = ITEMS.reduce((s, i) => s + (e[i.key] === undefined ? 0 : Number(e[i.key])), 0);
        const avail = ITEMS.reduce((s, i) => s + (e[i.key] === undefined ? 0 : i.max), 0);
        return [d, t.name, t.cls, ...marks, pts, avail, avail ? round((pts / avail) * 100, 1) : ''];
      }).filter(Boolean)),
    ],
  });

  sheets.push({
    name: 'Attendance register',
    rows: [
      ['Sr', 'Class', 'Incharge', 'Enrolment', ...WEEKS.flatMap((w) => [`${w.label} asm %`, `${w.label} days`]), 'Month %'],
      ...state.teachers.map((t) => {
        const w = weeklyAttendance(t, state);
        const r = app.records[t.id];
        return [t.sr, t.cls, t.name, t.enrollment,
          ...w.flatMap((x) => [x.pct === null ? '' : round(x.pct, 1), x.days]),
          r.daysObserved ? round(r.studentAttendance, 1) : ''];
      }),
    ],
  });

  sheets.push({
    name: 'Improvement register',
    rows: [
      ['Teacher', 'Undertaking', 'Detail', 'Due', 'Measure of success', 'Status', 'Created'],
      ...(state.actions || []).map((a) => [
        a.teacherName || '', a.title || '', a.detail || '', a.due || '',
        a.metric || '', a.done ? 'Closed' : 'Open', (a.createdAt || '').slice(0, 10),
      ]),
    ],
  });

  sheets.push({
    name: 'Rubric',
    rows: [
      ['Key', 'Item (English)', 'Item (Urdu)', 'Pillar', 'Max points', 'Scoring options', 'Remedial action'],
      ...ITEMS.map((i) => [i.key, i.en, i.ur, PILLARS[i.pillar].name, i.max,
        i.options.map((o) => `${o.label} = ${o.pts}`).join('; '), i.remedy]),
    ],
  });

  return sheets;
}

/* --- download the workbook as CSVs ------------------------------------ */
export function downloadWorkbook(app) {
  const sheets = workbook(app);
  const stamp = new Date().toISOString().slice(0, 10);
  const combined = sheets.map((s) => `# ${s.name}\n${toCSV(s.rows)}`).join('\n\n');
  downloadFile(`GBMHS-Layyah-workbook-${stamp}.csv`, combined, 'text/csv');
  return sheets;
}

export function downloadSheet(app, name) {
  const s = workbook(app).find((x) => x.name === name);
  if (!s) return;
  downloadFile(`${name.replace(/\s+/g, '-')}.csv`, toCSV(s.rows), 'text/csv');
}

/* --- modal ------------------------------------------------------------ */
export function modal({ title, body, actions = [] }) {
  let host = document.getElementById('modal-host');
  if (!host) {
    host = el('div', { class: 'modal-backdrop', id: 'modal-host' });
    document.body.append(host);
  }
  host.innerHTML = '';
  const close = () => host.classList.remove('open');
  host.append(el('div', { class: 'modal' },
    el('div', { class: 'modal-head' },
      el('h3', {}, title),
      el('div', { style: 'flex:1' }),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: close }, el('span', { html: icon('close') }))),
    el('div', { class: 'modal-body' }, body),
    el('div', { class: 'modal-foot' },
      ...actions.map((a) => el('button', {
        class: `btn ${a.primary ? 'btn-primary' : ''}`,
        onclick: () => { a.onClick?.(); if (a.close !== false) close(); },
      }, a.label))),
  ));
  host.classList.add('open');
  host.onclick = (e) => { if (e.target === host) close(); };
}

export async function pushToSheets(app) {
  const sheets = workbook(app);
  const rowsTotal = sheets.reduce((a, s) => a + s.rows.length, 0);

  const body = el('div', {},
    el('p', { class: 'small', style: 'margin-top:0' },
      'The console keeps its record in this browser. The live Google Sheet mirrors it, so the office always has a cloud copy in the same layout as the printed reports.'),
    el('div', { class: 'card card-pad', style: 'margin-bottom:12px' },
      el('div', { class: 'split' },
        el('span', { style: 'color:var(--green-700)', html: icon('sheet') }),
        el('div', {},
          el('div', { class: 'bold' }, 'Workbook ready'),
          el('div', { class: 'tiny muted' }, `${sheets.length} sheets · ${rowsTotal} rows · ${sheets.map((s) => s.name).join(', ')}`)))),
    LINKS.sheet
      ? el('div', { class: 'mb10' },
        el('a', { class: 'btn btn-primary', href: LINKS.sheet, target: '_blank', rel: 'noopener' },
          iconEl('sheet'), 'Open the live spreadsheet'),
        el('div', { class: 'tiny muted mt6' }, 'The monthly workbook for this school, with Summary, Teachers, Daily checklist, Attendance, Improvement register and Rubric tabs.'))
      : el('div', { class: 'flag amber mb10' },
        el('span', { class: 'dot' }),
        el('span', {}, 'The live spreadsheet link has not been connected for this session yet.')),
    el('div', { class: 'mb10' },
      el('a', { class: 'btn', href: LINKS.folder, target: '_blank', rel: 'noopener' },
        iconEl('drive'), 'Open the Drive archive folder')),
    el('div', { class: 'note' },
      el('b', {}, 'To refresh the cloud copy: '),
      'download the workbook, open the spreadsheet, and use File → Import → Replace data for each tab. The column order is identical, so nothing needs rearranging.'),
  );

  modal({
    title: 'Send workbook to Google Sheets',
    body,
    actions: [
      { label: 'Download workbook (CSV)', onClick: () => { downloadWorkbook(app); toast('Workbook downloaded.'); } },
      { label: 'Download single tab…', onClick: () => pickSheet(app), close: true },
      LINKS.sheet ? { label: 'Open spreadsheet', primary: true, onClick: () => window.open(LINKS.sheet, '_blank') } : null,
    ].filter(Boolean),
  });
}

function pickSheet(app) {
  const sheets = workbook(app);
  modal({
    title: 'Download one tab',
    body: el('div', {},
      ...sheets.map((s) => el('div', { class: 'split', style: 'padding:8px 0;border-bottom:1px solid var(--line-soft)' },
        el('div', { style: 'flex:1' }, el('div', { class: 'bold' }, s.name), el('div', { class: 'tiny muted' }, `${s.rows.length} rows`)),
        el('button', { class: 'btn btn-sm', onclick: () => downloadSheet(app, s.name) }, iconEl('download'), 'CSV')))),
    actions: [{ label: 'Close' }],
  });
}

export function reportToHTML(node, title) {
  const css = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      } catch { return ''; }
    })
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>${css}
body{background:#fff;padding:24px} .report-sheet{box-shadow:none;border:0}
@media print{@page{size:A4;margin:13mm 14mm}}
</style></head><body>${node.outerHTML}</body></html>`;
}

export function downloadReport(node, name) {
  const html = reportToHTML(node, name);
  downloadFile(`${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.html`, html, 'text/html');
  toast('Report file downloaded — open it and print to PDF, or upload it to the Drive folder.');
}

export function openDrivePanel(app) {
  modal({
    title: 'Drive archive',
    body: el('div', {},
      el('p', { class: 'small', style: 'margin-top:0' },
        'Signed reports and the monthly workbook are kept in one folder so the record survives changes of principal or office staff.'),
      LINKS.folder
        ? el('a', { class: 'btn btn-primary', href: LINKS.folder, target: '_blank', rel: 'noopener' }, iconEl('drive'), 'Open the archive folder')
        : el('div', { class: 'flag amber' }, el('span', { class: 'dot' }), el('span', {}, 'The archive folder is not connected for this session.')),
      el('div', { class: 'note mt10' },
        el('b', {}, 'What goes in the folder: '), 'the monthly school report, one finding per teacher below 70%, and the workbook CSV once a month.'),
    ),
    actions: [
      { label: 'Download workbook', onClick: () => downloadWorkbook(app) },
      { label: 'Close' },
    ],
  });
}

export async function saveToDrive(app, node, name) {
  downloadReport(node, name);
  setTimeout(() => openDrivePanel(app), 400);
}
