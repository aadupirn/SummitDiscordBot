const config = JSON.parse(document.getElementById('page-config').textContent);

const cardName = config.cardName;
let popularityChartInstance = null;
let popularityData = null;
let currentDays = 365;
let currentScale = 0; // 0 = auto
let currentBucket = 1; // days per bucket
let popNormalize = true;

async function fetchCardData() {
  try {
    const res = await fetch(
      `/api/card/${encodeURIComponent(cardName)}`,
    );
    if (!res.ok) {
      document.getElementById("card-name").textContent =
        "Card not found";
      document.getElementById("card-image-container").innerHTML =
        '<p class="loading-text">Card not found in database</p>';
      return;
    }
    const data = await res.json();

    // Update card info
    document.getElementById("card-name").textContent = data.name;
    document.getElementById("card-type").textContent = data.type || "Unknown Type";
    document.title = `${data.name} - Sorcerers Summit`;

    // Update overall stats
    document.getElementById("stat-wins").textContent = data.wins;
    document.getElementById("stat-losses").textContent = data.losses;
    document.getElementById("stat-winrate").textContent =
      `${data.win_rate}%`;
    document.getElementById("stat-matches").textContent =
      data.total_matches;

    // Display card image
    const imageContainer = document.getElementById("card-image-container");
    if (data.image) {
      const isSite = (data.type || "").toLowerCase() === "site";
      if (isSite) {
        imageContainer.className = "card-image-container site-card";
      }
      imageContainer.innerHTML = `
        <img
          src="/card-images/${data.image}"
          alt="${data.name}"
          onerror="this.parentElement.innerHTML = '<p class=\\'loading-text\\'>Image not available</p>';"
        />
      `;
    } else {
      imageContainer.innerHTML =
        '<p class="loading-text">No image available for this card</p>';
    }
  } catch (error) {
    document.getElementById("card-name").textContent =
      "Error loading card";
    document.getElementById("card-image-container").innerHTML =
      '<p class="loading-text">Error loading card data</p>';
    console.error(error);
  }
}

async function fetchPopularityData() {
  try {
    const res = await fetch(
      `/api/card/${encodeURIComponent(cardName)}/popularity`,
    );
    if (!res.ok) {
      console.error("Failed to fetch popularity data");
      return;
    }
    popularityData = await res.json();
    renderPopularityChart(popularityData, currentDays, currentScale);
    setupPopularitySliders();
  } catch (error) {
    console.error("Error fetching popularity data:", error);
  }
}

function renderPopularityChart(data, days, scale) {
  // Destroy existing chart if it exists
  if (popularityChartInstance) {
    popularityChartInstance.destroy();
    popularityChartInstance = null;
  }

  if (!data || !data.timeline || data.timeline.length === 0) {
    const canvas = document.getElementById("popularity-chart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "No popularity data available",
      canvas.width / 2,
      canvas.height / 2,
    );
    return;
  }

  // Filter data to last N days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const filteredTimeline = data.timeline.filter((point) => {
    const pointDate = new Date(point.date);
    return pointDate >= cutoffDate;
  });

  if (filteredTimeline.length === 0) {
    const canvas = document.getElementById("popularity-chart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "No data in selected time range",
      canvas.width / 2,
      canvas.height / 2,
    );
    return;
  }

  // Build daily totals for normalization
  const dailyTotals = data.daily_totals || [];

  // Bucket the data by grouping N days together
  let labels, counts;
  if (currentBucket <= 1) {
    labels = filteredTimeline.map((point) => {
      const date = new Date(point.date);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });
    if (popNormalize) {
      counts = filteredTimeline.map((point) => {
        const fullIdx = data.timeline.findIndex(p => p.date === point.date);
        const dayTotal = fullIdx >= 0 && fullIdx < dailyTotals.length ? dailyTotals[fullIdx] : 0;
        return dayTotal > 0 ? Math.round((point.count / dayTotal) * 1000) / 10 : 0;
      });
    } else {
      counts = filteredTimeline.map((point) => point.count);
    }
  } else {
    labels = [];
    counts = [];
    for (let i = 0; i < filteredTimeline.length; i += currentBucket) {
      const chunk = filteredTimeline.slice(
        i,
        Math.min(i + currentBucket, filteredTimeline.length),
      );
      if (popNormalize) {
        let totalPct = 0;
        let daysWithData = 0;
        chunk.forEach((point) => {
          const fullIdx = data.timeline.findIndex(p => p.date === point.date);
          const dayTotal = fullIdx >= 0 && fullIdx < dailyTotals.length ? dailyTotals[fullIdx] : 0;
          if (dayTotal > 0) {
            totalPct += (point.count / dayTotal) * 100;
            daysWithData++;
          }
        });
        counts.push(daysWithData > 0 ? Math.round(totalPct / daysWithData * 10) / 10 : 0);
      } else {
        const total = chunk.reduce((sum, p) => sum + p.count, 0);
        counts.push(total);
      }

      // Label: show date range for the bucket
      const startDate = new Date(chunk[0].date);
      const endDate = new Date(chunk[chunk.length - 1].date);
      const fmt = { month: "short", day: "numeric" };
      if (chunk.length === 1) {
        labels.push(startDate.toLocaleDateString("en-US", fmt));
      } else {
        labels.push(
          startDate.toLocaleDateString("en-US", fmt) +
            " - " +
            endDate.toLocaleDateString("en-US", fmt),
        );
      }
    }
  }

  // Calculate Y-axis range
  let yMin = 0;
  let yMax;
  if (scale === 0) {
    // Auto scale
    yMax = Math.max(...counts) * 1.1;
  } else {
    // Manual scale
    yMax = scale;
  }

  const ctx = document.getElementById("popularity-chart").getContext("2d");
  popularityChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: popNormalize ? "% of Decks" : "Decks Played",
          data: counts,
          borderColor: "rgba(46, 204, 113, 1)",
          backgroundColor: "rgba(46, 204, 113, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
          },
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: function (context) {
              const val = context.parsed.y;
              return popNormalize ? `% of Decks: ${val}%` : `Decks: ${val}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "rgba(255, 255, 255, 0.6)",
            maxRotation: 45,
            minRotation: 45,
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
        },
        y: {
          min: yMin,
          max: popNormalize ? undefined : yMax,
          ticks: {
            color: "rgba(255, 255, 255, 0.6)",
            stepSize: popNormalize ? undefined : Math.ceil(yMax / 10),
            callback: function(value) {
              return popNormalize ? value + "%" : value;
            },
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          title: {
            display: true,
            text: popNormalize ? "% of Decks" : "Deck Count",
            color: "rgba(255, 255, 255, 0.6)",
          },
        },
      },
    },
  });
}

function setupPopularitySliders() {
  const daysSlider = document.getElementById("days-slider");
  const bucketSlider = document.getElementById("bucket-slider");
  const scaleSlider = document.getElementById("scale-slider");
  const daysValue = document.getElementById("days-value");
  const bucketValue = document.getElementById("bucket-value");
  const scaleValue = document.getElementById("scale-value");

  daysSlider.addEventListener("input", function () {
    daysValue.textContent = this.value;
    currentDays = parseInt(this.value);
    renderPopularityChart(popularityData, currentDays, currentScale);
  });

  bucketSlider.addEventListener("input", function () {
    const value = parseInt(this.value);
    currentBucket = value;
    bucketValue.textContent =
      value === 1 ? "1 day" : value + " days";
    renderPopularityChart(popularityData, currentDays, currentScale);
  });

  scaleSlider.addEventListener("input", function () {
    const value = parseInt(this.value);
    if (value === 0) {
      scaleValue.textContent = "Auto";
    } else {
      scaleValue.textContent = value;
    }
    currentScale = value;
    renderPopularityChart(popularityData, currentDays, currentScale);
  });

  document.getElementById("pop-normalize").addEventListener("change", function () {
    popNormalize = this.checked;
    renderPopularityChart(popularityData, currentDays, currentScale);
  });
}

fetchCardData();
fetchPopularityData();
