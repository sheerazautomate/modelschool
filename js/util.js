/* Shared helpers: DOM, formatting, deterministic random, dates. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* Append a node or a (possibly nested) array of nodes safely. */
export function appendAll(node, ...children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const pct = (n) => `${Math.round(n)}%`;
export const round = (n, d = 0) => Number(n.toFixed(d));
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

export function fmtDate(iso, opts = { day: '2-digit', month: 'short' }) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', opts);
}
export function fmtDateLong(iso) {
  return fmtDate(iso, { day: '2-digit', month: 'long', year: 'numeric' });
}
export function weekday(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
}
export function dow(iso) {
  return new Date(`${iso}T00:00:00`).getDay();
}
export function initials(name) {
  const cleaned = name.replace(/^(Mr\.|Mrs\.|Miss|Ms\.|Dr\.)\s*/i, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/* mulberry32 — tiny deterministic PRNG so demo data is stable across reloads */
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Gaussian-ish noise in [-1, 1] from a uniform generator */
export function noise(r, spread = 0.12) {
  return ((r() + r() + r()) / 3 - 0.5) * 2 * spread;
}

export function debounce(fn, ms = 220) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function downloadFile(name, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

let toastTimer;
export function toast(message, kind = 'info') {
  let host = $('#toast-host');
  if (!host) {
    host = el('div', { id: 'toast-host', class: 'toast-host' });
    document.body.append(host);
  }
  host.innerHTML = '';
  const node = el('div', { class: `toast toast-${kind}` }, message);
  host.append(node);
  requestAnimationFrame(() => node.classList.add('in'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.classList.remove('in');
    setTimeout(() => node.remove(), 250);
  }, 3200);
}

export function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCSV(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}
