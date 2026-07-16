# 🤖 CatatAja

> Chat, catat, selesai. ⚡

CatatAja — pencatat keuangan pribadi berbasis AI untuk Telegram. Cukup ketik transaksimu dengan bahasa natural — bot otomatis memahami nominal, kategori, dan metode pembayaran, lalu menyimpannya ke Google Sheets.

**"beli kopi 25k"** → bot catat: Transfer • JAGO • Makanan • Rp 25.000

---

## ✨ Fitur

- 🤖 **Natural Language Parsing** — Ketik "beli kopi 25k", bot otomatis catat. Tidak perlu format kaku.
- 📊 **Google Sheets** — Data langsung tersimpan di spreadsheet kamu
- 🧠 **Gemini AI** — Memahami singkatan (rb/jt/k), tanggal relatif ("kemarin"), dan metode pembayaran
- 🔒 **Anti Prompt Injection** — Aman dari manipulasi AI
- 👤 **Access Control** — Hanya Chat ID terdaftar yang bisa pakai bot
- 📝 **Manual Input** — Tetap bisa pakai `/tambahdata` format semicolon
- ✏️ **Edit-in-place** — Pesan "⏳ Memproses" berubah jadi hasil, tanpa pesan baru

---

## 📋 Contoh Penggunaan

| Pesan | Transaksi | Bank | Kategori | Nilai |
|-------|-----------|------|----------|-------|
| `beli kopi 25k` | Transfer | JAGO | Makanan | 25.000 |
| `bayar shopee 120k` | Transfer | JAGO | Belanja | 120.000 |
| `makan siang 15k tunai` | Cash | CASH | Makanan | 15.000 |
| `jual server 150k` | Transfer | JAGO | server | 150.000 |
| `beli groceries 120rb BCA kemarin` | Transfer | BCA | Belanja | 120.000 |

Default metode = **Transfer** dan bank = **JAGO**. Sebut "tunai" untuk Cash, atau sebut nama bank lain.

---

## 🚀 Setup

### 1. Buat Telegram Bot

1. Buka Telegram, chat [@BotFather](https://t.me/botfather)
2. Kirim `/newbot`, ikuti instruksi
3. Simpan **Bot Token**

### 2. Dapatkan Chat ID

1. Chat [@userinfobot](https://t.me/userinfobot) di Telegram
2. Simpan angka **Chat ID** Anda

### 3. Dapatkan Gemini API Key

1. Buka https://aistudio.google.com/apikey
2. Buat API key gratis
3. Simpan key-nya

### 4. Clone Spreadsheet Template

1. Buka [template spreadsheet](https://docs.google.com/spreadsheets/d/1LZJjOE-YZL2GDH4JXVhxa0sQqH1vF3m_QxufEPNQrNc/edit?usp=sharing)
2. Klik **File → Make a copy** untuk menyalin ke Google Drive Anda
3. Buka salinan tersebut

### 5. Setup Google Apps Script

1. Di spreadsheet kamu, klik **Extensions → Apps Script**
2. Hapus kode default, ganti dengan isi file `Kode.gs` dari repo ini
3. Buat file baru di project, beri nama `webhook`, paste isi `webhook.gs`
4. Isi konfigurasi di bagian atas `Kode.gs`:

```javascript
var BOT_TOKEN = "your_bot_token";        // dari @BotFather
var USERS = [your_chat_id];               // dari @userinfobot
var GEMINI_API_KEY = "your_gemini_key";   // dari aistudio.google.com
```

### 6. Deploy sebagai Web App

1. Klik **Deploy → New deployment**
2. Pilih **Web app**
3. Setting:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Klik **Deploy**, authorize jika diminta
5. Copy **Web App URL**

### 7. Set Webhook

1. Buka file `webhook.gs`, isi `token` dan `url`:

```javascript
var token = "your_bot_token";       // sama dengan BOT_TOKEN
var url = "your_webapp_url";         // Web App URL dari langkah 6
```

2. Pilih function `setWebhook` di dropdown atas
3. Klik **Run**
4. Cek **Execution log** — harus ada `"ok":true`

### 8. Test! 🎉

Buka bot di Telegram, kirim `/start`, lalu coba:

```
beli kopi 25k
```

Bot akan membalas:

```
✅ Tercatat!

📌 Transfer
📝 beli kopi
🏷 Makanan • JAGO
💰 Rp 25.000
📅 17 Juli 2026
```

---

## ⚙️ Kustomisasi

Edit bagian config di atas `Kode.gs`:

```javascript
var BANKS = ["JAGO", "BCA", "CASH"];                          // pilihan bank di dropdown sheet
var KATEGORI = ["Belanja", "Cicilan", "Makanan", "Tabungan", "Hiburan", "server"];
```

**Penting:** Nilai `BANKS` dan `KATEGORI` harus cocok dengan data validation (dropdown) di Google Sheets kamu. Jika tidak cocok, data akan ditolak oleh sheet.

---

## 📊 Struktur Spreadsheet

| Kolom | Header | Tipe | Validasi |
|-------|--------|------|----------|
| A | Cek | Checkbox | — |
| B | Tanggal | Date | — |
| C | Bulan | Text | — |
| D | Transaksi | Dropdown | Transfer / Cash |
| E | Uraian | Text | — |
| F | Kategori | Dropdown | (sesuai config) |
| G | Bank | Dropdown | (sesuai config) |
| H | Nilai | Number | — |

Template sudah punya dropdown validation di kolom D, F, G. Pastikan config di `Kode.gs` cocok.

---

## 🔧 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `❌ AI gagal merespon` | Cek Gemini API key. Jalankan `testGeminiConnection` di editor Apps Script |
| `❌ Validation error` | Nilai AI tidak cocok dropdown sheet. Jalankan `testAddToSheet` untuk cek |
| Bot tidak merespon | Webhook URL salah. Jalankan ulang `setWebhook` dengan URL benar |
| `429 quota exceeded` | Free tier Gemini terbatas. Tunggu reset harian atau enable billing |
| Model `404 not found` | Nama model sudah deprecated. Jalankan `listGeminiModels` untuk lihat model tersedia |

### Function test di editor Apps Script

- `testGeminiConnection` — cek apakah API key Gemini valid & model tersedia
- `listGeminiModels` — list semua model yang bisa dipakai API key kamu
- `testAddToSheet` — cek apakah data bisa ditulis ke sheet tanpa error

---

## 📝 Lisensi

MIT — Bebas digunakan dan dimodifikasi.
