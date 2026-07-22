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
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzQhM1j77nppE9EjjDWesXkX6vLffBd5PTReZDN-ad4NMrTod9e4GZm_TLwtdJTsNkv/exec',

  // Kalau true: saat GAS_URL belum diisi / fetch ke GAS gagal,
  // aplikasi otomatis memuat data contoh dari data.json supaya
  // UI tetap bisa dicoba tanpa backend aktif.
  USE_LOCAL_FALLBACK: true,

  // Path file data contoh (dipakai kalau USE_LOCAL_FALLBACK = true)
  LOCAL_DATA_PATH: 'data.json'
};
