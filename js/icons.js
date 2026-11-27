/* Minimal inline icon set (stroke-based, 24×24 viewBox). */
const P = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-5H3v5Zm10 0h8V11h-8v10Zm0-18v5h8V3h-8Z',
  table: 'M3 5h18v14H3V5Zm0 5h18M9 5v14M15 5v14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 7.6M18 14a7 7 0 0 1 3 6',
  check: 'M4 12.5 9 17.5 20 6.5',
  checklist: 'M9 6h12M9 12h12M9 18h12M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17',
  clipboard: 'M9 4h6v3H9V4Zm-2 1H5v16h14V5h-2M9 12h6M9 16h4',
  print: 'M7 9V4h10v5M7 18H5V9h14v9h-2M7 14h10v6H7v-6Z',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M4 19h16',
  upload: 'M12 16V5m0 0 4 4m-4-4-4 4M4 19h16',
  refresh: 'M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6',
  alert: 'M12 8v5m0 3v.5M10.3 3.9 2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z',
  trend: 'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5',
  scale: 'M12 3v18M5 7h14M7 7l-3 7h6L7 7Zm10 0-3 7h6l-3-7Z',
  book: 'M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Zm0 13h14',
  camera: 'M4 8h3l2-2h6l2 2h3v11H4V8Zm8 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  badge: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-2 9 2 2 4-4',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  board: 'M3 4h18v12H3V4Zm6 12v4m6-4v4M7 8h6m-6 3h10',
  bus: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10H4V6Zm0 10v3m16-3v3M4 11h16M8 16h.1M16 16h.1',
  calendar: 'M4 6h16v14H4V6Zm4-3v4m8-4v4M4 11h16',
  tie: 'M12 3 9 6l3 3 3-3-3-3Zm0 6v4m-2 8 2-8 2 8-2 1-2-1Z',
  coin: 'M12 3a4 4 0 0 0 0 8 4 4 0 0 0 0-8ZM6 21h12M8 21a4 4 0 0 1 8 0M12 11v6',
  note: 'M6 3h9l4 4v14H6V3Zm9 0v4h4M9 12h7M9 16h5',
  flag: 'M6 21V4m0 0 9 2-1 4 5 1-3 5H6',
  share: 'M8 12a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Zm13-6a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Zm0 12a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0ZM7.7 10.9l6.6-3.8M7.7 13.1l6.6 3.8',
  shirt: 'M8 3 4 6l2 3 2-1v13h8V8l2 1 2-3-4-3-2 2h-4L8 3Z',
  star: 'm12 3 2.7 5.8 6.3.8-4.6 4.3 1.2 6.1L12 17l-5.6 3 1.2-6.1L3 9.6l6.3-.8L12 3Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5.5-1.5L21 21',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9 6 6 6-6 6',
  chevronDown: 'm6 9 6 6 6-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.7l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.9-1.7L14.2 2h-4l-.4 2.5a8 8 0 0 0-2.9 1.7l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 3.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2.9 1.7l.4 2.6h4l.4-2.6a8 8 0 0 0 2.9-1.7l2.3 1 2-3.4-2-1.5c.1-.5.2-1.1.2-1.7Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v.5m0 3V16',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  edit: 'm4 20 4-1 10-10-3-3L5 16l-1 4Zm11-15 3 3',
  file: 'M6 3h8l4 4v14H6V3Zm8 0v4h4M9 13h6M9 17h4',
  building: 'M4 21V4h9v17M13 9h7v12M7 8h3M7 12h3M7 16h3M16 13h1M16 17h1',
  arrowUp: 'M12 20V5m0 0-5 5m5-5 5 5',
  arrowDown: 'M12 4v15m0 0 5-5m-5 5-5-5',
  arrowRight: 'M4 12h15m0 0-5-5m5 5-5 5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  sheet: 'M4 4h16v16H4V4Zm0 5h16M9 9v11M15 9v11M4 15h16',
  drive: 'm9 3 6 0 6 10-3 5H6l-3-5L9 3Zm0 0 6 10M15 3 9 13M3 13h18',
};

export function icon(name, cls = '') {
  const d = P[name] || P.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${cls}"><path d="${d}"/></svg>`;
}

export function iconEl(name, cls = '') {
  const wrap = document.createElement('span');
  wrap.innerHTML = icon(name, cls);
  return wrap.firstElementChild;
}
