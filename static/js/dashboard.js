// ============================================================
// Deboard - Dashboard JS
// Mengambil data dari /api/stats dan /api/history, lalu render
// donut charts (Chart.js) dan line chart ringkasan sistem.
// ============================================================

const COLORS = {
  red: "#ff4d6d", pink: "#ff8fa3",
  blue: "#3b82f6", lightblue: "#60a5fa",
  green: "#22c55e",
  track: "#1b2740"
};

let memoryChart, cpuChart, diskChart, historyChart;
let currentRange = "1h";

function makeDonut(ctx, usedColor, freeColor) {
  return new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: [usedColor, freeColor],
        borderWidth: 0,
      }]
    },
    options: {
      cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 400 }
    }
  });
}

function initCharts() {
  memoryChart = makeDonut(document.getElementById("memoryChart"), COLORS.red, COLORS.pink);
  cpuChart = makeDonut(document.getElementById("cpuChart"), COLORS.blue, COLORS.lightblue);
  diskChart = makeDonut(document.getElementById("diskChart"), COLORS.green, COLORS.lightblue);

  historyChart = new Chart(document.getElementById("historyChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Memory", data: [], borderColor: COLORS.red, backgroundColor: "transparent", tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: "CPU", data: [], borderColor: COLORS.blue, backgroundColor: "transparent", tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: "Disk", data: [], borderColor: COLORS.green, backgroundColor: "transparent", tension: 0.3, pointRadius: 0, borderWidth: 2 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#7d8aa8", usePointStyle: true, boxWidth: 8 }
        }
      },
      scales: {
        x: { grid: { color: "#1b2740" }, ticks: { color: "#7d8aa8" } },
        y: {
          min: 0, max: 100,
          grid: { color: "#1b2740" },
          ticks: { color: "#7d8aa8", callback: (v) => v + "%" }
        }
      }
    }
  });
}

function updateDonut(chart, percent) {
  chart.data.datasets[0].data = [percent, Math.max(0, 100 - percent)];
  chart.update();
}

async function fetchStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();

    // Memory
    updateDonut(memoryChart, data.memory.percent);
    document.getElementById("memoryPercent").textContent = data.memory.percent + "%";
    document.getElementById("memoryDetail").textContent =
      `${data.memory.used_gb} GB / ${data.memory.total_gb} GB`;
    document.getElementById("memoryPercentSmall").textContent = `(${data.memory.percent}%)`;
    document.getElementById("miniMemory").textContent = data.memory.percent + "%";

    // CPU
    updateDonut(cpuChart, data.cpu.percent);
    document.getElementById("cpuPercent").textContent = data.cpu.percent + "%";
    document.getElementById("cpuDetail").textContent =
      `${data.cpu.percent}% used  |  ${data.cpu.cores} cores`;
    document.getElementById("cpuLoad").textContent = `Load avg: ${data.cpu.load_avg}`;
    document.getElementById("miniCpu").textContent = data.cpu.percent + "%";

    // Disk
    updateDonut(diskChart, data.disk.percent);
    document.getElementById("diskPercent").textContent = data.disk.percent + "%";
    document.getElementById("diskDetail").textContent =
      `${data.disk.used_gb} GB / ${data.disk.total_gb} GB`;
    document.getElementById("diskPercentSmall").textContent = `(${data.disk.percent}%)`;
    document.getElementById("miniDisk").textContent = data.disk.percent + "%";

    // Uptime
    document.getElementById("miniUptime").textContent = data.uptime;

    // OS label
    document.getElementById("os-label").textContent = `Sistem Operasi (${data.os})`;

    // Top processes
    const tbody = document.getElementById("processTableBody");
    if (data.top_processes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Tidak ada data</td></tr>`;
    } else {
      tbody.innerHTML = data.top_processes.map(p => `
        <tr>
          <td>${p.pid}</td>
          <td>${p.name}</td>
          <td>${p.read_kb.toFixed(1)} KB</td>
          <td>${p.write_kb.toFixed(1)} KB</td>
        </tr>
      `).join("");
    }

    // Datetime
    document.getElementById("datetime").textContent = data.timestamp;

  } catch (err) {
    console.error("Gagal mengambil /api/stats:", err);
  }
}

function rangeToPointCount(range) {
  // Data history direkam tiap 1 menit
  switch (range) {
    case "1h": return 60;
    case "6h": return 360;
    case "12h": return 720;
    case "24h": return 1440;
    default: return 60;
  }
}

async function fetchHistory() {
  try {
    const res = await fetch("/api/history");
    const data = await res.json();

    const pointCount = rangeToPointCount(currentRange);
    const sliced = data.slice(-pointCount);

    historyChart.data.labels = sliced.map(d => d.time);
    historyChart.data.datasets[0].data = sliced.map(d => d.memory);
    historyChart.data.datasets[1].data = sliced.map(d => d.cpu);
    historyChart.data.datasets[2].data = sliced.map(d => d.disk);
    historyChart.update();
  } catch (err) {
    console.error("Gagal mengambil /api/history:", err);
  }
}

function setupRangeButtons() {
  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRange = btn.dataset.range;
      fetchHistory();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  setupRangeButtons();
  fetchStats();
  fetchHistory();

  setInterval(fetchStats, 3000);   // refresh kartu tiap 3 detik
  setInterval(fetchHistory, 60000); // refresh grafik tiap 1 menit
});
