# InvoiceKu v6 — Business Suite

InvoiceKu v6 adalah aplikasi invoice mobile-first dengan login email/password, sinkronisasi akun, 288 template, penawaran, invoice, kwitansi, pembayaran, customer portal, recurring, reminder, multi-business, import Excel/CSV, backup/restore, version history, activity log, dan PWA installable.

## Upgrade dari v5/v5.1

Database v5 **jangan dihapus**. Jalankan migration baru:

1. `supabase/migration-v6-business-suite.sql`
2. `supabase/cron-v6.sql` jika ingin recurring, reminder, dan backup otomatis.

Jika copy SQL dari HP terbatas, jalankan berurutan folder `supabase/mobile-v6/`:

1. `01-v6-tabel-dan-multibisnis.sql`
2. `02-v6-fungsi-dokumen-portal.sql`
3. `03-v6-keamanan-storage.sql`
4. `04-v6-otomasi-backup-hardening.sql`
5. `05-v6-cron-otomatisasi.sql`

Jangan lanjut ke bagian berikutnya jika bagian sebelumnya error.

## Fitur v6

- Multi Business dalam satu akun
- Quotation / Penawaran → convert menjadi invoice
- Kwitansi otomatis untuk invoice lunas
- PDF invoice multi-halaman dengan header tabel berulang dan nomor halaman
- PNG invoice / penawaran / kwitansi
- Customer portal + riwayat pembayaran + upload bukti transfer
- Tracking invoice dibuka pelanggan
- Version history invoice dan restore versi
- Activity log
- Reminder fleksibel (-3, 0, +1, +3, +7 dapat diubah)
- Recurring harian, mingguan, bulanan, tahunan
- Import pelanggan & produk dari CSV/XLS/XLSX
- Bulk action: lunas, reminder, arsip, download PDF
- Tags pelanggan/produk/invoice
- Draft recovery dan antrean sinkronisasi saat offline
- Backup/restore lengkap + snapshot database otomatis 30 hari
- Pajak per item / per invoice, harga termasuk pajak, diskon per item + invoice
- Satuan custom
- Template Builder lanjutan: font, radius, logo size, margin, watermark, footer
- Quick Finder / universal command search
- Dark/light mode
- PWA: tombol install di landing page + prompt Install/Nanti
- Logout kembali ke landing page

## Konfigurasi

Koneksi aplikasi tetap berada pada `js/config.js`. Jangan pernah memasukkan secret/service role key ke frontend.

## Catatan deployment

Upload seluruh isi folder `invoiceku` ke repository GitHub, commit, lalu Vercel dapat melakukan redeploy otomatis. Service worker v6 menggunakan cache baru `invoiceku-v6-business-suite`, sehingga cache versi lama akan dibersihkan pada aktivasi.
