// Navbar component JavaScript
document.addEventListener("DOMContentLoaded", function () {
  try {
    console.log("[navbar] DOMContentLoaded");
    const hamburgerBtn = document.getElementById("hamburger-toggle");
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");

    console.log("[navbar] elements:", {
      hamburgerBtn: !!hamburgerBtn,
      sidebar: !!sidebar,
      backdrop: !!backdrop,
    });

    // Toggle sidebar
    function toggleSidebar() {
      try {
        const isOpen = sidebar && sidebar.classList.contains("open");
        console.log("[navbar] toggleSidebar called, isOpen=", isOpen);

        if (isOpen) {
          // Close sidebar
          sidebar.classList.remove("open");
          console.log("[navbar] closing sidebar");
          if (backdrop) {
            backdrop.classList.add("opacity-0");
            backdrop.classList.remove("opacity-100");
            setTimeout(() => {
              backdrop.classList.add("hidden");
              console.log("[navbar] backdrop hidden");
            }, 300);
          }
        } else {
          // Open sidebar
          if (sidebar) sidebar.classList.add("open");
          console.log("[navbar] opening sidebar");
          if (backdrop) {
            backdrop.classList.remove("hidden");
            setTimeout(() => {
              backdrop.classList.add("opacity-100");
              backdrop.classList.remove("opacity-0");
              console.log("[navbar] backdrop shown 12345");
            }, 10);
          }
        }
      } catch (err) {
        console.error("[navbar] toggleSidebar error:", err);
      }
    }

    // Event listener for hamburger button
    if (hamburgerBtn) {
      console.log("[navbar] attaching click listener to hamburgerBtn");
      hamburgerBtn.addEventListener("click", function (e) {
        console.log("[navbar] hamburger clicked", e);
        toggleSidebar();
      });
    } else {
      console.warn("[navbar] hamburgerBtn not found");
    }

    // Close sidebar when clicking backdrop
    if (backdrop) {
      console.log("[navbar] attaching click listener to backdrop");
      backdrop.addEventListener("click", function (e) {
        console.log("[navbar] backdrop clicked", e);
        toggleSidebar();
      });
    }

    // Close sidebar on escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar && sidebar.classList.contains("open")) {
        console.log("[navbar] Escape pressed, closing sidebar");
        toggleSidebar();
      }
    });

    // Close sidebar when clicking a link
    if (sidebar) {
      const sidebarLinks = sidebar.querySelectorAll("a");
      sidebarLinks.forEach((link) => {
        link.addEventListener("click", function (ev) {
          console.log(
            "[navbar] sidebar link clicked",
            link.href || link.textContent,
          );
          if (sidebar.classList.contains("open")) {
            toggleSidebar();
          }
        });
      });
    } else {
      console.warn(
        "[navbar] sidebar element not found; cannot attach link handlers",
      );
    }

    // Set active state for life counter icon when on life counter page
    const lifeCounterIcon = document.getElementById("life-counter-icon");
    if (lifeCounterIcon && window.location.pathname === "/life-counter") {
      lifeCounterIcon.classList.add("active");
      console.log("[navbar] life counter icon set to active");
    }

    // Secret easter egg: Triple-click the brand name to access secret fart leaderboard
    const brandLink = document.getElementById("brand-secret");
    if (brandLink) {
      let clickCount = 0;
      let clickTimer;

      brandLink.addEventListener("click", function (e) {
        clickCount++;
        console.log("[navbar] brand click count:", clickCount);

        if (clickCount === 3) {
          e.preventDefault();
          console.log(
            "[navbar] triple-click detected, navigating to secret leaderboard",
          );
          window.location.href = "/secret-fart-leaderboard";
          clickCount = 0;
          clearTimeout(clickTimer);
          return;
        }

        // Reset click count after 600ms if not triple-clicked
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 600);
      });
    }
  } catch (e) {
    console.error("[navbar] initialization error:", e);
  }
});

/* Extracted from navbar.html */

// Navbar Streaming Indicator
(function () {
  const CHECK_INTERVAL = 60000;

  function getPlatformIcon(platform) {
    if (platform === "Twitch") return "🟣";
    if (platform === "YouTube") return "🔴";
    return "📺";
  }

  function createStreamerChip(streamer) {
    const chip = document.createElement("a");
    chip.href = "https://discord.gg/ZDqHSK9VGx";
    chip.target = "_blank";
    chip.rel = "noopener noreferrer";
    chip.className = "navbar-streamer-chip";
    chip.title = `${streamer.display_name} is playing a live game - Join Discord to watch!`;

    chip.innerHTML = `
      ${streamer.avatar_url ? `<img src="${streamer.avatar_url}" alt="" class="navbar-streamer-avatar">` : ""}
      <span class="navbar-streamer-name">${streamer.display_name}</span>
      <span class="navbar-platform-icon">${getPlatformIcon(streamer.platform)}</span>
    `;

    return chip;
  }

  function createLiveLabel() {
    const label = document.createElement("span");
    label.className = "navbar-live-label";
    label.innerHTML = `
      <span class="navbar-live-dot"></span>
      Live Game
    `;
    return label;
  }

  function createSidebarStreamerLink(streamer) {
    const link = document.createElement("a");
    link.href = "https://discord.gg/ZDqHSK9VGx";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className =
      "flex items-center gap-2 py-2 text-white hover:text-secondary transition-colors";
    link.title = `${streamer.display_name} is playing a live game - Join Discord to watch!`;

    link.innerHTML = `
        <span class="navbar-live-dot" style="width:6px;height:6px;"></span>
        ${streamer.avatar_url ? `<img src="${streamer.avatar_url}" alt="" class="w-5 h-5 rounded-full">` : ""}
        <span class="text-sm font-medium">${streamer.display_name}</span>
        <span class="text-xs">${getPlatformIcon(streamer.platform)}</span>
      `;

    return link;
  }

  async function checkNavbarStreamers() {
    try {
      const response = await fetch("/api/streamers");
      if (!response.ok) return;

      const data = await response.json();
      const navbarContainer = document.getElementById("navbar-streamers");
      const sidebarContainer = document.getElementById("sidebar-streamers");

      if (!data.streamers || data.streamers.length === 0) {
        if (navbarContainer) {
          navbarContainer.style.display = "none";
          navbarContainer.innerHTML = "";
        }
        if (sidebarContainer) {
          sidebarContainer.classList.add("hidden");
          sidebarContainer.innerHTML = "";
        }
        return;
      }

      // Populate navbar (desktop)
      if (navbarContainer) {
        navbarContainer.innerHTML = "";
        navbarContainer.appendChild(createLiveLabel());
        data.streamers.forEach((streamer) => {
          navbarContainer.appendChild(createStreamerChip(streamer));
        });
        navbarContainer.style.display = "flex";
      }

      // Populate sidebar (mobile)
      if (sidebarContainer) {
        sidebarContainer.innerHTML = "";
        const header = document.createElement("div");
        header.className =
          "flex items-center gap-2 text-xs font-bold uppercase text-red-500 mb-2";
        header.innerHTML = `<span class="navbar-live-dot"></span> Live Games`;
        sidebarContainer.appendChild(header);
        data.streamers.forEach((streamer) => {
          sidebarContainer.appendChild(createSidebarStreamerLink(streamer));
        });
        sidebarContainer.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error checking navbar streamers:", error);
    }
  }

  // Initial check when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      checkNavbarStreamers();
      setInterval(checkNavbarStreamers, CHECK_INTERVAL);
    });
  } else {
    checkNavbarStreamers();
    setInterval(checkNavbarStreamers, CHECK_INTERVAL);
  }
})();

// Notification System
(function() {
  const CHECK_INTERVAL = 60000; // 1 minute
  const CACHE_KEY = 'pending_confirmations';
  const CACHE_TIMESTAMP_KEY = 'pending_confirmations_timestamp';
  const CACHE_DURATION = 30000; // 30 seconds

  let pendingConfirmations = [];

  function getCachedConfirmations() {
    const cached = sessionStorage.getItem(CACHE_KEY);
    const timestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < CACHE_DURATION) {
        return JSON.parse(cached);
      }
    }
    return null;
  }

  function cacheConfirmations(confirmations) {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(confirmations));
    sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  }

  function formatTimeRemaining(expiresAt) {
    const now = Math.floor(Date.now() / 1000);
    const remaining = expiresAt - now;

    if (remaining <= 0) return "expired";

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  }

  async function fetchPendingConfirmations() {
    // Check if user is logged in by looking for notification bell elements
    // (they only render in the template when current_user is set)
    const isLoggedIn = !!(document.getElementById('notification-bell-mobile') || document.getElementById('notification-bell-desktop'));
    if (!isLoggedIn) return;

    try {
      // Try cache first
      const cached = getCachedConfirmations();
      if (cached) {
        pendingConfirmations = cached;
        updateNotificationUI();
        return;
      }

      const response = await fetch('/api/match-report/pending');
      if (!response.ok) {
        console.error('Failed to fetch pending confirmations:', response.status);
        return;
      }

      const data = await response.json();
      pendingConfirmations = data.pending_confirmations || [];

      // Cache the results
      cacheConfirmations(pendingConfirmations);

      updateNotificationUI();
    } catch (error) {
      console.error('Error fetching pending confirmations:', error);
    }
  }

  function updateNotificationUI() {
    const count = pendingConfirmations.length;

    // Update badges (both mobile and desktop)
    const badgeMobile = document.getElementById('notification-badge-mobile');
    const badgeDesktop = document.getElementById('notification-badge-desktop');

    [badgeMobile, badgeDesktop].forEach(badge => {
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 9 ? '9+' : count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    });

    // Update bell icon colors (both mobile and desktop)
    const bellMobile = document.getElementById('notification-bell-mobile');
    const bellDesktop = document.getElementById('notification-bell-desktop');

    [bellMobile, bellDesktop].forEach(bell => {
      if (bell) {
        const bellIcons = bell.querySelectorAll('.notification-bell-icon');
        bellIcons.forEach(icon => {
          if (count > 0) {
            icon.classList.add('has-notifications');
          } else {
            icon.classList.remove('has-notifications');
          }
        });
      }
    });

    // Update dropdown list
    updateDropdownList();
  }

  function updateDropdownList() {
    const listContainer = document.getElementById('notification-list');
    if (!listContainer) return;

    if (pendingConfirmations.length === 0) {
      listContainer.innerHTML = `
          <div class="p-6 text-center text-text-muted text-sm">
            <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p>No pending confirmations</p>
          </div>
        `;
      return;
    }

    listContainer.innerHTML = pendingConfirmations.map(conf => {
      const submitterName = conf.submitter_display_name || 'Unknown Player';
      const expiresIn = formatTimeRemaining(conf.expires_at);

      // Determine who won
      const youWon = conf.winner_discord_id == conf.opponent_discord_id;
      const resultText = youWon ? '🏆 You won' : '💀 You lost';
      const resultClass = youWon ? 'text-green-400' : 'text-red-400';

      return `
          <a
            href="/life-counter"
            class="block px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
            data-confirmation-id="${conf.id}">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-white truncate">${submitterName}</p>
                <p class="text-xs ${resultClass} font-medium mt-0.5">${resultText}</p>
                <p class="text-xs text-text-muted mt-1">Final: ${conf.final_life_winner} - ${conf.final_life_loser}</p>
              </div>
              <div class="flex flex-col items-end gap-1">
                <span class="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full whitespace-nowrap">
                  ${expiresIn}
                </span>
              </div>
            </div>
          </a>
        `;
    }).join('');
  }

  function toggleDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('hidden');

    if (isHidden) {
      // Fetch fresh data when opening
      fetchPendingConfirmations();
      dropdown.classList.remove('hidden');
    } else {
      dropdown.classList.add('hidden');
    }
  }

  function closeDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
      dropdown.classList.add('hidden');
    }
  }

  // Initialize on DOM ready
  function init() {
    // Attach click handlers to bell icons
    const bellMobile = document.getElementById('notification-bell-mobile');
    const bellDesktop = document.getElementById('notification-bell-desktop');

    if (bellMobile) {
      bellMobile.addEventListener('click', toggleDropdown);
    }
    if (bellDesktop) {
      bellDesktop.addEventListener('click', toggleDropdown);
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
      const dropdown = document.getElementById('notification-dropdown');
      const bellMobile = document.getElementById('notification-bell-mobile');
      const bellDesktop = document.getElementById('notification-bell-desktop');

      if (dropdown && !dropdown.contains(event.target) &&
          event.target !== bellMobile && event.target !== bellDesktop &&
          !bellMobile?.contains(event.target) && !bellDesktop?.contains(event.target)) {
        closeDropdown();
      }
    });

    // Initial fetch
    fetchPendingConfirmations();

    // Periodic refresh
    setInterval(fetchPendingConfirmations, CHECK_INTERVAL);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
