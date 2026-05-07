/**
 * SessionCut License Server — paste this into your Apps Script project (replacing the
 * existing Code.gs contents), then redeploy as a new version of the Web App.
 *
 * SHEET LAYOUT (matches your existing columns A–D, plus E and F to add):
 *   A: Key            — e.g. "SCAdmin001", "722Y-25N5-16QO"
 *   B: Status         — "Active" | "Used" | "Unlimited" | "Revoked"  (case-insensitive; empty = Active)
 *   C: Redeemed Date  — set automatically on first bind if empty; existing values are preserved
 *   D: Assigned To    — admin freeform
 *   E: Fingerprint    — set automatically on first bind; clear this cell to release a binding
 *   F: LastCheckAt    — updated on every successful recheck
 *
 * STATUS VALUES:
 *   Active      — Normal: binds on first activation, enforces match on recheck.
 *   Used        — Same behavior as Active. Kept as a separate label for admin tracking.
 *   Unlimited   — Bypasses fingerprint binding (e.g. SCAdmin001). Use sparingly.
 *   Revoked     — Always rejected.
 *
 * DEPLOY:
 *   Editor → Deploy → Manage deployments → Edit (✎) on existing deployment →
 *   New version → "v2 fingerprint binding" → Deploy.
 *   The /exec URL stays the same — no app-side change needed.
 *
 * CLIENT API (GET ?key=...&fingerprint=...&action=activate|recheck):
 *   { valid: true }                                  — license OK
 *   { valid: false, reason: "Key not found." }
 *   { valid: false, reason: "Key revoked." }
 *   { valid: false, reason: "Key bound to another machine." }
 *
 * ADMIN OPERATIONS (no script changes needed):
 *   - Issue new key:    add a row with Key + Status="Active". Leave C–F blank.
 *   - Revoke a key:     set Status to "Revoked". Next recheck on that machine fails.
 *   - Reset machine binding (e.g. teammate got a new laptop):
 *                       clear the Fingerprint cell (E). Next activation rebinds.
 *   - Migrate "Used" key: nothing to do — first launch on the new app binds and starts working.
 */

// 1-indexed column positions in the sheet.
const COL = {
  KEY: 1,
  STATUS: 2,
  REDEEMED_DATE: 3,
  ASSIGNED_TO: 4,
  FINGERPRINT: 5,
  LAST_CHECK_AT: 6,
};

function doGet(e) {
  return handle(e);
}

function doPost(e) {
  return handle(e);
}

function handle(e) {
  const params = (e && e.parameter) || {};
  const key = String(params.key || '').trim().toUpperCase();
  const fingerprint = String(params.fingerprint || '').trim();
  const action = String(params.action || 'activate').trim();

  if (!key) return reply({ valid: false, reason: 'Empty key' });
  if (!fingerprint) return reply({ valid: false, reason: 'Missing fingerprint' });

  // Serialize so two concurrent activations on the same key can't both succeed by
  // each reading an empty fingerprint cell before either writes.
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); }
  catch (_e) { return reply({ valid: false, reason: 'Server busy, try again' }); }

  try {
    return doHandle(key, fingerprint, action);
  } finally {
    lock.releaseLock();
  }
}

function doHandle(key, fingerprint, action) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return reply({ valid: false, reason: 'Key not found.' });

  // Read all rows once. Fewer round-trips, simpler scan.
  const range = sheet.getRange(2, 1, lastRow - 1, 6);
  const values = range.getValues();

  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][COL.KEY - 1]).trim().toUpperCase() === key) {
      rowIndex = i;
      break;
    }
  }
  if (rowIndex === -1) return reply({ valid: false, reason: 'Key not found.' });

  const row = values[rowIndex];
  const sheetRowNum = rowIndex + 2;
  const status = String(row[COL.STATUS - 1] || '').trim().toLowerCase();
  const now = new Date();

  if (status === 'revoked') {
    return reply({ valid: false, reason: 'Key revoked.' });
  }

  // Unlimited admin key — succeed without binding.
  if (status === 'unlimited') {
    sheet.getRange(sheetRowNum, COL.LAST_CHECK_AT).setValue(now);
    return reply({ valid: true, action, unlimited: true });
  }

  // Active / Used / empty — fingerprint-binding flow.
  const boundFp = String(row[COL.FINGERPRINT - 1] || '').trim();

  if (boundFp && boundFp !== fingerprint) {
    return reply({ valid: false, reason: 'Key bound to another machine.' });
  }

  if (!boundFp) {
    sheet.getRange(sheetRowNum, COL.FINGERPRINT).setValue(fingerprint);
    // Only set Redeemed Date if it's currently empty — preserves existing values.
    if (!row[COL.REDEEMED_DATE - 1]) {
      sheet.getRange(sheetRowNum, COL.REDEEMED_DATE).setValue(now);
    }
  }
  sheet.getRange(sheetRowNum, COL.LAST_CHECK_AT).setValue(now);

  return reply({ valid: true, action });
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
