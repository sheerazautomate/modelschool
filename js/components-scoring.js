/* The rubric marking panel — used by the daily checklist view and the
   teacher case-file drawer. One shared implementation keeps marking
   behaviour identical wherever the principal touches it. */

import { ITEMS, PILLARS, MAX_TOTAL } from './data.js';
import { el, fmtDate, weekday, round } from './util.js';
import { icon } from './icons.js';
import { dayFilledCount, getMark, isDayComplete } from './scoring.js';
import { scoreColor } from './charts.js';

export function dayStrip(app, teacherId, selectedDay, onSelect) {
  const strip = el('div', { class: 'day-strip' });
  (app.days || []).forEach((d) => {
    const filled = dayFilledCount(app.state, teacherId, d);
    const complete = filled === ITEMS.length;
    const today = d === new Date().toISOString().slice(0, 10);
    strip.append(el('button', {
      class: `day-chip ${d === selectedDay ? 'on' : ''} ${complete ? 'complete' : filled ? 'partial' : ''}${today ? ' today' : ''}`,
      dataset: { day: d },
      onclick: () => onSelect(d),
      title: `${fmtDate(d, { day: '2-digit', month: 'short', year: 'numeric' })} — ${filled}/${ITEMS.length} items marked`,
    },
      fmtDate(d),
      el('span', { class: 'wd' }, weekday(d)),
    ));
  });
  return strip;
}

export function rubricPanel(app, teacherId, day, { onChange, compact = false } = {}) {
  const wrap = el('div');
  const rerender = () => {
    wrap.innerHTML = '';
    wrap.append(build());
  };

  const build = () => {
    const box = el('div');
    const filled = dayFilledCount(app.state, teacherId, day);
    const total = ITEMS.reduce((s, i) => {
      const v = getMark(app.state, teacherId, day, i.key);
      return s + (v === null ? 0 : v);
    }, 0);
    const possible = ITEMS.reduce((s, i) => {
      const v = getMark(app.state, teacherId, day, i.key);
      return s + (v === null ? 0 : i.max);
    }, 0);
    const p = possible ? (total / possible) * 100 : null;

    box.append(el('div', {
      class: 'split',
      style: 'position:sticky;top:0;z-index:4;background:var(--paper);padding:10px 0 12px;border-bottom:1px solid var(--line);margin-bottom:12px;gap:14px;flex-wrap:wrap',
    },
      el('div', {},
        el('div', { style: 'font-family:var(--serif);font-size:17px;font-weight:600' },
          fmtDate(day, { day: '2-digit', month: 'long', year: 'numeric' })),
        el('div', { class: 'tiny muted' }, `${weekday(day)} · ${filled} of ${ITEMS.length} items marked`),
      ),
      el('div', { style: 'flex:1;min-width:120px' },
        el('div', { class: 'meter' },
          el('i', { style: `width:${p === null ? 0 : p}%;background:${scoreColor(p)}` })),
        el('div', { class: 'tiny muted mt6' }, `${total} of ${possible} points marked`),
      ),
      el('div', { style: 'text-align:right' },
        el('div', { style: `font-family:var(--serif);font-size:26px;font-weight:600;line-height:1;color:${scoreColor(p)}` },
          p === null ? '—' : `${Math.round(p)}%`),
        el('div', { class: 'tiny muted' }, 'for the day'),
      ),
      el('button', {
        class: 'btn btn-sm',
        title: 'Mark every item as its top option',
        onclick: () => {
          ITEMS.forEach((i) => app.setMark(teacherId, day, i.key, i.max));
          rerender();
          onChange?.();
        },
      }, 'Mark all full'),
      el('button', {
        class: 'btn btn-sm btn-danger',
        title: 'Clear this day',
        onclick: () => {
          ITEMS.forEach((i) => app.setMark(teacherId, day, i.key, null));
          rerender();
          onChange?.();
        },
      }, 'Clear day'),
    ));

    if (compact) {
      // dense two-column layout for the drawer
      const grid = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' });
      ITEMS.forEach((item) => grid.append(itemCard(app, teacherId, day, item, rerender, onChange)));
      box.append(grid);
    } else {
      ITEMS.forEach((item) => box.append(itemCard(app, teacherId, day, item, rerender, onChange)));
    }
    return box;
  };

  wrap.append(build());
  return wrap;
}

function itemCard(app, teacherId, day, item, rerender, onChange) {
  const cur = getMark(app.state, teacherId, day, item.key);
  const cls = cur === null ? '' : cur === 0 ? 'zero' : 'scored';
  const card = el('div', { class: `rubric-item ${cls}` });

  card.append(el('div', { class: 'rubric-top' },
    el('div', { style: 'flex:1;min-width:0' },
      el('div', { class: 'en' }, item.en),
      el('div', { class: 'ur' }, item.ur),
      el('div', { class: 'hint' }, item.hint)),
    el('div', { class: 'max', style: `border:1px solid var(--line);padding:1px 7px;border-radius:99px;color:${cur === 0 ? 'var(--red)' : cur === null ? 'var(--ink-3)' : 'var(--green-700)'}` },
      cur === null ? `0/${item.max}` : `${cur}/${item.max}`),
  ));

  const opts = el('div', { class: 'opts' });
  [...item.options].sort((a, b) => a.pts - b.pts).forEach((o) => {
    const on = cur === o.pts;
    opts.append(el('button', {
      class: `opt ${on ? 'on' : ''} ${on && o.pts === 0 ? 'zero' : ''}`,
      onclick: () => {
        app.setMark(teacherId, day, item.key, on ? null : o.pts);
        rerender();
        onChange?.();
      },
    }, o.label, el('span', { class: 'pt' }, `${o.pts}`)));
  });
  card.append(opts);
  return card;
}
