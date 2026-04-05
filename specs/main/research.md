# Research: Extract Inline CSS/JS to Static Files

## R-1: Bridge Pattern for Jinja2-Templated JS

**Decision**: Use `<script type="application/json" id="page-config">` pattern to pass Jinja2 data to external JS files.

**Rationale**: This is the standard Flask/Jinja2 approach. It separates data injection (which must be inline) from logic (which can be external). The JSON config is safely escaped via `| tojson` filter. The external JS reads the config with `JSON.parse(document.getElementById('page-config').textContent)`.

**Alternatives considered**:
- `data-*` attributes on DOM elements — works but clutters HTML and doesn't handle complex data (arrays, nested objects)
- Global `window.__CONFIG__` inline script — works but less clean than JSON island; risk of XSS if not properly escaped
- Keep JS inline for Jinja2 pages — defeats the purpose of the extraction

## R-2: Append vs Replace for Existing External Files

**Decision**: Append extracted inline CSS to the bottom of existing external CSS files. For JS, merge into existing external JS files where they exist.

**Rationale**: The existing external files already have page-specific styles/logic. The inline code is additional styling that was never migrated. Appending preserves the existing working styles.

**Alternatives considered**:
- Replace — would break existing styles that are already external
- Create separate files (e.g., `index-inline.css`) — creates confusing dual-file pattern

## R-3: Error Page CSS Deduplication

**Decision**: Merge both 404.html and 500.html inline styles into the single existing `css/pages/error.css`.

**Rationale**: Both error pages have near-identical styling (~35 lines each). The `error.css` file already exists for error page styles.

## R-4: Standalone Template File References

**Decision**: For standalone HTML templates (not extending `base.html`), add `<link>` tags in the `<head>` and `<script>` tags before `</body>`, following the same `url_for('static', ...)` pattern used elsewhere.

**Rationale**: Converting standalone templates to base.html inheritance is out of scope for this task. We only extract inline code.

## R-5: Naming Convention for New Files

**Decision**: Follow existing naming convention — file names match template names exactly:
- `pages/stats.html` → `css/pages/stats.css` + `js/pages/stats.js`
- `components/streaming_banner.html` → `css/components/streaming-banner.css` + `js/components/streaming-banner.js`

**Rationale**: Consistent with the 20+ existing page CSS files and 14+ existing page JS files that follow this pattern.

## Inventory: New Static Files To Create (18 files)

| File | Source Template | Est. Lines |
|------|----------------|------------|
| `css/components/streaming-banner.css` | `streaming_banner.html` | ~160 |
| `css/pages/stats.css` | `stats.html` | ~147 |
| `css/pages/stats_event.css` | `stats_event.html` | ~305 |
| `css/pages/top_8.css` | `top_8.html` | ~133 |
| `css/pages/top_8_event.css` | `top_8_event.html` | ~407 |
| `css/pages/privacy.css` | `privacy.html` | ~57 |
| `css/pages/terms.css` | `terms.html` | ~57 |
| `css/pages/live_popular_cards.css` | `live_popular_cards.html` | ~300 |
| `css/pages/player.css` | `player.html` | ~200+ |
| `js/components/streaming-banner.js` | `streaming_banner.html` | ~120 |
| `js/pages/stats.js` | `stats.html` | ~44 |
| `js/pages/top_8.js` | `top_8.html` | ~44 |
| `js/pages/live_popular_cards.js` | `live_popular_cards.html` | ~575 |
| `js/pages/player.js` | `player.html` | ~2500 |
| `js/pages/avatar.js` | `avatar.html` | ~590 |
| `js/pages/card.js` | `card.html` | ~315 |
| `js/pages/stats_event.js` | `stats_event.html` | ~113 |
| `js/pages/top_8_event.js` | `top_8_event.html` | ~85 |

## Inventory: Existing Files To Append/Merge (13 files)

| File | Source Template | Action |
|------|----------------|--------|
| `css/components/navbar.css` | `navbar.html` | Append ~120 lines |
| `css/pages/index.css` | `index.html` | Append ~40 lines |
| `css/pages/login.css` | `login.html` | Append ~8 lines |
| `css/pages/about.css` | `about.html` | Append ~47 lines |
| `css/pages/elements.css` | `elements.html` | Append ~72 lines |
| `css/pages/life_counter.css` | `life_counter.html` | Append ~127 lines |
| `css/pages/avatar.css` | `avatar.html` | Append ~100 lines |
| `css/pages/avatars.css` | `avatars.html` | Append ~175 lines |
| `css/pages/card.css` | `card.html` | Append ~85 lines |
| `css/pages/error.css` | `404.html` + `500.html` | Append ~35 lines |
| `js/components/navbar.js` | `navbar.html` | Append ~150 lines |
| `js/pages/avatars.js` | `avatars.html` | Merge with existing |
| `js/pages/admin_audit_log.js` | `admin_audit_log.html` | Merge ~420 lines |

## Templates Modified (21 files)

All 21 templates will have their inline `<style>` and/or `<script>` blocks removed and replaced with external file references using `url_for('static', ...)`.
