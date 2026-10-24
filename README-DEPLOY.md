# MWG24 - Deployment ke Railway

## Persiapan
1. Push project ini ke GitHub.
2. Di Railway, buat project baru dari repo.
3. Set environment variables:
   - BASE_URL=https://your-domain.up.railway.app
   - SESSION_SECRET=<random long string>
   - ADMIN_USERNAME=admin
   - ADMIN_PASSWORD=<strong password>
   - DATA_DIR=/data
   - NODE_ENV=production
4. Tambahkan Volume di path /data agar SQLite persistent.
5. Deploy.

## Setelah Deploy
- Login admin di /admin/login
- Ubah password via... (or re-set ADMIN_PASSWORD and restart if needed, but prefer hashed)
- Semua gambar harus URL HTTPS eksternal.
- Tidak ada upload file ke server.

## Database
SQLite di DATA_DIR/database.sqlite. Volume wajib agar data tidak hilang saat restart.
