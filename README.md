# Monitoring Console — Govt. Boys Model High School, Layyah

A principal's console for attendance tracking and teacher performance, built from
the three-page inspection file scanned as `CamScanner 25-11-2026 10.43.pdf`.

- **School:** Govt. Boys Model High School, Layyah — EMIS 32230016
- **Principal:** Dr. Rizwan Alam
- **Monitoring period loaded:** 01 October 2026 — 30 October 2026 (22 working days)

Open `index.html` from any static server. There is no build step and no dependency
to install — plain ES modules, hand-written SVG charts, no CDN.

## What the PDF gave us

| Page | Content | Where it lives in the console |
|---|---|---|
| 1 | Daily checklist, 15 items with a weighted rubric out of 45 points | **Daily Checklist** (marking), scoring engine, evidence tables |
| 2 | Incharge-wise sheet: 29 teachers, class, enrolment, 4 weeks × assembly/class % | **Attendance Register** → Weekly register, **Teachers** roster |
| 3 | Assembly register, EMIS 32230016, 30 class rows with teachers | **Attendance Register** → Assembly roster |

All 29 staff names, designations and enrolments are transcribed exactly. A few
classes shown on page 2 (9th-B, 9th-D) do not appear on page 3's register; their
enrolments are marked `est: true` in `js/data.js` and estimate the section size.

## The scoring model

Fifteen items, 45 points per day, grouped into four pillars the principal chose:

| Pillar | Weight | Items |
|---|---|---|
| Attendance & Punctuality | 35% | Student attendance, leave, daily dress |
| Classroom & Teaching Quality | 30% | Personal file, class file, classroom features, lesson plan |
| Compliance & Records | 20% | Uniform, training card, monthly donation |
| Activities & Engagement | 15% | Assembly photo, extra activity, transport, scout uniform, social media |

Each pillar is a percentage of the points actually available. The composite is the
weighted average, and grades are A+ ≥ 90, A ≥ 80, B ≥ 70, C ≥ 60, D below 60.

Three items — **leave, monthly donation, classroom features** — are assessed once
for the month on the printed form, so the engine counts them once rather than once
per day (`monthly: true` in `js/data.js`).

## Screens

- **Overview** — school composite, grade distribution, daily trend, priority list of
  teachers below 70%, the items losing most points, teacher of the month.
- **Teachers** — all 29 with composite, grade, attendance, trend and weakest area;
  sortable, searchable, and an attendance-vs-performance scatter.
- **Attendance Register** — the page-2 weekly sheet, a 638-cell daily heatmap, and
  the page-3 assembly roster in both scripts.
- **Daily Checklist** — the marking screen, laid out like the printed form.
- **Improvement Plans** — undertakings with owner, measure and due date.
- **Reports** — six generated documents, print-ready.
- **Data & Sync** — sample vs live entry, backup/restore, Google Sheets and Drive.

## Explanations of low performance

Every teacher's **case file** (click any name) has an *Explanation* tab that writes
the finding in sentences: the verdict and rank, where the score comes from by
pillar, which items pulled it down and by how many points, attendance and month-on-
month movement, the probable causes, credit where due, and a note on how reliable
the data is. The *Action plan* tab turns that into dated undertakings, which can be
pushed into the school register with one click.

Wording lives in `js/narrative.js`. It is generated from the marks, not written by
hand, so it stays true as the record changes.

## Reports

| Document | Contents |
|---|---|
| Monthly school report | Summary, four pillars, weakest items, teacher-wise table, cases for formal notice, principal's observation |
| Teacher performance finding | Letterhead single-teacher finding with evidence, causes, plan, follow-up dates, signature block |
| Batch case files | One finding per teacher below 70%, a page each |
| Attendance register sheet | The page-2 register with month averages |
| Blank daily checklist | A clean copy of the page-1 form for the round |

Print to PDF from the browser. The masthead **Print report** button always prints the
school report, never the interface.

## Data

The console ships with a complete, realistic month of sample data so the principal
can walk through every screen during the visit. **Data & Sync → Clear for live entry**
wipes the marks and keeps the teacher list; **Factory reset** restores the sample.

Everything is stored in `localStorage` under `gbmhs-layyah-monitor-v1`. Backups are a
single JSON file. Sample marks are generated deterministically from each teacher's
name, so the demo is identical on every reload.

`archive/` holds the exported record pushed to Google Drive — the item-level CSV for
all 638 class-days, plus the summary, attendance, improvement and rubric sheets.

## Google Workspace

- **Workbook:** [GBMHS Layyah — Monitoring Workbook (Oct 2026)](https://docs.google.com/spreadsheets/d/1jqDC2AqgoCmKjdgOg4MGJomjmR1upXKahRgGPWQXrkw/edit)
- **Archive folder:** [School Monitoring — GBMHS Layyah](https://drive.google.com/drive/folders/1scGOXrHtu7aC255lcaX-YfeIYySxPQBT)

Links are defined once in `js/sync.js` (`LINKS`). The console builds the workbook
from live state and downloads it; the sheet is refreshed by importing that file.

## Deploying it

The app is a static site: plain HTML, CSS and ES modules, no build step and no
server code. Anything that serves files over HTTPS will host it.

### GitHub Pages (free, ~2 minutes)

1. Merge this branch into `main` (Pages publishes from `main`).
2. Repo → **Settings → Pages** → Source **Deploy from a branch** → `main`, folder `/ (root)` → **Save**.
3. It appears at `https://sheerazautomate.github.io/modelschool/` in a minute or two.

The `.nojekyll` file in the repo root stops Jekyll from touching the files. The
`archive/` folder is published too, so the exported CSVs and the two HTML reports
get a public URL — fine while the data is the sample month, worth removing before
real staff data goes in.

### Netlify / Cloudflare Pages (drag and drop)

Drop the repo folder on Netlify, or connect the repo and leave the build command
empty with publish directory `.`. `netlify.toml` sets the JavaScript MIME type and
no-sniff headers. Cloudflare Pages needs the same: no build command, output `/`.

### School server or a laptop on the LAN

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Then open `http://<machine-ip>:8080` from any device on the school network. This
is the version that works with no internet at all — the console needs nothing
external except the two Drive/Sheets links, which are only opened when clicked.

### Before real data goes on a public URL

The console keeps its state in the browser's `localStorage`. That means each
browser and each device is its own copy: marks entered on the principal's laptop
do not appear on the clerk's desktop, and they disappear if the browser profile is
cleared. For one person marking on one machine that is enough. For shared use,
either keep it on the LAN behind the school router, or set a password on the
hosting (Netlify Identity, Cloudflare Access) so only staff can open it — a public
URL with no password means anyone with the link can read every teacher's marks.

The Drive and Sheets integration is deliberately one-way: the console builds the
file, you upload it. It never holds Google credentials, so it cannot post on its
own and cannot leak them.

## Layout

```
index.html            page shell
styles.css            all styling, including the print sheet
js/data.js            school, rubric, 29 teachers, 22 working days, page-3 register
js/scoring.js         rubric → pillars → composite → grade, trends, risk flags
js/narrative.js       the explanation engine and improvement plans
js/store.js           state, persistence, demo-data generator, import/export
js/charts.js          SVG line, bar, donut, scatter, radar, heatmap
js/report.js          the six printable documents
js/sync.js            Google Sheets/Drive bridge and workbook definition
js/views/*.js         one file per screen
archive/              exported CSVs and HTML documents sent to Drive
```

## Known limits

- The console cannot hold Google credentials, so the Sheets link is a published
  workbook rather than a live two-way sync. Refreshing it is a file import.
- Enrolments for 9th-B and 9th-D are estimates (page 3 does not list those classes).
- Attendance percentages are derived from the checklist's bands (below 80% → 72,
  80%+ → 84, 90%+ → 92). They index compliance; they are not the class register.
