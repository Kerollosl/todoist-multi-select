# Todoist Task Toolkit

Chrome extension for copying selected Todoist tasks and organizing board sections through ChatGPT Work. No build step or API key is required.

## Install or update

Load this folder as an unpacked extension in `chrome://extensions`. After updating, click **Reload** on **Todoist Task Toolkit**, then refresh your Todoist tabs. Version 1.2.0 replaces **Todoist Multi-Select & Copy** and its Muse integration. The sidebar action tooltip shows the script version.

## Groups + Work

In an Inbox or project **board view**, click **Groups + Work** in the sidebar below the main navigation links. Open the sidebar if it is collapsed.

The extension creates missing **Group 1**, **Group 2**, and **Group 3** sections, verifies them, and opens a fresh `https://chatgpt.com/` tab. It then:

1. Activates **Work** mode.
2. Selects and verifies **GPT-6 Luna** with **Medium** reasoning effort.
3. Adds the connected **Todoist: To Do List & Calendar** plugin as a real mention.
4. Inserts the sorting prompt with the current Todoist project link.
5. Verifies the draft and settings immediately before clicking **Send** once.

You must be signed in to ChatGPT with Work, GPT-6 Luna, and the Todoist plugin available. Picker selections can become remembered defaults. If a control is unavailable or changes, automatic submission stops with an explanation and a **Copy sorting prompt** button. Existing drafts are preserved. Review the conversation before retrying any uncertain submission.

The prompt asks Work to move active No Section tasks into the three existing groups, choose useful groupings, manually order each group from quickest/easiest to hardest while respecting prerequisites, and keep the section names exactly **Group 1**, **Group 2**, and **Group 3**. Existing descriptive suffixes are removed by Work; no descriptive names or suffixes are added. Other sections and projects are outside the sorting scope. Work is asked to preserve task details and dates, verify the final moves and order, report blockers, and suggest the first three tasks to tackle. The exact prompt is in `buildPrompt()` in `background.js`.

Existing groups and tasks are reused. Missing groups are inserted after the preceding group; Group 1 goes after No Section. Existing sections are not reordered. Duplicate group prefixes stop the action for review. Virtualized board columns are scanned before creation and each creation is verified. If creation times out, inspect Todoist before retrying.

Handoffs are single use, tied to the newly opened tab, expire after ten minutes, and are kept only in Chrome session storage. The extension passes the prompt and project link without reading task contents or credentials for the handoff. The selected Todoist plugin reads and updates tasks when Work runs. No scripts are injected into Muse.

## Copy selected tasks

Select Todoist tasks, then use the floating **Copy** button or **Cmd/Ctrl + Shift + C**. The button sits above the native selection toolbar, including in narrow windows. Copying offers the existing choice to keep the tasks or mark them complete.

The selection toolbar replaces **Labels** with **Priority**, which opens Todoist's native bulk priority picker. Other actions remain in **More actions**.
