# Deboard — Dashboard Monitoring Sistem Operasi (Debian)

Dashboard monitoring Memory, CPU, Disk, dan I/O secara real-time, dibaca langsung
dari `/proc` dan `/sys` melalui `psutil`.

## Cara Menjalankan (di Debian)

```bash
# 1. Masuk ke folder project
cd deboard2

# 2. Buat virtual environment (opsional tapi disarankan)
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Jalankan server
python3 app.py
```

Buka browser ke `http://localhost:5000` (atau `http://<ip-vm>:5000` dari host).

## Struktur Project

```
deboard/
├── app.py                 # Backend Flask + psutil
├── requirements.txt
├── templates/
│   └── index.html         # Halaman dashboard
└── static/
    ├── css/style.css      # Styling dark theme
    └── js/dashboard.js    # Fetch data + render Chart.js
```

## Endpoint API

- `GET /api/stats` — data real-time Memory, CPU, Disk, Top Proses I/O, uptime
- `GET /api/history` — data time-series (direkam tiap 1 menit, max 24 jam) untuk grafik ringkasan

## Catatan

- Grafik "Ringkasan Sistem" butuh waktu berjalan untuk terisi data (direkam tiap 1 menit
  oleh thread background). Semakin lama server jalan, semakin panjang riwayatnya.
- `load_avg` memakai `psutil.getloadavg()` — hanya tersedia di Linux/Unix (cocok untuk Debian).
- Untuk uji beban CPU, gunakan `stress --cpu 2 --timeout 30` seperti yang sudah pernah dicoba sebelumnya.
