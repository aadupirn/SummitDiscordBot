// === Dashboard ===
const CHART_COLORS = {
  bot: 'rgba(77, 184, 255, 0.8)',
  web: 'rgba(63, 185, 80, 0.8)',
  total: 'rgba(219, 154, 4, 0.8)',
  players: 'rgba(168, 130, 255, 0.8)',
  botFill: 'rgba(77, 184, 255, 0.15)',
  webFill: 'rgba(63, 185, 80, 0.15)',
  playersFill: 'rgba(168, 130, 255, 0.15)',
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: 'rgba(255,255,255,0.8)', font: { size: 12 } } },
  },
  scales: {
    x: {
      ticks: { color: 'rgba(255,255,255,0.5)', maxRotation: 45, maxTicksLimit: 20 },
      grid: { color: 'rgba(255,255,255,0.05)' },
    },
    y: {
      beginAtZero: true,
      ticks: { color: 'rgba(255,255,255,0.5)' },
      grid: { color: 'rgba(255,255,255,0.08)' },
    },
  },
};

function weekLabel(yw) {
  // Convert "YYYY-WW" to a readable date label (first day of that week)
  const [year, week] = yw.split('-').map(Number);
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() + ((8 - dayOfWeek) % 7));
  const target = new Date(firstMonday);
  target.setDate(firstMonday.getDate() + (week - 1) * 7);
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function loadDashboard() {
  fetch('/api/admin/dashboard-stats')
    .then(r => r.json())
    .then(data => {
      if (!data.success) return;

      // Summary cards
      document.getElementById('total-players').textContent = data.summary.total_players.toLocaleString();
      document.getElementById('total-matches').textContent = data.summary.total_matches.toLocaleString();
      document.getElementById('avg-weekly').textContent = data.summary.avg_weekly_games;
      document.getElementById('bot-matches').textContent = data.summary.total_bot_matches.toLocaleString();
      document.getElementById('web-matches').textContent = data.summary.total_web_matches.toLocaleString();
      document.getElementById('total-logins').textContent = (data.summary.total_logins || 0).toLocaleString();

      const labels = data.games_over_time.map(d => weekLabel(d.week));

      // Games chart
      new Chart(document.getElementById('games-chart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Online',
              data: data.games_over_time.map(d => d.bot),
              backgroundColor: CHART_COLORS.bot,
              borderRadius: 2,
            },
            {
              label: 'Paper',
              data: data.games_over_time.map(d => d.web),
              backgroundColor: CHART_COLORS.web,
              borderRadius: 2,
            },
          ],
        },
        options: {
          ...chartDefaults,
          plugins: {
            ...chartDefaults.plugins,
            tooltip: {
              callbacks: {
                afterBody: (items) => {
                  const idx = items[0].dataIndex;
                  const total = data.games_over_time[idx].total;
                  return `Total: ${total}`;
                },
              },
            },
          },
          scales: {
            ...chartDefaults.scales,
            x: { ...chartDefaults.scales.x, stacked: true },
            y: { ...chartDefaults.scales.y, stacked: true },
          },
        },
      });

      // Players chart
      new Chart(document.getElementById('players-chart'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Unique Players',
              data: data.players_over_time.map(d => d.combined),
              borderColor: CHART_COLORS.players,
              backgroundColor: CHART_COLORS.playersFill,
              fill: true,
              tension: 0.3,
              pointRadius: 2,
              pointHoverRadius: 5,
            },
          ],
        },
        options: chartDefaults,
      });

      // Avg games per player chart
      const gppLabels = data.avg_games_per_player.map(d => weekLabel(d.week));
      new Chart(document.getElementById('avg-gpp-chart'), {
        type: 'line',
        data: {
          labels: gppLabels,
          datasets: [
            {
              label: 'Avg Games/Player',
              data: data.avg_games_per_player.map(d => d.avg),
              borderColor: 'rgba(219, 154, 4, 0.8)',
              backgroundColor: 'rgba(219, 154, 4, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
              pointHoverRadius: 5,
            },
          ],
        },
        options: chartDefaults,
      });

      // New player acquisition chart
      const npLabels = data.new_players_per_week.map(d => weekLabel(d.week));
      new Chart(document.getElementById('new-players-chart'), {
        type: 'bar',
        data: {
          labels: npLabels,
          datasets: [
            {
              label: 'New Players',
              data: data.new_players_per_week.map(d => d.count),
              backgroundColor: 'rgba(255, 136, 68, 0.8)',
              borderRadius: 2,
            },
          ],
        },
        options: chartDefaults,
      });

      // Dominance panel
      renderDominance(data.dominance);

      // Heatmap
      renderHeatmap(data.heatmap);
    })
    .catch(err => console.error('Dashboard load failed:', err));
}

function renderDominance(dom) {
  const el = document.getElementById('dominance-content');
  if (!dom || !dom.total_players_with_wins) {
    el.innerHTML = '<p class="empty-state">Not enough data yet.</p>';
    return;
  }

  function playerRow(p, i) {
    return `<tr>
      <td>${i + 1}</td>
      <td class="nowrap">${p.name}</td>
      <td>${p.wins}</td>
      <td>${p.losses}</td>
      <td>${p.games}</td>
      <td><strong>${p.win_rate}%</strong></td>
    </tr>`;
  }

  const topWinsHtml = dom.top_10_players.map(playerRow).join('');
  const mostActiveHtml = (dom.most_active || []).map(playerRow).join('');

  const streaksHtml = (dom.streaks || []).map((s, i) =>
    `<tr>
      <td>${i + 1}</td>
      <td class="nowrap">${s.name}</td>
      <td><strong>${s.best_streak}</strong></td>
      <td>${s.current_streak > 0 ? s.current_streak + ' \u{1F525}' : '-'}</td>
    </tr>`
  ).join('');

  const tableHead = '<thead><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>Games</th><th>Win%</th></tr></thead>';

  el.innerHTML = `
    <div class="dominance-stats">
      <div class="dominance-stat-row">
        <span class="dominance-label">Players with wins</span>
        <span class="dominance-value">${dom.total_players_with_wins}</span>
      </div>
      <div class="dominance-stat-row highlight">
        <span class="dominance-label">Top 10% (${dom.top_10_pct_count} players)</span>
        <span class="dominance-value">${dom.top_10_pct_win_share}% of wins</span>
      </div>
      <div class="dominance-stat-row">
        <span class="dominance-label">Top 25% (${dom.top_25_pct_count} players)</span>
        <span class="dominance-value">${dom.top_25_pct_win_share}% of wins</span>
      </div>
    </div>
    <div class="dominance-tables-grid">
      <div>
        <h4 class="dominance-table-title">Top 10 by Wins</h4>
        <table class="dominance-table">${tableHead}<tbody>${topWinsHtml}</tbody></table>
      </div>
      <div>
        <h4 class="dominance-table-title">Most Active Players</h4>
        <table class="dominance-table">${tableHead}<tbody>${mostActiveHtml}</tbody></table>
      </div>
      <div>
        <h4 class="dominance-table-title">Win Streaks</h4>
        <table class="dominance-table">
          <thead><tr><th>#</th><th>Player</th><th>Best</th><th>Current</th></tr></thead>
          <tbody>${streaksHtml || '<tr><td colspan="4">No streaks of 3+ yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderHeatmap(heatmap) {
  const container = document.getElementById('heatmap-container');
  if (!heatmap || heatmap.length === 0) {
    container.innerHTML = '<p class="empty-state">No data.</p>';
    return;
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxVal = Math.max(...heatmap.flat(), 1);

  let html = '<div class="heatmap-grid">';
  // Header row (hours)
  html += '<div class="heatmap-cell heatmap-corner"></div>';
  for (let h = 0; h < 24; h++) {
    const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
    html += `<div class="heatmap-cell heatmap-header">${label}</div>`;
  }

  // Red (low) -> Yellow (mid) -> Green (high) gradient
  function heatColor(intensity) {
    if (intensity <= 0.5) {
      // Red to Yellow (0.0 -> 0.5)
      const t = intensity * 2;
      const r = 220;
      const g = Math.round(60 + t * 160);
      const b = Math.round(50 + t * 10);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow to Green (0.5 -> 1.0)
      const t = (intensity - 0.5) * 2;
      const r = Math.round(220 - t * 170);
      const g = Math.round(220 - t * 30);
      const b = Math.round(60 + t * 30);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  for (let d = 0; d < 7; d++) {
    html += `<div class="heatmap-cell heatmap-day">${days[d]}</div>`;
    for (let h = 0; h < 24; h++) {
      const val = heatmap[d][h];
      const intensity = val / maxVal;
      const bg = val === 0
        ? 'rgba(255,255,255,0.03)'
        : heatColor(intensity);
      html += `<div class="heatmap-cell heatmap-data" style="background:${bg}" title="${days[d]} ${h}:00 - ${val} games">${val || ''}</div>`;
    }
  }
  html += '</div>';

  // Legend
  html += `<div class="heatmap-legend">
    <span>Less</span>
    <div class="heatmap-legend-cell" style="background:rgb(220,60,50)"></div>
    <div class="heatmap-legend-cell" style="background:rgb(220,140,55)"></div>
    <div class="heatmap-legend-cell" style="background:rgb(220,220,60)"></div>
    <div class="heatmap-legend-cell" style="background:rgb(135,205,75)"></div>
    <div class="heatmap-legend-cell" style="background:rgb(50,190,90)"></div>
    <span>More</span>
  </div>`;

  container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', loadDashboard);

function resetAllElo() {
  if (!confirm('\u26a0\ufe0f WARNING: This will DELETE ALL ELO ratings and match history!\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
    return;
  }

  if (!confirm('This is your FINAL warning. ALL data will be permanently deleted.\n\nType YES in the next prompt to confirm.')) {
    return;
  }

  const confirmation = prompt('Type YES to confirm database reset:');
  if (confirmation !== 'YES') {
    alert('Reset cancelled.');
    return;
  }

  fetch('/api/admin/reset-all-elo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('\u2705 ' + data.message);
      location.reload();
    } else {
      alert('\u274c Error: ' + data.error);
    }
  })
  .catch(error => {
    alert('\u274c Network error: ' + error.message);
  });
}

function getGameActivity() {
  const hours = document.getElementById('activity-hours').value;
  const resultDiv = document.getElementById('activity-result');

  resultDiv.innerHTML = '<p class="loading">Loading...</p>';

  fetch(`/api/admin/game-activity?hours=${hours}`)
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      resultDiv.innerHTML = `
        <div class="activity-stats">
          <h4>Activity for Last ${data.hours} Hours</h4>
          <p><strong>Total Matches:</strong> ${data.total_matches}</p>
          <p><strong>Bot Matches:</strong> ${data.bot_matches}</p>
          <p><strong>Web Matches:</strong> ${data.web_matches}</p>
          <p><strong>Active Players:</strong> ${data.active_players}</p>
          <p class="time-range"><small>${data.start_time} to ${data.end_time}</small></p>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `<p class="error">\u274c Error: ${data.error}</p>`;
    }
  })
  .catch(error => {
    resultDiv.innerHTML = `<p class="error">\u274c Network error: ${error.message}</p>`;
  });
}

function startEvent() {
  const eventName = document.getElementById('event-name').value.trim();

  if (!eventName) {
    alert('Please enter an event name.');
    return;
  }

  if (!confirm(`Start new event "${eventName}"?\n\nThis will archive the current event (if any) and reset event ELO for all players.`)) {
    return;
  }

  fetch('/api/admin/start-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_name: eventName })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('\u2705 ' + data.message);
      document.getElementById('event-name').value = '';
      location.reload();
    } else {
      alert('\u274c Error: ' + data.error);
    }
  })
  .catch(error => {
    alert('\u274c Network error: ' + error.message);
  });
}

function endEvent() {
  if (!confirm('End the current event?\n\nThis will archive the event and leave no active event until you start a new one.')) {
    return;
  }

  fetch('/api/admin/end-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('\u2705 ' + data.message);
      location.reload();
    } else {
      alert('\u274c Error: ' + data.error);
    }
  })
  .catch(error => {
    alert('\u274c Network error: ' + error.message);
  });
}
