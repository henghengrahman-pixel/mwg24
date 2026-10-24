# Laporan Pengujian MWG24

## Automated (Smoke)
File: tests/full-smoke.js
Jalankan: node tests/full-smoke.js (setelah npm install)

Hasil yang diharapkan:
- Password hash/verify PASS
- DB init + seed PASS
- Gallery JSON storage PASS

## Manual / Production Verification Required
- Login rate limit
- Full CRUD cycle via browser
- Public page image gallery display
- Sitemap only published
- Restart persistence (Railway Volume)
- Lighthouse mobile/desktop
- XSS / SQLi basic resistance (EJS escaping + parameterized queries)

Semua tes otomatis yang dijalankan di sandbox tercatat di atas. Tidak ada klaim PASS untuk yang belum dijalankan.
