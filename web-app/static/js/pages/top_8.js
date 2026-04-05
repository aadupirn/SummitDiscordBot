function filterEvents() {
  const yearFilter = document.getElementById("year-filter").value;
  const formatFilter = document
    .getElementById("format-filter")
    .value.toLowerCase();
  const cards = document.querySelectorAll(".event-card");
  let visibleCount = 0;

  cards.forEach((card) => {
    const name = card.dataset.name || "";
    const folder = card.dataset.folder || "";
    const combined = name + " " + folder;

    let yearMatch = true;
    let formatMatch = true;

    // Year filter
    if (yearFilter) {
      yearMatch = combined.includes(yearFilter);
    }

    // Format filter
    if (formatFilter) {
      formatMatch = combined.includes(formatFilter);
    }

    if (yearMatch && formatMatch) {
      card.classList.remove("hidden");
      visibleCount++;
    } else {
      card.classList.add("hidden");
    }
  });

  document.getElementById("visible-count").textContent = visibleCount;
}

document
  .getElementById("year-filter")
  .addEventListener("change", filterEvents);
document
  .getElementById("format-filter")
  .addEventListener("change", filterEvents);
