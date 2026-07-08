/**
 * ============================================================
 *  GALERI KARYA SMKN 1 SANDEN — BACKEND GOOGLE APPS SCRIPT
 * ============================================================
 *  Script ini menjadikan Google Sheet sebagai "database"
 *  untuk halaman galeri (index.html).
 *
 *  CARA PASANG:
 *  1. Buka spreadsheet:
 *     https://docs.google.com/spreadsheets/d/1A9zJC2ROfRCNz6FRONTM00xr3Ez-3V74H1S_-dcwtG8/edit
 *  2. Menu: Extensions > Apps Script.
 *  3. Hapus isi default, tempel seluruh isi file ini.
 *  4. Klik Deploy > New deployment.
 *     - Type: Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  5. Salin URL Web App yang muncul (diakhiri /exec).
 *  6. Tempel URL itu ke variabel GAS_URL di index.html.
 *  7. Setiap kali mengubah script ini, buat "New deployment"
 *     lagi (atau gunakan "Manage deployments" > Edit > versi baru)
 *     supaya perubahan ikut ter-publish.
 * ============================================================
 */

// ID diambil dari URL spreadsheet yang diberikan
const SPREADSHEET_ID = '1A9zJC2ROfRCNz6FRONTM00xr3Ez-3V74H1S_-dcwtG8';
const SHEET_NAME = 'Data';

// Urutan kolom di sheet — HARUS sama persis dengan urutan ini
const FIELDS = [
  'id',
  'name',
  'status',
  'department',
  'contact',
  'access_code',
  'publish_consent',
  'registered_at',
  'work_title',
  'work_description',
  'work_category',
  'work_class',
  'work_year',
  'work_link',
  'work_type',
  'stars',
  'certified',
  'quiz_score',
  'submitted_at'
];

/* ------------------------------------------------------------
 * Util: ambil sheet, buat + isi header otomatis kalau belum ada
 * ------------------------------------------------------------ */
function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(FIELDS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ------------------------------------------------------------
 * Util: baca semua baris jadi array of object
 * ------------------------------------------------------------ */
function readAll_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const range = sheet.getRange(2, 1, lastRow - 1, FIELDS.length);
  const values = range.getValues();

  return values
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      FIELDS.forEach((field, i) => {
        let val = row[i];
        if (field === 'publish_consent' || field === 'certified') {
          val = (val === true || val === 'TRUE' || val === 'true');
        }
        if (field === 'stars' || field === 'quiz_score') {
          val = Number(val) || 0;
        }
        if ((field === 'registered_at' || field === 'submitted_at') && val instanceof Date) {
          val = val.toISOString();
        }
        obj[field] = val === null || val === undefined ? '' : val;
      });
      return obj;
    });
}

/* ------------------------------------------------------------
 * Util: tambah 1 baris baru dari objek record
 * ------------------------------------------------------------ */
function appendRecord_(record) {
  const sheet = getSheet_();
  const id = Utilities.getUuid();
  record.id = id;

  const row = FIELDS.map(field => {
    const val = record[field];
    return val === undefined || val === null ? '' : val;
  });

  sheet.appendRow(row);
  return record;
}

/* ------------------------------------------------------------
 * Util: bungkus response JSON + izinkan akses lintas-origin
 * ------------------------------------------------------------ */
function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------
 * GET  -> ambil seluruh data (dipakai saat halaman dibuka)
 *   ?action=list  (default)
 * ------------------------------------------------------------ */
function doGet(e) {
  try {
    const data = readAll_();
    return jsonResponse_({ isOk: true, data: data });
  } catch (err) {
    return jsonResponse_({ isOk: false, error: err.message });
  }
}

/* ------------------------------------------------------------
 * POST -> tambah data baru (registrasi akun ATAU upload karya)
 * Body dikirim sebagai text/plain berisi JSON, contoh:
 * {
 *   "action": "create",
 *   "record": { ...field-field sesuai FIELDS... }
 * }
 * ------------------------------------------------------------ */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'create';

    if (action === 'create') {
      const saved = appendRecord_(body.record || {});
      return jsonResponse_({ isOk: true, data: saved });
    }

    return jsonResponse_({ isOk: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse_({ isOk: false, error: err.message });
  }
}
