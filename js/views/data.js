/* Data & Sync — the office controls: sample vs live, import/export, cloud. */

import { SCHOOL, ITEMS } from '../data.js';
import { el, fmtDate, plural, toast } from '../util.js';
import { icon, iconEl } from '../icons.js';
import { viewHead, card } from '../components.js';
import { workbook, pushToSheets, openDrivePanel, downloadWorkbook, modal } from '../sync.js';
import * as bridge from '../bridge.js';
import { pending } from '../ops.js';

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

  /* cloud — live bridge */
  root.append(connectionCard(app));

  /* cloud — manual routes */
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

/* --- live connection to the school's sheet ----------------------------- */

function connectionCard(app) {
  const connected = bridge.isConnected();
  const cfg = bridge.getSettings();
  const st = bridge.status;
  const queued = pending(app.state);
  const statusLine = (() => {
    if (!connected) return 'The console is saving to this browser only. Connect the school sheet to keep a cloud copy that every device reads from.';
    if (st.state === 'error') return st.message;
    if (st.state === 'syncing') return st.message;
    if (queued) return `${queued} change${queued === 1 ? '' : 's'} waiting to be sent.`;
    return 'Connected. Marks save here instantly and reach the sheet within a few seconds.';
  })();

  const urlInput = el('input', {
    class: 'input', type: 'url', id: 'bridge-url', placeholder: 'https://script.google.com/macros/s/…/exec',
    value: cfg.url || '', spellcheck: 'false',
  });
  const tokenInput = el('input', {
    class: 'input', type: 'text', id: 'bridge-token', placeholder: 'SYNC_TOKEN from Script Properties',
    value: cfg.token || '', spellcheck: 'false',
  });

  const msg = el('div', { class: 'note mt10', id: 'bridge-msg' });

  async function connect() {
    const url = urlInput.value.trim();
    const token = tokenInput.value.trim();
    if (!url) { msg.textContent = 'Paste the deployment URL first.'; return; }
    msg.textContent = 'Testing the deployment…';
    try {
      const res = await bridge.test(url, token);
      bridge.adopt(app, res);
      bridge.saveSettings({ enabled: true });
      msg.textContent = `Connected. ${res.ops || 0} change${res.ops === 1 ? '' : 's'} already in the sheet.`;
      const pulled = await bridge.pull(app, { apply: true });
      if (pulled.changed) {
        app.recompute();
        toast(`Pulled ${pulled.changed} existing change${pulled.changed === 1 ? '' : 's'} from the sheet.`);
      }
      if (pending(app.state)) await bridge.push(app, { quiet: false });
      app.render();
      toast('Sheet connected.');
    } catch (err) {
      bridge.saveSettings({ enabled: false });
      msg.textContent = err.message;
      app.updateSyncChip();
    }
  }

  const buttons = connected
    ? el('div', { class: 'split wrap' },
      el('button', { class: 'btn btn-primary', onclick: async () => { await app.syncNow({ quiet: false }); app.render(); } },
        iconEl('refresh'), 'Sync now'),
      el('button', { class: 'btn', onclick: () => app.pushWorkbook() }, iconEl('sheet'), 'Write workbook tabs'),
      el('button', {
        class: 'btn',
        onclick: () => saveReportToDrive(app),
      }, iconEl('drive'), 'Save report to Drive'),
      el('button', {
        class: 'btn btn-ghost',
        onclick: () => { if (confirm('Disconnect the sheet? Marks stay on this device and the sheet keeps everything already sent.')) { bridge.disconnect(); app.render(); } },
      }, 'Disconnect'),
    )
    : el('div', { class: 'split wrap' },
      el('button', { class: 'btn btn-primary', onclick: connect }, iconEl('drive'), 'Connect and test'),
      el('button', { class: 'btn btn-ghost', onclick: () => openSetupGuide() }, iconEl('info'), 'How to set this up'),
    );

  return card({
    title: 'Google Sheets storage',
    sub: connected ? 'Live — every mark is written to the school workbook' : 'Not connected yet',
    body: el('div', {},
      el('div', { class: `flag ${connected ? (st.state === 'error' ? 'red' : 'green') : 'amber'} mb12` },
        el('span', { class: 'dot' }),
        el('span', { id: 'bridge-status' }, statusLine)),
      connected
        ? el('div', { class: 'kv mb12' },
          el('dt', {}, 'Deployment'), el('dd', { class: 'tiny' }, el('code', {}, (cfg.url || '').replace('https://', '').slice(0, 52) + '…')),
          el('dt', {}, 'Last read'), el('dd', {}, st.lastPull ? new Date(st.lastPull).toLocaleString('en-GB') : '—'),
          el('dt', {}, 'Last write'), el('dd', {}, st.lastPush ? new Date(st.lastPush).toLocaleString('en-GB') : '—'),
          el('dt', {}, 'Change log position'), el('dd', {}, String(app.state.sync?.since || 0)),
          el('dt', {}, 'Clock offset'), el('dd', {}, `${Math.round(app.state.sync?.skew || 0)} ms`),
        )
        : el('div', { class: 'grid g-2 mb12', style: 'gap:10px' },
          el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Deployment URL'), urlInput),
          el('label', { class: 'field' }, el('span', { class: 'field-label' }, 'Sync token'), tokenInput),
        ),
      buttons,
      msg,
      el('div', { class: 'note mt10' },
        el('b', {}, 'What this means for the record: '),
        'the sheet is the shared copy. Every device that connects with the same URL and token reads the same marks, and changes merge by timestamp — the most recent edit to a cell wins, and nothing else is overwritten.'),
    ),
  });
}

async function saveReportToDrive(app) {
  const node = document.querySelector('#main .report-sheet');
  if (!node) {
    toast('Open Reports first, then save the sheet shown there.', 'error');
    return;
  }
  const cfg = bridge.getSettings();
  if (!bridge.isConnected()) { toast('Connect the sheet first.', 'error'); return; }
  const name = `Monitoring report — ${new Date().toISOString().slice(0, 10)}`;
  try {
    const css = Array.from(document.styleSheets).map((sheet) => {
      try { return Array.from(sheet.cssRules).map((r) => r.cssText).join('\n'); } catch { return ''; }
    }).join('\n');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${name}</title><style>${css}</style></head><body>${node.outerHTML}</body></html>`;
    const res = await bridge.saveFile({ name: `${name}.html`, content: html, mimeType: 'text/html' });
    toast(res?.url ? 'Report saved to the Drive folder.' : 'Report sent — check the Drive folder.');
  } catch (err) {
    toast(err.message || 'Could not save to Drive.', 'error');
  }
}

function openSetupGuide() {
  modal({
    title: 'Connect the school sheet',
    body: el('div', { class: 'prose' },
      el('p', {}, 'This is done once, in the school workbook. It takes about five minutes.'),
      el('ol', { class: 'steps' },
        el('li', {}, el('b', {}, 'Open the workbook '), 'and choose Extensions → Apps Script.'),
        el('li', {}, el('b', {}, 'Paste the bridge script'), ' into Code.gs, replacing what is there. ',
          el('button', {
            class: 'btn btn-sm',
            onclick: async () => {
              try {
                const text = await (await fetch('apps-script/Code.gs')).text();
                await navigator.clipboard.writeText(text);
                toast('Script copied — paste it into Code.gs.');
              } catch {
                toast('Could not copy here. The file is apps-script/Code.gs in the project folder.', 'error');
              }
            },
          }, iconEl('file'), 'Copy the script')),
        el('li', {}, el('b', {}, 'Run the setup function '), 'once from the editor. It creates the log tabs and prints your token — approve the permissions prompt.'),
        el('li', {}, el('b', {}, 'Deploy → New deployment → Web app'), ', execute as ', el('i', {}, 'me'), ', access ', el('i', {}, 'Anyone'), '. Copy the /exec URL.'),
        el('li', {}, el('b', {}, 'Paste the URL and the token'), ' here and press Connect.'),
      ),
      el('div', { class: 'flag amber mt12' },
        el('span', { class: 'dot' }),
        el('span', {}, 'Set access to "Anyone" so the browser can reach it — the token is what keeps it private, not the Google sign-in. Do not put the token in a public document.')),
      el('p', { class: 'tiny muted' }, 'Full instructions, including how to change the token, are in apps-script/README.md.'),
    ),
    actions: [{ label: 'Close', primary: true }],
  });
}
