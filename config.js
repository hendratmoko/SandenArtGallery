/**
 * ============================================================
 *  KONFIGURASI GALERI KARYA SMKN 1 SANDEN
 * ============================================================
 *  Ganti GAS_URL dengan URL Web App Google Apps Script kamu
 *  (Deploy > New deployment > Web app), yang diakhiri "/exec".
 *
 *  Contoh:
 *  https://script.google.com/macros/s/AKfycbx.......xyz/exec
 * ============================================================
 */
window.APP_CONFIG = {
  // WAJIB DIISI — URL Web App Apps Script kamu
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyZUhVYxTet1lVV8llFxYyZ_fMo4l5aQEbozlbbCQvC16c2w1qqwowEp6X8n7XG7HTOWA/exec',

  // Kalau true: saat GAS_URL belum diisi / fetch ke GAS gagal,
  // aplikasi otomatis memuat data contoh dari data.json supaya
  // UI tetap bisa dicoba tanpa backend aktif.
  USE_LOCAL_FALLBACK: true,

  // Path file data contoh (dipakai kalau USE_LOCAL_FALLBACK = true)
  LOCAL_DATA_PATH: 'data.json'
};
//default icon kartu
window.DEFAULT_WORK_IMAGE =
"https://hendratmoko.github.io/SandenArtGallery/Avatar/default.png";

/**
 * ============================================================
 *  KONFIGURASI AVATAR
 * ============================================================
 *  Folder "Avatar" berisi file 01.png s/d 22.png yang di-hosting
 *  di repo GitHub Pages yang sama dengan tentacle-cursor.js.
 *  Ganti AVATAR_BASE jika lokasi folder Avatar berbeda.
 * ============================================================
 */
window.AVATAR_BASE = 'https://hendratmoko.github.io/SandenArtGallery/Avatar/';
window.AVATAR_COUNT = 22;
window.AVATAR_EXT = '.png';
