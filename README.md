# InvoiceKu Cloud v4 — Supabase Edition

InvoiceKu sekarang bukan lagi prototype lokal. Versi ini memakai **Supabase Auth + Postgres + Storage + Realtime + Cron** agar data pengguna tersinkron antara HP dan PC.

## Fitur yang sudah masuk

- Login email/password dan Google OAuth.
- Profil bisnis cloud: logo, alamat, WhatsApp, email, website, tanda tangan, rekening, e-wallet, dan QRIS.
- 288 template bawaan dengan preview invoice nyata dan kategori penggunaan bisnis.
- Favorite template, recently used, dan Template Builder untuk menyimpan template custom.
- Database pelanggan.
- Database produk/jasa.
- Editor invoice mobile-first dengan autosave ke cloud untuk invoice yang sudah tersimpan.
- Nomor invoice otomatis dan format custom, misalnya `INV/{YYYY}/{MM}/{SEQ4}`.
- Status: Draft, Terkirim, Belum Dibayar, Sebagian Dibayar, Lunas, Jatuh Tempo, Dibatalkan.
- Partial payment / pencatatan pembayaran.
- Link invoice online publik berbasis token unik.
- Kirim invoice dan reminder melalui WhatsApp.
- QRIS pada invoice dan halaman invoice publik.
- PDF A4 dan PNG HD.
- Dashboard: tagihan, pembayaran, outstanding, overdue, grafik 6 bulan, dan invoice terbaru.
- Recurring invoice.
- Reminder jatuh tempo.
- Browser notification saat aplikasi aktif/dibuka dan izin notifikasi diberikan.
- Realtime refresh untuk invoice dan reminder.
- Duplicate invoice, undo/redo, filter, search, empty state, skeleton loading, toast, dan shortcut keyboard.
- Dark / light mode.
- PWA / installable app.
- Tidak ada fitur subscription / Free-Pro pada versi ini.

---

# 1. Buat project Supabase

Buat project baru di Supabase.

Setelah project aktif, buka **Project Settings / API** dan siapkan:

- Project URL
- Publishable key atau anon key

> Jangan pernah menaruh `service_role` key di `js/config.js`. Browser hanya boleh memakai publishable/anon key. Keamanan data dijaga oleh RLS pada database.

---

# 2. Jalankan database schema

Di Supabase Dashboard:

1. Buka **SQL Editor**.
2. Buka file `supabase/schema.sql` dari project InvoiceKu.
3. Copy seluruh isinya.
4. Jalankan.

Schema membuat:

- `profiles`
- `customers`
- `products`
- `invoices`
- `payments`
- `recurring_rules`
- `notifications`
- `template_preferences`
- `custom_templates`
- RLS policies
- RPC nomor invoice
- RPC invoice publik
- trigger status pembayaran
- bucket `invoiceku-assets`
- Realtime untuk invoice dan notification

---

# 3. Isi koneksi Supabase

Buka:

`js/config.js`

Isi:

```js
window.INVOICEKU_CONFIG = {
  supabaseUrl: 'https://PROJECT_REF.supabase.co',
  supabasePublishableKey: 'SB_PUBLISHABLE_KEY_ATAU_ANON_KEY',
  publicSiteUrl: 'https://DOMAIN-ANDA.vercel.app'
};
```

Untuk testing lokal, `publicSiteUrl` boleh dikosongkan.

---

# 4. Aktifkan login Google (opsional tetapi direkomendasikan)

Di Supabase:

**Authentication → Providers → Google**

Aktifkan Google dan isi Client ID / Client Secret dari Google Cloud Console.

Tambahkan domain Vercel Anda ke URL/redirect yang dibutuhkan Supabase dan Google OAuth.

Login email/password tetap dapat dipakai tanpa Google OAuth.

---

# 5. Aktifkan recurring invoice & reminder otomatis

Setelah `schema.sql` selesai:

1. Aktifkan **Supabase Cron / pg_cron** pada Dashboard → Integrations → Cron.
2. Buka SQL Editor.
3. Jalankan file `supabase/cron.sql`.

Cron bawaan project:

- `invoiceku-recurring-daily` → setiap hari 00:05 UTC.
- `invoiceku-reminder-daily` → setiap hari 00:10 UTC.

Untuk WIB, kira-kira berjalan pukul 07:05 dan 07:10.

Tanpa `cron.sql`, menu Recurring tetap dapat menyimpan aturan tetapi invoice tidak akan dibuat otomatis oleh server.

---

# 6. Deploy ke GitHub + Vercel

Upload seluruh isi folder `invoiceku` ke repository GitHub.

Struktur utama:

```text
invoiceku/
├── assets/
├── js/
│   ├── config.js
│   ├── templates.js
│   ├── invoice-renderer.js
│   ├── cloud.js
│   └── app.js
├── supabase/
│   ├── schema.sql
│   └── cron.sql
├── index.html
├── styles.css
├── manifest.webmanifest
├── sw.js
├── vercel.json
└── README.md
```

Di Vercel:

1. Import repository.
2. Framework preset: **Other**.
3. Tidak perlu build command.
4. Deploy.

Setelah domain final diketahui, update `publicSiteUrl` di `js/config.js`, commit, lalu redeploy.

---

# Shortcut keyboard

Pada PC:

- `Ctrl/Cmd + S` → simpan invoice.
- `Ctrl/Cmd + N` → invoice baru.
- `Ctrl/Cmd + Shift + P` → download PDF.
- `Ctrl/Cmd + Z` → undo saat fokus tidak berada di input teks.

---

# Catatan keamanan

- Seluruh tabel aplikasi menggunakan Row Level Security.
- Data akun hanya dapat diakses oleh `auth.uid()` pemiliknya.
- Halaman invoice publik tidak diberi akses langsung ke tabel `invoices`; data publik dibaca melalui RPC `get_public_invoice` dan hanya bila `public_enabled = true`.
- Logo, tanda tangan, dan QRIS memang digunakan pada invoice publik sehingga asset disimpan di bucket publik `invoiceku-assets`. Listing metadata tetap dibatasi kepada pemilik melalui policy Storage.
- Jangan pernah memasukkan `service_role` key ke frontend atau repository publik.

---

# Reminder browser vs server

Supabase Cron membuat reminder di database secara otomatis. InvoiceKu akan menampilkan reminder tersebut secara realtime/ketika aplikasi dibuka. Jika pengguna memberikan izin browser notification, reminder yang belum dibaca juga dapat muncul sebagai notifikasi browser saat aplikasi aktif/dibuka.

Push notification penuh ketika browser benar-benar tertutup membutuhkan layanan Web Push/VAPID tambahan; sengaja belum dipaksakan agar InvoiceKu tetap hanya bergantung pada Supabase dan browser standar.

---

Created by **xdaniel04**.
