/* =========================================================================
   App shell: state, routing, and the render loop.
   ========================================================================= */

import { SCHOOL, WORKING_DAYS, ITEMS } from './data.js';
import {
  load, save, blankState, generateDemo, clearStorage, setMark,
  setObservation, addAction, removeAction, toggleActionDone, saveNote,
  exportState, normalizeImport,
} from './store.js';
import { computeSchool, computeTeacher, gradeFor, statusTone } from './scoring.js';
import { $, $$, el, toast, downloadFile, fmtDateLong } from './util.js';
import { icon, iconEl } from './icons.js';

import { renderDashboard } from './views/dashboard.js';
import { renderRegister } from './views/register.js';
import { renderLeaderboard } from './views/leaderboard.js';
import { renderEntry } from './views/entry.js';
import { renderActions } from './views/actions.js';
import { renderReports } from './views/reports.js';
import { renderData } from './views/data.js';
import { openTeacherDrawer, closeTeacherDrawer } from './views/teacher.js';
import { printCurrentReport } from './views/reports.js';

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
  selectedDay: WORKING_DAYS[WORKING_DAYS.length - 1],
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
    this.recompute();
    this.mount();
  },

  recompute() {
    this.school = computeSchool(this.state.teachers, this.state);
    this.records = Object.fromEntries(this.school.records.map((r) => [r.id, r]));
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
    setMark(this.state, teacherId, day, itemKey, value);
    this.commit({ rerender: false });
  },

  setRemark(teacherId, text) {
    setObservation(this.state, teacherId, text);
    this.commit();
    toast('Official remark recorded.');
  },

  newAction(action) {
    addAction(this.state, action);
    this.commit();
  },
  toggleAction(id) { toggleActionDone(this.state, id); this.commit(); },
  deleteAction(id) { removeAction(this.state, id); this.commit(); },

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
    const btns = el('div', { class: 'mh-actions' },
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
    const chip = $('#mode-chip');
    if (chip) {
      chip.className = `chip-mode ${this.mode}`;
      chip.innerHTML = '';
      chip.append(el('span', { class: 'dot' }), this.mode === 'demo' ? 'Sample data' : 'Live data');
    }
  },

  openTeacher(id, tab = 'overview') {
    openTeacherDrawer(this, id, tab);
  },
};

export { VIEWS };
window.App = App;

App.init();
