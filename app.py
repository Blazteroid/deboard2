"""
Deboard - Dashboard Monitoring Sistem Operasi (Debian)
Backend: Flask + psutil
Membaca data Memory, CPU, Disk, dan I/O langsung dari /proc dan /sys (via psutil)
"""

from flask import Flask, jsonify, render_template
import psutil
import time
import platform
from collections import deque
from datetime import datetime
import threading

app = Flask(__name__)

# ---------------------------------------------------------
# Penyimpanan history in-memory untuk grafik "Ringkasan Sistem"
# Setiap entri: {time, memory, cpu, disk}
# Disimpan maksimal 24 jam data dengan interval 1 menit (1440 titik)
# ---------------------------------------------------------
MAX_HISTORY = 1440
history = deque(maxlen=MAX_HISTORY)
history_lock = threading.Lock()


def get_system_snapshot():
    """Ambil snapshot penggunaan Memory, CPU, dan Disk saat ini."""
    mem = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=0.5)
    disk = psutil.disk_usage('/')

    return {
        "memory": round(mem.percent, 2),
        "cpu": round(cpu_percent, 2),
        "disk": round(disk.percent, 2),
    }


def background_collector():
    """Thread background yang merekam snapshot tiap 60 detik untuk history."""
    while True:
        snap = get_system_snapshot()
        with history_lock:
            history.append({
                "time": datetime.now().strftime("%H:%M"),
                **snap
            })
        time.sleep(60)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stats")
def api_stats():
    """Data real-time untuk kartu Memory, CPU, Disk, dan Top Proses I/O."""
    mem = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=0.5)
    cpu_cores = psutil.cpu_count(logical=True)
    load_avg = 0
    try:
        load_avg = round(psutil.getloadavg()[0], 2)
    except (AttributeError, OSError):
        load_avg = 0  # tidak tersedia di beberapa platform

    disk = psutil.disk_usage('/')

    # Top proses berdasarkan I/O (read + write bytes)
    procs = []
    for p in psutil.process_iter(['pid', 'name']):
        try:
            io = p.io_counters()
            procs.append({
                "pid": p.pid,
                "name": p.info['name'],
                "read_kb": round(io.read_bytes / 1024, 1),
                "write_kb": round(io.write_bytes / 1024, 1),
                "total_io": io.read_bytes + io.write_bytes
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, AttributeError):
            continue

    top_procs = sorted(procs, key=lambda x: x["total_io"], reverse=True)[:5]

    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time
    uptime_str = format_uptime(uptime_seconds)

    return jsonify({
        "memory": {
            "percent": round(mem.percent, 2),
            "used_gb": round(mem.used / (1024 ** 3), 2),
            "total_gb": round(mem.total / (1024 ** 3), 2),
        },
        "cpu": {
            "percent": round(cpu_percent, 2),
            "cores": cpu_cores,
            "load_avg": load_avg,
        },
        "disk": {
            "percent": round(disk.percent, 2),
            "used_gb": round(disk.used / (1024 ** 3), 2),
            "total_gb": round(disk.total / (1024 ** 3), 2),
        },
        "top_processes": top_procs,
        "uptime": uptime_str,
        "hostname": platform.node(),
        "os": f"{platform.system()} ({platform.release()})",
        "timestamp": datetime.now().strftime("%d %b %Y %H:%M:%S"),
    })


@app.route("/api/history")
def api_history():
    """Data time-series untuk grafik 'Ringkasan Sistem'."""
    with history_lock:
        data = list(history)
    return jsonify(data)


def format_uptime(seconds):
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    if days > 0:
        return f"{days}h {hours}j {minutes}m"
    return f"{hours}j {minutes}m"


if __name__ == "__main__":
    # Jalankan thread pengumpul history di background
    collector_thread = threading.Thread(target=background_collector, daemon=True)
    collector_thread.start()

    app.run(host="0.0.0.0", port=5000, debug=True)
