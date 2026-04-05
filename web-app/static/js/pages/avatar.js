const config = JSON.parse(document.getElementById('page-config').textContent);
const avatarName = config.avatarName;

async function fetchAvatarData() {
  try {
    const res = await fetch(
      `/api/avatar/${encodeURIComponent(avatarName)}`,
    );
    if (!res.ok) {
      document.getElementById("avatar-name").textContent =
        "Avatar not found";
      return;
    }
    const data = await res.json();

    // Update avatar info
    document.getElementById("avatar-name").textContent = data.name;
    document.getElementById("avatar-stats").textContent =
      `${data.total_matches} matches played`;
    document.title = `${data.name} - Sorcerers Summit`;

    // Update overall stats
    document.getElementById("stat-wins").textContent = data.wins;
    document.getElementById("stat-losses").textContent = data.losses;
    document.getElementById("stat-winrate").textContent =
      `${data.win_rate}%`;
    document.getElementById("stat-matches").textContent =
      data.total_matches;

    // Update play/draw stats
    if (data.play_stats && data.draw_stats) {
      document.getElementById("stat-play-winrate").textContent =
        `${data.play_stats.win_rate}%`;
      document.getElementById("stat-play-record").textContent =
        `${data.play_stats.wins}-${data.play_stats.losses} (${data.play_stats.total} matches)`;

      document.getElementById("stat-draw-winrate").textContent =
        `${data.draw_stats.win_rate}%`;
      document.getElementById("stat-draw-record").textContent =
        `${data.draw_stats.wins}-${data.draw_stats.losses} (${data.draw_stats.total} matches)`;
    } else {
      document.getElementById("stat-play-winrate").textContent = "N/A";
      document.getElementById("stat-play-record").textContent = "No data";
      document.getElementById("stat-draw-winrate").textContent = "N/A";
      document.getElementById("stat-draw-record").textContent = "No data";
    }

    // Render wins history
    const winsTbody = document.getElementById("wins-history-tbody");
    winsTbody.innerHTML = "";

    if (data.wins_matches.length === 0) {
      winsTbody.innerHTML =
        '<tr><td colspan="3" class="px-4 py-8 text-center text-text-muted">No wins recorded</td></tr>';
    } else {
      data.wins_matches.forEach((match) => {
        const row = document.createElement("tr");
        const date = new Date(match.date).toLocaleDateString();
        const matchTime = match.match_time
          ? `${match.match_time} min`
          : "-";
        const matchId = match.match_id ? `#${match.match_id}` : "-";
        const eloChange = match.winner_elo_change;
        const eloSign = eloChange >= 0 ? "+" : "";

        row.className =
          "border-b border-border hover:bg-bg-elevated transition-colors";
        row.innerHTML = `
          <td class="px-4 py-3">${match.winner_name}</td>
          <td class="px-4 py-3">${match.loser_name}</td>
          <td class="px-4 py-3 text-accent-green font-semibold">${eloSign}${eloChange}</td>
        `;
        winsTbody.appendChild(row);
      });
    }

    // Render losses history
    const lossesTbody = document.getElementById("losses-history-tbody");
    lossesTbody.innerHTML = "";

    if (data.losses_matches.length === 0) {
      lossesTbody.innerHTML =
        '<tr><td colspan="3" class="px-4 py-8 text-center text-text-muted">No losses recorded</td></tr>';
    } else {
      data.losses_matches.forEach((match) => {
        const row = document.createElement("tr");
        const date = new Date(match.date).toLocaleDateString();
        const matchTime = match.match_time
          ? `${match.match_time} min`
          : "-";
        const matchId = match.match_id ? `#${match.match_id}` : "-";
        const eloChange = match.loser_elo_change;
        const eloSign = eloChange >= 0 ? "+" : "";

        row.className =
          "border-b border-border hover:bg-bg-elevated transition-colors";
        row.innerHTML = `
          <td class="px-4 py-3">${match.winner_name}</td>
          <td class="px-4 py-3">${match.loser_name}</td>
          <td class="px-4 py-3 text-accent-red font-semibold">${eloSign}${eloChange}</td>
        `;
        lossesTbody.appendChild(row);
      });
    }
  } catch (error) {
    document.getElementById("avatar-name").textContent =
      "Error loading avatar";
    console.error(error);
  }
}

fetchAvatarData();

let matchupData = null;
let currentSortColumn = "total";
let currentSortDirection = "desc";

async function fetchMatchupData() {
  try {
    const res = await fetch(
      `/api/avatar/${encodeURIComponent(avatarName)}/matchups`,
    );
    if (!res.ok) {
      document.getElementById("matchups-container").innerHTML =
        '<p class="loading-text">Error loading matchup data</p>';
      return;
    }
    const data = await res.json();

    if (!data.matchups || data.matchups.length === 0) {
      document.getElementById("matchups-container").innerHTML =
        '<p class="text-center text-text-muted py-8">No matchup data available yet.</p>';
      return;
    }

    matchupData = data.matchups;
    renderMatchupTable();
  } catch (error) {
    console.error("Error fetching matchup data:", error);
    document.getElementById("matchups-container").innerHTML =
      '<p class="loading-text">Error loading matchup data</p>';
  }
}

function getWinRateClass(winRate) {
  if (winRate <= 40) {
    return "winrate-terrible"; // Red (0-40%)
  } else if (winRate <= 50) {
    return "winrate-poor"; // Light red (41-50%)
  } else if (winRate <= 60) {
    return "winrate-good"; // Light green (51-60%)
  } else if (winRate <= 70) {
    return "winrate-great"; // Normal green (61-70%)
  } else {
    return "winrate-excellent"; // Bright green (70%+)
  }
}

function sortMatchups(column) {
  if (currentSortColumn === column) {
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentSortColumn = column;
    currentSortDirection = "desc";
  }

  matchupData.sort((a, b) => {
    let aVal, bVal;

    switch (column) {
      case "opponent":
        aVal = a.opponent.toLowerCase();
        bVal = b.opponent.toLowerCase();
        break;
      case "winrate":
        aVal = a.win_rate;
        bVal = b.win_rate;
        break;
      case "wins":
        aVal = a.wins;
        bVal = b.wins;
        break;
      case "total":
        aVal = a.total;
        bVal = b.total;
        break;
      default:
        return 0;
    }

    if (currentSortDirection === "asc") {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  renderMatchupTable();
}

function renderMatchupTable() {
  const container = document.getElementById("matchups-container");

  let html = `
    <div class="overflow-x-auto -mx-6 md:mx-0">
      <div class="inline-block min-w-full align-middle px-6 md:px-0">
        <table class="min-w-full border border-border rounded-soft overflow-hidden">
          <thead class="bg-bg-elevated border-b border-border">
            <tr>
              <th class="sortable px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase ${currentSortColumn === 'opponent' ? 'sort-' + currentSortDirection : ''}" onclick="sortMatchups('opponent')">
                Opponent Avatar
              </th>
              <th class="sortable px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase ${currentSortColumn === 'winrate' ? 'sort-' + currentSortDirection : ''}" onclick="sortMatchups('winrate')">
                Win Rate
              </th>
              <th class="sortable px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase ${currentSortColumn === 'wins' ? 'sort-' + currentSortDirection : ''}" onclick="sortMatchups('wins')">
                Record
              </th>
              <th class="sortable px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase ${currentSortColumn === 'total' ? 'sort-' + currentSortDirection : ''}" onclick="sortMatchups('total')">
                Matches
              </th>
            </tr>
          </thead>
          <tbody>
  `;

  matchupData.forEach((matchup) => {
    const winRateClass = getWinRateClass(matchup.win_rate);

    html += `
      <tr class="border-b border-border hover:bg-bg-elevated transition-colors">
        <td class="px-4 py-3">
          <a href="/avatar/${encodeURIComponent(matchup.opponent)}" class="text-primary hover:underline">
            ${matchup.opponent}
          </a>
        </td>
        <td class="px-4 py-3 text-center font-semibold ${winRateClass}">
          ${matchup.win_rate}%
        </td>
        <td class="px-4 py-3 text-center text-sm">
          ${matchup.wins}W - ${matchup.losses}L
        </td>
        <td class="px-4 py-3 text-center text-text-muted">
          ${matchup.total}
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

fetchMatchupData();

async function fetchDeckComposition() {
  try {
    const res = await fetch(
      `/api/avatar/${encodeURIComponent(avatarName)}/deck-composition`,
    );

    // Check if user has permission
    if (res.status === 403) {
      // Hide the section if no permission
      document.getElementById("deck-composition-section").style.display =
        "none";
      return;
    }

    if (!res.ok) {
      document.getElementById("composition-bars").innerHTML =
        '<p class="loading-text">Error loading deck composition</p>';
      return;
    }

    const data = await res.json();
    const container = document.getElementById("composition-bars");

    if (!data || !data.composition || data.composition.length === 0) {
      container.innerHTML =
        '<p class="loading-text">No deck data available for this avatar yet.</p>';
      document.getElementById("deck-composition-section").style.display =
        "block";
      return;
    }

    // Show the section
    document.getElementById("deck-composition-section").style.display =
      "block";

    // Helper function to get element color class
    function getElementColorClass(elementName) {
      const el = elementName.toLowerCase();
      if (el === "fire") return "element-fire";
      if (el === "water") return "element-water";
      if (el === "earth") return "element-earth";
      if (el === "air") return "element-air";
      return "";
    }

    // Render composition bars
    let html = "";
    data.composition.forEach((item) => {
      // Determine element class based on composition (for bar color)
      let barElementClass = "element-multi";
      const elements = item.elements.split(", ");
      if (elements.length === 1) {
        const el = elements[0].toLowerCase();
        if (el === "fire") barElementClass = "element-fire";
        else if (el === "water") barElementClass = "element-water";
        else if (el === "earth") barElementClass = "element-earth";
        else if (el === "air") barElementClass = "element-air";
      }

      // Render element names with individual colors
      let labelHtml = elements
        .map((el) => {
          const colorClass = getElementColorClass(el);
          return `<span class="element-name ${colorClass}">${el}</span>`;
        })
        .join(", ");

      html += `
        <div class="composition-row ${barElementClass}">
          <div class="composition-label">${labelHtml}</div>
          <div class="composition-bar-container">
            <div class="composition-bar" style="width: ${item.percent}%;"></div>
            <span class="composition-bar-text">${item.percent}%</span>
          </div>
          <div class="composition-stats">
            ${item.count} deck${item.count !== 1 ? "s" : ""}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (error) {
    console.error("Error fetching deck composition:", error);
    document.getElementById("composition-bars").innerHTML =
      '<p class="loading-text">Error loading deck composition</p>';
  }
}

// Fetch deck composition data
fetchDeckComposition();

// Popularity over time chart
let popularityChartInstance = null;
let popularityData = null;
let currentDays = 365;
let currentScale = 0;
let currentBucket = 1;
let popNormalize = true;

async function fetchPopularityData() {
  try {
    const res = await fetch(
      `/api/avatar/${encodeURIComponent(avatarName)}/popularity`,
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

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const filteredTimeline = data.timeline.filter((point) => {
    return new Date(point.date) >= cutoffDate;
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

  let labels, counts;
  if (currentBucket <= 1) {
    labels = filteredTimeline.map((point) => {
      return new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });
    if (popNormalize) {
      counts = filteredTimeline.map((point, idx) => {
        // Find the index in the full timeline for daily_totals alignment
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
        counts.push(chunk.reduce((sum, p) => sum + p.count, 0));
      }
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

  let yMin = 0;
  let yMax;
  if (scale === 0) {
    yMax = Math.max(...counts) * 1.1;
  } else {
    yMax = scale;
  }

  const ctx = document
    .getElementById("popularity-chart")
    .getContext("2d");
  popularityChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: popNormalize ? "% of Decks" : "Matches Played",
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
          labels: { color: "rgba(255, 255, 255, 0.8)" },
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: function (context) {
              const val = context.parsed.y;
              return popNormalize ? `% of Decks: ${val}%` : `Matches: ${val}`;
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
          grid: { color: "rgba(255, 255, 255, 0.1)" },
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
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          title: {
            display: true,
            text: popNormalize ? "% of Decks" : "Match Count",
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
    scaleValue.textContent = value === 0 ? "Auto" : value;
    currentScale = value;
    renderPopularityChart(popularityData, currentDays, currentScale);
  });

  document.getElementById("pop-normalize").addEventListener("change", function () {
    popNormalize = this.checked;
    renderPopularityChart(popularityData, currentDays, currentScale);
  });
}

fetchPopularityData();
