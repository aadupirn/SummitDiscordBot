(function () {
  const BANNER_DISMISSED_KEY = "streaming_banner_dismissed";
  const CHECK_INTERVAL = 60000; // Check every 60 seconds

  function getPlatformIcon(platform) {
    if (platform === "Twitch") return "🟣";
    if (platform === "YouTube") return "🔴";
    return "📺";
  }

  function createStreamerCard(streamer) {
    const card = document.createElement("a");
    card.href = streamer.stream_url || "#";
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.className = "streamer-card";

    card.innerHTML = `
      <span class="live-indicator">
        <span class="live-dot-container">
          <span class="live-dot-ping"></span>
          <span class="live-dot"></span>
        </span>
        <span class="live-text">Live</span>
      </span>
      ${streamer.avatar_url ? `<img src="${streamer.avatar_url}" alt="${streamer.display_name}" class="streamer-avatar">` : ""}
      <div class="streamer-details">
        <span class="streamer-name">${streamer.display_name}</span>
        <span class="stream-game">${streamer.game_name || "Streaming"}</span>
      </div>
      <span class="platform-icon">${getPlatformIcon(streamer.platform)}</span>
    `;

    return card;
  }

  async function checkStreamers() {
    try {
      const response = await fetch("/api/streamers");
      if (!response.ok) {
        console.warn(
          "Streamers API returned non-ok status:",
          response.status,
        );
        return;
      }

      const data = await response.json();
      console.log("Streamers API response:", data);
      const banner = document.getElementById("streaming-banner");
      const streamersList = document.getElementById("streamers-list");

      if (!data.streamers || data.streamers.length === 0) {
        console.log("No active streamers, hiding banner");
        banner.classList.remove("show");
        sessionStorage.removeItem(BANNER_DISMISSED_KEY);
        return;
      }

      // Check if user dismissed the banner this session
      const dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);
      if (dismissed === "true") {
        console.log("Banner was dismissed by user");
        return;
      }

      // Clear and rebuild streamer cards
      streamersList.innerHTML = "";
      data.streamers.forEach((streamer) => {
        streamersList.appendChild(createStreamerCard(streamer));
      });

      // Show banner
      console.log("Showing banner for", data.streamers.length, "streamers");
      banner.classList.add("show");
    } catch (error) {
      console.error("Error checking streamers:", error);
    }
  }

  function closeBanner() {
    const banner = document.getElementById("streaming-banner");
    banner.classList.remove("show");
    sessionStorage.setItem(BANNER_DISMISSED_KEY, "true");
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      console.log("DOM loaded, initializing streaming banner");

      // Set up close button
      const closeBtn = document.getElementById("close-streaming-banner");
      if (closeBtn) {
        closeBtn.addEventListener("click", closeBanner);
      }

      // Initial check
      checkStreamers();

      // Periodic check
      setInterval(checkStreamers, CHECK_INTERVAL);
    });
  } else {
    console.log("DOM already loaded, initializing streaming banner");

    // Set up close button
    const closeBtn = document.getElementById("close-streaming-banner");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeBanner);
    }

    // Initial check
    checkStreamers();

    // Periodic check
    setInterval(checkStreamers, CHECK_INTERVAL);
  }
})();
