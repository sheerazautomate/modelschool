/* =========================================================================
   Periods — which working days the console is recording against.

   The inspection file covered October 2026 only, so the first build hardcoded
   those 22 dates. That made the console a demo: no day after 30 October could
   be marked, and the whole app had to be rebuilt to start a new month.

   A period is a calendar month plus the days the school actually worked in it.
   Everything downstream — the day strip, coverage, weekly blocks, the workbook
   — derives its dates from here, so a new month needs no code change.
   ========================================================================= */

/* The school works Monday to Friday. Page 1 of the inspection file has no
   entries for 3 and 4 October 2026 (Saturday and Sunday), which is where this
   rule comes from. */
export const WORK_DAYS = [1, 2, 3, 4, 5];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function monthParts(key) {
  const [y, m] = String(key).split('-').map(Number);
  return { year: y, month: m };
}

/* Every date in the month that is a school day and not a declared holiday. */
export function workingDaysFor(key, holidays = []) {
  const { year, month } = monthParts(key);
  const skip = new Set(holidays || []);
  const total = new Date(year, month, 0).getDate();
  const days = [];
  for (let d = 1; d <= total; d += 1) {
    const date = new Date(year, month - 1, d);
    if (!WORK_DAYS.includes(date.getDay())) continue;
    const iso = `${year}-${pad(month)}-${pad(d)}`;
    if (skip.has(iso)) continue;
    days.push(iso);
  }
  return days;
}

/* Group into Monday-start weeks, the way the printed attendance sheet runs. */
export function weeksOf(days) {
  if (!days.length) return [];
  const groups = [];
  let current = [];
  let weekStart = null;

  for (const iso of days) {
    const date = new Date(`${iso}T00:00:00`);
    const monday = new Date(date);
    const shift = (date.getDay() + 6) % 7; // Monday = 0
    monday.setDate(date.getDate() - shift);
    const key = monday.toISOString().slice(0, 10);

    if (weekStart === null) weekStart = key;
    if (key !== weekStart) {
      groups.push({ days: current, start: weekStart });
      current = [];
      weekStart = key;
    }
    current.push(iso);
  }
  if (current.length) groups.push({ days: current, start: weekStart });

  return groups.map((g, i) => ({
    key: `w${i + 1}`,
    label: `Week ${i + 1}`,
    range: rangeLabel(g.days),
    days: g.days,
  }));
}

function rangeLabel(days) {
  if (!days.length) return '';
  const first = new Date(`${days[0]}T00:00:00`);
  const last = new Date(`${days[days.length - 1]}T00:00:00`);
  const fmt = (d) => d.getDate();
  const mon = MONTH_NAMES[last.getMonth()].slice(0, 3);
  if (days.length === 1) return `${fmt(first)} ${mon}`;
  return `${fmt(first)}–${fmt(last)} ${mon}`;
}

export function periodLabel(key) {
  const { year, month } = monthParts(key);
  const total = new Date(year, month, 0).getDate();
  return `01 ${MONTH_NAMES[month - 1]} ${year} — ${pad(total)} ${MONTH_NAMES[month - 1]} ${year}`;
}

export function monthLabel(key) {
  const { year, month } = monthParts(key);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function monthShort(key) {
  const { year, month } = monthParts(key);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`;
}

/* For the month switcher: this month and the eleven before it. */
export function monthChoices(count = 13, from = new Date()) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: monthLabel(monthKey(d)) });
  }
  return out;
}

/* The period object the rest of the app reads. Kept on state so it syncs and
   survives a reload; nothing downstream should compute dates itself. */
export function buildPeriod(key, holidays = []) {
  const days = workingDaysFor(key, holidays);
  return {
    key,
    label: monthLabel(key),
    range: periodLabel(key),
    days,
    weeks: weeksOf(days),
    holidays: holidays.slice(),
  };
}

/* Repair or create the period block on a state object. */
export function ensurePeriod(state, fallbackKey = monthKey()) {
  const existing = state?.period;
  if (existing && existing.key && Array.isArray(existing.days) && existing.days.length) {
    const rebuilt = buildPeriod(existing.key, existing.holidays || []);
    /* A holiday added elsewhere must not leave stale days behind. */
    if (rebuilt.days.join() !== existing.days.join()) return rebuilt;
    existing.weeks ||= rebuilt.weeks;
    existing.label ||= rebuilt.label;
    existing.range ||= rebuilt.range;
    return existing;
  }
  return buildPeriod(fallbackKey);
}

export function addMonths(key, delta) {
  const { year, month } = monthParts(key);
  const d = new Date(year, month - 1 + delta, 1);
  return monthKey(d);
}

/* The first day that has not happened yet, or the last working day if the
   month is over. This is what the marking screen should open on. */
export function latestOpenDay(days, today = new Date()) {
  if (!days.length) return null;
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const past = days.filter((d) => d <= todayIso);
  return past.length ? past[past.length - 1] : days[0];
}

export { MONTH_NAMES };
