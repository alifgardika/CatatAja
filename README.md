# CatatAja

Bot Telegram pencatat pengeluaran tanpa server. Ketik transaksi pakai bahasa sehari-hari, bot memahaminya dengan Gemini AI lalu menyimpannya ke Google Sheets.

Jalan sepenuhnya di Google Apps Script — tanpa server, tanpa biaya hosting, tanpa instalasi dependency apa pun.

Baca dalam bahasa lain: **[English (README_EN.md)](README_EN.md)**

---

## Cara kerja

Kamu kirim pesan biasa, atau foto struk/bukti bayar:

```
beli kopi 25k
```

Bot membalas (pesan yang sama di-edit, tanpa spam pesan baru):

```
✅ Tercatat!

📌 Transfer
📝 beli kopi
🏷 Makanan • JAGO
💰 Rp 25.000
📅 17 Juli 2026
```

Baris tersebut masuk ke tab "Expenses" di Google Sheets kamu.

![Penggunaan bot di Telegram](img/3.jpg)

---

## Tampilan

Dashboard dan sheet di Google Sheets:

![Dashboard Sheets](img/1.jpg)

![Sheet income](img/2.jpg)

## Contoh

| Kamu ketik | Metode | Bank | Kategori | Nilai |
|------------|--------|------|----------|-------|
| `beli kopi 25k` | Transfer | JAGO | Makanan | 25.000 |
| `bayar shopee 120k` | Transfer | JAGO | Belanja | 120.000 |
| `makan siang 15k tunai` | Cash | CASH | Makanan | 15.000 |
| `jual server 150k` | Transfer | JAGO | server | 150.000 |
| `beli groceries 120rb BCA kemarin` | Transfer | BCA | Belanja | 120.000 |

## Kirim gambar / struk

Selain mengetik, kamu bisa **mengirim foto** struk, invoice, bukti transfer, atau screenshot pembayaran e-wallet/QRIS. Bot membaca gambar pakai Gemini Vision lalu mencatat otomatis seperti pesan teks.

| Kamu kirim | Hasil |
|------------|-------|
| Foto struk kopi Rp25.000 | Transfer • Makanan • JAGO • 25.000 |
| Screenshot transfer BCA Rp120.000 | Transfer • Belanja • BCA • 120.000 |
| Foto + caption `tunai` | Cash • CASH • (kategori sesuai gambar) |

Tips:
- Tambah **caption** opsional untuk memperjelas, mis. foto struk + caption `makan siang`.
- Gambar dikirim sebagai foto maupun sebagai file/document sama-sama didukung (asalkan tipe image).
- Jika gambar tak terbaca, bot akan minta kamu ketik manual.

Catatan: Telegram membatasi unduhan file bot hingga 20 MB. Struk/screenshot biasanya jauh di bawah itu.

Metode default adalah Transfer, bank default JAGO. Sebut "tunai" atau "cash" untuk Cash. Sebut nama bank untuk ganti dari JAGO.

Bot mengerti singkatan nominal: `rb`/`ribu`/`k` = ribu, `jt`/`juta` = juta. Juga mengerti tanggal relatif: `kemarin`, `2 hari lalu`, `tgl 13`, `minggu lalu`.

---

## Setup

### 1. Buat bot Telegram

Buka [@BotFather](https://t.me/botfather), kirim `/newbot`, ikuti instruksi. Simpan bot token.

### 2. Dapatkan Chat ID

Buka [@userinfobot](https://t.me/userinfobot), kirim pesan apa saja. Bot balas dengan Chat ID angka kamu.

### 3. Dapatkan Gemini API key

Buka https://aistudio.google.com/apikey dan buat key gratis.

### 4. Salin spreadsheet template

Buka [spreadsheet template](https://docs.google.com/spreadsheets/d/1LZJjOE-YZL2GDH4JXVhxa0sQqH1vF3m_QxufEPNQrNc/edit?usp=sharing), lalu **File > Make a copy** ke Google Drive kamu sendiri.

### 5. Buka Apps Script

Di spreadsheet yang sudah disalin, klik **Extensions > Apps Script**.

### 6. Masukkan kode

- Ganti isi `Code.gs` default dengan isi `Kode.gs` dari repo ini.
- Buat file kedua bernama `webhook`, paste isi `webhook.gs` ke sana.
- Isi konfigurasi di bagian atas `Kode.gs`:

```javascript
var BOT_TOKEN = "bot_token_kamu";
var USERS = [chat_id_kamu];
var GEMINI_API_KEY = "gemini_key_kamu";
```

### 7. Deploy sebagai web app

- **Deploy > New deployment > Web app**
- Execute as: Me
- Who has access: Anyone
- Deploy dan authorize saat diminta
- Copy Web App URL

### 8. Daftarkan webhook

Di `webhook.gs`, isi token dan Web App URL:

```javascript
var token = "bot_token_kamu";
var url = "webapp_url_kamu";
```

Pilih function `setWebhook` dan klik Run. Cek execution log — harus ada `"ok":true`.

### 9. Tes

Buka bot kamu di Telegram, kirim `/start`, lalu coba:

```
beli kopi 25k
```

---

## Konfigurasi

Edit bagian atas `Kode.gs`:

```javascript
var BANKS = ["JAGO", "BCA", "CASH"];
var KATEGORI = ["Belanja", "Cicilan", "Makanan", "Tabungan", "Hiburan", "server"];
```

Nilai ini harus cocok dengan data validation (dropdown) di Google Sheets kolom D, F, dan G. Jika tidak cocok, sheet akan menolak penulisan data.

---

## Struktur spreadsheet

| Kolom | Field | Validasi |
|-------|-------|----------|
| A | Cek (checkbox) | — |
| B | Tanggal | — |
| C | Bulan | — |
| D | Transaksi | Transfer / Cash |
| E | Uraian | — |
| F | Kategori | dropdown |
| G | Bank | dropdown |
| H | Nilai | angka |

---

## Troubleshooting

Jalankan function ini dari editor Apps Script untuk diagnosa masalah:

| Function | Cek apa |
|----------|---------|
| `testGeminiConnection` | Apakah API key valid dan model mana yang merespon |
| `listGeminiModels` | List semua model yang bisa diakses API key kamu |
| `testAddToSheet` | Apakah data bisa ditulis ke sheet tanpa error |

Masalah umum:

- **AI gagal merespon** — API key kosong atau invalid. Jalankan `testGeminiConnection`.
- **Validation error** — Output AI tidak cocok dropdown sheet. Jalankan `testAddToSheet`.
- **Bot tidak merespon** — Webhook URL salah. Jalankan ulang `setWebhook` dengan URL benar.
- **429 quota exceeded** — Limit free tier Gemini tercapai. Reset harian, atau enable billing.
- **404 model not found** — Nama model sudah deprecated. Jalankan `listGeminiModels` untuk nama terbaru.

---

## Input manual

Jika AI tidak tersedia, kamu tetap bisa menambah data dengan format semicolon:

```
/tambahdata Transfer;makan;Makanan;JAGO;25000
```

---

## Lisensi

MIT
