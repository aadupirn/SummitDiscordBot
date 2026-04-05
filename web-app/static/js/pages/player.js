const config = JSON.parse(document.getElementById('page-config').textContent);

const playerId = config.playerId;
const needsDisplayName = config.needsDisplayName;
const defaultDisplayName = config.defaultDisplayName;
const isLoggedIn = config.loggedIn;
const currentUserId = config.currentUserId;
let eloChartInstance = null;
let storedElo = null;
let storedMatches = null;
let currentMaxMatches = 50;
let currentScale = 200;
let storedPlayerData = null;
let eventsData = null;

// Immediately show season buttons for profile owner (don't wait for API)
const _normCurrent = currentUserId.replace(/^google_/, '');
const _normPlayer = playerId.replace(/^google_/, '');
if (isLoggedIn && _normCurrent === _normPlayer) {
  const _createBtn = document.getElementById("create-season-btn");
  const _joinBtn = document.getElementById("join-season-btn");
  if (_createBtn) _createBtn.style.display = "";
  if (_joinBtn) _joinBtn.style.display = "";
}

// ELO source tracking
// Check for saved preference, otherwise backend will auto-detect based on most recent match
let currentEloSource = localStorage.getItem('elo_source_preference') || 'bot';
let hasWebMatches = false;
let hasBotMatches = false;

// Edit deck modal state
let editDeckMatchId = null;

function showEditDeckModal(matchId, currentUrl) {
  editDeckMatchId = matchId;
  document.getElementById("edit-deck-url").value = currentUrl || "";
  document.getElementById("edit-deck-match-info").textContent = `Match #${matchId}`;
  document.getElementById("edit-deck-modal").classList.add("modal--active");
}

function hideEditDeckModal() {
  document.getElementById("edit-deck-modal").classList.remove("modal--active");
  editDeckMatchId = null;
  document.getElementById("edit-deck-url").value = "";
}

async function submitEditDeck() {
  const deckUrl = document.getElementById("edit-deck-url").value.trim();
  if (!deckUrl) {
    alert("Please enter a deck URL.");
    return;
  }

  const submitBtn = document.getElementById("edit-deck-submit");
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Saving...";
  submitBtn.disabled = true;

  try {
    const response = await fetch("/api/update-match-deck", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: editDeckMatchId,
        deck_url: deckUrl,
        source: currentEloSource,
      }),
    });

    const result = await response.json();
    if (result.success) {
      hideEditDeckModal();
      // Refresh the player data to show updated deck info
      const eventFilter = document.getElementById("event-filter")?.value || "lifetime";
      const currentPage = storedPlayerData?.pagination?.current_page || 1;
      fetchPlayerData(eventFilter, currentPage, currentEloSource);
    } else {
      alert(result.error || "Failed to update deck.");
    }
  } catch (error) {
    console.error("Error updating deck:", error);
    alert("An error occurred while updating the deck.");
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

// Close edit deck modal on backdrop click or Escape
document.addEventListener("DOMContentLoaded", function () {
  const editDeckBackdrop = document.getElementById("edit-deck-backdrop");
  if (editDeckBackdrop) {
    editDeckBackdrop.addEventListener("click", hideEditDeckModal);
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.getElementById("edit-deck-modal").classList.contains("modal--active")) {
      hideEditDeckModal();
    }
  });
});

// Fetch available events for the filter dropdown
async function fetchEvents() {
  try {
    const res = await fetch("/api/events");
    if (!res.ok) return;
    const data = await res.json();
    eventsData = data;

    const select = document.getElementById("elo-filter");
    if (!select) return;

    // Add past events to dropdown
    if (data.events && data.events.length > 0) {
      data.events.forEach((event) => {
        if (!event.is_active) {
          const option = document.createElement("option");
          option.value = `event_${event.event_id}`;
          option.textContent = event.event_name;
          select.appendChild(option);
        }
      });
    }

    // Add change listener
    select.addEventListener("change", handleFilterChange);
  } catch (e) {
    console.error("Error fetching events:", e);
  }
}

// Handle filter dropdown change
async function handleFilterChange(e) {
  const value = e.target.value;

  // Convert filter value to API parameter
  let eventParam = "lifetime";
  if (value === "lifetime") {
    eventParam = "lifetime";
  } else if (value === "current") {
    eventParam = "current";
  } else if (value.startsWith("event_")) {
    eventParam = value.replace("event_", "");
  }

  // Re-fetch all player data with the new filter (reset to page 1)
  // Pass current ELO source to maintain toggle state
  await fetchPlayerData(eventParam, 1, currentEloSource);
}

function renderEloChart(
  currentElo,
  matches,
  maxMatches = 50,
  scale = 200,
) {
  // Destroy existing chart if it exists
  if (eloChartInstance) {
    eloChartInstance.destroy();
    eloChartInstance = null;
  }

  // Limit matches to maxMatches (most recent)
  const limitedMatches = matches.slice(0, maxMatches);

  // Build ELO history by working backwards from current ELO
  // Matches are in DESC order (newest first)
  const eloHistory = [];
  let elo = currentElo;

  // Add current ELO as first point
  eloHistory.push({
    elo: elo,
    date: new Date().toLocaleDateString(),
    result: null,
    matchIndex: 0,
  });

  // Work backwards through matches to reconstruct ELO history
  for (let i = 0; i < limitedMatches.length; i++) {
    const match = limitedMatches[i];
    // Subtract the change to get previous ELO
    elo = elo - (match.elo_change || 0);
    eloHistory.push({
      elo: elo,
      date: new Date(match.date).toLocaleDateString(),
      result: match.result,
      matchIndex: i + 1,
    });
  }

  // Reverse to get chronological order (oldest to newest)
  eloHistory.reverse();

  // Prepare chart data
  const labels = eloHistory.map((_, i) =>
    i === 0 ? "Start" : `Match ${i}`,
  );
  const eloData = eloHistory.map((h) => h.elo);
  const pointColors = eloHistory.map((h) => {
    if (h.result === null) return "#58a6ff"; // Current (primary blue)
    return h.result === "Win" ? "#3fb950" : "#f85149"; // Win green / Loss red
  });

  // Calculate average ELO of displayed data points, rounded to nearest 50 for tick alignment
  const rawAvgElo =
    eloData.reduce((sum, elo) => sum + elo, 0) / eloData.length;
  const avgElo = Math.round(rawAvgElo / 50) * 50;

  // Calculate min/max based on scale parameter, centered around average ELO
  const yMin = avgElo - scale;
  const yMax = avgElo + scale;

  const ctx = document.getElementById("elo-chart").getContext("2d");
  eloChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "ELO Rating",
          data: eloData,
          borderColor: "#58a6ff",
          backgroundColor: "rgba(88, 166, 255, 0.1)",
          borderWidth: 2,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#21262d",
          titleColor: "#f0f6fc",
          bodyColor: "#f0f6fc",
          borderColor: "#30363d",
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: function (context) {
              const idx = context[0].dataIndex;
              const point = eloHistory[idx];
              if (idx === eloHistory.length - 1) return "Current";
              if (idx === 0) return "Starting ELO";
              return `Match ${idx}`;
            },
            label: function (context) {
              const idx = context.dataIndex;
              const point = eloHistory[idx];
              const lines = [`ELO: ${point.elo}`];
              if (point.result) {
                lines.push(`Result: ${point.result}`);
              }
              if (point.date) {
                lines.push(`Date: ${point.date}`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            color: "rgba(48, 54, 61, 0.5)",
            drawBorder: false,
          },
          ticks: {
            color: "#8b949e",
            maxTicksLimit: 10,
            font: {
              size: 11,
            },
          },
        },
        y: {
          display: true,
          min: yMin,
          max: yMax,
          grid: {
            color: function (context) {
              // Highlight the average ELO baseline
              if (context.tick.value === avgElo) {
                return "rgba(88, 166, 255, 0.5)";
              }
              return "rgba(48, 54, 61, 0.5)";
            },
            lineWidth: function (context) {
              if (context.tick.value === avgElo) {
                return 2;
              }
              return 1;
            },
            drawBorder: false,
          },
          ticks: {
            color: function (context) {
              if (context.tick.value === avgElo) {
                return "#58a6ff";
              }
              return "#8b949e";
            },
            font: {
              size: 11,
              weight: function (context) {
                if (context.tick && context.tick.value === avgElo) {
                  return "bold";
                }
                return "normal";
              },
            },
            stepSize: 50,
          },
        },
      },
    },
  });
}

function setupEloSliders() {
  const rangeSlider = document.getElementById("elo-range-slider");
  const rangeValue = document.getElementById("elo-range-value");
  const scaleSlider = document.getElementById("elo-scale-slider");
  const scaleValue = document.getElementById("elo-scale-value");

  if (rangeSlider && storedMatches) {
    // Set max to total matches or 100, whichever is smaller
    const maxValue = Math.min(storedMatches.length, 100);
    rangeSlider.max = maxValue;
    rangeSlider.value = Math.min(50, maxValue);
    currentMaxMatches = parseInt(rangeSlider.value);
    rangeValue.textContent = rangeSlider.value;

    rangeSlider.addEventListener("input", function () {
      rangeValue.textContent = this.value;
      currentMaxMatches = parseInt(this.value);
      renderEloChart(
        storedElo,
        storedMatches,
        currentMaxMatches,
        currentScale,
      );
    });
  }

  if (scaleSlider) {
    scaleSlider.addEventListener("input", function () {
      scaleValue.textContent = this.value;
      currentScale = parseInt(this.value);
      renderEloChart(
        storedElo,
        storedMatches,
        currentMaxMatches,
        currentScale,
      );
    });
  }
}

// Pagination state
let currentPage = 1;
const perPage = 50;

async function fetchPlayerData(eventFilter = "lifetime", page = 1, eloSource = null) {
  try {
    currentPage = page;

    // Use provided source or current source, default to "bot" (where all matches are)
    if (!eloSource) eloSource = currentEloSource || "bot";

    let url = `/api/player/${playerId}?page=${page}&per_page=${perPage}&source=${eloSource}`;
    if (eventFilter && eventFilter !== "lifetime") {
      url += `&event=${eventFilter}`;
    }
    console.log('Fetching player data from:', url);
    const res = await fetch(url);
    console.log('Response status:', res.status);
    if (!res.ok) {
      document.getElementById("player-name").textContent =
        "Player not found";
      // Still load seasons even if player has no match history
      fetchPlayerSeason();
      return;
    }
    const data = await res.json();
    console.log('Player data received:', data);

    // Store data globally for filter functionality
    storedPlayerData = data;

    // Check if running on localhost for full access
    const isLocalServer =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // Track ownership for season controls
    isProfileOwner = data.is_owner || isLocalServer;

    // Check for pending confirmations on own profile
    if (isProfileOwner && isLoggedIn && !confirmationPollInterval) {
      fetchPendingConfirmations();
      confirmationPollInterval = setInterval(fetchPendingConfirmations, CONFIRMATION_POLL_MS);
    }

    // Update player info
    document.getElementById("player-name").textContent = data.name;

    // Build ELO text based on the current filter
    let eloText = "";
    let rankText = "";

    if (eventFilter === "lifetime" || !eventFilter) {
      eloText = `Lifetime ELO: ${data.elo}`;
      if (data.event_elo && data.event_elo !== 1500) {
        eloText += ` | Event ELO: ${data.event_elo}`;
      }
      rankText = `Rank #${data.rank}`;
    } else if (eventFilter === "current") {
      eloText =
        data.displayed_elo !== 1500
          ? `Current Event ELO: ${data.displayed_elo}`
          : "No current event data";
      rankText =
        data.displayed_rank > 0
          ? `Event Rank #${data.displayed_rank}`
          : eventsData?.active_event
            ? `Event: ${eventsData.active_event.event_name}`
            : "";
    } else {
      // Past event
      const eventInfo = eventsData?.events?.find(
        (e) => e.event_id === parseInt(eventFilter),
      );
      eloText =
        data.displayed_elo !== 1500
          ? `Event ELO: ${data.displayed_elo}`
          : "No data for this event";
      rankText =
        data.displayed_rank > 0
          ? `#${data.displayed_rank} in ${eventInfo?.event_name || "Event"}`
          : "";
    }

    document.getElementById("player-elo").textContent = eloText;
    document.getElementById("player-rank").textContent = rankText;
    document.title = `${data.name} - Sorcerers Summit`;

    // Update overall stats
    document.getElementById("stat-wins").textContent = data.wins;
    document.getElementById("stat-losses").textContent = data.losses;
    document.getElementById("stat-winrate").textContent =
      `${data.win_rate}%`;
    document.getElementById("stat-matches").textContent =
      data.wins + data.losses;
    document.getElementById("stat-avg-time").textContent =
      data.avg_match_time > 0 ? `${data.avg_match_time} min` : "-";

    // Show play/draw winrate stats for owner
    if (data.is_owner || isLocalServer) {
      const playCard = document.getElementById("stat-play-card");
      const drawCard = document.getElementById("stat-draw-card");
      if (playCard && data.on_play_matches > 0) {
        playCard.style.display = "";
        document.getElementById("stat-play-wr").textContent =
          `${data.on_play_win_rate}%`;
        playCard.querySelector(".stat-label").textContent =
          `On the Play (${data.on_play_wins}-${data.on_play_matches - data.on_play_wins})`;
      }
      if (drawCard && data.on_draw_matches > 0) {
        drawCard.style.display = "";
        document.getElementById("stat-draw-wr").textContent =
          `${data.on_draw_win_rate}%`;
        drawCard.querySelector(".stat-label").textContent =
          `On the Draw (${data.on_draw_wins}-${data.on_draw_matches - data.on_draw_wins})`;
      }
    }

    // Show Record Game button for profile owner or localhost
    if (data.is_owner || isLocalServer) {
      const recordBtn = document.getElementById("record-game-btn");
      if (recordBtn) recordBtn.style.display = "inline-flex";
    }

    // Render ELO history chart (only for profile owner or localhost)
    // Use displayed_elo for the chart when filtering by event
    const chartElo = data.displayed_elo || data.elo;
    if (
      (data.is_owner || isLocalServer) &&
      data.matches &&
      data.matches.length > 1
    ) {
      document.getElementById("elo-chart-section").style.display =
        "block";
      // Store data for sliders
      storedElo = chartElo;
      storedMatches = data.matches;
      setupEloSliders();
      currentMaxMatches = Math.min(50, data.matches.length);
      renderEloChart(
        chartElo,
        data.matches,
        currentMaxMatches,
        currentScale,
      );
    } else {
      // Hide chart section if no matches for this filter
      document.getElementById("elo-chart-section").style.display = "none";
    }

    // Update avatar performance
    if (data.avatar_performance && data.avatar_performance.length > 0) {
      document.getElementById("avatar-section").style.display = "block";
      const avatarGrid = document.getElementById("avatar-grid");
      avatarGrid.innerHTML = "";

      data.avatar_performance.forEach((avatar) => {
        const card = document.createElement("div");
        card.className = "avatar-card";
        card.innerHTML = `
          <div class="avatar-name">${avatar.name}</div>
          <div class="avatar-record">
            <span class="match-win">${avatar.wins}</span> - <span class="match-loss">${avatar.losses}</span>
          </div>
          <div class="avatar-winrate">${avatar.win_rate}%</div>
        `;
        avatarGrid.appendChild(card);
      });
    } else {
      document.getElementById("avatar-section").style.display = "none";
    }

    // Update performance against other avatars
    if (data.avatar_matchups && data.avatar_matchups.length > 0) {
      document.getElementById("avatar-matchup-section").style.display =
        "block";
      const avatarGrid = document.getElementById("avatar-matchup-grid");
      avatarGrid.innerHTML = "";

      data.avatar_matchups.forEach((matchup) => {
        const card = document.createElement("div");
        card.className = "avatar-card";
        card.innerHTML = `
          <div class="avatar-name">${matchup.opponent_avatar}</div>
          <div class="avatar-record">
            <span class="match-win">${matchup.wins}</span> - <span class="match-loss">${matchup.losses}</span>
          </div>
          <div class="avatar-winrate">${matchup.win_rate}%</div>
        `;
        avatarGrid.appendChild(card);
      });
    } else {
      document.getElementById("avatar-matchup-section").style.display =
        "none";
    }

    // Update recent decks (only show to profile owner or localhost)
    if (
      (data.is_owner || isLocalServer) &&
      data.recent_decks &&
      data.recent_decks.length > 0
    ) {
      document.getElementById("recent-decks-section").style.display =
        "block";
      const decksList = document.getElementById("recent-decks-list");
      decksList.innerHTML = "";

      data.recent_decks.forEach((deck) => {
        const deckItem = document.createElement("div");
        deckItem.className = "recent-deck-item";
        const date = new Date(deck.date).toLocaleDateString();
        const winRateColor = deck.win_rate >= 50 ? "#4ade80" : "#f87171";
        deckItem.innerHTML = `
          <div class="deck-info">
            <div class="deck-avatar">🎭 ${deck.avatar}</div>
            <div class="deck-name">${deck.deck_name}</div>
            <div class="deck-stats" style="color: ${winRateColor}; font-weight: 600; margin-top: 4px;">
              ${deck.wins}W - ${deck.losses}L (${deck.win_rate}%)
            </div>
            <div class="deck-date">${date}</div>
          </div>
          <a href="${deck.url}" target="_blank" class="deck-link-button">View Deck →</a>
        `;
        decksList.appendChild(deckItem);
      });
    } else {
      document.getElementById("recent-decks-section").style.display =
        "none";
    }

    // Render Limited Arena section
    if (data.limited && data.limited.has_data) {
      document.getElementById("limited-arena-section").style.display = "block";
      document.getElementById("limited-elo").textContent = data.limited.elo;
      document.getElementById("limited-wins").textContent = data.limited.total_wins;
      document.getElementById("limited-losses").textContent = data.limited.total_losses;
      document.getElementById("limited-winrate").textContent = `${data.limited.win_rate}%`;
      document.getElementById("limited-runs-count").textContent = data.limited.arena_runs.length;

      // Render arena runs table
      const runsBody = document.getElementById("limited-runs-tbody");
      runsBody.innerHTML = "";
      if (data.limited.arena_runs.length === 0) {
        runsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; opacity: 0.6;">No arena runs yet</td></tr>';
      } else {
        data.limited.arena_runs.forEach(run => {
          const statusColor = run.status === "completed" ? "#4ade80"
            : run.status === "forfeited" ? "#f87171" : "#facc15";
          const statusLabel = run.status === "completed" ? "Completed"
            : run.status === "forfeited" ? "Forfeited" : "Active";
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${run.wins}-${run.losses}</strong></td>
            <td style="color: ${statusColor}">${statusLabel}</td>
            <td>${run.deck_url ? `<a href="${run.deck_url}" target="_blank" style="color: var(--color-primary, #a855f7)">View Deck</a>` : '-'}</td>
            <td>${run.starting_elo}</td>
            <td>${run.created_at || '-'}</td>
          `;
          runsBody.appendChild(tr);
        });
      }

      // Render limited matches table
      const matchesBody = document.getElementById("limited-matches-tbody");
      matchesBody.innerHTML = "";
      if (data.limited.recent_matches.length === 0) {
        matchesBody.innerHTML = '<tr><td colspan="5" style="text-align: center; opacity: 0.6;">No limited matches yet</td></tr>';
      } else {
        data.limited.recent_matches.forEach(match => {
          const isWinner = String(match.winner_id) === String(playerId);
          const resultText = isWinner ? "Win" : "Loss";
          const resultColor = isWinner ? "#4ade80" : "#f87171";
          const eloChange = isWinner ? match.winner_elo_change : match.loser_elo_change;
          const eloSign = eloChange >= 0 ? "+" : "";
          const opponent = isWinner ? match.loser_name : match.winner_name;
          const matchDate = match.timestamp ? new Date(match.timestamp).toLocaleDateString() : "-";
          const matchTime = match.match_time > 0 ? `${match.match_time} min` : "-";
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="color: ${resultColor}; font-weight: 600;">${resultText}</td>
            <td>${opponent}</td>
            <td style="color: ${eloChange >= 0 ? '#4ade80' : '#f87171'}">${eloSign}${eloChange}</td>
            <td>${matchTime}</td>
            <td>${matchDate}</td>
          `;
          matchesBody.appendChild(tr);
        });
      }
    } else {
      document.getElementById("limited-arena-section").style.display = "none";
    }

    // Render match history table headers (conditionally include Deck column)
    const thead = document.getElementById("match-history-thead");
    if (data.is_owner || isLocalServer) {
      thead.innerHTML = `
        <tr>
          <th style="width: 30px;"></th>
          <th>ID</th>
          <th>Result</th>
          <th>Your Avatar</th>
          <th>Your Elements</th>
          <th>Deck Link</th>
          <th>Snapshot</th>
          <th>Opponent</th>
          <th>Opp Avatar</th>
          <th>Opp Elements</th>
          <th>ELO</th>
          <th>Play/Draw</th>
          <th>Time</th>
          <th>Date</th>
        </tr>
      `;
    } else {
      thead.innerHTML = `
        <tr>
          <th>ID</th>
          <th>Result</th>
          <th>Opponent</th>
          <th>ELO</th>
          <th>Play/Draw</th>
          <th>Time</th>
          <th>Date</th>
        </tr>
      `;
    }

    // Update match history
    const tbody = document.getElementById("match-history-tbody");
    tbody.innerHTML = "";

    const colspanCount = data.is_owner || isLocalServer ? 14 : 7;
    if (data.matches.length === 0) {
      const noMatchesMsg = data.is_owner
        ? "No matches yet! Play games on Discord to start tracking your stats."
        : "No matches recorded";
      tbody.innerHTML = `<tr><td colspan="${colspanCount}" style="text-align: center; opacity: 0.6;">${noMatchesMsg}</td></tr>`;
      return;
    }

    // Map element names to image filenames
    const elementImageMap = {
      "Earth": "earth.png",
      "Fire": "fire.png",
      "Water": "water.png",
      "Air": "wind.png",
    };

    function renderElementIcons(elements) {
      if (!elements || elements.length === 0) return "-";
      const icons = elements.map(el => {
        const img = elementImageMap[el];
        if (!img) return el;
        return `<img src="/avatar-images/${img}" alt="${el}" title="${el}">`;
      }).join("");
      return `<span class="element-icons">${icons}</span>`;
    }

    data.matches.forEach((match) => {
      const row = document.createElement("tr");
      const resultClass =
        match.result === "Win" ? "match-win" : "match-loss";
      const eloSign = match.elo_change >= 0 ? "+" : "";
      const date = new Date(match.date).toLocaleDateString();
      const matchTime = match.match_time
        ? `${match.match_time} min`
        : "-";
      const matchId = match.match_id ? `#${match.match_id}` : "-";
      const avatarName = match.player_avatar || "-";
      const elementsHtml = renderElementIcons(match.deck_elements);
      const oppAvatarName = match.opponent_avatar || "-";
      const oppElementsHtml = renderElementIcons(match.opponent_elements);

      // Build row HTML conditionally based on is_owner or localhost
      if (data.is_owner || isLocalServer) {
        // Create deck link if available
        let deckLink = "-";
        if (
          match.player_deck_url &&
          match.player_deck_url !== "No URL provided" &&
          match.player_deck_url !== "Admin reported match"
        ) {
          deckLink = `<a href="${match.player_deck_url}" target="_blank" class="deck-link" title="View deck on Curiosa">🔗</a>`;
        }

        // Create snapshot link if deck has JSON data
        let snapshotLink = "-";
        if (match.has_deck_json) {
          snapshotLink = `<a href="/deck-snapshot/${match.match_id}/${playerId}" class="snapshot-link" title="View deck snapshot">View</a>`;
        }

        const escapedDeckUrl = (match.player_deck_url || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const editBtn = match.match_id
          ? `<button class="edit-deck-btn" onclick="showEditDeckModal('${match.match_id}', '${escapedDeckUrl}')" title="Edit deck">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>`
          : '';
        row.innerHTML = `
          <td style="text-align: center; padding: 4px;">
            ${editBtn}
          </td>
          <td class="match-id">${matchId}</td>
          <td class="${resultClass}">${match.result}</td>
          <td>${avatarName}</td>
          <td>${elementsHtml}</td>
          <td>${deckLink}</td>
          <td>${snapshotLink}</td>
          <td><a href="/player/${match.opponent_id}" class="opponent-link">${match.opponent}</a></td>
          <td>${oppAvatarName}</td>
          <td>${oppElementsHtml}</td>
          <td class="${resultClass}">${eloSign}${match.elo_change}</td>
          <td>${match.first_player || "-"}</td>
          <td>${matchTime}</td>
          <td>${date}</td>
        `;
      } else {
        // Public view - show submitted status only
        row.innerHTML = `
          <td class="match-id">${matchId}</td>
          <td class="${resultClass}">${match.result}</td>
          <td><a href="/player/${match.opponent_id}" class="opponent-link">${match.opponent}</a></td>
          <td class="${resultClass}">${eloSign}${match.elo_change}</td>
          <td>${match.first_player || "-"}</td>
          <td>${matchTime}</td>
          <td>${date}</td>
        `;
      }
      tbody.appendChild(row);
    });

    // Render self-reported games (only for profile owner or localhost)
    if (
      (data.is_owner || isLocalServer) &&
      data.recorded_games &&
      data.recorded_games.length > 0
    ) {
      document.getElementById("recorded-games-section").style.display =
        "block";
      const recordedTbody = document.getElementById(
        "recorded-games-tbody",
      );
      recordedTbody.innerHTML = "";

      data.recorded_games.forEach((game, index) => {
        const row = document.createElement("tr");
        const resultClass =
          game.result === "Win" ? "match-win" : "match-loss";
        const date = new Date(game.date).toLocaleDateString();
        const matchTime = game.match_time
          ? `${game.match_time} min`
          : "-";
        const reportId = game.report_id ? `#${game.report_id}` : "-";

        // Create deck link if available
        let deckLink = "-";
        if (game.deck_url && game.deck_url !== "No URL provided") {
          deckLink = `<a href="${game.deck_url}" target="_blank" class="deck-link" title="View deck on Curiosa">🔗</a>`;
        }

        row.innerHTML = `
          <td class="match-id">${reportId}</td>
          <td class="${resultClass}">${game.result}</td>
          <td>${game.opponent}</td>
          <td>${deckLink}</td>
          <td>${game.first_player || "-"}</td>
          <td>${matchTime}</td>
          <td>${date}</td>
          <td><button class="delete-recorded-game-btn" data-report-id="${game.report_id}" style="background: #d32f2f; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button></td>
        `;
        recordedTbody.appendChild(row);
      });
    }

    // Add event listeners for delete buttons
    document
      .querySelectorAll(".delete-recorded-game-btn")
      .forEach((btn) => {
        btn.addEventListener("click", deleteRecordedGame);
      });

    // Initialize ELO source toggle
    hasWebMatches = data.has_web_matches || false;
    hasBotMatches = data.has_bot_matches || false;

    // Sync currentEloSource with what the API actually used (may have auto-detected)
    if (data.elo_source) {
      currentEloSource = data.elo_source;
    }

    const toggle = document.getElementById('elo-source-toggle');
    if (hasWebMatches || hasBotMatches) {
      toggle.style.display = 'inline-flex';

      // Use the source from API response (backend auto-detects the best source)
      // Only override if user has a saved preference AND that source has matches
      const saved = localStorage.getItem('elo_source_preference');
      if (saved && (saved === 'web' || saved === 'bot')) {
        // Only use saved preference if that source has matches
        if ((saved === 'web' && hasWebMatches) || (saved === 'bot' && hasBotMatches)) {
          currentEloSource = saved;
        }
        // Otherwise keep the API's auto-detected source
      }

      // Update toggle button states
      document.querySelectorAll('.elo-source-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === currentEloSource);
        // Disable button if no matches for that source
        if (btn.dataset.source === 'web' && !hasWebMatches) {
          btn.disabled = true;
          btn.title = 'No web matches yet';
        } else if (btn.dataset.source === 'bot' && !hasBotMatches) {
          btn.disabled = true;
          btn.title = 'No bot matches yet';
        }
      });
    } else {
      toggle.style.display = 'none';
    }

    // Update pagination controls
    updatePaginationControls(data.pagination);

    // Show display name banner if user hasn't set one yet (non-intrusive)
    if (needsDisplayName && data.is_owner && !data.has_custom_display_name) {
      const dismissed = sessionStorage.getItem('display_name_banner_dismissed');
      if (!dismissed) {
        document.getElementById("display-name-banner").style.display = "flex";
      }
    }

    // Load season info for all players
    fetchPlayerSeason();
  } catch (error) {
    document.getElementById("player-name").textContent =
      "Error loading player";
    console.error(error);
  }
}

// Update pagination controls based on API response
function updatePaginationControls(pagination) {
  if (!pagination || pagination.total_pages <= 1) {
    document.getElementById("pagination-controls").style.display = "none";
    return;
  }

  document.getElementById("pagination-controls").style.display = "block";

  const firstBtn = document.getElementById("pagination-first");
  const prevBtn = document.getElementById("pagination-prev");
  const nextBtn = document.getElementById("pagination-next");
  const lastBtn = document.getElementById("pagination-last");
  const info = document.getElementById("pagination-info");
  const summary = document.getElementById("pagination-summary");

  // Update buttons state
  firstBtn.disabled = !pagination.has_previous;
  prevBtn.disabled = !pagination.has_previous;
  nextBtn.disabled = !pagination.has_next;
  lastBtn.disabled = !pagination.has_next;

  // Update info text
  info.textContent = `Page ${pagination.current_page} of ${pagination.total_pages}`;

  // Calculate range
  const start = (pagination.current_page - 1) * pagination.per_page + 1;
  const end = Math.min(pagination.current_page * pagination.per_page, pagination.total_matches);
  summary.textContent = `Showing ${start}-${end} of ${pagination.total_matches} matches`;
}

// Pagination button handlers
function goToPage(page) {
  const eventFilter = document.getElementById("event-filter")?.value || "lifetime";
  fetchPlayerData(eventFilter, page, currentEloSource);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Add pagination event listeners
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("pagination-first").addEventListener("click", () => goToPage(1));
  document.getElementById("pagination-prev").addEventListener("click", () => goToPage(currentPage - 1));
  document.getElementById("pagination-next").addEventListener("click", () => goToPage(currentPage + 1));
  document.getElementById("pagination-last").addEventListener("click", () => {
    // We'll get total pages from the last pagination update
    const totalPages = parseInt(document.getElementById("pagination-info").textContent.split("of ")[1]) || 1;
    goToPage(totalPages);
  });
});

// Delete a recorded game
async function deleteRecordedGame(e) {
  const reportId = e.target.getAttribute("data-report-id");
  if (!confirm("Are you sure you want to delete this recorded game?")) {
    return;
  }

  try {
    const res = await fetch(`/api/delete-recorded-game/${reportId}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (res.ok && data.success) {
      const eventFilter = document.getElementById("event-filter")?.value || "lifetime";
      fetchPlayerData(eventFilter, currentPage, currentEloSource); // Refresh the page data
      alert("Recorded game deleted successfully!");
    } else {
      alert("Error: " + (data.error || "Failed to delete game"));
    }
  } catch (error) {
    console.error("Delete error:", error);
    alert("Failed to delete. Please try again.");
  }
}

// ===== Report Game Modal Logic (Three-Mode: Ranked / Casual / Solo) =====

let avatarsList = [];
let currentReportMode = "ranked";
let opponentSearchTimer = null;

// Fetch avatars for Solo mode dropdown
async function loadAvatars() {
  try {
    const res = await fetch("/api/list-all-avatars");
    const data = await res.json();
    avatarsList = data;
    const select = document.getElementById("opponent-avatar");
    data.forEach((avatarName) => {
      const option = document.createElement("option");
      option.value = avatarName;
      option.textContent = avatarName;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Failed to load avatars:", error);
  }
}

// Mode toggle
function setReportMode(mode) {
  currentReportMode = mode;
  document.getElementById("report-mode").value = mode;

  // Update tab button styles
  ["ranked", "casual", "solo"].forEach(m => {
    const btn = document.getElementById(`mode-${m}-btn`);
    if (m === mode) {
      btn.style.background = "rgba(255, 215, 0, 0.15)";
      btn.style.color = "#ffd700";
      btn.style.boxShadow = "inset 0 -2px 0 #ffd700";
    } else {
      btn.style.background = "";
      btn.style.color = "";
      btn.style.boxShadow = "";
    }
  });

  // Show/hide fields
  document.getElementById("confirmation-fields").style.display = (mode === "solo") ? "none" : "block";
  document.getElementById("solo-fields").style.display = (mode === "solo") ? "block" : "none";

  // Reset forms on mode switch
  if (mode === "solo") {
    resetSoloForm();
  } else {
    resetConfirmationForm();
    populateSeasonPicker();
  }
}

// Season picker (search-based like opponent)
let availableSeasons = [];

async function populateSeasonPicker() {
  const group = document.getElementById("season-picker-group");

  // Use cached playerSeasons if available, otherwise fetch
  let seasons = playerSeasons;
  if (!seasons || seasons.length === 0) {
    try {
      const res = await fetch(`/api/player/${playerId}/seasons`, {credentials: "same-origin"});
      const data = await res.json();
      seasons = (data.success && data.seasons) ? data.seasons : [];
    } catch (e) {
      seasons = [];
    }
  }

  availableSeasons = seasons;

  if (seasons.length > 0) {
    group.style.display = "";
    setupSeasonSearch();
  } else {
    group.style.display = "none";
  }
}

function setupSeasonSearch() {
  const input = document.getElementById("season-search");
  const resultsDiv = document.getElementById("season-search-results");

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (query.length === 0) {
      // Show all seasons when input is focused but empty
      showSeasonResults(availableSeasons);
      return;
    }
    const filtered = availableSeasons.filter(s =>
      s.title.toLowerCase().includes(query)
    );
    showSeasonResults(filtered);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim().length === 0) {
      showSeasonResults(availableSeasons);
    }
  });

  // Hide results on click outside
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !resultsDiv.contains(e.target)) {
      resultsDiv.style.display = "none";
    }
  });
}

function showSeasonResults(seasons) {
  const resultsDiv = document.getElementById("season-search-results");
  if (seasons.length === 0) {
    resultsDiv.innerHTML = '<div style="padding: 0.5rem 0.75rem; font-size: 0.85rem; color: var(--color-text-muted);">No seasons found</div>';
    resultsDiv.style.display = "block";
    return;
  }
  resultsDiv.innerHTML = seasons.map(s => `
    <div style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--color-border); font-size: 0.9rem;"
      onmouseover="this.style.background='rgba(255, 215, 0, 0.1)'"
      onmouseout="this.style.background=''"
      onclick="selectSeason('${s.season_id}', '${s.title.replace(/'/g, "\\'")}')">
      <strong>${s.title}</strong>
    </div>
  `).join("");
  resultsDiv.style.display = "block";
}

function selectSeason(seasonId, title) {
  document.getElementById("report-season-id").value = seasonId;
  document.getElementById("season-search").value = "";
  document.getElementById("season-search").style.display = "none";
  document.getElementById("selected-season-name").textContent = title;
  document.getElementById("selected-season-display").style.display = "block";
  document.getElementById("season-search-results").style.display = "none";
}

function clearSeasonSelection() {
  document.getElementById("report-season-id").value = "";
  document.getElementById("season-search").value = "";
  document.getElementById("season-search").style.display = "";
  document.getElementById("selected-season-display").style.display = "none";
}

// Opponent search (for Ranked/Casual)
function setupOpponentSearch() {
  const input = document.getElementById("opponent-search");
  const resultsDiv = document.getElementById("opponent-search-results");

  input.addEventListener("input", () => {
    clearTimeout(opponentSearchTimer);
    const query = input.value.trim();
    if (query.length < 2) {
      resultsDiv.style.display = "none";
      return;
    }
    opponentSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/match-report/search-opponents?q=${encodeURIComponent(query)}&limit=10`, {credentials: "same-origin"});
        const data = await res.json();
        if (data.success && data.opponents && data.opponents.length > 0) {
          resultsDiv.innerHTML = data.opponents.map(opp => `
            <div style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--color-border); font-size: 0.9rem;"
              onmouseover="this.style.background='rgba(88, 166, 255, 0.1)'"
              onmouseout="this.style.background=''"
              onclick="selectOpponent('${opp.user_id}', '${opp.display_name.replace(/'/g, "\\'")}')">
              <strong>${opp.display_name}</strong>
              ${opp.is_recent ? '<span style="font-size: 0.75rem; color: var(--color-accent-blue); margin-left: 0.5rem;">Recent</span>' : ''}
            </div>
          `).join("");
          resultsDiv.style.display = "block";
        } else {
          resultsDiv.innerHTML = '<div style="padding: 0.5rem 0.75rem; font-size: 0.85rem; color: var(--color-text-muted);">No players found</div>';
          resultsDiv.style.display = "block";
        }
      } catch (e) {
        resultsDiv.style.display = "none";
      }
    }, 300);
  });

  // Hide results on click outside
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !resultsDiv.contains(e.target)) {
      resultsDiv.style.display = "none";
    }
  });
}

function selectOpponent(userId, displayName) {
  document.getElementById("selected-opponent-id").value = userId;
  document.getElementById("opponent-search").value = "";
  document.getElementById("opponent-search").style.display = "none";
  document.getElementById("selected-opponent-name").textContent = displayName;
  document.getElementById("selected-opponent-display").style.display = "block";
  document.getElementById("opponent-search-results").style.display = "none";
}

function clearOpponentSelection() {
  document.getElementById("selected-opponent-id").value = "";
  document.getElementById("opponent-search").value = "";
  document.getElementById("opponent-search").style.display = "";
  document.getElementById("selected-opponent-display").style.display = "none";
}

// Show/hide modal
function showRecordGameModal() {
  setReportMode("ranked");
  document.getElementById("record-game-modal").classList.add("modal--active");
}

function hideRecordGameModal() {
  document.getElementById("record-game-modal").classList.remove("modal--active");
  resetConfirmationForm();
  resetSoloForm();
}

function resetConfirmationForm() {
  const form = document.getElementById("confirmation-form");
  if (form) form.reset();
  document.getElementById("confirm-result").value = "";
  document.getElementById("confirm-went-first").value = "";
  document.getElementById("selected-opponent-id").value = "";
  clearOpponentSelection();
  clearSeasonSelection();
  ["confirm-win-yes", "confirm-win-no", "confirm-first-me", "confirm-first-opp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("btn--active");
  });
}

function resetSoloForm() {
  const form = document.getElementById("record-game-form");
  if (form) form.reset();
  document.getElementById("did-win").value = "";
  document.getElementById("went-first").value = "";
  ["win-yes", "win-no", "first-yes", "first-no"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("btn--active");
  });
}

// Toggle button setup for Confirmation mode
function setupConfirmationToggleButtons() {
  const cWinYes = document.getElementById("confirm-win-yes");
  const cWinNo = document.getElementById("confirm-win-no");
  const cFirstMe = document.getElementById("confirm-first-me");
  const cFirstOpp = document.getElementById("confirm-first-opp");

  cWinYes.addEventListener("click", () => {
    document.getElementById("confirm-result").value = "won";
    cWinYes.classList.add("btn--active");
    cWinNo.classList.remove("btn--active");
  });
  cWinNo.addEventListener("click", () => {
    document.getElementById("confirm-result").value = "lost";
    cWinNo.classList.add("btn--active");
    cWinYes.classList.remove("btn--active");
  });
  cFirstMe.addEventListener("click", () => {
    document.getElementById("confirm-went-first").value = "submitter";
    cFirstMe.classList.add("btn--active");
    cFirstOpp.classList.remove("btn--active");
  });
  cFirstOpp.addEventListener("click", () => {
    document.getElementById("confirm-went-first").value = "opponent";
    cFirstOpp.classList.add("btn--active");
    cFirstMe.classList.remove("btn--active");
  });
}

// Toggle button setup for Solo mode (unchanged)
function setupToggleButtons() {
  const winYes = document.getElementById("win-yes");
  const winNo = document.getElementById("win-no");
  const firstYes = document.getElementById("first-yes");
  const firstNo = document.getElementById("first-no");

  winYes.addEventListener("click", () => {
    document.getElementById("did-win").value = "true";
    winYes.classList.add("btn--active");
    winNo.classList.remove("btn--active");
  });
  winNo.addEventListener("click", () => {
    document.getElementById("did-win").value = "false";
    winNo.classList.add("btn--active");
    winYes.classList.remove("btn--active");
  });
  firstYes.addEventListener("click", () => {
    document.getElementById("went-first").value = "true";
    firstYes.classList.add("btn--active");
    firstNo.classList.remove("btn--active");
  });
  firstNo.addEventListener("click", () => {
    document.getElementById("went-first").value = "false";
    firstNo.classList.add("btn--active");
    firstYes.classList.remove("btn--active");
  });
}

// Unified submit handler
async function submitRecordGame() {
  const mode = currentReportMode;

  if (mode === "solo") {
    await submitSoloReport();
  } else {
    await submitConfirmationReport(mode);
  }
}

// Submit Solo report (POST /api/record-game)
async function submitSoloReport() {
  const deckUrl = document.getElementById("deck-url").value.trim();
  const opponentAvatar = document.getElementById("opponent-avatar").value;
  const didWin = document.getElementById("did-win").value;
  const wentFirst = document.getElementById("went-first").value;
  const matchTime = document.getElementById("match-time").value;
  const matchComment = document.getElementById("match-comment").value.trim();

  if (!deckUrl || !opponentAvatar || !didWin || !wentFirst) {
    alert("Please fill in all required fields");
    return;
  }

  const submitBtn = document.getElementById("modal-submit");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnSpinner = submitBtn.querySelector(".btn-spinner");
  submitBtn.disabled = true;
  btnText.textContent = "Submitting...";
  btnSpinner.style.display = "inline-flex";

  try {
    const res = await fetch("/api/record-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deck_url: deckUrl,
        opponent_avatar: opponentAvatar,
        did_win: didWin === "true",
        went_first: wentFirst === "true",
        match_time: matchTime ? parseInt(matchTime) : 0,
        match_comment: matchComment,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideRecordGameModal();
      const eventFilter = document.getElementById("event-filter")?.value || "lifetime";
      fetchPlayerData(eventFilter, currentPage, currentEloSource);
      alert("Game recorded successfully!");
    } else {
      alert("Error: " + (data.error || "Failed to record game"));
    }
  } catch (error) {
    console.error("Submit error:", error);
    alert("Failed to submit. Please try again.");
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = "Submit";
    btnSpinner.style.display = "none";
  }
}

// Submit Ranked/Casual report (POST /api/match-report/submit)
async function submitConfirmationReport(matchType) {
  const opponentId = document.getElementById("selected-opponent-id").value;
  const deckUrl = document.getElementById("confirm-deck-url").value.trim();
  const result = document.getElementById("confirm-result").value;
  const wentFirst = document.getElementById("confirm-went-first").value;
  const lifeMe = parseInt(document.getElementById("confirm-life-me").value) || 0;
  const lifeOpp = parseInt(document.getElementById("confirm-life-opp").value) || 0;
  const seasonId = document.getElementById("report-season-id").value || null;

  if (!opponentId || !deckUrl || !result || !wentFirst) {
    alert("Please fill in all required fields (opponent, deck URL, result, turn order)");
    return;
  }

  const submitBtn = document.getElementById("modal-submit");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnSpinner = submitBtn.querySelector(".btn-spinner");
  submitBtn.disabled = true;
  btnText.textContent = "Submitting...";
  btnSpinner.style.display = "inline-flex";

  try {
    const payload = {
      opponent_user_id: opponentId,
      result: result,
      went_first: wentFirst,
      submitter_deck_url: deckUrl,
      final_life_submitter: lifeMe,
      final_life_opponent: lifeOpp,
      match_type: matchType,
    };
    if (seasonId) payload.season_id = parseInt(seasonId);

    const res = await fetch("/api/match-report/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideRecordGameModal();
      const oppName = data.opponent?.display_name || "opponent";
      alert(`Match report submitted! Awaiting confirmation from ${oppName}.`);
    } else {
      const errMsg = data.error?.message || data.error || "Failed to submit match report";
      alert("Error: " + errMsg);
    }
  } catch (error) {
    console.error("Submit error:", error);
    alert("Failed to submit. Please try again.");
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = "Submit";
    btnSpinner.style.display = "none";
  }
}

// Setup collapsible sections
function setupCollapsibleSections() {
  const collapsibleHeaders = document.querySelectorAll(
    ".collapsible-header",
  );

  collapsibleHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      // Toggle collapsed state on header
      header.classList.toggle("collapsed");

      // Find the next sibling that's the collapsible content
      const content = header.nextElementSibling;
      if (content && content.classList.contains("collapsible-content")) {
        content.classList.toggle("collapsed");
      }

      // Save state to localStorage
      const sectionId = header.id.replace("-header", "");
      const isCollapsed = header.classList.contains("collapsed");
      localStorage.setItem(`section-collapsed-${sectionId}`, isCollapsed);
    });

    // Restore state from localStorage if it exists
    const sectionId = header.id.replace("-header", "");
    const savedState = localStorage.getItem(
      `section-collapsed-${sectionId}`,
    );
    if (savedState !== null) {
      const wasCollapsed = savedState === "true";
      if (wasCollapsed && !header.classList.contains("collapsed")) {
        header.classList.add("collapsed");
        const content = header.nextElementSibling;
        if (
          content &&
          content.classList.contains("collapsible-content")
        ) {
          content.classList.add("collapsed");
        }
      } else if (
        !wasCollapsed &&
        header.classList.contains("collapsed")
      ) {
        header.classList.remove("collapsed");
        const content = header.nextElementSibling;
        if (
          content &&
          content.classList.contains("collapsible-content")
        ) {
          content.classList.remove("collapsed");
        }
      }
    }
  });
}

// Initialize modal when page loads
document.addEventListener("DOMContentLoaded", () => {
  loadAvatars();
  setupToggleButtons();
  setupConfirmationToggleButtons();
  setupOpponentSearch();
  setupCollapsibleSections();
  fetchEvents(); // Load events for filter dropdown

  // ELO Source Toggle Handler
  document.querySelectorAll('.elo-source-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      if (this.disabled) return;

      const source = this.dataset.source;
      if (source === currentEloSource) return; // Already selected

      // Update UI
      document.querySelectorAll('.elo-source-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Update state
      currentEloSource = source;
      localStorage.setItem('elo_source_preference', source);

      // Refetch data with new source
      const eventFilter = document.getElementById("elo-filter")?.value || "lifetime";
      await fetchPlayerData(eventFilter, 1, source);

      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Event listeners
  document
    .getElementById("record-game-btn")
    ?.addEventListener("click", showRecordGameModal);
  document
    .getElementById("modal-close")
    ?.addEventListener("click", hideRecordGameModal);
  document
    .getElementById("modal-backdrop")
    ?.addEventListener("click", hideRecordGameModal);
  document
    .getElementById("modal-cancel")
    ?.addEventListener("click", hideRecordGameModal);
  document
    .getElementById("modal-submit")
    ?.addEventListener("click", submitRecordGame);

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideRecordGameModal();
  });
});

if (config.isAdmin) {
// ===== Admin Controls =====

// Remove Player
document.getElementById("admin-remove-player")?.addEventListener("click", async () => {
  const playerName = document.getElementById("player-name").textContent;
  if (!confirm(`Remove "${playerName}" from the leaderboard?\n\nThis removes them from standings but keeps match history.`)) return;
  try {
    const res = await fetch(`/api/admin/remove-player/${playerId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      window.location.href = "/";
    } else {
      alert("Error: " + (data.error || "Failed to remove player"));
    }
  } catch (err) {
    alert("Failed to remove player.");
  }
});

// Remove Match - modal
function showRemoveMatchModal() {
  document.getElementById("remove-match-modal").classList.add("modal--active");
  document.getElementById("admin-match-id").value = "";
}
function hideRemoveMatchModal() {
  document.getElementById("remove-match-modal").classList.remove("modal--active");
}
document.getElementById("admin-remove-match")?.addEventListener("click", showRemoveMatchModal);
document.getElementById("remove-match-backdrop")?.addEventListener("click", hideRemoveMatchModal);
document.getElementById("remove-match-close")?.addEventListener("click", hideRemoveMatchModal);
document.getElementById("remove-match-cancel")?.addEventListener("click", hideRemoveMatchModal);

document.getElementById("remove-match-confirm")?.addEventListener("click", async () => {
  const matchId = document.getElementById("admin-match-id").value.trim();
  if (!matchId) { alert("Please enter a match ID."); return; }
  if (!confirm(`Delete match #${matchId}?\n\nELO changes will be reversed for both players.`)) return;
  try {
    const res = await fetch(`/api/admin/remove-match/${matchId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      hideRemoveMatchModal();
      alert(data.message);
      const eventFilter = document.getElementById("event-filter")?.value || "lifetime";
      fetchPlayerData(eventFilter, currentPage);
    } else {
      alert("Error: " + (data.error || "Failed to remove match"));
    }
  } catch (err) {
    alert("Failed to remove match.");
  }
});

// Reset ELO - modal
function showResetEloModal() {
  document.getElementById("reset-elo-modal").classList.add("modal--active");
  document.getElementById("admin-new-elo").value = "1500";
}
function hideResetEloModal() {
  document.getElementById("reset-elo-modal").classList.remove("modal--active");
}
document.getElementById("admin-reset-elo")?.addEventListener("click", showResetEloModal);
document.getElementById("reset-elo-backdrop")?.addEventListener("click", hideResetEloModal);
document.getElementById("reset-elo-close")?.addEventListener("click", hideResetEloModal);
document.getElementById("reset-elo-cancel")?.addEventListener("click", hideResetEloModal);

document.getElementById("reset-elo-confirm")?.addEventListener("click", async () => {
  const newElo = document.getElementById("admin-new-elo").value.trim();
  if (!newElo) { alert("Please enter an ELO value."); return; }
  const eloNum = parseInt(newElo, 10);
  if (isNaN(eloNum) || eloNum < 0 || eloNum > 5000) { alert("ELO must be between 0 and 5000."); return; }
  const eloSource = document.getElementById("admin-elo-source").value;
  const sourceLabel = eloSource === "both" ? "online + paper" : eloSource === "bot" ? "online" : "paper";
  const playerName = document.getElementById("player-name").textContent;
  if (!confirm(`Set "${playerName}"'s ${sourceLabel} ELO to ${eloNum}?`)) return;
  try {
    const res = await fetch(`/api/admin/reset-elo/${playerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_elo: eloNum, source: eloSource }),
    });
    const data = await res.json();
    if (data.success) {
      hideResetEloModal();
      alert(data.message);
      const eventFilter = document.getElementById("event-filter")?.value || "lifetime";
      fetchPlayerData(eventFilter, currentPage);
    } else {
      alert("Error: " + (data.error || "Failed to set ELO"));
    }
  } catch (err) {
    alert("Failed to set ELO.");
  }
});

// Rename Player - modal
function showRenameModal() {
  document.getElementById("rename-player-modal").classList.add("modal--active");
  document.getElementById("admin-new-name").value = document.getElementById("player-name").textContent;
}
function hideRenameModal() {
  document.getElementById("rename-player-modal").classList.remove("modal--active");
}
document.getElementById("admin-rename-player")?.addEventListener("click", showRenameModal);
document.getElementById("rename-player-backdrop")?.addEventListener("click", hideRenameModal);
document.getElementById("rename-player-close")?.addEventListener("click", hideRenameModal);
document.getElementById("rename-player-cancel")?.addEventListener("click", hideRenameModal);

document.getElementById("rename-player-confirm")?.addEventListener("click", async () => {
  const newName = document.getElementById("admin-new-name").value.trim();
  if (!newName) { alert("Please enter a name."); return; }
  try {
    const res = await fetch(`/api/admin/rename-player/${playerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_name: newName }),
    });
    const data = await res.json();
    if (data.success) {
      hideRenameModal();
      alert(data.message);
      const eventFilter = document.getElementById("event-filter")?.value || "lifetime";
      fetchPlayerData(eventFilter, currentPage);
    } else {
      alert("Error: " + (data.error || "Failed to rename player"));
    }
  } catch (err) {
    alert("Failed to rename player.");
  }
});

// Close admin modals on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideRemoveMatchModal();
    hideResetEloModal();
    hideRenameModal();
  }
});
} // end if (config.isAdmin)

// ===== Display Name Banner + Modal Logic =====

function showDisplayNameModal() {
  const input = document.getElementById("display-name-input");
  input.value = defaultDisplayName;
  document.getElementById("display-name-modal").classList.add("modal--active");
  setTimeout(() => input.select(), 100);
}

function hideDisplayNameModal() {
  document.getElementById("display-name-modal").classList.remove("modal--active");
}

// Banner: "Set Name" opens the modal
document.getElementById("display-name-open-btn")?.addEventListener("click", showDisplayNameModal);

// Banner: dismiss button hides for this session
document.getElementById("display-name-dismiss")?.addEventListener("click", () => {
  document.getElementById("display-name-banner").style.display = "none";
  sessionStorage.setItem('display_name_banner_dismissed', '1');
});

// Modal: close button and backdrop
document.getElementById("display-name-close")?.addEventListener("click", hideDisplayNameModal);
document.getElementById("display-name-backdrop")?.addEventListener("click", hideDisplayNameModal);

let isSubmittingDisplayName = false;

async function submitDisplayName(name) {
  if (isSubmittingDisplayName) return;

  isSubmittingDisplayName = true;
  const submitBtn = document.getElementById("display-name-submit");
  const skipBtn = document.getElementById("display-name-skip");
  const originalSubmitText = submitBtn?.textContent;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }
  if (skipBtn) skipBtn.disabled = true;

  try {
    const res = await fetch(`/api/player/${playerId}/set-display-name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: name }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideDisplayNameModal();
      // Hide the banner too
      document.getElementById("display-name-banner").style.display = "none";
      const playerNameElement = document.getElementById("player-name");
      if (playerNameElement) {
        playerNameElement.textContent = data.display_name;
      }
      document.title = `${data.display_name} - Sorcerers Summit`;
      if (storedPlayerData) {
        storedPlayerData.has_custom_display_name = true;
      }
    } else {
      alert("Error: " + (data.error || "Failed to set display name"));
    }
  } catch (error) {
    console.error("Display name submit error:", error);
    alert("Failed to save display name. Please try again.");
  } finally {
    isSubmittingDisplayName = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalSubmitText;
    }
    if (skipBtn) skipBtn.disabled = false;
  }
}

// Modal submit/skip event listeners
document.getElementById("display-name-submit")?.addEventListener("click", () => {
  const name = document.getElementById("display-name-input").value.trim();
  if (!name) {
    alert("Please enter a display name.");
    return;
  }
  submitDisplayName(name);
});

document.getElementById("display-name-skip")?.addEventListener("click", () => {
  submitDisplayName(defaultDisplayName);
});

document.getElementById("display-name-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("display-name-submit").click();
  }
});

// -- Season Management -----------------------------------------

let playerSeasons = [];
let selectedSeasonId = null;
let seasonSearchTimer = null;
let isProfileOwner = false;

function fetchPlayerSeason() {
  fetch(`/api/player/${playerId}/seasons`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        playerSeasons = data.seasons || [];
        renderSeasonManagement(playerSeasons);
      }
    })
    .catch(() => {});
}

function getSeasonById(seasonId) {
  return playerSeasons.find(s => s.season_id === seasonId) || null;
}

function renderSeasonManagement(seasons) {
  const mgmtSection = document.getElementById("season-management-section");
  const createBtn = document.getElementById("create-season-btn");
  const joinBtn = document.getElementById("join-season-btn");

  // Always show Create/Join for profile owner (multi-season allowed)
  // Use both API-based and template-based ownership checks
  const ownerCheck = isProfileOwner || (isLoggedIn && _normCurrent === _normPlayer);
  if (ownerCheck) {
    if (createBtn) createBtn.style.display = "";
    if (joinBtn) joinBtn.style.display = "";
  } else {
    if (createBtn) createBtn.style.display = "none";
    if (joinBtn) joinBtn.style.display = "none";
  }

  if (!seasons || seasons.length === 0) {
    if (mgmtSection) mgmtSection.style.display = "none";
    return;
  }

  if (mgmtSection) {
    mgmtSection.innerHTML = seasons.map(season => {
      const isCreator = season.is_creator;
      const statusBadge = season.status === "active"
        ? (season.start_date > new Date().toISOString().slice(0, 10) ? "Upcoming" : "Active")
        : season.status;

      let controlsHtml = "";
      if (ownerCheck) {
        if (isCreator) {
          controlsHtml = `
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
              <button class="btn btn--secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;" onclick="showModifySeasonModal(${season.season_id})">Modify Season</button>
              <button class="btn btn--secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;" onclick="endSeason(${season.season_id})">End Season</button>
              <button class="btn btn--danger" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;" onclick="deleteSeason(${season.season_id})">Delete Season</button>
              <button class="btn btn--secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;" onclick="showKickMemberModal(${season.season_id})">Kick Member</button>
              <button class="btn btn--primary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;" onclick="showReportSeasonMatchModal(${season.season_id})">Report Match</button>
            </div>
          `;
        } else {
          controlsHtml = `
            <div style="margin-top: 0.75rem;">
              <button class="btn btn--danger" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;" onclick="leaveSeason(${season.season_id})">Leave Season</button>
            </div>
          `;
        }
      }

      return `
        <div style="background: rgba(88, 166, 255, 0.08); border: 1px solid rgba(88, 166, 255, 0.25); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <span style="font-size: 1.1rem;">🏆</span>
            <h4 style="margin: 0; font-size: 1.05rem; color: var(--color-text-primary);">${season.title}</h4>
            <span style="font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 4px; background: rgba(88, 166, 255, 0.15); color: var(--color-accent-blue);">${statusBadge}</span>
          </div>
          ${season.description ? `<p style="margin: 0.25rem 0 0.5rem 0; font-size: 0.85rem; color: var(--color-text-muted);">${season.description}</p>` : ""}
          <div style="display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.9rem; margin-top: 0.5rem;">
            <span>📅 ${season.start_date} — ${season.end_date}</span>
            ${season.region ? `<span>📍 ${season.region}</span>` : ""}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 1.25rem; font-size: 0.9rem; margin-top: 0.5rem;">
            <span><strong>ELO:</strong> ${season.season_elo}</span>
            <span><strong>Record:</strong> ${season.wins}W - ${season.losses}L</span>
            <span><strong>Rank:</strong> #${season.rank} of ${season.member_count}</span>
          </div>
          <div style="margin-top: 0.75rem;">
            <a href="/season/${season.season_id}" class="btn btn--primary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem; text-decoration: none;">View Leaderboard</a>
          </div>
          ${controlsHtml}
        </div>
      `;
    }).join("");
    mgmtSection.style.display = "block";
  }
}

// -- Create Season Modal -----------------------------------------

function showCreateSeasonModal() {
  // Set min date to today
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("season-start-date").min = today;
  document.getElementById("season-end-date").min = today;
  document.getElementById("create-season-modal").classList.add("modal--active");
}

function hideCreateSeasonModal() {
  document.getElementById("create-season-modal").classList.remove("modal--active");
  // Reset form
  document.getElementById("season-title").value = "";
  document.getElementById("season-description").value = "";
  document.getElementById("season-start-date").value = "";
  document.getElementById("season-end-date").value = "";
  document.getElementById("season-k-value").value = "32";
  document.getElementById("season-base-elo").value = "1500";
  document.getElementById("season-max-members").value = "";
  document.getElementById("season-region").value = "";
}

async function submitCreateSeason() {
  const btn = document.getElementById("create-season-submit");
  const btnText = btn.querySelector(".btn-text");
  const btnSpinner = btn.querySelector(".btn-spinner");

  const title = document.getElementById("season-title").value.trim();
  const description = document.getElementById("season-description").value.trim() || null;
  const start_date = document.getElementById("season-start-date").value;
  const end_date = document.getElementById("season-end-date").value;
  const k_value = parseInt(document.getElementById("season-k-value").value) || 32;
  const base_elo = parseInt(document.getElementById("season-base-elo").value) || 1500;
  const maxMembers = document.getElementById("season-max-members").value;
  const max_members = maxMembers ? parseInt(maxMembers) : null;
  const region = document.getElementById("season-region").value.trim() || null;

  if (!title || !start_date || !end_date) {
    alert("Title, start date, and end date are required.");
    return;
  }

  btn.disabled = true;
  if (btnText) btnText.style.display = "none";
  if (btnSpinner) btnSpinner.style.display = "inline-flex";

  try {
    const res = await fetch("/api/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, start_date, end_date, k_value, base_elo, max_members, region }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideCreateSeasonModal();
      fetchPlayerSeason();
    } else {
      alert("Error: " + (data.error || "Failed to create season"));
    }
  } catch (err) {
    alert("Network error. Please try again.");
  } finally {
    btn.disabled = false;
    if (btnText) btnText.style.display = "";
    if (btnSpinner) btnSpinner.style.display = "none";
  }
}

// -- Join Season Modal -------------------------------------------

function showJoinSeasonModal() {
  document.getElementById("join-season-modal").classList.add("modal--active");
  document.getElementById("season-search-input").value = "";
  searchSeasons("");
}

function hideJoinSeasonModal() {
  document.getElementById("join-season-modal").classList.remove("modal--active");
  document.getElementById("join-season-results").innerHTML = "";
}

function debouncedSeasonSearch() {
  clearTimeout(seasonSearchTimer);
  seasonSearchTimer = setTimeout(() => {
    const q = document.getElementById("season-search-input").value.trim();
    searchSeasons(q);
  }, 300);
}

async function searchSeasons(q) {
  const container = document.getElementById("join-season-results");
  try {
    const res = await fetch(`/api/seasons/search?q=${encodeURIComponent(q)}&limit=3`);
    const data = await res.json();
    if (!data.success || !data.seasons || data.seasons.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: 2rem 0;">No seasons found</p>';
      return;
    }
    container.innerHTML = data.seasons.map(s => {
      const memberText = s.max_members ? `${s.member_count}/${s.max_members} members` : `${s.member_count} members`;
      const isFull = s.max_members && s.member_count >= s.max_members;
      const statusBadge = s.start_date > new Date().toISOString().slice(0, 10) ? "Upcoming" : "Active";
      return `
        <div style="padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <strong>${s.title}</strong>
              <span style="font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; background: rgba(88, 166, 255, 0.15); color: var(--color-accent-blue); margin-left: 0.5rem;">${statusBadge}</span>
              ${s.description ? `<p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--color-text-muted);">${s.description.substring(0, 100)}${s.description.length > 100 ? "..." : ""}</p>` : ""}
              <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.25rem;">
                ${s.start_date} — ${s.end_date} · ${memberText}
                ${s.region ? ` · 📍 ${s.region}` : ""}
                · by ${s.creator_name}
              </div>
            </div>
            <div style="margin-left: 0.75rem;">
              ${s.is_member
                ? '<span style="font-size: 0.8rem; color: var(--color-text-muted);">Joined</span>'
                : isFull
                  ? '<span style="font-size: 0.8rem; color: var(--color-text-muted);">Full</span>'
                  : `<button class="btn btn--primary" style="font-size: 0.8rem; padding: 0.3rem 0.75rem;" onclick="joinSeason(${s.season_id})">Join</button>`
              }
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: 2rem 0;">Error loading seasons</p>';
  }
}

async function joinSeason(seasonId) {
  try {
    const res = await fetch(`/api/seasons/${seasonId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideJoinSeasonModal();
      fetchPlayerSeason();
    } else {
      alert("Error: " + (data.error || "Failed to join season"));
    }
  } catch (err) {
    alert("Network error. Please try again.");
  }
}

// -- Leave / End / Delete Season ---------------------------------

async function leaveSeason(seasonId) {
  if (!seasonId) return;
  if (!window.confirm("Are you sure you want to leave this season?")) return;
  try {
    const res = await fetch(`/api/seasons/${seasonId}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      fetchPlayerSeason();
    } else {
      alert("Error: " + (data.error || "Failed to leave season"));
    }
  } catch (err) {
    alert("Network error. Please try again.");
  }
}

async function endSeason(seasonId) {
  if (!seasonId) return;
  if (!window.confirm("Are you sure you want to end this season? This cannot be undone.")) return;
  try {
    const res = await fetch(`/api/seasons/${seasonId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      fetchPlayerSeason();
    } else {
      alert("Error: " + (data.error || "Failed to end season"));
    }
  } catch (err) {
    alert("Network error. Please try again.");
  }
}

async function deleteSeason(seasonId) {
  if (!seasonId) return;
  if (!window.confirm("This will permanently delete the season and remove all members. Continue?")) return;
  try {
    const res = await fetch(`/api/seasons/${seasonId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.ok && data.success) {
      fetchPlayerSeason();
    } else {
      alert("Error: " + (data.error || "Failed to delete season"));
    }
  } catch (err) {
    alert("Network error. Please try again.");
  }
}

// -- Kick Member Modal -------------------------------------------

function showKickMemberModal(seasonId) {
  if (!seasonId) return;
  selectedSeasonId = seasonId;
  document.getElementById("kick-member-modal").classList.add("modal--active");
  fetchKickMemberList();
}

function hideKickMemberModal() {
  document.getElementById("kick-member-modal").classList.remove("modal--active");
  document.getElementById("kick-member-list").innerHTML = "";
}

async function fetchKickMemberList() {
  const container = document.getElementById("kick-member-list");
  try {
    const res = await fetch(`/api/seasons/${selectedSeasonId}/members`);
    const data = await res.json();
    if (!data.success || !data.members || data.members.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: 1rem 0;">No members found</p>';
      return;
    }
    container.innerHTML = data.members.map(m => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border);">
        <div>
          <strong>${m.display_name}</strong>
          <span style="font-size: 0.8rem; color: var(--color-text-muted); margin-left: 0.5rem;">
            ELO: ${m.season_elo} · ${m.wins}W-${m.losses}L · #${m.rank}
          </span>
        </div>
        <div>
          ${m.is_creator
            ? '<span style="font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; background: rgba(168, 85, 247, 0.15); color: #a855f7;">Creator</span>'
            : `<button class="btn btn--danger" style="font-size: 0.8rem; padding: 0.2rem 0.6rem;" onclick="kickMember('${m.user_id}', '${m.display_name}')">Kick</button>`
          }
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = '<p style="text-align: center; color: var(--color-text-muted);">Error loading members</p>';
  }
}

async function kickMember(userId, displayName) {
  if (!selectedSeasonId) return;
  if (!window.confirm(`Remove ${displayName} from the season?`)) return;
  try {
    const res = await fetch(`/api/seasons/${selectedSeasonId}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      fetchKickMemberList();
      fetchPlayerSeason();
    } else {
      alert("Error: " + (data.error || "Failed to kick member"));
    }
  } catch (err) {
    alert("Network error. Please try again.");
  }
}

// -- Report Season Match Modal ------------------------------------

function showReportSeasonMatchModal(seasonId) {
  if (!seasonId) return;
  selectedSeasonId = seasonId;
  document.getElementById("report-season-match-error").style.display = "none";
  document.getElementById("report-season-match-modal").classList.add("modal--active");
  fetchSeasonMembersForMatch();
}

function hideReportSeasonMatchModal() {
  document.getElementById("report-season-match-modal").classList.remove("modal--active");
  document.getElementById("season-match-winner").innerHTML = '<option value="">Select winner...</option>';
  document.getElementById("season-match-loser").innerHTML = '<option value="">Select loser...</option>';
  document.getElementById("report-season-match-error").style.display = "none";
}

async function fetchSeasonMembersForMatch() {
  const winnerSelect = document.getElementById("season-match-winner");
  const loserSelect = document.getElementById("season-match-loser");
  try {
    const res = await fetch(`/api/seasons/${selectedSeasonId}/members`);
    const data = await res.json();
    if (!data.success || !data.members || data.members.length < 2) {
      winnerSelect.innerHTML = '<option value="">No members available</option>';
      loserSelect.innerHTML = '<option value="">No members available</option>';
      return;
    }
    const options = data.members.map(m =>
      `<option value="${m.user_id}">${m.display_name} (ELO: ${m.season_elo})</option>`
    ).join("");
    winnerSelect.innerHTML = '<option value="">Select winner...</option>' + options;
    loserSelect.innerHTML = '<option value="">Select loser...</option>' + options;
  } catch (err) {
    winnerSelect.innerHTML = '<option value="">Error loading members</option>';
    loserSelect.innerHTML = '<option value="">Error loading members</option>';
  }
}

async function submitSeasonMatch() {
  const winnerId = document.getElementById("season-match-winner").value;
  const loserId = document.getElementById("season-match-loser").value;
  const errorEl = document.getElementById("report-season-match-error");
  const submitBtn = document.getElementById("submit-season-match-btn");

  errorEl.style.display = "none";

  if (!winnerId || !loserId) {
    errorEl.textContent = "Please select both a winner and a loser.";
    errorEl.style.display = "block";
    return;
  }
  if (winnerId === loserId) {
    errorEl.textContent = "Winner and loser must be different players.";
    errorEl.style.display = "block";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Reporting...";

  try {
    const res = await fetch(`/api/seasons/${selectedSeasonId}/report-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner_id: winnerId, loser_id: loserId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideReportSeasonMatchModal();
      fetchPlayerSeason();
      alert(data.message || "Match reported successfully!");
    } else {
      errorEl.textContent = data.error || "Failed to report match.";
      errorEl.style.display = "block";
    }
  } catch (err) {
    errorEl.textContent = "Network error. Please try again.";
    errorEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Report Match";
  }
}

// -- Modify Season Modal -----------------------------------------

function showModifySeasonModal(seasonId) {
  const season = getSeasonById(seasonId);
  if (!season) return;
  selectedSeasonId = seasonId;
  document.getElementById("modify-start-date").value = season.start_date || "";
  document.getElementById("modify-end-date").value = season.end_date || "";
  document.getElementById("modify-description").value = season.description || "";
  document.getElementById("modify-k-value").value = season.k_value || 32;
  document.getElementById("modify-max-members").value = season.max_members || "";
  document.getElementById("modify-region").value = season.region || "";
  document.getElementById("modify-season-modal").classList.add("modal--active");
}

function hideModifySeasonModal() {
  document.getElementById("modify-season-modal").classList.remove("modal--active");
}

async function submitModifySeason() {
  if (!selectedSeasonId) return;
  const fields = {};
  const startDate = document.getElementById("modify-start-date").value;
  const endDate = document.getElementById("modify-end-date").value;
  const description = document.getElementById("modify-description").value.trim();
  const kValue = document.getElementById("modify-k-value").value;
  const maxMembers = document.getElementById("modify-max-members").value;
  const region = document.getElementById("modify-region").value.trim();

  if (startDate) fields.start_date = startDate;
  if (endDate) fields.end_date = endDate;
  fields.description = description || null;
  if (kValue) fields.k_value = parseInt(kValue);
  if (maxMembers) fields.max_members = parseInt(maxMembers);
  fields.region = region || null;

  try {
    const res = await fetch(`/api/seasons/${selectedSeasonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideModifySeasonModal();
      fetchPlayerSeason();
    } else {
      alert("Error: " + (data.error || "Failed to update season"));
    }
  } catch (err) {
    alert("Network error. Please try again.");
  }
}

// Escape key handlers for season modals
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    if (document.getElementById("create-season-modal").classList.contains("modal--active")) hideCreateSeasonModal();
    if (document.getElementById("join-season-modal").classList.contains("modal--active")) hideJoinSeasonModal();
    if (document.getElementById("kick-member-modal").classList.contains("modal--active")) hideKickMemberModal();
    if (document.getElementById("modify-season-modal").classList.contains("modal--active")) hideModifySeasonModal();
    if (document.getElementById("pending-confirmation-modal").classList.contains("modal--active")) hidePendingConfirmationModal();
  }
});

// ==================== Pending Match Confirmations ====================

let pendingConfirmations = [];
let currentConfirmation = null;
let confirmationPollInterval = null;
const CONFIRMATION_POLL_MS = 30000;

function showPendingConfirmationModal() {
  document.getElementById("pending-confirmation-modal").classList.add("modal--active");
}

function hidePendingConfirmationModal() {
  document.getElementById("pending-confirmation-modal").classList.remove("modal--active");
  backToConfirmationList();
}

async function fetchPendingConfirmations() {
  try {
    const response = await fetch("/api/match-report/pending");
    if (!response.ok) return;
    const data = await response.json();

    pendingConfirmations = data.pending_confirmations || [];
    displayPendingConfirmationsList();

    if (pendingConfirmations.length > 0) {
      const modal = document.getElementById("pending-confirmation-modal");
      if (!modal.classList.contains("modal--active")) {
        showPendingConfirmationModal();
      }
    }
  } catch (error) {
    console.error("Error fetching pending confirmations:", error);
  }
}

function displayPendingConfirmationsList() {
  const listContainer = document.getElementById("pending-confirmations-list");

  if (!pendingConfirmations || pendingConfirmations.length === 0) {
    listContainer.innerHTML = '<p style="color: var(--color-text-muted);">No pending confirmations.</p>';
    return;
  }

  listContainer.innerHTML = pendingConfirmations.map(conf => {
    const submitterName = conf.submitter_display_name || "Unknown Player";
    const expiresIn = formatConfirmationTimeRemaining(conf.expires_at);
    const youWon = conf.winner_discord_id == conf.opponent_discord_id;
    const resultText = youWon ? "You won" : "You lost";

    return `
      <div style="padding: var(--spacing-md); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); cursor: pointer; margin-bottom: var(--spacing-sm); transition: background 0.2s;"
           onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''"
           onclick="showConfirmationDetails(${conf.id})">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 600; color: var(--color-text);">${submitterName}</span>
            <br><span style="color: var(--color-text-muted); font-size: 0.875rem;">${resultText} &bull; Expires ${expiresIn}</span>
          </div>
          <span style="padding: 2px 8px; background: rgba(234,179,8,0.15); color: #eab308; border-radius: var(--radius-sm); font-size: 0.75rem;">Pending</span>
        </div>
      </div>
    `;
  }).join('');
}

function showConfirmationDetails(confirmationId) {
  const confirmation = pendingConfirmations.find(c => c.id === confirmationId);
  if (!confirmation) return;

  currentConfirmation = confirmation;

  const submitterName = confirmation.submitter_display_name || "Unknown Player";
  document.getElementById("confirmation-submitter-name").textContent = submitterName;

  const youWon = confirmation.winner_discord_id == confirmation.opponent_discord_id;
  document.getElementById("confirmation-result").textContent = youWon
    ? `${submitterName} reported that you won`
    : `${submitterName} reported that they won`;

  document.getElementById("confirmation-final-life").textContent =
    `Winner: ${confirmation.final_life_winner} | Loser: ${confirmation.final_life_loser}`;

  const wentFirst = confirmation.went_first === "submitter" ? submitterName : "You";
  document.getElementById("confirmation-went-first").textContent = wentFirst;

  const winnerDeckRow = document.getElementById("confirmation-deck-row-winner");
  const loserDeckRow = document.getElementById("confirmation-deck-row-loser");
  if (confirmation.winner_deck_url) {
    document.getElementById("confirmation-deck-winner").href = confirmation.winner_deck_url;
    winnerDeckRow.style.display = "flex";
  } else {
    winnerDeckRow.style.display = "none";
  }
  if (confirmation.loser_deck_url) {
    document.getElementById("confirmation-deck-loser").href = confirmation.loser_deck_url;
    loserDeckRow.style.display = "flex";
  } else {
    loserDeckRow.style.display = "none";
  }

  document.getElementById("confirmation-expires").textContent = formatConfirmationTimeRemaining(confirmation.expires_at);

  document.getElementById("confirmation-success").style.display = "none";
  document.getElementById("confirmation-error").style.display = "none";
  document.getElementById("confirmation-loading").style.display = "none";
  document.getElementById("confirm-match-btn").disabled = false;
  document.getElementById("deny-match-btn").disabled = false;
  document.getElementById("back-to-list-btn").disabled = false;

  document.getElementById("pending-confirmations-list").style.display = "none";
  document.getElementById("confirmation-details").style.display = "block";
}

function backToConfirmationList() {
  document.getElementById("pending-confirmations-list").style.display = "block";
  document.getElementById("confirmation-details").style.display = "none";
  currentConfirmation = null;
}

function formatConfirmationTimeRemaining(expiresAt) {
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiresAt - now;
  if (remaining <= 0) return "expired";
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
}

async function confirmPendingMatch() {
  if (!currentConfirmation) return;

  document.getElementById("confirmation-loading").style.display = "block";
  document.getElementById("confirmation-success").style.display = "none";
  document.getElementById("confirmation-error").style.display = "none";
  document.getElementById("confirm-match-btn").disabled = true;
  document.getElementById("deny-match-btn").disabled = true;
  document.getElementById("back-to-list-btn").disabled = true;

  try {
    const deckUrl = document.getElementById("confirmation-your-deck-url").value || null;
    const response = await fetch(`/api/match-report/confirm/${currentConfirmation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_url: deckUrl })
    });
    const data = await response.json();
    document.getElementById("confirmation-loading").style.display = "none";

    if (!response.ok) {
      const errorEl = document.getElementById("confirmation-error");
      errorEl.textContent = data.error?.message || "Failed to confirm match. Please try again.";
      errorEl.style.display = "block";
      document.getElementById("confirm-match-btn").disabled = false;
      document.getElementById("deny-match-btn").disabled = false;
      document.getElementById("back-to-list-btn").disabled = false;
      return;
    }

    const successEl = document.getElementById("confirmation-success");
    successEl.textContent = data.message || "Match confirmed successfully!";
    successEl.style.display = "block";

    setTimeout(() => {
      hidePendingConfirmationModal();
      fetchPendingConfirmations();
    }, 2000);
  } catch (error) {
    console.error("Error confirming match:", error);
    document.getElementById("confirmation-loading").style.display = "none";
    const errorEl = document.getElementById("confirmation-error");
    errorEl.textContent = "Network error. Please check your connection and try again.";
    errorEl.style.display = "block";
    document.getElementById("confirm-match-btn").disabled = false;
    document.getElementById("deny-match-btn").disabled = false;
    document.getElementById("back-to-list-btn").disabled = false;
  }
}

async function denyPendingMatch() {
  if (!currentConfirmation) return;

  document.getElementById("confirmation-loading").style.display = "block";
  document.getElementById("confirmation-success").style.display = "none";
  document.getElementById("confirmation-error").style.display = "none";
  document.getElementById("confirm-match-btn").disabled = true;
  document.getElementById("deny-match-btn").disabled = true;
  document.getElementById("back-to-list-btn").disabled = true;

  try {
    const response = await fetch(`/api/match-report/deny/${currentConfirmation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: null })
    });
    const data = await response.json();
    document.getElementById("confirmation-loading").style.display = "none";

    if (!response.ok) {
      const errorEl = document.getElementById("confirmation-error");
      errorEl.textContent = data.error?.message || "Failed to deny match. Please try again.";
      errorEl.style.display = "block";
      document.getElementById("confirm-match-btn").disabled = false;
      document.getElementById("deny-match-btn").disabled = false;
      document.getElementById("back-to-list-btn").disabled = false;
      return;
    }

    const successEl = document.getElementById("confirmation-success");
    successEl.textContent = data.message || "Match report denied.";
    successEl.style.display = "block";

    setTimeout(() => {
      hidePendingConfirmationModal();
      fetchPendingConfirmations();
    }, 2000);
  } catch (error) {
    console.error("Error denying match:", error);
    document.getElementById("confirmation-loading").style.display = "none";
    const errorEl = document.getElementById("confirmation-error");
    errorEl.textContent = "Network error. Please check your connection and try again.";
    errorEl.style.display = "block";
    document.getElementById("confirm-match-btn").disabled = false;
    document.getElementById("deny-match-btn").disabled = false;
    document.getElementById("back-to-list-btn").disabled = false;
  }
}

// Initial load - start at page 1
// currentEloSource will be set during fetchPlayerData based on user type
fetchPlayerData("lifetime", 1, currentEloSource);
