/* Data & Sync — the office controls: sample vs live, import/export, cloud. */

import { SCHOOL, ITEMS } from '../data.js';
import { el, fmtDate, plural } from '../util.js';
import { icon, iconEl } from '../icons.js';
import { viewHead, card } from '../components.js';
import { workbook, pushToSheets, openDrivePanel, downloadWorkbook } from '../sync.js';

export function renderData(app) {
  const root = el('div');
  const entries = app.state.entries || {};
  const cells = Object.values(entries).reduce((a, t) => a + Object.values(t).reduce((b, d) => b + Object.keys(d).length, 0), 0);

  root.append(viewHead({
    title: 'Data & sync',
    subtitle: 'The console works offline and stores everything in this browser. Use this page to load the sample set, switch to live entry, or move the record in and out.',
  }));

  /* mode */
  root.append(el('div', { class: 'grid g-2 mb14' },
    card({
      title: 'Dataset in use',
      body: el('div', {},
        el('div', { class: 'split', style: 'gap:12px;margin-bottom:12px' },
          el('div', { class: `chip ${app.mode === 'demo' ? 'fair' : 'excellent'}`, style: 'font-size:13px;padding:5px 12px' },
            app.mode === 'demo' ? 'Sample data' : 'Live data'),
          el('div', { class: 'note' },
            app.mode === 'demo'
              ? 'Every teacher carries a full month of realistic marks so the principal can walk through every screen during the visit.'
              : 'Entries are yours. Nothing here was generated.'),
        ),
        el('div', { class: 'split wrap' },
          el('button', {
            class: 'btn', disabled: app.mode === 'demo',
            onclick: () => app.setMode('demo'),
          }, iconEl('refresh'), 'Load sample data'),
          el('button', {
            class: 'btn btn-danger',
            onclick: () => {
              if (confirm('Clear every mark and remark and start a fresh live record? The teacher list is kept.')) app.setMode('live');
            },
          }, iconEl('minus'), 'Clear for live entry'),
        ),
        el('div', { class: 'note mt10' },
          el('b', {}, 'Recommendation: '), 'run the visit on the sample set, then clear it once the office has seen the screens.'),
      ),
    }),
    card({
      title: 'Storage at a glance',
      body: el('div', { class: 'kv' },
        el('dt', {}, 'Teachers'), el('dd', {}, String(app.state.teachers.length)),
        el('dt', {}, 'Marks recorded'), el('dd', {}, cells.toLocaleString('en-GB')),
        el('dt', {}, 'Remarks'), el('dd', {}, String(Object.keys(app.state.observations || {}).length)),
        el('dt', {}, 'Undertakings'), el('dd', {}, String((app.state.actions || []).length)),
        el('dt', {}, 'Last saved'), el('dd', {}, app.state.updatedAt ? fmtDate(app.state.updatedAt.slice(0, 10)) : '—'),
        el('dt', {}, 'Browser storage'), el('dd', {}, `${(JSON.stringify(app.state).length / 1024).toFixed(1)} KB`),
      ),
    }),
  ));

  /* cloud */
  root.append(card({
    title: 'Google Workspace',
    sub: 'Sheets for the record, Drive for the signed papers',
    body: el('div', { class: 'grid g-3' },
      el('div', { class: 'card card-pad', style: 'background:var(--paper-2)' },
        el('div', { class: 'split' }, el('span', { style: 'color:var(--green-700)', html: icon('sheet') }),
          el('div', { class: 'bold' }, 'Monthly workbook')),
        el('div', { class: 'note mt6' }, 'Summary, Teachers, Daily checklist, Attendance register, Improvement register and Rubric — six tabs in the printed column order.'),
        el('button', { class: 'btn btn-sm btn-primary mt10', onclick: () => pushToSheets(app) }, 'Open sync panel')),
      el('div', { class: 'card card-pad', style: 'background:var(--paper-2)' },
        el('div', { class: 'split' }, el('span', { style: 'color:var(--green-700)', html: icon('drive') }),
          el('div', { class: 'bold' }, 'Drive archive')),
        el('div', { class: 'note mt6' }, 'One folder for the signed school report, the individual findings and the monthly workbook.'),
        el('button', { class: 'btn btn-sm mt10', onclick: () => openDrivePanel(app) }, 'Open archive panel')),
      el('div', { class: 'card card-pad', style: 'background:var(--paper-2)' },
        el('div', { class: 'split' }, el('span', { style: 'color:var(--green-700)', html: icon('download') }),
          el('div', { class: 'bold' }, 'Quick export')),
        el('div', { class: 'note mt6' }, 'Download the whole workbook as a single CSV with a tab heading before each block.'),
        el('button', { class: 'btn btn-sm mt10', onclick: () => downloadWorkbook(app) }, 'Download CSV')),
    ),
  }));

  /* backup */
  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', style: 'display:none',
    onchange: (e) => { if (e.target.files[0]) app.importBackup(e.target.files[0]); e.target.value = ''; },
  });

  root.append(el('div', { class: 'mt14' }, card({
    title: 'Backup and restore',
    sub: 'A single JSON file holds every mark, remark and undertaking',
    body: el('div', { class: 'split wrap' },
      el('button', { class: 'btn', onclick: () => app.exportBackup() }, iconEl('download'), 'Download backup'),
      el('button', { class: 'btn', onclick: () => fileInput.click() }, iconEl('upload'), 'Restore from backup'),
      fileInput,
      el('span', { class: 'spacer', style: 'flex:1' }),
      el('button', {
        class: 'btn btn-danger',
        onclick: () => { if (confirm('Reset the console to the sample dataset? This replaces everything currently stored.')) app.reset(); },
      }, iconEl('refresh'), 'Factory reset'),
    ),
    pad: true,
  })));

  /* rubric reference */
  root.append(el('div', { class: 'mt14' }, card({
    title: 'The rubric as printed, with the remedial action attached to each item',
    sub: 'Taken from page 1 of the inspection file',
    pad: false,
    body: el('div', { class: 'table-wrap' }, el('table', { class: 'data' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Item'), el('th', {}, 'Urdu'), el('th', {}, 'Pillar'), el('th', { class: 'num' }, 'Max'),
        el('th', {}, 'Scoring options'), el('th', { style: 'min-width:280px' }, 'Remedial action'))),
      el('tbody', {}, ...ITEMS.map((i) => el('tr', {},
        el('td', {}, el('b', {}, i.en)),
        el('td', { style: 'direction:rtl' }, i.ur),
        el('td', { class: 'tiny muted' }, i.pillar),
        el('td', { class: 'num' }, String(i.max)),
        el('td', { class: 'tiny' }, i.options.map((o) => `${o.label} = ${o.pts}`).join(' · ')),
        el('td', { class: 'small muted' }, i.remedy),
      ))),
    )),
  })));

  return root;
}
