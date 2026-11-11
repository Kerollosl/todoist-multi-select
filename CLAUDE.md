# Todoist Task Toolkit — Chrome Extension

MV3 Chrome extension that copies Todoist's native selected tasks and prepares board groups for ChatGPT Work with GPT-6 Luna at Medium effort.

## Architecture

```
selectors.js    → all Todoist DOM selectors (one SELECTORS object)
content.js      → native selection copy and optional completion
groups.js       → sidebar action, virtualized column scan, missing group creation
background.js   → sorting prompt and tab-bound, single-use handoff
chatgpt-work.js → Work/Luna/Medium/plugin verification, draft insertion, one send
styles.css      → sidebar action, floating copy action, toast and modal
manifest.json   → clipboardWrite/storage/scripting; scripts on Todoist; chatgpt-work.js is registered dynamically only when Groups + Work is on (optional host permission)
popup/options   → toolbar popup, options page (Copy on, Groups + Work off by default)
```

## How It Works

- `content.js` watches native selected rows with a throttled MutationObserver and caches their content before a click can deselect them.
- Copy preserves task links and descriptions and offers an explicit completion choice.
- Group recognition accepts Group 1/2/3 prefixes with optional legacy descriptive suffixes. The Work prompt requires exact Group 1, Group 2, and Group 3 names and removes any legacy suffixes.
- Named sections have an extra sortable wrapper; find insertion controls through `[data-drag-scroll-target]`.
- Work automation verifies Luna, Medium, Work mode, the Todoist mention, and the exact draft immediately before sending. Never retry uncertain mutations or submissions.

## Known Fragility / Planned Upgrade

Selection **detection** uses DOM clicks (unavoidable — Todoist has no selection API). But **mutations** on selected tasks (moving, labeling, completing) should call the Todoist REST API (`https://api.todoist.com/api/v1/tasks/{id}`) instead of further DOM clicks. Any Todoist UI update can silently break DOM-based operations. See PROJECT-MAP.md for details.

## Development

```bash
# Load unpacked in Chrome:
# chrome://extensions/ → Developer mode → Load unpacked → select this folder

# No build step — plain JS/CSS
# When Todoist updates their UI, re-inspect task row selectors in DevTools
```

## Debugging Selector Breakage

When tasks stop being selectable: open DevTools on `app.todoist.com`, inspect a task row, find the new data attribute or class that identifies task items, update `content.js` accordingly.
