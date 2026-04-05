# Implementation Plan: Extract Inline CSS/JS to Static Files

**Branch**: `main` | **Date**: 2026-04-05 | **Spec**: Web app template cleanup
**Input**: User request to extract inline CSS and JavaScript from all web app pages into proper static folder files.

## Summary

Extract all inline `<style>` and `<script>` blocks from 21+ web app Jinja2 templates into external CSS/JS files in the existing `web-app/static/` folder structure. Templates with Jinja2 template variables in their inline JS require a bridging pattern (small inline data script + external logic).

## Technical Context

**Language/Version**: Python 3.x / Flask / Jinja2 (templates), CSS3, JavaScript ES6+
**Primary Dependencies**: Flask, Jinja2, Chart.js (used in several pages)
**Storage**: N/A (static assets only)
**Testing**: Manual visual inspection, browser dev tools
**Target Platform**: Web browsers (production behind Nginx + Cloudflare)
**Project Type**: Web application (Flask)
**Constraints**: Must not break any existing page rendering or functionality
**Scale/Scope**: ~21 templates with inline CSS/JS, ~37 templates total

## Constitution Check

*No project constitution defined. Proceeding with standard best practices.*

- Follow existing naming conventions: `css/pages/<page>.css`, `js/pages/<page>.js`, `css/components/<component>.css`, `js/components/<component>.js`
- Use existing `url_for('static', ...)` pattern with `?v={{ app_version }}` cache busting
- Maintain the existing CSS layer architecture: vendor → base → utilities → components → pages

## Research Findings

### Existing Static Architecture (Already Well-Organized)

```
web-app/static/
├── css/
│   ├── base/        (variables, reset, typography, layout)
│   ├── components/  (navbar, footer, buttons, forms, modals, etc.)
│   ├── pages/       (one CSS per page - 20 files exist)
│   ├── utilities/   (spacing, colors, flexbox, visibility)
│   └── vendor/      (tailwind)
├── js/
│   ├── core/        (main.js - global init)
│   ├── components/  (navbar, chat, deck-viewer, leaderboard, event-card)
│   ├── pages/       (one JS per page - 14 files exist)
│   └── utils/       (empty)
└── images/
```

### Templates With Inline CSS/JS (Extraction Targets)

#### Category A: Pure CSS/JS (No Jinja2 in scripts — direct extraction)

| Template | Inline CSS | Inline JS | Existing External CSS | Existing External JS |
|----------|-----------|----------|----------------------|---------------------|
| `components/navbar.html` | ~120 lines | ~150 lines (2 IIFEs) | `css/components/navbar.css` ✅ | `js/components/navbar.js` ✅ |
| `components/streaming_banner.html` | ~160 lines | ~120 lines | ❌ Need new | ❌ Need new |
| `pages/index.html` | ~40 lines | None | `css/pages/index.css` ✅ | N/A |
| `pages/login.html` | ~8 lines | None | `css/pages/login.css` ✅ | N/A |
| `pages/about.html` | ~47 lines | None | `css/pages/about.css` ✅ | N/A |
| `pages/elements.html` | ~72 lines | None | `css/pages/elements.css` ✅ | N/A |
| `pages/stats.html` | ~147 lines | ~44 lines | ❌ Need new | ❌ Need new |
| `pages/top_8.html` | ~133 lines | ~44 lines | ❌ Need new | ❌ Need new |
| `pages/life_counter.html` | ~127 lines | ~6 lines (minimal) | `css/pages/life_counter.css` ✅ | N/A |
| `pages/privacy.html` | ~57 lines | None | ❌ Need new | N/A |
| `pages/terms.html` | ~57 lines | None | ❌ Need new | N/A |
| `pages/admin_audit_log.html` | None | ~420 lines | `css/pages/admin_audit_log.css` ✅ | ❌ Need new |
| `pages/live_popular_cards.html` | ~300 lines | ~575 lines | ❌ Need new | ❌ Need new |
| `errors/404.html` | ~35 lines | None | `css/pages/error.css` ✅ | N/A |
| `errors/500.html` | ~35 lines | None | `css/pages/error.css` ✅ | N/A |

#### Category B: Jinja2 Variables in JS (Needs bridge pattern)

| Template | Inline CSS | Inline JS | Jinja2 Vars in JS |
|----------|-----------|----------|--------------------|
| `pages/player.html` | ~200+ lines | ~2500+ lines | `player_id`, `needs_display_name`, `default_display_name`, `logged_in`, `current_user_id` |
| `pages/avatar.html` | ~100 lines | ~590 lines | `avatar_name` |
| `pages/avatars.html` | ~175 lines | ~700 lines | `{% if all_popularity %}` conditional block |
| `pages/card.html` | ~85 lines | ~315 lines | `card_name` |
| `pages/stats_event.html` | ~305 lines | ~113 lines | `element_stats \| tojson`, `card_data` conditional |
| `pages/top_8_event.html` | ~407 lines | ~85 lines | `element_stats \| tojson`, `card_data` conditional |

### Bridge Pattern for Jinja2 Variables

For templates where inline JS uses Jinja2 template variables, we'll use the **data attribute + JSON config** pattern:

**Before** (inline JS with Jinja2):
```html
<script>
  const cardName = "{{ card_name }}";
  // ... 300 lines of logic ...
</script>
```

**After** (minimal inline config + external JS):
```html
<script id="page-config" type="application/json">
  { "cardName": {{ card_name | tojson }} }
</script>
<script src="{{ url_for('static', filename='js/pages/card.js') }}?v={{ app_version }}" defer></script>
```

Then in the external JS:
```javascript
const config = JSON.parse(document.getElementById('page-config').textContent);
const cardName = config.cardName;
// ... rest of logic ...
```

## Project Structure

### Documentation
```text
specs/main/
├── plan.md              # This file
├── research.md          # Phase 0 research (inline below)
└── tasks.md             # Phase 2 output (generated by /speckit.tasks)
```

### Source Code (files to create/modify)

```text
web-app/
├── static/
│   ├── css/
│   │   ├── components/
│   │   │   └── streaming-banner.css    # NEW - extracted from streaming_banner.html
│   │   └── pages/
│   │       ├── stats.css               # NEW - extracted from stats.html
│   │       ├── stats_event.css         # NEW - extracted from stats_event.html
│   │       ├── top_8.css               # NEW - extracted from top_8.html
│   │       ├── top_8_event.css         # NEW - extracted from top_8_event.html
│   │       ├── privacy.css             # NEW - extracted from privacy.html
│   │       ├── terms.css               # NEW - extracted from terms.html
│   │       ├── live_popular_cards.css   # NEW - extracted from live_popular_cards.html
│   │       ├── player.css              # NEW - extracted from player.html
│   │       ├── navbar.css              # APPEND - merge inline styles
│   │       ├── index.css               # APPEND - merge inline styles
│   │       ├── login.css               # APPEND - merge inline styles
│   │       ├── about.css               # APPEND - merge inline styles
│   │       ├── elements.css            # APPEND - merge inline styles
│   │       ├── life_counter.css        # APPEND - merge inline styles
│   │       ├── avatar.css              # APPEND - merge inline styles
│   │       ├── avatars.css             # APPEND - merge inline styles
│   │       ├── card.css                # APPEND - merge inline styles
│   │       └── error.css               # APPEND - merge inline styles (404/500)
│   └── js/
│       ├── components/
│       │   ├── navbar.js               # APPEND - merge inline JS IIFEs
│       │   └── streaming-banner.js     # NEW - extracted from streaming_banner.html
│       └── pages/
│           ├── stats.js                # NEW - extracted from stats.html
│           ├── top_8.js                # NEW - extracted from top_8.html
│           ├── admin_audit_log.js      # REPLACE content - currently exists but inline JS also present
│           ├── live_popular_cards.js    # NEW - extracted from live_popular_cards.html
│           ├── player.js               # NEW - extracted (bridge pattern)
│           ├── avatar.js               # NEW - extracted (bridge pattern)
│           ├── avatars.js              # REPLACE content - merge inline + external
│           ├── card.js                 # NEW - extracted (bridge pattern)
│           ├── stats_event.js          # NEW - extracted (bridge pattern)
│           └── top_8_event.js          # NEW - extracted (bridge pattern)
│
├── templates/
│   ├── components/
│   │   ├── navbar.html                 # MODIFY - remove inline <style> and <script>
│   │   └── streaming_banner.html       # MODIFY - remove inline <style> and <script>
│   ├── pages/
│   │   ├── index.html                  # MODIFY - remove inline <style>
│   │   ├── login.html                  # MODIFY - remove inline <style>
│   │   ├── about.html                  # MODIFY - remove inline <style>
│   │   ├── elements.html               # MODIFY - remove inline <style>
│   │   ├── stats.html                  # MODIFY - remove inline <style> and <script>
│   │   ├── stats_event.html            # MODIFY - remove inline <style> and <script>, add bridge
│   │   ├── top_8.html                  # MODIFY - remove inline <style> and <script>
│   │   ├── top_8_event.html            # MODIFY - remove inline <style> and <script>, add bridge
│   │   ├── life_counter.html           # MODIFY - remove inline <style>
│   │   ├── privacy.html                # MODIFY - remove inline <style>
│   │   ├── terms.html                  # MODIFY - remove inline <style>
│   │   ├── admin_audit_log.html        # MODIFY - remove inline <script>
│   │   ├── live_popular_cards.html     # MODIFY - remove inline <style> and <script>
│   │   ├── player.html                 # MODIFY - remove inline <style> and <script>, add bridge
│   │   ├── avatar.html                 # MODIFY - remove inline <style> and <script>, add bridge
│   │   ├── avatars.html                # MODIFY - remove inline <style> and <script>, add bridge
│   │   └── card.html                   # MODIFY - remove inline <style> and <script>, add bridge
│   └── errors/
│       ├── 404.html                    # MODIFY - remove inline <style>
│       └── 500.html                    # MODIFY - remove inline <style>
```

## Implementation Phases

### Phase 1: Category A — Pure Extractions (No Jinja2 in JS)

These are straightforward: copy inline CSS/JS to external files, replace with `<link>`/`<script>` tags.

**Group 1a: CSS-only extractions (append to existing files)**
1. `navbar.html` → append to `css/components/navbar.css`
2. `index.html` → append to `css/pages/index.css`
3. `login.html` → append to `css/pages/login.css`
4. `about.html` → append to `css/pages/about.css`
5. `elements.html` → append to `css/pages/elements.css`
6. `life_counter.html` → append to `css/pages/life_counter.css`
7. `errors/404.html` → append to `css/pages/error.css`
8. `errors/500.html` → merge with 404 styles in `css/pages/error.css`

**Group 1b: CSS-only extractions (new files)**
9. `privacy.html` → create `css/pages/privacy.css`
10. `terms.html` → create `css/pages/terms.css`

**Group 1c: CSS + JS extractions (new files)**
11. `streaming_banner.html` → create `css/components/streaming-banner.css` + `js/components/streaming-banner.js`
12. `stats.html` → create `css/pages/stats.css` + `js/pages/stats.js`
13. `top_8.html` → create `css/pages/top_8.css` + `js/pages/top_8.js`
14. `live_popular_cards.html` → create `css/pages/live_popular_cards.css` + `js/pages/live_popular_cards.js`

**Group 1d: JS-only extractions**
15. `navbar.html` → append streaming/notification IIFEs to `js/components/navbar.js`
16. `admin_audit_log.html` → move inline JS to `js/pages/admin_audit_log.js` (file exists but may need merging)

### Phase 2: Category B — Bridge Pattern Extractions (Jinja2 in JS)

For each, extract CSS to external file, then apply the bridge pattern for JS.

1. `card.html` — Bridge var: `card_name`
2. `avatar.html` — Bridge var: `avatar_name`
3. `avatars.html` — Bridge vars: `all_popularity` (conditional)
4. `stats_event.html` — Bridge vars: `element_stats`, `card_data` (conditional blocks)
5. `top_8_event.html` — Bridge vars: `element_stats`, `card_data` (conditional blocks)
6. `player.html` — Bridge vars: `player_id`, `needs_display_name`, `default_display_name`, `logged_in`, `current_user_id`

### Phase 3: Template Cleanup & Verification

1. Update all modified templates to load their new external CSS/JS files
2. For standalone HTML templates (not using `{% extends "base.html" %}`), add `<link>` and `<script>` tags
3. For base.html-extending templates, use `{% block styles %}` and `{% block scripts %}`
4. Verify no `<style>` or inline `<script>` blocks remain (except bridge config scripts)
5. Run a grep across all templates for remaining `<style>` tags to confirm complete extraction

## Complexity Tracking

| Item | Notes |
|------|-------|
| Bridge pattern (6 templates) | More complex than direct extraction; requires careful variable mapping |
| Existing external files overlap | Some pages already have external CSS/JS that needs merging, not overwriting |
| Standalone vs base.html templates | ~25 templates are full HTML documents, not using base.html inheritance |
| 404/500 error pages | Share similar styles — deduplicate into single `error.css` |
| `player.html` | Largest inline JS (~2500 lines) with 5 Jinja2 variables — most complex bridge |
