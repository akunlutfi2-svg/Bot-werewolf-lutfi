# 🐺 Werewolf WhatsApp Bot

Bot game Werewolf untuk WhatsApp, siap deploy di Railway.

---

## 🚀 Cara Deploy ke Railway

### Langkah 1 — Upload ke GitHub
1. Buat repository baru di GitHub
2. Upload semua file ini ke repo tersebut
3. Pastikan `auth_info/` ada di `.gitignore` (sudah ada)

### Langkah 2 — Deploy ke Railway
1. Buka [railway.app](https://railway.app) dan login
2. Klik **New Project → Deploy from GitHub repo**
3. Pilih repo yang sudah kamu buat
4. Railway akan otomatis detect Node.js dan install dependencies
5. Klik **Deploy**

### Langkah 3 — Verifikasi WhatsApp (Scan QR)
1. Setelah deploy, buka **Logs** di Railway dashboard
2. Kamu akan melihat QR code di terminal log
3. Buka WhatsApp di HP → **Perangkat Tertaut → Tautkan Perangkat**
4. Scan QR yang muncul di log Railway
5. Bot otomatis terhubung dan siap digunakan!

> ⚠️ **Penting:** Setelah pertama kali scan, session tersimpan di folder `auth_info/`.
> Namun di Railway, folder ini akan hilang setiap kali redeploy karena filesystem-nya ephemeral.
> **Solusi:** Gunakan Railway Volume atau set environment variable untuk menyimpan session.

---

## 🎮 Cara Main

### Di Grup WhatsApp:
| Perintah | Fungsi |
|----------|--------|
| `.ww create` | Buat room game baru |
| `.ww join` | Bergabung ke room |
| `.ww leave` | Keluar dari room |
| `.ww start` | Mulai game (min. 4 pemain) |
| `.ww stop` | Hentikan game |
| `.ww player` | Lihat daftar pemain |
| `.ww vote [nomor]` | Vote untuk mengeksekusi pemain |
| `.wwhelp` | Tampilkan bantuan |

### Di Private Message (DM ke bot):
| Perintah | Role | Fungsi |
|----------|------|--------|
| `.wwpc kill [nomor]` | Werewolf | Bunuh pemain |
| `.wwpc dreamy [nomor]` | Seer | Lihat role pemain |
| `.wwpc deff [nomor]` | Guardian | Lindungi pemain |
| `.wwpc sorcerer [nomor]` | Sorcerer | Buka identitas pemain |

---

## 📋 Jumlah Pemain & Distribusi Role

| Pemain | Werewolf | Seer | Guardian | Sorcerer | Warga |
|--------|----------|------|----------|----------|-------|
| 4 | 1 | 1 | 1 | 0 | 1 |
| 5 | 1 | 1 | 1 | 0 | 2 |
| 6 | 2 | 1 | 1 | 0 | 2 |
| 7 | 2 | 1 | 1 | 0 | 3 |
| 8 | 2 | 1 | 1 | 0 | 4 |
| 9 | 2 | 1 | 1 | 1 | 4 |
| 10 | 2 | 1 | 1 | 1 | 5 |

---

## ⚙️ Struktur File

```
werewolf-bot/
├── index.js          ← Bot utama + command handler
├── game/
│   └── werewolf.js   ← Logika game werewolf
├── lib/
│   └── myfunc.js     ← Helper functions
├── package.json
├── railway.toml      ← Konfigurasi Railway
├── Procfile
└── .gitignore
```

---

## 🔧 Tips Menyimpan Session di Railway

Agar tidak perlu scan QR ulang setiap deploy, gunakan Railway Volume:
1. Di Railway dashboard → **Add Volume**
2. Mount path: `/app/auth_info`
3. Session akan persisten meski redeploy
