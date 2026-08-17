/**
 * ============================================================
 *  GALERI KARYA SMKN 1 SANDEN — BACKEND GOOGLE APPS SCRIPT
 * ============================================================
 *  Spreadsheet:
 *  https://docs.google.com/spreadsheets/d/1_NZp1U1zl3j165JIwzOmyNBrUSv4A1tTd41nvjy0RFQ/edit
 *
 *  CARA DEPLOY:
 *  1. Buka spreadsheet di atas.
 *  2. Menu Extensions > Apps Script.
 *  3. Hapus isi default, tempel seluruh isi file ini.
 *  4. Pastikan nama sheet data di bawah (SHEET_NAME) sesuai
 *     dengan nama tab sheet yang berisi data (default: "Sheet1").
 *  5. Simpan, lalu klik Deploy > New deployment.
 *     - Type: Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  6. Salin URL yang diakhiri "/exec", tempel ke GAS_URL pada
 *     file config.js di website.
 *
 *  ⚠️ PENYEBAB PALING UMUM notifikasi "Gagal menyimpan data":
 *  - Code.gs BARU diedit tapi belum di-deploy ulang. Setiap kali isi
 *    Code.gs diubah, WAJIB buka Deploy > Manage deployments > klik ✏️
 *    pada deployment aktif > Version: "New version" > Deploy.
 *    (Menyimpan project saja TIDAK otomatis memperbarui URL /exec).
 *  - Deployment "Who has access" bukan "Anyone" (mis. "Only myself"
 *    atau "Anyone with Google account") sehingga permintaan dari
 *    pengunjung anonim ditolak / dialihkan ke halaman login Google.
 *  - Nama tab sheet tidak sama dengan SHEET_NAME di bawah.
 *  - Otorisasi izin (Authorize access) belum disetujui saat pertama
 *    kali deploy — jalankan sekali fungsi apa saja dari editor Apps
 *    Script untuk memicu layar izin, lalu Allow.
 *
 *  KOLOM SHEET (harus persis, baris pertama = header):
 *  id | name | status | department | contact | access_code |
 *  publish_consent | registered_at | work_title | work_description |
 *  work_category | work_class | work_year | work_link | work_type |
 *  stars | certified | quiz_score | submitted_at | lama | gambar |
 *  guru | mapel | avatar
 * ============================================================ */

const SHEET_NAME = 'Sheet1';

// Urutan kolom di spreadsheet — WAJIB sesuai urutan header.
const COLUMNS = [
  'id', 'name', 'status', 'department', 'contact', 'access_code',
  'publish_consent', 'registered_at', 'work_title', 'work_description',
  'work_category', 'work_class', 'work_year', 'work_link', 'work_type',
  'stars', 'certified', 'quiz_score', 'submitted_at', 'lama', 'gambar',
  'guru', 'mapel', 'avatar'
];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];

  // Pastikan header sudah ada; kalau sheet kosong, buat header otomatis.
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  }
  return sheet;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    if (!h) return;
    let val = row[i];
    if (h === 'publish_consent' || h === 'certified') {
      val = (val === true || val === 'true' || val === 'TRUE' || val === 1);
    } else if (h === 'stars' || h === 'quiz_score') {
      val = Number(val) || 0;
    } else if (val instanceof Date) {
      val = val.toISOString();
    } else if (val === undefined || val === null) {
      val = '';
    } else {
      val = String(val);
    }
    obj[h] = val;
  });
  return obj;
}

/**
 * GET — ambil seluruh data (dipakai galeri untuk menampilkan karya).
 */
function doGet(e) {
  try {
    const sheet = getSheet_();
    const range = sheet.getDataRange();
    const values = range.getValues();
    if (values.length < 2) return jsonOut_({ isOk: true, data: [] });

    const headers = values[0].map(h => String(h).trim());
    const rows = values.slice(1).filter(r => r.join('') !== '');
    const data = rows.map(r => rowToObject_(headers, r));

    return jsonOut_({ isOk: true, data: data });
  } catch (err) {
    return jsonOut_({ isOk: false, error: 'doGet error: ' + String(err) });
  }
}

/**
 * POST — dipakai untuk registrasi akun baru & upload karya baru.
 * Body (text/plain, agar tidak kena CORS preflight):
 * { "action": "create", "record": { ...kolom... } }
 */
function doPost(e) {
  // Lock supaya dua permintaan simpan yang datang bersamaan (mis. dua
  // siswa upload karya di waktu yang sama) tidak saling menimpa baris.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return jsonOut_({ isOk: false, error: 'Server sedang sibuk, coba lagi beberapa detik lagi.' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ isOk: false, error: 'Request tidak berisi data (postData kosong). Pastikan permintaan dikirim dengan method POST dan ada body.' });
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonOut_({ isOk: false, error: 'Body request bukan JSON yang valid.' });
    }

    if (body.action !== 'create') {
      return jsonOut_({ isOk: false, error: 'Aksi tidak dikenal: ' + body.action });
    }

    const record = body.record || {};
    if (!record.id) {
      record.id = (record.work_type === 'registration' ? 'reg-' : 'work-') +
        Utilities.getUuid().substring(0, 8);
    }

    const sheet = getSheet_();

    // Baca header baris pertama. Kalau baris pertama kosong/tidak lengkap,
    // tulis ulang memakai COLUMNS supaya urutan kolom selalu konsisten.
    let lastCol = sheet.getLastColumn();
    let headers = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim())
      : [];

    if (headers.length === 0 || headers.every(h => h === '')) {
      headers = COLUMNS.slice();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    // Kalau ada kolom di record yang belum punya header di sheet
    // (mis. kolom "avatar" ditambahkan belakangan), tambahkan otomatis
    // di akhir supaya data baru tidak hilang / salah kolom.
    const missingCols = COLUMNS.filter(c => headers.indexOf(c) === -1);
    if (missingCols.length > 0) {
      const newHeaders = headers.concat(missingCols);
      sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
      headers = newHeaders;
    }

    const rowValues = headers.map(h => {
      const v = record[h];
      if (v === undefined || v === null) return '';
      return v;
    });

    sheet.appendRow(rowValues);
    SpreadsheetApp.flush();

    return jsonOut_({ isOk: true, data: record });
  } catch (err) {
    return jsonOut_({ isOk: false, error: 'doPost error: ' + String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menangani preflight OPTIONS (jaga-jaga bila suatu saat request diubah
 * memakai Content-Type yang memicu CORS preflight). Untuk request POST
 * text/plain dari script.js saat ini, fungsi ini normalnya tidak dipakai.
 */
function doOptions(e) {
  return ContentService.createTextOutput('');
}
