# Upgrade InvoiceKu v6 dari HP

## A. Upload kode
Replace file project lama dengan seluruh isi paket v6 lalu commit ke GitHub.

## B. Upgrade database dari HP
Buka SQL Editor dan jalankan file di `supabase/mobile-v6` satu per satu dari 01 sampai 05.

Bagian 01–04 adalah migration utama. Bagian 05 mengaktifkan pekerjaan terjadwal untuk recurring invoice, reminder, dan backup snapshot harian.

## C. Tes cepat setelah deploy
1. Login.
2. Pilih bisnis utama dari sidebar.
3. Buat invoice dan simpan.
4. Buat Penawaran dari editor lalu Convert menjadi invoice.
5. Tandai invoice lunas dan buat Kwitansi.
6. Buka link invoice dari browser incognito dan kirim bukti pembayaran.
7. Kembali ke dashboard → Dokumen Bisnis → Bukti Bayar.
8. Uji tombol Install InvoiceKu pada landing page.

Jika migration belum dijalankan, fitur v5 tetap dapat terbuka, tetapi fitur Business Suite v6 dapat menampilkan error tabel/fungsi belum tersedia.
