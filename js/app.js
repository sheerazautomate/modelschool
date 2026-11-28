/* =========================================================================
   App shell: state, routing, and the render loop.
   ========================================================================= */

import { SCHOOL, ITEMS } from './data.js';
import {
  ensurePeriod, buildPeriod, monthKey, latestOpenDay, monthLabel,
} from './period.js';
import {
  load, save, blankState, generateDemo, clearStorage, setMark,
  setObservation, addAction, removeAction, toggleActionDone, saveNote,
  exportState, normalizeImport,
} from './store.js';
import { computeSchool, computeTeacher, gradeFor, statusTone } from './scoring.js';
import { $, $$, el, toast, downloadFile, fmtDateLong } from './util.js';
import { icon, iconEl } from './icons.js';
import { ensure as ensureSync, seedStamps, newOp, pending } from './ops.js';
import * as bridge from './bridge.js';

import { renderDashboard } from './views/dashboard.js';
import { renderRegister } from './views/register.js';
import { renderLeaderboard } from './views/leaderboard.js';
import { renderEntry } from './views/entry.js';
import { renderActions } from './views/actions.js';
import { renderReports } from './views/reports.js';
import { renderData } from './views/data.js';
import { openTeacherDrawer, closeTeacherDrawer } from './views/teacher.js';
import { printCurrentReport } from './views/reports.js';
import { workbook } from './sync.js';

const VIEWS = {
  dashboard: { label: 'Overview', icon: 'dashboard', group: 'Monitor', render: renderDashboard },
  leaderboard: { label: 'Teachers', icon: 'users', group: 'Monitor', render: renderLeaderboard },
  register: { label: 'Attendance Register', icon: 'table', group: 'Monitor', render: renderRegister },
  entry: { label: 'Daily Checklist', icon: 'checklist', group: 'Record', render: renderEntry },
  actions: { label: 'Improvement Plans', icon: 'target', group: 'Record', render: renderActions },
  reports: { label: 'Reports', icon: 'print', group: 'Produce', render: renderReports },
  data: { label: 'Data & Sync', icon: 'sheet', group: 'Produce', render: renderData },
};

export const App = {
  state: null,
  mode: 'demo',
  view: 'dashboard',
  params: {},
  selectedDay: null,
  search: '',
  filters: { grade: 'all', week: 'all', pillar: 'all', sort: 'composite', dir: 'desc' },
  listeners: [],

  init() {
    const saved = load();
    if (saved) {
      this.state = saved;
      this.mode = saved.mode || 'demo';
    } else {
      this.state = generateDemo(blankState());
      this.mode = 'demo';
      save(this.state);
    }
    ensureSync(this.state);
    seedStamps(this.state);
    /* A save from an earlier build has no period. Repair it before anything
       reads a day, or every screen would render an empty month. */
    this.state.period = ensurePeriod(this.state);
    this.selectedDay = latestOpenDay(this.state.period.days);
    bridge.loadSettings();
    this.recompute();
    this.mount();
    this.startSync();
  },

  /* --- sync ----------------------------------------------------------- */

  /* Queue a change for the sheet. Local save happens immediately either way,
     so marking never waits for the network. */
  track(op) {
    bridge.queue(this.state, op);
    this.updateSyncChip();
    if (bridge.isConnected()) bridge.schedule(this);
    return op;
  },

  startSync() {
    bridge.subscribe(() => this.updateSyncChip());
    this.updateSyncChip();
    if (!bridge.isConnected()) return;
    this.syncNow({ quiet: true });
    clearInterval(this._syncTimer);
    this._syncTimer = setInterval(() => {
      if (!bridge.isConnected()) return;
      if (pending(this.state)) bridge.push(this).catch(() => {});
      else this.syncNow({ quiet: true, push: false }).catch(() => {});
    }, 60000);
    window.addEventListener('online', () => this.syncNow({ quiet: true }).catch(() => {}));
  },

  /* One round trip: send what is queued, then read what others sent. */
  async syncNow({ quiet = true, push = true } = {}) {
    if (!bridge.isConnected()) return { skipped: true };
    try {
      if (push && pending(this.state)) await bridge.push(this, { quiet });
      const res = await bridge.pull(this, { apply: true });
      if (res.changed) {
        this.recompute();
        save(this.state);
        this.render();
        toast(`Updated from the sheet — ${res.changed} change${res.changed === 1 ? '' : 's'}.`);
      }
      this.updateSyncChip();
      return res;
    } catch (err) {
      if (!quiet) toast(err.message, 'error');
      this.updateSyncChip();
      return { error: err.message };
    }
  },

  /* Send the readable tabs along with the next push, so the spreadsheet shows
     the same tables the principal sees. */
  async pushWorkbook() {
    if (!bridge.isConnected()) { toast('Connect the sheet first.', 'error'); return; }
    const tabs = workbook(this);
    try {
      await bridge.push(this, { tabs, quiet: false });
      toast('Workbook written to the sheet.');
    } catch (err) {
      toast(err.message, 'error');
    }
  },

  recompute() {
    const days = this.state.period?.days || [];
    this.school = computeSchool(this.state.teachers, this.state, days);
    this.records = Object.fromEntries(this.school.records.map((r) => [r.id, r]));
  },

  /* --- period --------------------------------------------------------- */

  get days() { return this.state.period?.days || []; },
  get weeks() { return this.state.period?.weeks || []; },
  get periodLabel() { return this.state.period?.label || monthLabel(monthKey()); },

  /* Switching month changes which days are markable. It does not delete
     anything: marks already recorded against other months stay in state. */
  setPeriod(key) {
    const holidays = this.state.period?.holidays || [];
    this.state.period = buildPeriod(key, holidays);
    this.selectedDay = latestOpenDay(this.state.period.days);
    this.params = {};
    this.commit();
    toast(`Now recording ${this.state.period.label}.`);
  },

  /* Begin a real month. Distinct from clearStorage(): it keeps the roster,
     the remarks and the sheet connection, and only removes the sample marks
     for the chosen period. */
  startLive(key) {
    const base = blankState(key);
    base.teachers = this.state.teachers;
    base.observations = this.state.observations || {};
    base.actions = this.state.actions || [];
    base.notes = this.state.notes || {};
    base.period = buildPeriod(key, this.state.period?.holidays || []);
    base.mode = 'live';
    /* Unsent mark operations describe the sample marks that were just
       cleared. Keeping them would push those marks back into the sheet and
       undo the reset, so they are dropped. Remarks, undertakings and the
       cursor are kept: those are real work and nothing depends on the marks. */
    const sync = this.state.sync || {};
    base.sync = {
      ...sync,
      ops: (sync.ops || []).filter((o) => o.kind !== 'mark'),
    };
    this.state = base;
    this.mode = 'live';
    this.selectedDay = latestOpenDay(this.state.period.days);
    this.params = {};
    this.commit();
    toast(`${monthLabel(key)} is ready for real entry.`);
    this.navigate('entry');
  },

  setHolidays(list) {
    const key = this.state.period?.key || monthKey();
    this.state.period = buildPeriod(key, list);
    if (!this.state.period.days.includes(this.selectedDay)) {
      this.selectedDay = latestOpenDay(this.state.period.days);
    }
    this.commit();
    toast(`Saved — ${this.state.period.days.length} school days this month.`);
  },

  commit({ rerender = true, quiet = true } = {}) {
    this.recompute();
    save(this.state);
    if (rerender) this.render();
    this.listeners.forEach((fn) => fn());
    if (!quiet) toast('Saved.');
  },

  on(fn) { this.listeners.push(fn); },
  off(fn) { this.listeners = this.listeners.filter((f) => f !== fn); },

  navigate(view, params = {}) {
    if (!VIEWS[view]) view = 'dashboard';
    this.view = view;
    this.params = params;
    if (location.hash.slice(1) !== view) history.replaceState(null, '', `#${view}`);
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  teacher(id) { return this.state.teachers.find((t) => t.id === id); },
  record(id) { return this.records[id]; },

  /* Marking must never rebuild the screen the principal is working in —
     only the numbers that depend on the mark are refreshed by the caller. */
  setMark(teacherId, day, itemKey, value) {
    const ts = bridge.now(this.state);
    setMark(this.state, teacherId, day, itemKey, value);
    ensureSync(this.state).stamps.marks[`${teacherId}|${day}|${itemKey}`] = ts;
    this.commit({ rerender: false });
    this.track(newOp('mark', { teacherId, day, itemKey, value: value === '' ? null : Number(value) }, ts));
  },

  setRemark(teacherId, text) {
    const ts = bridge.now(this.state);
    setObservation(this.state, teacherId, text);
    ensureSync(this.state).stamps.obs[teacherId] = ts;
    this.commit();
    this.track(newOp('remark', { teacherId, text }, ts));
    toast('Official remark recorded.');
  },

  newAction(action) {
    const ts = bridge.now(this.state);
    addAction(this.state, action);
    this.commit();
    this.track(newOp('action.add', { action }, ts));
  },
  toggleAction(id) {
    const ts = bridge.now(this.state);
    toggleActionDone(this.state, id);
    const a = (this.state.actions || []).find((x) => x.id === id);
    this.commit();
    this.track(newOp('action.done', { actionId: id, done: a ? !!a.done : null }, ts));
  },
  deleteAction(id) {
    const ts = bridge.now(this.state);
    removeAction(this.state, id);
    this.commit();
    this.track(newOp('action.del', { actionId: id }, ts));
  },

  setMode(mode) {
    if (mode === 'demo') {
      this.state = generateDemo(this.state);
    } else {
      const next = blankState();
      next.teachers = this.state.teachers;
      next.meta = this.state.meta;
      this.state = next;
    }
    this.mode = mode;
    this.state.mode = mode;
    ensureSync(this.state).stamps = { marks: {}, obs: {}, actions: {}, notes: {} };
    this.commit();
    toast(mode === 'demo' ? 'Sample dataset loaded.' : 'Cleared — ready for live entry.');
  },

  exportBackup() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`GBMHS-Layyah-monitoring-${stamp}.json`, exportState(this.state));
    toast('Backup downloaded.');
  },

  async importBackup(file) {
    try {
      const text = await file.text();
      const data = normalizeImport(JSON.parse(text));
      this.state = data;
      this.mode = data.mode === 'demo' ? 'demo' : 'live';
      ensureSync(this.state);
      seedStamps(this.state);
      this.commit();
      toast('Backup restored.');
    } catch (err) {
      toast(`Could not import: ${err.message}`, 'error');
    }
  },

  reset() {
    clearStorage();
    this.state = generateDemo(blankState());
    this.mode = 'demo';
    save(this.state);
    this.commit();
    toast('Reset to the sample dataset.');
  },

  mount() {
    const nav = this.buildNav();
    const mast = this.buildMasthead();
    document.body.innerHTML = '';
    const shell = el('div', { class: 'app' });
    shell.append(mast, nav, el('main', { id: 'main' }));
    document.body.append(shell, el('div', { id: 'print-root' }));
    const backdrop = el('div', { class: 'drawer-backdrop', id: 'drawer-backdrop', onclick: closeTeacherDrawer });
    const drawer = el('div', { class: 'drawer', id: 'drawer' });
    document.body.append(backdrop, drawer);

    if (location.hash) {
      const v = location.hash.slice(1);
      if (VIEWS[v]) this.view = v;
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTeacherDrawer();
        document.getElementById('modal-host')?.classList.remove('open');
      }
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
        const box = document.querySelector('.searchbox .input');
        if (box) { e.preventDefault(); box.focus(); }
      }
    });
    this.render();
  },

  buildMasthead() {
    const ident = el('div', { class: 'ident' },
      el('div', { class: 'school' }, SCHOOL.name),
      el('div', { class: 'sub' }, `EMIS ${SCHOOL.emis} · Monitoring Console`),
    );
    const modeChip = el('span', { class: `chip-mode ${this.mode}`, id: 'mode-chip' },
      el('span', { class: 'dot' }), this.mode === 'demo' ? 'Sample data' : 'Live data');
    const syncChip = el('button', {
      class: 'chip-sync off', id: 'sync-chip', title: 'Google Sheets sync',
      onclick: () => this.navigate('data'),
    }, el('span', { class: 'dot' }), el('span', { id: 'sync-text' }, 'Sheet: off'));
    const btns = el('div', { class: 'mh-actions' },
      syncChip,
      el('button', {
        class: 'btn btn-sm',
        title: 'Print the monthly school report for this period',
        onclick: () => { this.navigate('reports'); setTimeout(() => printCurrentReport(), 120); },
      }, iconEl('print'), 'Print report'),
      modeChip,
    );
    return el('header', { class: 'masthead' },
      el('div', { class: 'crest' }, 'GB'),
      ident,
      el('div', { class: 'spacer' }),
      btns,
    );
  },

  buildNav() {
    const nav = el('nav', { class: 'nav' });
    const groups = new Map();
    Object.entries(VIEWS).forEach(([key, v]) => {
      if (!groups.has(v.group)) groups.set(v.group, []);
      groups.get(v.group).push([key, v]);
    });
    groups.forEach((items, group) => {
      nav.append(el('div', { class: 'nav-label' }, group));
      items.forEach(([key, v]) => {
        const b = el('button', {
          class: `nav-item${this.view === key ? ' active' : ''}`,
          dataset: { view: key },
          onclick: () => this.navigate(key),
        }, el('span', { html: icon(v.icon) }), v.label);
        if (key === 'actions') {
          const open = (this.state.actions || []).filter((a) => !a.done).length;
          if (open) b.append(el('span', { class: 'badge' }, String(open)));
        }
        if (key === 'leaderboard') {
          const atRisk = this.school.records.filter((r) => r.daysObserved && r.composite < 70).length;
          if (atRisk) b.append(el('span', { class: 'badge' }, String(atRisk)));
        }
        nav.append(b);
      });
    });
    nav.append(el('div', { class: 'nav-foot' },
      el('div', { style: 'font-weight:700;color:var(--ink-2)' }, SCHOOL.principal),
      el('div', {}, SCHOOL.principalTitle),
      el('div', { class: 'mt6' }, SCHOOL.monitorPeriod),
    ));
    return nav;
  },

  render() {
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === this.view));
    const main = $('#main');
    if (!main) return;
    main.innerHTML = '';
    main.className = 'fade-in';
    const view = VIEWS[this.view] || VIEWS.dashboard;
    try {
      main.append(view.render(this));
    } catch (err) {
      console.error(err);
      main.append(el('div', { class: 'empty' },
        el('div', { class: 'big' }, 'Something went wrong rendering this view'),
        el('div', { class: 'note' }, String(err.message || err))));
    }
    this.updateSyncChip();
    const chip = $('#mode-chip');
    if (chip) {
      chip.className = `chip-mode ${this.mode}`;
      chip.innerHTML = '';
      chip.append(el('span', { class: 'dot' }), this.mode === 'demo' ? 'Sample data' : 'Live data');
    }
  },

  updateSyncChip() {
    const chip = document.getElementById('sync-chip');
    const text = document.getElementById('sync-text');
    if (!chip || !text) return;
    const st = bridge.status;
    const queued = pending(this.state);
    const labels = {
      off: 'Sheet: off',
      idle: queued ? `Sheet: ${queued} queued` : 'Sheet: synced',
      syncing: 'Sheet: syncing…',
      error: 'Sheet: error',
    };
    chip.className = `chip-sync ${st.state}${queued && st.state === 'idle' ? ' queued' : ''}`;
    text.textContent = labels[st.state] || 'Sheet: off';
    chip.title = `${st.message}${st.lastPull ? ` · last read ${new Date(st.lastPull).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
  },

  openTeacher(id, tab = 'overview') {
    openTeacherDrawer(this, id, tab);
  },
};

export { VIEWS };
window.App = App;

App.init();
