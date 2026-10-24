# MWG24 V5 — Audit implementasi (belum final release)

Source aktual: `MWG24-V4-AUDITED-PARTIAL-REPAIR(4).zip`, satu-satunya berkas ZIP yang dilampirkan. Permintaan menyebut `(3).zip`, yang tidak tersedia dalam unggahan ini. Seluruh perubahan dilakukan pada salinan `(4)`.

## Perubahan nyata
- Form settings diarahkan ke `/admin/settings/save`; memastikan row settings ada sebelum UPDATE dan mengecek affected rows.
- CRUD galeri: locals item eksplisit, halaman GET edit, simpan slug, validasi ID dan 404 ketika item hilang; migrasi aman untuk kolom slug lama.
- Sidebar affiliate ditempatkan di dalam `<aside>` dan menu baru ditambahkan.
- Affiliate products: form edit dengan ID, partner/category, status, meta, URL, arsip; daftar menautkan edit.
- Affiliate partners: insert dan update terpisah, edit dan arsip, logo URL dan kolom migrasi tambahan.
- CRUD dasar categories/placements/campaigns berbasis tabel existing; daftar laporan klik dan konversi dari tabel existing (tanpa data sintetis).
- Middleware token CSRF session-bound bagi POST admin, hidden token dalam form EJS admin yang terdeteksi.
- Test audit statis tambahan (`tests/v5-static-audit.js`).

## Kekurangan / release blockers
- Tidak ada `package-lock.json` dari source; dependency npm belum terpasang. Semua test HTTP, database, EJS render, login, restart persistence dan Railway masih **NOT VERIFIED**.
- Sistem affiliate generik belum diuji constraint, concurrency, workflow browser, maupun end-to-end.
- Import conversion terverifikasi, search/filter/pagination affiliate, affiliate placement publik, dan pengaturan affiliate/SEO khusus belum diimplementasikan lengkap.
- Form gambar seluruh CMS, kontrol featured, SEO dan tata letak mobile belum diaudit end-to-end.
- Soft-delete semua entitas CMS existing dan koreksi mekanisme seed lama belum diverifikasi.
- Route matrix penuh tidak dapat dinyatakan WORKING tanpa runtime HTTP test.
- Penambahan CSRF berdampak pada POST lama; diperlukan pengujian browser end-to-end untuk seluruh admin.
- Potensi error/edge case di SQLite constraints dan EJS template belum dapat disingkirkan tanpa instalasi dependency.

**Keputusan release:** NOT READY. Arsip ini merupakan paket kerja parsial V5, bukan ZIP final production-verified.
