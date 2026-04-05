# Quickstart: Extract Inline CSS/JS to Static Files

## What This Task Does

Extracts all inline `<style>` and `<script>` blocks from 21 web app Jinja2 templates into proper external files in the existing `web-app/static/` folder structure. This improves maintainability, enables browser caching, and follows the project's established static asset architecture.

## Key Concepts

### Two Categories of Extraction

**Category A — Direct extraction (15 templates):**
Inline CSS/JS contains no Jinja2 template variables. Copy the code to an external file, replace with a `<link>` or `<script src>` tag.

**Category B — Bridge pattern extraction (6 templates):**
Inline JS contains Jinja2 template variables (e.g., `{{ player_id }}`). Use a small inline JSON config block for data, move all logic to external JS.

### Bridge Pattern

```html
<!-- Minimal inline: only passes server data -->
<script id="page-config" type="application/json">
  { "cardName": {{ card_name | tojson }} }
</script>
<!-- All logic in external file -->
<script src="{{ url_for('static', filename='js/pages/card.js') }}?v={{ app_version }}" defer></script>
```

```javascript
// In external JS file:
const config = JSON.parse(document.getElementById('page-config').textContent);
const cardName = config.cardName;
// ... rest of logic
```

## File Layout

### New CSS Files (9 files)
```
web-app/static/css/
├── components/
│   └── streaming-banner.css   # From streaming_banner.html
└── pages/
    ├── stats.css              # From stats.html
    ├── stats_event.css        # From stats_event.html
    ├── top_8.css              # From top_8.html
    ├── top_8_event.css        # From top_8_event.html
    ├── privacy.css            # From privacy.html
    ├── terms.css              # From terms.html
    ├── live_popular_cards.css  # From live_popular_cards.html
    └── player.css             # From player.html
```

### New JS Files (10 files)
```
web-app/static/js/
├── components/
│   └── streaming-banner.js    # From streaming_banner.html
└── pages/
    ├── stats.js               # From stats.html (Category A)
    ├── top_8.js               # From top_8.html (Category A)
    ├── live_popular_cards.js   # From live_popular_cards.html (Category A)
    ├── player.js              # From player.html (Category B - bridge)
    ├── avatar.js              # From avatar.html (Category B - bridge)
    ├── card.js                # From card.html (Category B - bridge)
    ├── stats_event.js         # From stats_event.html (Category B - bridge)
    └── top_8_event.js         # From top_8_event.html (Category B - bridge)
```

### Existing Files Modified (13 files — append extracted CSS/JS)
- `css/components/navbar.css`, `css/pages/index.css`, `css/pages/login.css`, `css/pages/about.css`
- `css/pages/elements.css`, `css/pages/life_counter.css`, `css/pages/avatar.css`, `css/pages/avatars.css`
- `css/pages/card.css`, `css/pages/error.css`
- `js/components/navbar.js`, `js/pages/avatars.js`, `js/pages/admin_audit_log.js`

### Templates Modified (21 files)
All have inline `<style>` and/or `<script>` blocks removed and replaced with external `<link>`/`<script src>` references.

## How to Verify

1. **No remaining inline styles**: `grep -r "<style>" web-app/templates/` should return zero results (except possibly `{% block styles %}` block definitions in base.html)
2. **No remaining inline scripts with logic**: `grep -r "<script>" web-app/templates/` should only show `<script src=...>` external references and `<script type="application/json">` config blocks
3. **Visual check**: Load each page in browser and verify styling/functionality is identical to before
4. **Browser cache**: Static files should be cacheable (verify `?v=` cache-busting query params are present)

## Naming Conventions

- CSS: `css/pages/<template_name>.css` or `css/components/<component_name>.css`
- JS: `js/pages/<template_name>.js` or `js/components/<component_name>.js`
- Reference pattern: `{{ url_for('static', filename='css/pages/stats.css') }}?v={{ app_version }}`
