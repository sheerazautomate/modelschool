/* =========================================================================
   GBMHS Layyah — monitoring sync endpoint.

   Paste this file into the Apps Script editor of the monitoring workbook, set
   a token in Script Properties, and deploy as a web app. It then acts as the
   storage layer for the monitoring console.

   What it does
     · Log    — receives change records from the console, appends them, never
                edits or deletes a row.
     · Pull   — hands back every record newer than the caller's cursor.
     · Render — rewrites the readable tabs (Summary, Teachers, Daily checklist,
                Attendance register, Improvement register) from the console's
                own calculation. The console computes the scoring; this script
                only stores and displays, so there is exactly one copy of the
                formula — in js/scoring.js.
     · Files  — saves generated reports into a Drive folder.
     · Token  — a shared secret, so a stranger who finds the URL cannot read
                the school's record.

   Setup, in order, is in apps-script/README.md.
   ========================================================================= */

var LOG = 'Sync log';
var META = 'Settings';
var RENDERED = ['Summary', 'Teachers', 'Daily checklist', 'Attendance register',
  'Improvement register', 'Rubric'];
var MAX_BATCH = 500;

/* --- entry points ------------------------------------------------------ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var body;
  try {
    guard_(p.token);
    var action = p.action || 'ping';
    if (action === 'ping') body = ping_();
    else if (action === 'pull') body = pull_(Number(p.since) || 0);
    else if (action === 'version') body = { ok: true, version: version_() };
    else body = { ok: false, error: 'Unknown action: ' + action };
  } catch (err) {
    body = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return reply_(body, p.callback);
}

function doPost(e) {
  var body;
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    guard_(data.token);
    if (data.action === 'push') body = push_(data);
    else if (data.action === 'file') body = saveFile_(data);
    else body = { ok: false, error: 'Unknown action: ' + (data.action || '(none)') };
  } catch (err) {
    body = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return reply_(body, null);
}

/* The console reads nothing from this reply on POST (it cannot, cross-origin),
   but returning JSON keeps the endpoint testable from a terminal. */
function reply_(body, callback) {
  body.serverTime = Date.now();
  var json = JSON.stringify(body);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/* --- auth -------------------------------------------------------------- */

function guard_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!expected) {
    throw new Error('No SYNC_TOKEN set. Open Project Settings → Script Properties and add SYNC_TOKEN.');
  }
  if (String(token || '') !== expected) {
    throw new Error('Wrong token. The console and the script must hold the same SYNC_TOKEN.');
  }
}

/* --- sheets ------------------------------------------------------------ */

function book_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function ensureTab_(name) {
  var ss = book_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function log_() {
  var sh = ensureTab_(LOG);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['id', 'ts', 'kind', 'teacherId', 'day', 'itemKey', 'value',
      'text', 'actionId', 'payload', 'received']);
    sh.getRange('A1:K1').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function meta_() {
  var sh = ensureTab_(META);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['key', 'value', 'updated']);
    sh.getRange('A1:C1').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function version_() {
  var sh = meta_();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var rows = sh.getRange(2, 1, last - 1, 3).getValues();
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i][0] === 'version') return Number(rows[i][1]) || 0;
  }
  return 0;
}

function bumpVersion_() {
  var sh = meta_();
  var last = sh.getLastRow();
  var v = version_() + 1;
  if (last < 2) {
    sh.appendRow(['version', v, new Date()]);
  } else {
    var rows = sh.getRange(2, 1, last - 1, 3).getValues();
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i][0] === 'version') {
        sh.getRange(i + 2, 2, 1, 2).setValues([[v, new Date()]]);
        return v;
      }
    }
    sh.appendRow(['version', v, new Date()]);
  }
  return v;
}

/* --- ping / pull ------------------------------------------------------- */

function ping_() {
  return {
    ok: true,
    school: 'GOVT. BOYS MODEL HIGH SCHOOL, LAYYAH',
    script: 'gbmhs-monitoring-sync',
    version: version_(),
    ops: Math.max(0, log_().getLastRow() - 1),
    recent: recentIds_(60),
    cursor: cursor_(),
  };
}

function cursor_() {
  var sh = log_();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  return last - 1; // row number doubles as an append-only cursor
}

function recentIds_(n) {
  var sh = log_();
  var last = sh.getLastRow();
  var take = Math.min(n, Math.max(0, last - 1));
  if (!take) return [];
  return sh.getRange(last - take + 1, 1, take, 1).getValues()
    .map(function (r) { return String(r[0]); });
}

function pull_(since) {
  var sh = log_();
  var last = sh.getLastRow();
  var out = [];

  /* `since` is a count of log rows the caller already holds, starting at 0.
     Keeping it a count rather than a row number removes the off-by-one that
     would otherwise leave a client reading an empty window for ever. */
  var available = Math.max(0, last - 1);
  var consumed = Math.max(0, Number(since) || 0);
  var replayed = false;

  /* The caller is ahead of the log, so rows were deleted or the tab rebuilt.
     Replay everything; the client's timestamps decide what actually wins. */
  if (consumed > available) { consumed = 0; replayed = true; }

  var take = Math.min(available - consumed, MAX_BATCH);
  if (take > 0) {
    var rows = sh.getRange(consumed + 2, 1, take, 10).getValues();
    for (var i = 0; i < rows.length; i += 1) {
      var r = rows[i];
      if (!r[0]) continue;
      var op = { id: String(r[0]), ts: Number(r[1]) || 0, kind: String(r[2]) };
      if (r[3]) op.teacherId = String(r[3]);
      if (r[4]) op.day = String(r[4]);
      if (r[5]) op.itemKey = String(r[5]);
      if (r[6] !== '' && r[6] !== null) op.value = Number(r[6]);
      if (r[7]) op.text = String(r[7]);
      if (r[8]) op.actionId = String(r[8]);
      if (r[9]) {
        try {
          var extra = JSON.parse(String(r[9]));
          for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) op[k] = extra[k];
        } catch (ignore) { /* a malformed payload must not break the read */ }
      }
      out.push(op);
    }
    consumed += rows.length;
  }

  return {
    ok: true,
    ops: out,
    cursor: consumed,
    replayed: replayed,
    recent: recentIds_(60),
    version: version_(),
    total: available,
    serverTime: Date.now(),
  };
}

/* --- push -------------------------------------------------------------- */

function push_(data) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('The sheet is busy, retry shortly.');
  try {
    var sh = log_();
    var last = sh.getLastRow();
    var known = {};
    if (last > 1) {
      var existing = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < existing.length; i += 1) known[String(existing[i][0])] = true;
    }

    var ops = Array.isArray(data.ops) ? data.ops.slice(0, MAX_BATCH) : [];
    var rows = [];
    var accepted = 0;
    var received = new Date();

    for (var j = 0; j < ops.length; j += 1) {
      var op = ops[j];
      if (!op || !op.id || !op.kind || known[String(op.id)]) continue;
      known[String(op.id)] = true;   // de-duplicate within the same batch too
      var extra = {};
      for (var f in op) {
        if (!Object.prototype.hasOwnProperty.call(op, f)) continue;
        if (['id', 'ts', 'kind', 'teacherId', 'day', 'itemKey', 'value',
          'text', 'actionId', '_key'].indexOf(f) >= 0) continue;
        extra[f] = op[f];
      }
      rows.push([
        String(op.id),
        Number(op.ts) || Date.now(),
        String(op.kind),
        op.teacherId || '',
        op.day || '',
        op.itemKey || '',
        op.value === undefined || op.value === null ? '' : op.value,
        op.text || '',
        op.actionId || '',
        Object.keys(extra).length ? JSON.stringify(extra) : '',
        received,
      ]);
      accepted += 1;
    }

    if (rows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, 11).setValues(rows);
      bumpVersion_();
    }

    var rendered = 0;
    if (Array.isArray(data.tabs) && data.tabs.length) {
      rendered = render_(data.tabs);
    }

    return {
      ok: true,
      accepted: accepted,
      skipped: ops.length - accepted,
      rendered: rendered,
      cursor: cursor_(),
      recent: recentIds_(60),
      version: version_(),
      serverTime: Date.now(),
    };
  } finally {
    lock.releaseLock();
  }
}

/* --- rendering the readable tabs --------------------------------------- */

/* The console sends the same six tables it would have exported. They are
   written whole, in place, so the spreadsheet always matches what the
   principal sees on screen. */
function render_(tabs) {
  var written = 0;
  for (var i = 0; i < tabs.length; i += 1) {
    var tab = tabs[i];
    if (!tab || !tab.name || RENDERED.indexOf(tab.name) < 0) continue;
    if (!Array.isArray(tab.rows) || !tab.rows.length) continue;
    writeTab_(tab.name, tab.rows);
    written += 1;
  }
  return written;
}

function writeTab_(name, rows) {
  var sh = ensureTab_(name);
  var width = rows.reduce(function (a, r) { return Math.max(a, r.length); }, 1);
  var grid = rows.map(function (r) {
    var copy = r.slice(0, Math.max(width, r.length));
    while (copy.length < width) copy.push('');
    return copy;
  });
  sh.clear({ contentsOnly: true });
  sh.getRange(1, 1, grid.length, width).setValues(grid);
  sh.getRange(1, 1, 1, width).setFontWeight('bold');
  sh.setFrozenRows(1);
}

/* --- Drive files ------------------------------------------------------- */

/* Called when the office saves a signed report or the workbook. Files land in
   the folder recorded in Script Properties as DRIVE_FOLDER_ID, which the
   console sets up during connection. */
function saveFile_(data) {
  if (!data.name || !data.content) throw new Error('A file needs a name and content.');
  var folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  var name = String(data.name).replace(/[\\/:*?"<>|]/g, '-');
  var mime = data.mimeType || 'text/html';
  var blob = Utilities.newBlob(String(data.content), mime, name);
  var file = folderId
    ? DriveApp.getFolderById(folderId).createFile(blob)
    : DriveApp.createFile(blob);

  if (mime === 'text/html') {
    try {
      var doc = Drive.Files.insert
        ? null
        : null; // Drive advanced service is optional; keep the .html if absent
    } catch (ignore) { /* ignore */ }
  }

  return {
    ok: true,
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl(),
    folder: folderId || '(My Drive)',
    serverTime: Date.now(),
  };
}

/* --- one-time helpers, run from the editor ----------------------------- */

/* Run once from the editor to create the tabs and record this workbook's id. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  log_();
  meta_();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SYNC_TOKEN')) {
    var token = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
    props.setProperty('SYNC_TOKEN', token);
    Logger.log('SYNC_TOKEN = ' + token + '\nPaste this into the console when it asks.');
  } else {
    Logger.log('SYNC_TOKEN already set: ' + props.getProperty('SYNC_TOKEN'));
  }
  Logger.log('Setup complete for ' + ss.getName());
}

/* Run once to point Drive saves at the monitoring folder. */
function setFolder(folderId) {
  PropertiesService.getScriptProperties().setProperty('DRIVE_FOLDER_ID', folderId);
  return folderId;
}

/* A terminal sanity check: prints the last few log rows. */
function tail() {
  var sh = log_();
  var last = sh.getLastRow();
  var take = Math.min(10, Math.max(0, last - 1));
  if (!take) { Logger.log('Log is empty.'); return; }
  Logger.log(sh.getRange(last - take + 1, 1, take, 8).getValues());
}
