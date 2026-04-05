// ELO source tracking
let currentEloSource = 'discord'; // Default to online

// Load saved preference or default to discord
const savedSource = localStorage.getItem('live_popular_cards_source_preference');
if (savedSource && (savedSource === 'discord' || savedSource === 'web')) {
  currentEloSource = savedSource;
}

// Initialize source toggle buttons
function initializeSourceToggle() {
  document.querySelectorAll('.elo-source-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      if (this.disabled) return;

      const source = this.dataset.source;
      if (source === currentEloSource) return; // Already selected

      // Update state
      currentEloSource = source;
      localStorage.setItem('live_popular_cards_source_preference', source);

      // Update UI
      updateToggleButtons(source);

      // Refetch data
      await fetchCardStats();
      await fetchPopularityData();
    });
  });

  // Set initial button states
  updateToggleButtons(currentEloSource);
}

function updateToggleButtons(source) {
  document.querySelectorAll('.elo-source-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.source === source);
  });
}

let allCards = [];
let filteredCards = [];
let currentSort = { field: "percent_of_decks", direction: "desc" };

function getElementClass(element) {
  const el = (element || "none").toLowerCase();
  if (el.includes("fire")) return "element-fire";
  if (el.includes("water")) return "element-water";
  if (el.includes("earth")) return "element-earth";
  if (el.includes("air")) return "element-air";
  return "element-none";
}

function getRarityClass(rarity) {
  const r = (rarity || "").toLowerCase();
  if (r === "unique") return "rarity-unique";
  if (r === "exceptional") return "rarity-exceptional";
  if (r === "elite") return "rarity-elite";
  return "rarity-ordinary";
}

function renderTable() {
  const tbody = document.getElementById("cards-tbody");

  if (filteredCards.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem;">
          No cards match the current filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredCards
    .map(
      (card) => `
      <tr>
        <td><strong><a href="/card/${encodeURIComponent(card.name)}" style="color: inherit; text-decoration: underline;">${card.name}</a></strong></td>
        <td>${card.type}</td>
        <td><span class="element-badge ${getElementClass(card.element)}">${card.element}</span></td>
        <td class="${getRarityClass(card.rarity)}">${card.rarity}</td>
        <td>
          ${card.percent_of_decks}%
          <span class="percent-bar" style="width: ${Math.min(card.percent_of_decks, 100)}px;"></span>
        </td>
        <td>${card.count}</td>
        <td>${card.average_played}</td>
        <td>${card.decks_with_card}</td>
      </tr>
    `,
    )
    .join("");

  document.getElementById("visible-count").textContent =
    filteredCards.length;
}

function sortCards(field) {
  const headers = document.querySelectorAll(".popular-cards-table th");
  headers.forEach((h) => h.classList.remove("sorted-asc", "sorted-desc"));

  if (currentSort.field === field) {
    currentSort.direction =
      currentSort.direction === "asc" ? "desc" : "asc";
  } else {
    currentSort.field = field;
    currentSort.direction = "desc";
  }

  const header = document.querySelector(`th[data-sort="${field}"]`);
  if (header) {
    header.classList.add(`sorted-${currentSort.direction}`);
  }

  filteredCards.sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];

    // Handle string vs number sorting
    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = (bVal || "").toLowerCase();
      return currentSort.direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return currentSort.direction === "asc" ? aVal - bVal : bVal - aVal;
  });

  renderTable();
}

function applyFilters() {
  const typeFilter = document
    .getElementById("type-filter")
    .value.toLowerCase();
  const elementFilter = document
    .getElementById("element-filter")
    .value.toLowerCase();
  const searchQuery = document
    .getElementById("card-search")
    .value.trim()
    .toLowerCase();

  filteredCards = allCards.filter((card) => {
    const typeMatch =
      !typeFilter || (card.type || "").toLowerCase() === typeFilter;
    const elementMatch =
      !elementFilter ||
      (card.element || "").toLowerCase().includes(elementFilter);
    const searchMatch =
      !searchQuery || card.name.toLowerCase().includes(searchQuery);
    return typeMatch && elementMatch && searchMatch;
  });

  // Re-apply current sort
  sortCards(currentSort.field);
}

async function fetchCardStats() {
  try {
    const res = await fetch(`/api/live-popular-cards?source=${currentEloSource}`);

    if (res.status === 403) {
      document.getElementById("cards-tbody").innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: #e74c3c;">
            You don't have permission to view this data.
          </td>
        </tr>
      `;
      return;
    }

    const data = await res.json();

    if (!data || data.length === 0) {
      document.getElementById("cards-tbody").innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem;">
            No card data available yet. Report matches with decklists to see stats!
          </td>
        </tr>
      `;
      return;
    }

    allCards = data;
    filteredCards = [...data];

    // Update summary stats
    const totalDecks = data[0]?.total_decks || 0;
    document.getElementById("total-decks").textContent = totalDecks;
    document.getElementById("unique-cards").textContent = data.length;
    document.getElementById("stats-summary").style.display = "flex";

    // Update counts
    document.getElementById("total-count").textContent = data.length;

    // Set up sorting
    document
      .querySelectorAll(".popular-cards-table th[data-sort]")
      .forEach((th) => {
        th.addEventListener("click", () => sortCards(th.dataset.sort));
      });

    // Set up filters
    document
      .getElementById("type-filter")
      .addEventListener("change", applyFilters);
    document
      .getElementById("element-filter")
      .addEventListener("change", applyFilters);
    document
      .getElementById("card-search")
      .addEventListener("input", applyFilters);

    // Initial render
    renderTable();

    // If popularity data already loaded, auto-load top 8 chart
    if (popularityData && chartSelectedCards.length === 0) {
      const top8 = [...allCards]
        .sort((a, b) => b.percent_of_decks - a.percent_of_decks)
        .slice(0, MAX_CHART_CARDS)
        .map(c => c.name);
      chartSelectedCards = top8;
      renderActiveCards();
      renderPopChart();
    }
  } catch (err) {
    console.error("Error fetching card stats", err);
    document.getElementById("cards-tbody").innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #e74c3c;">
          Error loading card stats
        </td>
      </tr>
    `;
  }
}

// Initialize toggle
initializeSourceToggle();

fetchCardStats();

// ===== Card Popularity Chart =====
const CHART_COLORS = [
  "#2ecc71", "#3498db", "#e74c3c", "#f1c40f",
  "#9b59b6", "#e67e22", "#1abc9c", "#e84393"
];
const MAX_CHART_CARDS = 8;
let popularityData = null;
let chartSelectedCards = [];
let popChartInstance = null;
let popDays = 365;
let popBucket = 7;
let popNormalize = true;

const hoverHighlightPlugin = {
  id: "hoverHighlight",
  beforeDraw(chart) {
    const active = chart.getActiveElements();
    if (active.length === 0) {
      chart.data.datasets.forEach((ds) => {
        ds.borderColor = ds._originalColor || ds.borderColor;
        ds.borderWidth = 2;
      });
      return;
    }
    const hoveredIdx = active[0].datasetIndex;
    chart.data.datasets.forEach((ds, i) => {
      if (!ds._originalColor) ds._originalColor = ds.borderColor;
      if (i === hoveredIdx) {
        ds.borderColor = ds._originalColor;
        ds.borderWidth = 4;
      } else {
        const c = ds._originalColor;
        ds.borderColor = c.length === 7 ? c + "30" : c;
        ds.borderWidth = 1;
      }
    });
  },
};

function renderActiveCards() {
  const container = document.getElementById("chart-active-cards");
  container.innerHTML = chartSelectedCards.map((name, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    return `<span class="chart-active-card" style="background: ${color}33; border: 1px solid ${color};">
      ${name}
      <span class="remove-card" onclick="removeChartCard('${name.replace(/'/g, "\\'")}')">&times;</span>
    </span>`;
  }).join("");
}

function addChartCard(name) {
  if (chartSelectedCards.includes(name)) return;
  if (chartSelectedCards.length >= MAX_CHART_CARDS) {
    chartSelectedCards.shift();
  }
  chartSelectedCards.push(name);
  renderActiveCards();
  renderPopChart();
}

function removeChartCard(name) {
  chartSelectedCards = chartSelectedCards.filter(n => n !== name);
  renderActiveCards();
  renderPopChart();
}

function loadTypePreset(type) {
  // Clear preset button active states
  document.querySelectorAll(".chart-type-presets button").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");

  // Get top 8 cards of this type (sorted by percent_of_decks from allCards)
  let candidates;
  if (type === "All") {
    candidates = [...allCards];
  } else {
    candidates = allCards.filter(c => (c.type || "").toLowerCase() === type.toLowerCase());
  }
  candidates.sort((a, b) => b.percent_of_decks - a.percent_of_decks);
  chartSelectedCards = candidates.slice(0, MAX_CHART_CARDS).map(c => c.name);
  renderActiveCards();
  renderPopChart();
}

function renderPopChart() {
  if (popChartInstance) {
    popChartInstance.destroy();
    popChartInstance = null;
  }

  if (!popularityData || !popularityData.cards || chartSelectedCards.length === 0) {
    const canvas = document.getElementById("popularity-chart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      chartSelectedCards.length === 0 ? "Add cards using the search box or preset buttons above" : "No popularity data available",
      canvas.width / 2,
      canvas.height / 2
    );
    return;
  }

  // Filter dates by time range
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - popDays);
  const allDates = (popularityData.dates || []).filter(d => new Date(d) >= cutoffDate);
  if (allDates.length === 0) return;

  // Bucket dates
  let bucketLabels = [];
  let bucketIndices = [];
  for (let i = 0; i < allDates.length; i += popBucket) {
    const end = Math.min(i + popBucket, allDates.length);
    bucketIndices.push([i, end]);
    const startD = new Date(allDates[i]);
    const endD = new Date(allDates[end - 1]);
    const fmt = { month: "short", day: "numeric" };
    if (end - i === 1) {
      bucketLabels.push(startD.toLocaleDateString("en-US", fmt));
    } else {
      bucketLabels.push(startD.toLocaleDateString("en-US", fmt) + " - " + endD.toLocaleDateString("en-US", fmt));
    }
  }

  // Build daily totals index for normalization
  const dailyTotals = popularityData.daily_totals || [];
  // Map full dates to their index in the complete dates array
  const fullDates = popularityData.dates || [];
  const dateToTotalIdx = {};
  fullDates.forEach((d, i) => { dateToTotalIdx[d] = i; });

  // Build datasets using shared date axis
  const datasets = [];
  chartSelectedCards.forEach((cardName, idx) => {
    const timeline = popularityData.cards[cardName];
    if (!timeline) return;

    // Build date->count lookup
    const dateCounts = {};
    timeline.forEach(p => { dateCounts[p.date] = p.count; });

    // Bucket the counts using shared indices
    const bucketedCounts = bucketIndices.map(([start, end]) => {
      if (popNormalize) {
        // Calculate average % of decks across days in this bucket
        let totalPct = 0;
        let daysWithData = 0;
        for (let j = start; j < end; j++) {
          const totalIdx = dateToTotalIdx[allDates[j]];
          const dayTotal = totalIdx !== undefined ? dailyTotals[totalIdx] : 0;
          const cardCount = dateCounts[allDates[j]] || 0;
          if (dayTotal > 0) {
            totalPct += (cardCount / dayTotal) * 100;
            daysWithData++;
          }
        }
        return daysWithData > 0 ? Math.round(totalPct / daysWithData * 10) / 10 : 0;
      } else {
        let total = 0;
        for (let j = start; j < end; j++) {
          total += dateCounts[allDates[j]] || 0;
        }
        return total;
      }
    });

    const color = CHART_COLORS[idx % CHART_COLORS.length];
    datasets.push({
      label: cardName,
      data: bucketedCounts,
      borderColor: color,
      _originalColor: color,
      backgroundColor: color + "15",
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 6,
      hoverBorderWidth: 4,
    });
  });

  if (datasets.length === 0) return;

  const ctx = document.getElementById("popularity-chart").getContext("2d");
  popChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: bucketLabels,
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      hover: { mode: "dataset", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: "rgba(255, 255, 255, 0.8)" },
        },
        tooltip: {
          mode: "nearest",
          intersect: false,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              return popNormalize
                ? `${context.dataset.label}: ${val}%`
                : `${context.dataset.label}: ${val}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "rgba(255, 255, 255, 0.6)", maxRotation: 45, minRotation: 45 },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "rgba(255, 255, 255, 0.6)",
            callback: function(value) {
              return popNormalize ? value + "%" : value;
            },
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          title: {
            display: true,
            text: popNormalize ? "% of Decks" : "Deck Count",
            color: "rgba(255, 255, 255, 0.6)",
          },
        },
      },
    },
    plugins: [hoverHighlightPlugin],
  });
}

// Search box functionality
const chartSearchInput = document.getElementById("chart-card-search");
const chartSearchResults = document.getElementById("chart-search-results");

chartSearchInput.addEventListener("input", function() {
  const query = this.value.trim().toLowerCase();
  if (query.length < 2) {
    chartSearchResults.style.display = "none";
    return;
  }

  // Search from allCards (already loaded from /api/live-popular-cards)
  const matches = allCards
    .filter(c => c.name.toLowerCase().includes(query) && !chartSelectedCards.includes(c.name))
    .slice(0, 10);

  if (matches.length === 0) {
    chartSearchResults.style.display = "none";
    return;
  }

  chartSearchResults.innerHTML = matches.map(c =>
    `<div class="search-result-item" onclick="addChartCard('${c.name.replace(/'/g, "\\'")}'); chartSearchInput.value = ''; chartSearchResults.style.display = 'none';">
      ${c.name}<span class="result-type">${c.type}</span>
    </div>`
  ).join("");
  chartSearchResults.style.display = "block";
});

// Hide search results when clicking outside
document.addEventListener("click", function(e) {
  if (!e.target.closest(".chart-search-box")) {
    chartSearchResults.style.display = "none";
  }
});

// Sliders
document.getElementById("pop-days-slider").addEventListener("input", function() {
  popDays = parseInt(this.value);
  document.getElementById("pop-days-value").textContent = popDays;
  renderPopChart();
});

document.getElementById("pop-bucket-slider").addEventListener("input", function() {
  popBucket = parseInt(this.value);
  document.getElementById("pop-bucket-value").textContent = popBucket === 1 ? "1 day" : popBucket + " days";
  renderPopChart();
});

document.getElementById("pop-normalize").addEventListener("change", function() {
  popNormalize = this.checked;
  renderPopChart();
});

// Fetch popularity data
async function fetchPopularityData() {
  try {
    const res = await fetch(`/api/cards/popularity?source=${currentEloSource}`);
    if (!res.ok) return;
    popularityData = await res.json();

    // Auto-load top 8 overall once data and allCards are ready
    if (allCards.length > 0 && chartSelectedCards.length === 0) {
      const top8 = [...allCards]
        .sort((a, b) => b.percent_of_decks - a.percent_of_decks)
        .slice(0, MAX_CHART_CARDS)
        .map(c => c.name);
      chartSelectedCards = top8;
      renderActiveCards();
      renderPopChart();
    }
  } catch (err) {
    console.error("Error fetching popularity data:", err);
  }
}

fetchPopularityData();
