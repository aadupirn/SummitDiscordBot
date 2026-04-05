# Tasks: Extract Inline CSS/JS to Static Files

**Input**: Design documents from `/specs/main/`
**Prerequisites**: plan.md, research.md, quickstart.md

**Tests**: Not required. Manual visual inspection per quickstart.md verification steps.

**Organization**: Tasks grouped by extraction category. Category A (direct extraction) templates can be done in parallel. Category B (bridge pattern) templates are more complex and grouped separately. Each template extraction is independently verifiable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[CAT-A]**: Category A — Direct extraction (no Jinja2 in JS)
- **[CAT-B]**: Category B — Bridge pattern extraction (Jinja2 variables in JS)
- Include exact file paths in descriptions

---

## Phase 1: Category A — CSS-Only Extractions (Append to Existing Files)

**Purpose**: Extract inline `<style>` blocks from templates that already have corresponding external CSS files. Append the inline CSS to the bottom of the existing external file, then remove the `<style>` block from the template and ensure the template loads the external CSS file.

**Pattern**: For each task: (1) Read the template, copy the `<style>` block content, (2) Append it to the existing CSS file with a comment separator `/* Extracted from <template>.html */`, (3) Remove the `<style>` block from the template, (4) Ensure the template has a `<link>` tag referencing the CSS file via `{{ url_for('static', filename='...') }}?v={{ app_version }}`.

- [X] T001 [P] [CAT-A] Extract inline CSS from `web-app/templates/components/navbar.html` (~120 lines) → append to `web-app/static/css/components/navbar.css`. Remove the `<style>` block from `navbar.html`. The template already loads `navbar.css` via base.html.
- [X] T002 [P] [CAT-A] Extract inline CSS from `web-app/templates/pages/index.html` (~40 lines of ELO source toggle styling) → append to `web-app/static/css/pages/index.css`. Remove the `<style>` block from `index.html`. Ensure the template loads `css/pages/index.css`.
- [X] T003 [P] [CAT-A] Extract inline CSS from `web-app/templates/pages/login.html` (~8 lines of body gradient) → append to `web-app/static/css/pages/login.css`. Remove the `<style>` block from `login.html`. Ensure the template loads `css/pages/login.css`.
- [X] T004 [P] [CAT-A] Extract inline CSS from `web-app/templates/pages/about.html` (~47 lines) → append to `web-app/static/css/pages/about.css`. Remove the `<style>` block from `about.html`. Ensure the template loads `css/pages/about.css`.
- [X] T005 [P] [CAT-A] Extract inline CSS from `web-app/templates/pages/elements.html` (~72 lines of filter/badge styling) → append to `web-app/static/css/pages/elements.css`. Remove the `<style>` block from `elements.html`. Ensure the template loads `css/pages/elements.css`.
- [X] T006 [P] [CAT-A] Extract inline CSS from `web-app/templates/pages/life_counter.html` (~127 lines of header/button/status styles) → append to `web-app/static/css/pages/life_counter.css`. Remove the `<style>` block from `life_counter.html`. Ensure the template loads `css/pages/life_counter.css`.
- [X] T007 [P] [CAT-A] Extract inline CSS from `web-app/templates/errors/404.html` (~35 lines of error container styling) → append to `web-app/static/css/pages/error.css`. Remove the `<style>` block from `404.html`. Ensure the template loads `css/pages/error.css`.
- [X] T008 [P] [CAT-A] Extract inline CSS from `web-app/templates/errors/500.html` (~35 lines, near-identical to 404) → deduplicate with 404 styles already appended in T007. Only add styles that differ (if any) to `web-app/static/css/pages/error.css`. Remove the `<style>` block from `500.html`. Ensure the template loads `css/pages/error.css`.

**Checkpoint**: 8 templates have `<style>` blocks removed. Existing CSS files have the extracted styles appended. All pages render identically.

---

## Phase 2: Category A — CSS-Only Extractions (New Files)

**Purpose**: Extract inline `<style>` blocks from templates that do NOT have existing external CSS files. Create new CSS files.

**Pattern**: (1) Read the template, copy the `<style>` block content, (2) Create a new CSS file at the correct path, (3) Remove the `<style>` block from the template, (4) Add a `<link>` tag referencing the new CSS file via `{{ url_for('static', filename='...') }}?v={{ app_version }}`.

- [X] T009 [P] [CAT-A] Create `web-app/static/css/pages/privacy.css` with inline CSS extracted from `web-app/templates/pages/privacy.html` (~57 lines of content layout/typography). Remove the `<style>` block from `privacy.html`. Add `<link>` tag in `<head>`.
- [X] T010 [P] [CAT-A] Create `web-app/static/css/pages/terms.css` with inline CSS extracted from `web-app/templates/pages/terms.html` (~57 lines, similar to privacy.html). Remove the `<style>` block from `terms.html`. Add `<link>` tag in `<head>`.

**Checkpoint**: 2 new CSS files created. Templates load them correctly. Pages render identically.

---

## Phase 3: Category A — CSS + JS Extractions (New Files, No Jinja2)

**Purpose**: Extract both inline `<style>` and `<script>` blocks from templates where the JavaScript contains NO Jinja2 template variables. Create new CSS and JS files.

**Pattern**: (1) Copy `<style>` content → new CSS file, (2) Copy `<script>` content → new JS file, (3) Remove both blocks from template, (4) Add `<link>` for CSS and `<script src>` for JS with `{{ url_for('static', ...) }}?v={{ app_version }}`.

- [X] T011 [P] [CAT-A] Extract CSS and JS from `web-app/templates/components/streaming_banner.html`:
  - Create `web-app/static/css/components/streaming-banner.css` (~160 lines of banner/streamer card/animation styles)
  - Create `web-app/static/js/components/streaming-banner.js` (~120 lines of streamer fetching/banner management IIFE)
  - Remove both inline blocks from `streaming_banner.html`
  - Add `<link>` and `<script src>` references in the template
- [X] T012 [P] [CAT-A] Extract CSS and JS from `web-app/templates/pages/stats.html`:
  - Create `web-app/static/css/pages/stats.css` (~147 lines of event container/grid/filter styles)
  - Create `web-app/static/js/pages/stats.js` (~44 lines of filterEvents function and event listeners)
  - Remove both inline blocks from `stats.html`
  - Add `<link>` and `<script src>` references
- [X] T013 [P] [CAT-A] Extract CSS and JS from `web-app/templates/pages/top_8.html`:
  - Create `web-app/static/css/pages/top_8.css` (~133 lines of event cards/filter styles)
  - Create `web-app/static/js/pages/top_8.js` (~44 lines of filterEvents function and event listeners)
  - Remove both inline blocks from `top_8.html`
  - Add `<link>` and `<script src>` references
- [X] T014 [P] [CAT-A] Extract CSS and JS from `web-app/templates/pages/live_popular_cards.html`:
  - Create `web-app/static/css/pages/live_popular_cards.css` (~300 lines of table/badge/bar/filter styles)
  - Create `web-app/static/js/pages/live_popular_cards.js` (~575 lines of ELO toggle, sorting, filtering, rendering)
  - Remove both inline blocks from `live_popular_cards.html`
  - Add `<link>` and `<script src>` references

**Checkpoint**: 4 templates fully extracted. 8 new static files created (4 CSS + 4 JS). All pages render and function identically.

---

## Phase 4: Category A — JS-Only Extractions (Append/Merge)

**Purpose**: Extract inline `<script>` blocks from templates that either have an existing external JS file (merge) or need their JS appended to a shared file.

- [X] T015 [P] [CAT-A] Extract inline JS from `web-app/templates/components/navbar.html` (2 IIFE blocks: streaming indicator ~115 lines + notification system ~35 lines) → append to `web-app/static/js/components/navbar.js`. Remove the inline `<script>` blocks from `navbar.html`. The template already loads `navbar.js` via base.html.
- [X] T016 [P] [CAT-A] Extract inline JS from `web-app/templates/pages/admin_audit_log.html` (~420 lines of Chart.js dashboard code) → merge into `web-app/static/js/pages/admin_audit_log.js` (file exists — check if it already has content, append if so or replace if empty/placeholder). Remove the inline `<script>` block from `admin_audit_log.html`. Ensure the template loads `js/pages/admin_audit_log.js`.

**Checkpoint**: 2 templates have inline `<script>` blocks removed. JS is in external files. Navbar streaming indicator and admin dashboard charts work correctly.

---

## Phase 5: Category B — Bridge Pattern: Simple Single-Variable Templates

**Purpose**: Extract inline CSS and JS from templates where the JS uses a single Jinja2 variable. Use the JSON config bridge pattern (see research.md R-1).

**Bridge Pattern**:
In template — replace the `<script>` block with:
```html
<script id="page-config" type="application/json">
  { "varName": {{ jinja_var | tojson }} }
</script>
<script src="{{ url_for('static', filename='js/pages/<page>.js') }}?v={{ app_version }}" defer></script>
```
In external JS — read config at top:
```javascript
const config = JSON.parse(document.getElementById('page-config').textContent);
```

- [X] T017 [P] [CAT-B] Extract CSS and JS from `web-app/templates/pages/card.html`:
  - Append inline CSS (~85 lines) to `web-app/static/css/pages/card.css`
  - Create `web-app/static/js/pages/card.js` with the inline JS (~315 lines). At the top, read `config.cardName` from `#page-config`. Replace the Jinja2 `{{ card_name }}` reference with `config.cardName`.
  - In `card.html`: remove `<style>` block, replace `<script>` block with bridge JSON config `{ "cardName": {{ card_name | tojson }} }` + external `<script src>` tag.
  - Ensure `card.html` loads `css/pages/card.css`.
- [X] T018 [P] [CAT-B] Extract CSS and JS from `web-app/templates/pages/avatar.html`:
  - Append inline CSS (~100 lines) to `web-app/static/css/pages/avatar.css`
  - Create `web-app/static/js/pages/avatar.js` with the inline JS (~590 lines). At the top, read `config.avatarName` from `#page-config`. Replace the Jinja2 `{{ avatar_name }}` reference with `config.avatarName`.
  - In `avatar.html`: remove `<style>` block, replace `<script>` block with bridge JSON config `{ "avatarName": {{ avatar_name | tojson }} }` + external `<script src>` tag.
  - Ensure `avatar.html` loads `css/pages/avatar.css`.

**Checkpoint**: `card.html` and `avatar.html` have no inline CSS/JS (except the small JSON config block). Pages load data correctly from the bridge config.

---

## Phase 6: Category B — Bridge Pattern: Conditional/Multi-Variable Templates

**Purpose**: Extract inline CSS and JS from templates where the JS uses Jinja2 conditionals (`{% if %}`) or `| tojson` data injection. These need the bridge pattern plus careful handling of conditional script rendering.

**Conditional Bridge Pattern**: For templates with `{% if data %}...{% endif %}` wrapping script blocks, the JSON config includes a flag and the data:
```html
{% if element_stats %}
<script id="page-config" type="application/json">
  { "hasElementStats": true, "elementStats": {{ element_stats | tojson }}, "hasCardData": {{ 'true' if card_data else 'false' }} }
</script>
{% endif %}
```
The external JS checks `config.hasElementStats` before running chart logic.

- [X] T019 [P] [CAT-B] Extract CSS and JS from `web-app/templates/pages/avatars.html`:
  - Append inline CSS (~175 lines) to `web-app/static/css/pages/avatars.css`
  - Merge inline JS (~700 lines) into `web-app/static/js/pages/avatars.js` (file exists — read it first, then integrate the inline JS). The inline JS is wrapped in `{% if all_popularity %}...{% endif %}`. Use bridge: `{ "hasPopularity": true }` inside the conditional. In the external JS, check `config.hasPopularity` before running the popularity chart initialization.
  - In `avatars.html`: remove `<style>` block, replace `<script>` block with conditional bridge config + external `<script src>` tag.
  - Ensure `avatars.html` loads `css/pages/avatars.css`.
- [X] T020 [P] [CAT-B] Extract CSS and JS from `web-app/templates/pages/stats_event.html`:
  - Create `web-app/static/css/pages/stats_event.css` with inline CSS (~305 lines)
  - Create `web-app/static/js/pages/stats_event.js` with inline JS (~113 lines). Handle two conditional blocks: `{% if element_stats %}` injects `{{ element_stats | tojson }}`, and `{% if card_data %}` wraps sorting logic. Use bridge config: `{ "elementStats": {{ element_stats | tojson }}, "hasCardData": {{ 'true' if card_data else 'false' }} }`.
  - In `stats_event.html`: remove `<style>` blocks, replace `<script>` blocks with bridge config + external `<script src>` tag.
  - Add `<link>` for `css/pages/stats_event.css`.
- [X] T021 [P] [CAT-B] Extract CSS and JS from `web-app/templates/pages/top_8_event.html`:
  - Create `web-app/static/css/pages/top_8_event.css` with inline CSS (~407 lines)
  - Create `web-app/static/js/pages/top_8_event.js` with inline JS (~85 lines). Same conditional pattern as `stats_event.html`: `element_stats | tojson` and `card_data` conditional. Use identical bridge config pattern.
  - In `top_8_event.html`: remove `<style>` blocks, replace `<script>` blocks with bridge config + external `<script src>` tag.
  - Add `<link>` for `css/pages/top_8_event.css`.

**Checkpoint**: 3 templates extracted with conditional bridge pattern. Charts and sorting still work when data is present, and pages degrade gracefully when data is absent.

---

## Phase 7: Category B — Bridge Pattern: player.html (Largest Template)

**Purpose**: Extract inline CSS and JS from `player.html`, the most complex template with ~2500 lines of inline JS and 5 Jinja2 variables.

- [X] T022 [CAT-B] Extract inline CSS from `web-app/templates/pages/player.html` (~200+ lines of spinner, table, pagination, ELO toggle styles) → create `web-app/static/css/pages/player.css`. Remove the `<style>` block from `player.html`. Add `<link>` tag loading `css/pages/player.css`.
- [X] T023 [CAT-B] Extract inline JS from `web-app/templates/pages/player.html` (~2500+ lines) → create `web-app/static/js/pages/player.js`. Bridge config variables: `player_id`, `needs_display_name`, `default_display_name`, `logged_in`, `current_user_id`. In `player.html`, replace the `<script>` block with:
  ```html
  <script id="page-config" type="application/json">
    {
      "playerId": {{ player_id | tojson }},
      "needsDisplayName": {{ needs_display_name | tojson }},
      "defaultDisplayName": {{ default_display_name | tojson }},
      "loggedIn": {{ logged_in | tojson }},
      "currentUserId": {{ current_user_id | tojson }}
    }
  </script>
  ```
  In the external JS, read all 5 values from `config` object at the top. Replace all Jinja2 variable references throughout the ~2500 lines with the corresponding `config.*` values. Ensure the template loads `js/pages/player.js`.

**Checkpoint**: `player.html` has no inline CSS/JS except the ~8-line JSON config block. Player profile page renders correctly with all interactive features working (display name editing, match history, ELO display, etc.).

---

## Phase 8: Verification & Cleanup

**Purpose**: Verify all inline CSS/JS has been extracted and all pages still work.

- [X] T024 Run grep across all templates for remaining `<style>` tags — execute `grep -r "<style" web-app/templates/` and verify zero results. If any `<style>` blocks remain, extract them following the same pattern.
- [X] T025 Run grep across all templates for remaining inline `<script>` tags — execute `grep -r "<script>" web-app/templates/` and verify results only show: (a) `<script src=...>` external references, (b) `<script type="application/json" id="page-config">` bridge configs, and (c) CDN `<script>` tags (Chart.js, etc.). Flag any inline logic scripts that were missed.
- [X] T026 Verify all new/modified CSS files are properly referenced — for each template modified in Phases 1-7, confirm the template has a `<link>` tag loading the correct CSS file with `?v={{ app_version }}` cache busting.
- [X] T027 Verify all new/modified JS files are properly referenced — for each template modified in Phases 1-7, confirm the template has a `<script src>` tag loading the correct JS file with `?v={{ app_version }}` cache busting and `defer` attribute.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phases 1-4 (Category A)**: No dependencies between them — all can start immediately and run in parallel
- **Phases 5-7 (Category B)**: No dependencies between them — all can start immediately and run in parallel
- **Phase 8 (Verification)**: Depends on ALL previous phases being complete
- Within each phase, all tasks marked `[P]` can run in parallel

### Dependency Graph

```
┌───────────────────────────────────────────��─────────────┐
│  All Category A tasks (Phases 1-4)                       │
│  T001-T016 — all [P], no inter-dependencies              │
│                                                          │
│  All Category B tasks (Phases 5-7)                       │
│  T017-T023 — all [P] except T022→T023 (same file)       │
└────────────────────────┬──────────────────────────────���─┘
                         │
                         ▼
              Phase 8: Verification
              T024-T027 (sequential)
```

### Parallel Opportunities

**Maximum parallelism**: Tasks T001-T021 can ALL run in parallel (each touches different template + different CSS/JS files). T022 and T023 are sequential (same template). That's up to 21 tasks running simultaneously.

**Recommended batching** (if working sequentially):
1. Phase 1 (T001-T008): Quick wins, 8 simple CSS appends
2. Phase 2 (T009-T010): 2 new CSS files
3. Phase 3 (T011-T014): 4 full CSS+JS extractions
4. Phase 4 (T015-T016): 2 JS appends
5. Phase 5 (T017-T018): 2 simple bridge templates
6. Phase 6 (T019-T021): 3 conditional bridge templates
7. Phase 7 (T022-T023): Largest single template
8. Phase 8 (T024-T027): Final verification sweep

---

## Implementation Strategy

### MVP First (Phase 1 Only)

1. Complete Phase 1: 8 CSS-only appends (quickest wins, lowest risk)
2. **STOP and VALIDATE**: Verify 8 pages render correctly
3. Proves the extraction pattern works before tackling JS

### Incremental Delivery

1. **Phases 1-2**: All CSS-only extractions (10 templates) → Zero-risk, CSS is straightforward
2. **Phases 3-4**: Category A JS extractions (6 templates) → Medium risk, but no Jinja2 complications
3. **Phases 5-6**: Simple + conditional bridge patterns (5 templates) → Higher risk, needs careful testing
4. **Phase 7**: player.html (~2500 lines JS) → Highest risk, most complex single extraction
5. **Phase 8**: Verification sweep → Confirms 100% extraction

### Total Task Count

- **Phase 1 (CSS append)**: 8 tasks
- **Phase 2 (CSS new)**: 2 tasks
- **Phase 3 (CSS+JS new)**: 4 tasks
- **Phase 4 (JS append)**: 2 tasks
- **Phase 5 (Bridge simple)**: 2 tasks
- **Phase 6 (Bridge conditional)**: 3 tasks
- **Phase 7 (Bridge player.html)**: 2 tasks
- **Phase 8 (Verification)**: 4 tasks
- **Total**: 27 tasks across 21 templates

### Task Count by Category

| Category | Templates | Tasks | Risk |
|----------|-----------|-------|------|
| CAT-A: CSS-only append | 8 | 8 | Low |
| CAT-A: CSS-only new | 2 | 2 | Low |
| CAT-A: CSS+JS new | 4 | 4 | Low |
| CAT-A: JS append/merge | 2 | 2 | Medium |
| CAT-B: Simple bridge | 2 | 2 | Medium |
| CAT-B: Conditional bridge | 3 | 3 | Medium-High |
| CAT-B: Complex bridge (player) | 1 | 2 | High |
| Verification | — | 4 | — |

---

## Notes

- [P] tasks = different files, no dependencies
- [CAT-A] = direct extraction, no Jinja2 in JS
- [CAT-B] = bridge pattern needed, Jinja2 variables in JS
- Bridge config blocks (`<script type="application/json">`) are the ONLY acceptable remaining inline scripts
- Always preserve `?v={{ app_version }}` cache busting on new static file references
- When appending to existing CSS files, add a comment separator: `/* Extracted from <template>.html */`
- Commit after each phase for safe rollback
