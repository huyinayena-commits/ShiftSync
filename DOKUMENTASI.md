# 📅 TSM Shift Scheduler - Dokumentasi Lengkap

Aplikasi web berbasis HTML/JS untuk membuat jadwal shift otomatis dengan aturan operasional yang ketat dan fitur edit reaktif.

## 🌟 Fitur Utama

### 1. **Generator Jadwal Otomatis**
   - **Sekali Klik**: Cukup masukkan tanggal mulai/akhir dan kondisi awal (H-1), jadwal langsung jadi.
   - **Logika Cerdas**: Algoritma memperhitungkan rotasi, libur, dan keseimbangan tim secara otomatis.

### 2. **Aturan Bisnis (Rules Engine)**
   Sistem mematuhi aturan operasional berikut:
   - **Rotasi Kunci (PK)**: Pemegang Kunci (Shift 2) wajib masuk Shift 1 besoknya.
   - **Rotasi Libur**: Habis OFF wajib masuk Shift 2.
   - **Batas Kuota Libur**: Maksimal 1x OFF per orang dalam satu minggu (Senin-Minggu).
   - **Distribusi PK Adil**: Tugas PK dibagi rata antara CIF, SSL, dan SJL (agar tidak menumpuk di satu orang).
   - **Anti-Monoton**: Mencegah seseorang mendapat shift yang sama (misal Pagi terus) lebih dari 2 hari berturut-turut.
   - **Anti-Zigzag**: Mencegah pola OFF yang berantakan (tidak boleh OFF lagi jika kemarin baru saja OFF).

### 3. **Edit Manual Reaktif (Smart Edit)** 🔓➡️🔒
   Fitur canggih untuk koreksi manual:
   - **Klik & Ganti**: Klik kotak shift di tabel untuk mengubah (Siklus: 1 ➝ 2 ➝ OFF).
   - **Auto-Kunci (Lock)**: Kotak yang diedit akan ditandai dengan ikon 🔒 dan border kuning.
   - **Regenerasi Otomatis**: Saat Anda mengubah satu kotak, jadwal hari-hari berikutnya akan **dihitung ulang otomatis** untuk menyesuaikan perubahan tersebut tanpa melanggar aturan.

### 4. **Visualisasi Premium**
   - **Kode Shift Simpel**: `1` (Pagi), `2` (Siang), `OFF` (Libur).
   - **Penanda PK**: Titik oranye pada shift Siang menandakan pembawa kunci untuk besok.
   - **Tanggal Merah**: Menandai hari libur nasional dengan warna merah khusus.

---

## 📖 Cara Penggunaan

1.  **Siapkan Data (Panel Kiri)**
    *   **Tanggal Mulai & Selesai**: Pilih rentang tanggal yang ingin dibuatkan jadwal.
    *   **Event (Opsional)**: Jika ada tanggal event toko, masukkan tanggalnya (Semua wajib masuk, No OFF).
    *   Klik tombol **"SIAPKAN"**.

2.  **Input Kondisi H-1 (Penting!)**
    *   Akan muncul Popup.
    *   **PK Kemarin**: Siapa yang pegang kunci kemarin? (Dia wajib masuk Pagi hari ini).
    *   **OFF Kemarin**: Siapa yang libur kemarin? (Dia wajib masuk Siang hari ini).
    *   Klik **"EKSEKUSI"**.

3.  **Review & Edit**
    *   Jadwal akan muncul di tabel.
    *   Jika ada yang kurang pas, **Klik Langsung** di kotak tersebut untuk mengubahnya.
    *   Perhatikan bagaimana jadwal di kanannya berubah menyesuaikan pilihan Anda.

4.  **Simpan**
    *   Gunakan fitur Print browser (Ctrl+P) untuk menyimpan sebagai PDF atau mencetak.

---

## ⚙️ Penjelasan Teknis Singkat

*   **File Utama**:
    *   `index.html`: Struktur tampilan.
    *   `script.js`: Otak algoritma (mengandung logika *Weighted Rotation* dan *Constraint Satisfaction*).
    *   `index.css`: Styling tampilan modern.
*   **Tanpa Instalasi**: Aplikasi berjalan langsung di browser (Chrome/Edge), tidak butuh internet atau server database.

---
*Dibuat untuk Tim TSM - 2026*
