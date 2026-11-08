# Catat Hutang — GAS + Spreadsheet + GitHub + Vercel

Aplikasi pencatatan hutang/piutang pribadi yang responsif untuk smartphone, tablet, dan desktop. Frontend statis berada di GitHub/Vercel; Google Apps Script menjadi backend dan Google Spreadsheet menjadi database.

## Fitur
- Login privat dengan username/password; sesi aktif sekitar 6 jam.
- Dashboard ringkasan hutang saya, piutang saya, total pembayaran, transaksi aktif, dan grafik perbandingan saldo.
- Catat transaksi hutang atau piutang. Setiap pencatatan menghasilkan kode unik tersendiri, termasuk bila nama pihak yang sama dicatat berkali-kali.
- Pembayaran penuh atau angsuran berdasarkan kode unik. Sisa saldo dan status lunas diperbarui otomatis.
- Upload bukti gambar/video saat pencatatan hutang/piutang maupun pembayaran (batas aplikasi 8 MB per file); file disimpan ke Google Drive.
- Cetak kwitansi transaksi dan pembayaran.
- Spreadsheet dan folder bukti dibuat otomatis.

## A. Buat database dan backend Google Apps Script
1. Buka [script.google.com](https://script.google.com) dan buat project baru.
2. Hapus kode awal, lalu salin seluruh isi `Code.gs` dari paket ini ke editor Apps Script.
3. Pilih fungsi `setupApp`, klik **Run/Jalankan**, lalu berikan izin akses Spreadsheet dan Drive.
4. Buka **Project Settings / Setelan project** dan atur zona waktu ke `Asia/Jakarta`.
5. Dari **Deploy > New deployment > Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, lalu salin URL Web App yang berakhiran `/exec`.
6. Database Spreadsheet bernama **Database Catat Hutang** dan folder Drive **Bukti Catat Hutang** dibuat otomatis. URL Spreadsheet dapat dilihat pada log eksekusi fungsi `setupApp`.

**Login awal:** `admin`  
**Password awal:** `GantiPassword123!`  
Segera login dan buka Pengaturan akun untuk mengganti password awal.

> Catatan: akses Web App Apps Script disetel Anyone agar proxy Vercel dapat memanggilnya. API tetap memerlukan sesi login untuk semua operasi data. Jangan membagikan URL endpoint dan password. File bukti disetel Anyone with the link agar tautan bukti dapat dibuka dari kwitansi; pertimbangkan konsekuensi privasi sebelum mengunggah bukti sensitif.

## B. Upload ke GitHub
1. Buat repository baru di GitHub.
2. Upload seluruh isi folder ini (termasuk folder `api`).
3. Jangan upload password, token, atau URL endpoint dalam source code.

## C. Deploy ke Vercel
1. Login ke Vercel, pilih **Add New > Project**, lalu import repository GitHub.
2. Framework preset: **Other**. Build command dan output directory dapat dikosongkan.
3. Pada Environment Variables tambahkan:
   - Name: `GAS_WEB_APP_URL`
   - Value: URL Web App Apps Script yang berakhiran `/exec`
4. Deploy. Buka domain Vercel untuk menggunakan aplikasi.
5. Jika mengubah URL deployment Apps Script, perbarui environment variable di Vercel lalu redeploy.

## D. Cara penggunaan
- **Hutang / Piutang:** pilih jenis, nama pihak, tanggal, nominal dan keterangan, lalu simpan. Sistem menghasilkan kode unik, misalnya `CH-261108-AB12CD34`. Simpan kode tersebut.
- **Bayar:** pilih jenis pembayaran, masukkan kode unik dan tekan Cari. Data transaksi serta sisa saldo akan ditampilkan. Masukkan nominal angsuran/pelunasan dan bukti jika ada, lalu Simpan pembayaran.
- Nominal pembayaran tidak boleh melebihi saldo tersisa. Pembayaran sebagian mengurangi saldo; jika saldo menjadi nol status berubah menjadi LUNAS.
- **Cetak kwitansi:** tersedia setelah pencatatan hutang/piutang atau pembayaran, dan pada daftar transaksi.

## Struktur file
- `Code.gs` — backend Google Apps Script dan pembuatan database otomatis.
- `index.html`, `style.css`, `app.js` — frontend responsif.
- `api/gas.js` — proxy Vercel untuk komunikasi aman lintas domain.
- `vercel.json` — konfigurasi deployment.

## Batasan dan catatan keamanan
- Login satu akun admin bawaan. Ganti password awal sebelum dipakai.
- Sesi menggunakan CacheService dan dapat berakhir otomatis; login ulang jika diminta.
- Bukti unggahan dibatasi 8 MB di frontend. Apps Script juga memvalidasi ukuran payload.
- Bukti video/gambar disimpan di Google Drive dengan tautan akses. Jangan unggah dokumen yang berisi data sangat rahasia jika tautan publik tidak sesuai kebutuhan.
- Ini aplikasi pencatatan sederhana, bukan sistem akuntansi/audit. Simpan salinan spreadsheet secara berkala.
- Bila terjadi error izin, jalankan ulang `setupApp()` dan pastikan deployment Web App memakai **Execute as Me**.
