const pageConfigEl = document.getElementById('page-config');
const config = pageConfigEl ? JSON.parse(pageConfigEl.textContent) : {};

// Element chart rendering
if (config.elementStats) {
  function renderEventElementBars(data, containerId, totalDecks) {
    const container = document.getElementById(containerId);
    if (!container || !data || data.length === 0) return;

    const sorted = [...data].sort((a, b) => b.percent - a.percent);
    let html = "";
    sorted.forEach((el) => {
      const elementClass = `element-${el.name.toLowerCase()}`;
      html += `
        <div class="element-row ${elementClass}">
          <div class="element-label">${el.name}</div>
          <div class="element-bar-container">
            <div class="element-bar" style="width: ${el.percent}%;">
              <span class="element-bar-text">${el.percent}%</span>
            </div>
          </div>
          <div class="element-stats">
            ${el.count} / ${totalDecks} decks
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  const stats = config.elementStats;
  renderEventElementBars(stats.dominant_element, "dominant-bars", stats.total_decks);
  renderEventElementBars(stats.element_presence, "presence-bars", stats.total_decks);
}

// Card data sorting and filtering
if (config.hasCardData) {
  // Current sort state
  let currentSort = { column: null, direction: "asc" };

  // Sort table by column
  function sortTable(column, type) {
    const table = document.getElementById("cards-table");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const headers = table.querySelectorAll("th.sortable");

    // Toggle direction if same column, otherwise default to ascending
    if (currentSort.column === column) {
      currentSort.direction =
        currentSort.direction === "asc" ? "desc" : "asc";
    } else {
      currentSort.column = column;
      currentSort.direction = "asc";
    }

    // Update header classes
    headers.forEach((h) => {
      h.classList.remove("asc", "desc");
      if (h.dataset.sort === column) {
        h.classList.add(currentSort.direction);
      }
    });

    // Sort rows
    rows.sort((a, b) => {
      let aVal = a.dataset[column];
      let bVal = b.dataset[column];

      if (type === "number") {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return currentSort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return currentSort.direction === "asc" ? 1 : -1;
      return 0;
    });

    // Re-append sorted rows
    rows.forEach((row) => tbody.appendChild(row));
  }

  // Add click listeners to sortable headers
  document.querySelectorAll("th.sortable").forEach((header) => {
    header.addEventListener("click", () => {
      sortTable(header.dataset.sort, header.dataset.type);
    });
  });

  // Filter cards by search term, type, and element
  window.filterCards = function filterCards() {
    const searchTerm = document
      .getElementById("card-search")
      .value.toLowerCase();
    const typeFilter = document.getElementById("type-filter").value;
    const elementFilter = document.getElementById("element-filter").value;
    const rows = document.querySelectorAll("#cards-table tbody tr");

    rows.forEach((row) => {
      const name = row.dataset.name.toLowerCase();
      const type = row.dataset.type;
      const element = row.dataset.element;

      const matchesSearch = name.includes(searchTerm);
      const matchesType = !typeFilter || type === typeFilter;
      const matchesElement = !elementFilter || element === elementFilter;

      row.style.display =
        matchesSearch && matchesType && matchesElement ? "" : "none";
    });
  };
}
