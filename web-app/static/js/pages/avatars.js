// Configurable image settings
const AVATAR_IMAGE_CONFIG = {
  opacity: 0.15, // Opacity of background image (0.0 to 1.0)
  defaultZoom: 100, // Default background-size percentage (100 = cover, >100 = more zoom, <100 = less zoom)
  defaultPosition: "center center", // Default position (horizontal vertical)

  // Per-avatar zoom overrides (adjust for specific avatars)
  // 100 = fill card, <100 = show more of image, >100 = zoom in more
  zoomOverrides: {
    // Elemental Avatars
    "avatar of air": 100,
    "avatar of earth": 100,
    "avatar of fire": 100,
    "avatar of water": 100,

    // GOT Avatars (larger images, need less zoom)
    "animist": 85,
    "bladedancer": 100,
    "corruptor": 85,
    "duplicator": 85,
    "harbinger": 85,
    "imposter": 85,
    "interrogator": 100,
    "ironclad": 85,
    "magician": 85,
    "necromancer": 100,
    "persecutor": 85,
    "realm eater": 85,
    "savior": 100,

    // Standard Avatars
    "battlemage": 100,
    "deathspeaker": 100,
    "elementalist": 100,
    "enchantress": 100,
    "flamecaller": 100,
    "geomancer": 100,
    "pathfinder": 100,
    "seer": 100,
    "sorcerer": 100,
    "sparkmage": 100,
    "waveshaper": 100,
  },

  // Per-avatar position overrides
  // Format: 'horizontal vertical'
  // Horizontal: left, center, right, or percentage (e.g., '30%')
  // Vertical: top, center, bottom, or percentage (e.g., '40%')
  positionOverrides: {
    // Elemental Avatars
    "avatar of air": "50% 50%",
    "avatar of earth": "50% 50%",
    "avatar of fire": "50% 50%",
    "avatar of water": "50% 50%",

    // GOT Avatars
    "animist": "50% 25%",
    "bladedancer": "50% 15%",
    "corruptor": "50% 40%",
    "duplicator": "50% 40%",
    "harbinger": "50% 30%",
    "imposter": "50% 50%",
    "interrogator": "50% 40%",
    "ironclad": "50% 45%",
    "magician": "50% 35%",
    "necromancer": "20% 10%",
    "persecutor": "50% 40%",
    "realm_eater": "50% 20%",
    "savior": "50% 30%",
    "spellslinger": "50% 25%",
    "dragonlord": "50% 30%",
    "witch": "50% 40%",
    "druid": "50% 30%",

    // Standard Avatars
    "battlemage": "50% 30%",
    "deathspeaker": "50% 25%",
    "elementalist": "50% 20%",
    "enchantress": "50% 40%",
    "flamecaller": "50% 40%",
    "geomancer": "50% 25%",
    "pathfinder": "50% 20%",
    "seer": "50% 40%",
    "sorcerer": "50% 25%",
    "sparkmage": "50% 40%",
    "waveshaper": "50% 20%",
  },
};

// Get zoom level for specific avatar
function getAvatarZoom(avatarName) {
  const normalized = avatarName.toLowerCase();
  return (
    AVATAR_IMAGE_CONFIG.zoomOverrides[normalized] ||
    AVATAR_IMAGE_CONFIG.defaultZoom
  );
}

// Get position for specific avatar
function getAvatarPosition(avatarName) {
  const normalized = avatarName.toLowerCase();
  return (
    AVATAR_IMAGE_CONFIG.positionOverrides[normalized] ||
    AVATAR_IMAGE_CONFIG.defaultPosition
  );
}

// Calculate gradient color for win rate
// 0% = red, 50% = white/neutral, 100% = green
function getWinRateColor(winRate) {
  const percentage = Math.max(0, Math.min(100, winRate)); // Clamp between 0-100

  if (percentage <= 50) {
    // 0-50%: red to white
    const ratio = percentage / 50;
    const r = Math.round(231 + (255 - 231) * ratio);   // 231 -> 255
    const g = Math.round(76 + (255 - 76) * ratio);     // 76 -> 255
    const b = Math.round(60 + (255 - 60) * ratio);     // 60 -> 255
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // 50-100%: white to green
    const ratio = (percentage - 50) / 50;
    const r = Math.round(255 - (255 - 46) * ratio);   // 255 -> 46
    const g = Math.round(255 - (255 - 204) * ratio);  // 255 -> 204
    const b = Math.round(255 - (255 - 113) * ratio);  // 255 -> 113
    return `rgb(${r}, ${g}, ${b})`;
  }
}

// Map avatar names to image files (fuzzy matching)
function getAvatarImagePath(avatarName) {
  // Read available images from page-config data bridge
  const pageConfigEl = document.getElementById('page-config');
  const availableImages = pageConfigEl ? JSON.parse(pageConfigEl.textContent).avatarImageFiles || [] : [];

  // Normalize avatar name for matching
  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedName = normalize(avatarName);

  // Try exact match first (normalized)
  for (const img of availableImages) {
    const imgBase = img.replace(/\.(png|jpg|jpeg)$/i, ""); // remove extension
    if (normalize(imgBase) === normalizedName) {
      return img;
    }
  }

  // Try contains match (avatar name in filename)
  for (const img of availableImages) {
    const imgBase = img.replace(/\.(png|jpg|jpeg)$/i, "");
    if (normalize(imgBase).includes(normalizedName)) {
      return img;
    }
  }

  // Try reverse contains (filename in avatar name)
  for (const img of availableImages) {
    const imgBase = img.replace(/\.(png|jpg|jpeg)$/i, "");
    const normalizedImg = normalize(imgBase);
    if (normalizedName.includes(normalizedImg)) {
      return img;
    }
  }

  return null;
}

// ---- Filter & sort logic ----
let currentEventFilter = "all";
let currentSourceFilter = "discord"; // Default to online (Discord) matches
let currentSort = "accuracy";

const SORT_LABELS = {
  accuracy: "accuracy score (win rate \u00d7 games played)",
  winrate: "win rate",
  alphabetical: "name (A\u2013Z)",
  "most-played": "most games played",
  "most-wins": "most wins",
  "best-record": "best record (wins \u2212 losses)",
};

function sortAvatarData(data, sortKey) {
  switch (sortKey) {
    case "winrate":
      return data.sort((a, b) => b.win_rate - a.win_rate || b.total - a.total);
    case "alphabetical":
      return data.sort((a, b) => a.name.localeCompare(b.name));
    case "most-played":
      return data.sort((a, b) => b.total - a.total || b.win_rate - a.win_rate);
    case "most-wins":
      return data.sort((a, b) => b.wins - a.wins || b.win_rate - a.win_rate);
    case "best-record":
      return data.sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.total - a.total);
    case "accuracy":
    default:
      return data.sort((a, b) => b.accuracy - a.accuracy);
  }
}

function formatEventDate(dateStr) {
  if (!dateStr) return null;
  // Handle various DB formats: "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS", etc.
  const dateOnly = dateStr.split(" ")[0]; // strip any time portion
  const parts = dateOnly.split("-");
  if (parts.length !== 3) return dateStr; // fallback to raw string
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function loadFilters() {
  try {
    const res = await fetch("/api/avatars/filters");
    const data = await res.json();

    const eventSelect = document.getElementById("event-filter");
    if (data.events && data.events.length > 0) {
      data.events.forEach(evt => {
        const opt = document.createElement("option");
        const startFmt = formatEventDate(evt.start_date);
        const endFmt = formatEventDate(evt.end_date);
        if (evt.is_active) {
          opt.value = "current";
          opt.textContent = `${evt.event_name} (${startFmt} - Present)`;
        } else {
          opt.value = String(evt.event_id);
          opt.textContent = `${evt.event_name} (${startFmt} - ${endFmt || "?"})`;
        }
        eventSelect.appendChild(opt);
      });
    }

    // Initialize toggle buttons
    document.querySelectorAll('.elo-source-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (this.disabled) return;

        const source = this.dataset.source;
        if (source === currentSourceFilter) return; // Already selected

        // Update state
        currentSourceFilter = source;
        localStorage.setItem('avatars_source_preference', source);

        // Update UI
        document.querySelectorAll('.elo-source-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.source === source);
        });

        // Refetch data
        fetchAvatarStats();
      });
    });

    // Load saved preference or use default (discord)
    const savedSource = localStorage.getItem('avatars_source_preference');
    if (savedSource && (savedSource === 'discord' || savedSource === 'web')) {
      currentSourceFilter = savedSource;
      document.querySelectorAll('.elo-source-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === savedSource);
      });
    }

    eventSelect.addEventListener("change", () => {
      currentEventFilter = eventSelect.value;
      fetchAvatarStats();
    });

    document.getElementById("sort-filter").addEventListener("change", (e) => {
      currentSort = e.target.value;
      fetchAvatarStats();
    });
  } catch (e) {
    console.error("Error loading filters:", e);
  }
}

loadFilters();

async function fetchPlayDrawStats() {
  try {
    const res = await fetch("/api/avatars/play-draw-stats");
    const data = await res.json();

    const playDrawElem = document.getElementById("play-draw-stats");
    if (data.play_stats && data.draw_stats) {
      const playWinRate = data.play_stats.win_rate;
      const drawWinRate = data.draw_stats.win_rate;
      const playTotal = data.play_stats.total;
      const drawTotal = data.draw_stats.total;

      playDrawElem.innerHTML = `
        Overall (from 2/7/2026 onward):
        On the Play: <span style="color: ${getWinRateColor(playWinRate)};">${playWinRate}%</span> (${data.play_stats.wins}W-${data.play_stats.losses}L, ${playTotal} games) |
        On the Draw: <span style="color: ${getWinRateColor(drawWinRate)};">${drawWinRate}%</span> (${data.draw_stats.wins}W-${data.draw_stats.losses}L, ${drawTotal} games)
      `;
    }
  } catch (error) {
    console.error("Error fetching play/draw stats:", error);
  }
}

fetchPlayDrawStats();

async function fetchAvatarStats() {
  try {
    const params = new URLSearchParams();
    if (currentEventFilter !== "all") params.set("event", currentEventFilter);
    // Always pass source parameter (discord or web)
    params.set("source", currentSourceFilter);
    const qs = params.toString();
    const res = await fetch("/api/avatars" + (qs ? "?" + qs : ""));
    const data = await res.json();
    const grid = document.getElementById("avatar-stats-grid");
    grid.innerHTML = "";

    if (data.length === 0) {
      grid.innerHTML =
        '<p class="no-data">No avatar data available yet. Report matches with decklists to see stats!</p>';
      document.getElementById("total-decklists-subtitle").textContent = "Total Decklists: 0";
      document.getElementById("avatar-table-body").innerHTML =
        '<tr><td colspan="3" style="padding: var(--spacing-md); text-align: center; color: rgba(255, 255, 255, 0.5);">No data available</td></tr>';
      return;
    }

    // Calculate accuracy stat (win rate x total games) for accuracy sort
    data.forEach(avatar => {
      avatar.accuracy = avatar.win_rate * avatar.total;
    });
    sortAvatarData(data, currentSort);

    // Update subtitle to reflect current sort
    document.getElementById("hero-subtitle").textContent =
      `Global statistics from all matches reported with decklists, sorted by ${SORT_LABELS[currentSort] || SORT_LABELS.accuracy}`;

    // Calculate total games across all avatars
    const totalGames = data.reduce((sum, avatar) => sum + avatar.total, 0);

    // Update subtitle with total decklists count
    document.getElementById("total-decklists-subtitle").textContent =
      `Total Decklists Reported: ${totalGames}`;

    // Populate avatar cards grid
    data.forEach((avatar, index) => {
      const card = document.createElement("a");
      card.href = `/avatar/${encodeURIComponent(avatar.name)}`;
      card.className = "avatar-stats-card";

      // Add background image if available
      const imagePath = getAvatarImagePath(avatar.name);
      if (imagePath) {
        card.style.backgroundImage = `url('/avatar-images/${imagePath}')`;
        const zoom = getAvatarZoom(avatar.name);
        card.style.backgroundSize = `${zoom}%`;
        const position = getAvatarPosition(avatar.name);
        card.style.backgroundPosition = position;
      }

      // Calculate win rate gradient color
      const winRateColor = getWinRateColor(avatar.win_rate);

      card.innerHTML = `
        <div class="avatar-stats-rank">#${index + 1}</div>
        <div class="avatar-stats-name">
          ${avatar.name}
          <span style="position: absolute; right: var(--spacing-sm); font-size: 0.7rem; color: rgba(255, 255, 255, 0.6);">${avatar.total} games</span>
        </div>
        <div class="avatar-stats-middle"></div>
        <div class="avatar-stats-bottom">
          <div class="avatar-stats-winrate" style="color: ${winRateColor};">${avatar.win_rate}%</div>
          <div class="avatar-stats-record">
            <span class="match-win">${avatar.wins}W</span> - <span class="match-loss">${avatar.losses}L</span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    // Populate table with avatar statistics
    const tableBody = document.getElementById("avatar-table-body");
    tableBody.innerHTML = "";

    // Sort data by total games descending for the table
    const tableSortedData = [...data].sort((a, b) => b.total - a.total);

    tableSortedData.forEach((avatar, index) => {
      const percentOfGames = ((avatar.total / totalGames) * 100).toFixed(1);
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
      if (index % 2 === 1) {
        row.style.background = "rgba(255, 255, 255, 0.02)";
      }

      row.innerHTML = `
        <td style="padding: var(--spacing-sm) var(--spacing-md);">
          <a href="/avatar/${encodeURIComponent(avatar.name)}" style="color: var(--color-primary); text-decoration: none; hover: text-decoration: underline;">
            ${avatar.name}
          </a>
        </td>
        <td style="padding: var(--spacing-sm) var(--spacing-md); text-align: center;">${avatar.total}</td>
        <td style="padding: var(--spacing-sm) var(--spacing-md); text-align: center;">${percentOfGames}%</td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching avatar stats:", error);
    document.getElementById("avatar-stats-grid").innerHTML =
      '<p class="no-data">Error loading avatar stats</p>';
    document.getElementById("total-decklists-subtitle").textContent = "Error loading data";
    document.getElementById("avatar-table-body").innerHTML =
      '<tr><td colspan="3" style="padding: var(--spacing-md); text-align: center; color: rgba(255, 255, 255, 0.5);">Error loading data</td></tr>';
  }
}

fetchAvatarStats();

/* Extracted from avatars.html - popularity chart */

// Popularity chart - only runs when page-config is present
const pageConfigEl = document.getElementById('page-config');
if (pageConfigEl) {
    const config = JSON.parse(pageConfigEl.textContent);
    if (config.hasPopularity) {
        // ---- All Avatars Popularity Chart ----
        const AVATAR_COLORS = [
            "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
            "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4",
            "#469990", "#dcbeff", "#9A6324", "#fffac8", "#800000",
            "#aaffc3", "#808000", "#ffd8b1", "#000075", "#a9a9a9",
            "#e6beff", "#1abc9c", "#e74c3c", "#2ecc71", "#3498db",
            "#9b59b6", "#f39c12", "#1abc9c", "#e67e22", "#2c3e50",
        ];

        let allPopData = null;
        let allPopChart = null;
        let allPopDays = 365;
        let allPopBucket = 7;
        let allPopNormalize = true;
        let avatarEnabled = {};

        function getAvatarColor(index) {
            return AVATAR_COLORS[index % AVATAR_COLORS.length];
        }

        async function fetchAllPopularity() {
            try {
                const res = await fetch("/api/avatars/popularity");
                if (!res.ok) return;
                allPopData = await res.json();
                buildAvatarCheckboxes();
                renderAllPopChart();
                setupAllPopSliders();
            } catch (e) {
                console.error("Error fetching all avatars popularity:", e);
            }
        }

        function buildAvatarCheckboxes() {
            const container = document.getElementById("avatar-checkboxes");
            container.innerHTML = "";
            const avatarNames = Object.keys(allPopData.avatars).sort();

            // Default: top 5 by total count enabled
            const totals = avatarNames.map(name => {
                const total = allPopData.avatars[name].reduce((s, p) => s + p.count, 0);
                return { name, total };
            });
            totals.sort((a, b) => b.total - a.total);
            const top5 = new Set(totals.slice(0, 8).map(t => t.name));

            avatarNames.forEach((name, i) => {
                const color = getAvatarColor(i);
                avatarEnabled[name] = top5.has(name);

                const label = document.createElement("label");
                label.className = "avatar-checkbox-label";

                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.checked = avatarEnabled[name];
                cb.addEventListener("change", function () {
                    avatarEnabled[name] = this.checked;
                    renderAllPopChart();
                });

                const dot = document.createElement("span");
                dot.className = "avatar-color-dot";
                dot.style.backgroundColor = color;

                label.appendChild(cb);
                label.appendChild(dot);
                label.appendChild(document.createTextNode(" " + name));
                container.appendChild(label);
            });
        }

        // Expose toggleAllAvatars globally for onclick handlers in HTML
        window.toggleAllAvatars = function(enable) {
            const checkboxes = document.querySelectorAll("#avatar-checkboxes input[type='checkbox']");
            const names = Object.keys(allPopData.avatars).sort();
            checkboxes.forEach((cb, i) => {
                cb.checked = enable;
                avatarEnabled[names[i]] = enable;
            });
            renderAllPopChart();
        };

        function renderAllPopChart() {
            if (allPopChart) {
                allPopChart.destroy();
                allPopChart = null;
            }
            if (!allPopData || !allPopData.dates) return;

            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - allPopDays);

            // Filter dates
            const filteredDates = allPopData.dates.filter(d => new Date(d) >= cutoff);
            if (filteredDates.length === 0) return;

            // Bucket dates
            let bucketLabels = [];
            let bucketIndices = []; // array of [startIdx, endIdx]
            for (let i = 0; i < filteredDates.length; i += allPopBucket) {
                const end = Math.min(i + allPopBucket, filteredDates.length);
                bucketIndices.push([i, end]);
                const startDate = new Date(filteredDates[i]);
                const endDate = new Date(filteredDates[end - 1]);
                const fmt = { month: "short", day: "numeric" };
                if (end - i === 1) {
                    bucketLabels.push(startDate.toLocaleDateString("en-US", fmt));
                } else {
                    bucketLabels.push(
                        startDate.toLocaleDateString("en-US", fmt) + " - " + endDate.toLocaleDateString("en-US", fmt)
                    );
                }
            }

            // Build daily totals index for normalization
            const dailyTotals = allPopData.daily_totals || [];
            const fullDates = allPopData.dates || [];
            const dateToTotalIdx = {};
            fullDates.forEach((d, i) => { dateToTotalIdx[d] = i; });

            const avatarNames = Object.keys(allPopData.avatars).sort();
            const datasets = [];

            avatarNames.forEach((name, i) => {
                if (!avatarEnabled[name]) return;

                const timeline = allPopData.avatars[name];
                // Build date->count lookup
                const dateCounts = {};
                timeline.forEach(p => { dateCounts[p.date] = p.count; });

                // Bucket the counts
                const bucketedCounts = bucketIndices.map(([start, end]) => {
                    if (allPopNormalize) {
                        let totalPct = 0;
                        let daysWithData = 0;
                        for (let j = start; j < end; j++) {
                            const totalIdx = dateToTotalIdx[filteredDates[j]];
                            const dayTotal = totalIdx !== undefined ? dailyTotals[totalIdx] : 0;
                            const avatarCount = dateCounts[filteredDates[j]] || 0;
                            if (dayTotal > 0) {
                                totalPct += (avatarCount / dayTotal) * 100;
                                daysWithData++;
                            }
                        }
                        return daysWithData > 0 ? Math.round(totalPct / daysWithData * 10) / 10 : 0;
                    } else {
                        let total = 0;
                        for (let j = start; j < end; j++) {
                            total += dateCounts[filteredDates[j]] || 0;
                        }
                        return total;
                    }
                });

                datasets.push({
                    label: name,
                    data: bucketedCounts,
                    borderColor: getAvatarColor(i),
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    hoverBorderWidth: 4,
                });
            });

            // Plugin to dim non-hovered datasets
            const hoverHighlightPlugin = {
                id: "hoverHighlight",
                beforeDraw(chart) {
                    const active = chart.getActiveElements();
                    if (active.length === 0) {
                        // No hover - restore all
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
                            // Dim with transparency
                            const c = ds._originalColor;
                            ds.borderColor = c.length === 7 ? c + "30" : c;
                            ds.borderWidth = 1;
                        }
                    });
                },
            };

            const ctx = document.getElementById("all-popularity-chart").getContext("2d");
            allPopChart = new Chart(ctx, {
                type: "line",
                data: { labels: bucketLabels, datasets: datasets },
                plugins: [hoverHighlightPlugin],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "nearest", intersect: false },
                    hover: {
                        mode: "dataset",
                        intersect: false,
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: "nearest",
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    const val = context.parsed.y;
                                    return allPopNormalize
                                        ? `${context.dataset.label}: ${val}%`
                                        : `${context.dataset.label}: ${val}`;
                                },
                            },
                        },
                    },
                    scales: {
                        x: {
                            ticks: { color: "rgba(255,255,255,0.6)", maxRotation: 45, minRotation: 45 },
                            grid: { color: "rgba(255,255,255,0.1)" },
                        },
                        y: {
                            min: 0,
                            ticks: {
                                color: "rgba(255,255,255,0.6)",
                                callback: function(value) {
                                    return allPopNormalize ? value + "%" : value;
                                },
                            },
                            grid: { color: "rgba(255,255,255,0.1)" },
                            title: {
                                display: true,
                                text: allPopNormalize ? "% of Decks" : "Deck Count",
                                color: "rgba(255,255,255,0.6)",
                            },
                        },
                    },
                },
            });
        }

        function setupAllPopSliders() {
            const daysSlider = document.getElementById("all-pop-days-slider");
            const bucketSlider = document.getElementById("all-pop-bucket-slider");

            daysSlider.addEventListener("input", function () {
                allPopDays = parseInt(this.value);
                document.getElementById("all-pop-days-value").textContent = this.value;
                renderAllPopChart();
            });

            bucketSlider.addEventListener("input", function () {
                allPopBucket = parseInt(this.value);
                const v = parseInt(this.value);
                document.getElementById("all-pop-bucket-value").textContent = v === 1 ? "1 day" : v + " days";
                renderAllPopChart();
            });

            document.getElementById("all-pop-normalize").addEventListener("change", function () {
                allPopNormalize = this.checked;
                renderAllPopChart();
            });
        }

        fetchAllPopularity();
    }
}
