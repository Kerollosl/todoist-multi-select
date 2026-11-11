"use strict";
function buildPrompt(projectUrl) {
  return `Use [$todoist--to-do-list---calendar](app://asdk_app_6943b73823548191a9f9216c6790c453) to organize my Todoist tasks so I can quickly and efficiently get them done. Apply the changes in Todoist.

Todoist project: ${projectUrl}

1. Read this project's current sections and all active tasks, including descriptions, subtasks, priorities, due dates, deadlines, and dependencies when available.
2. Move each task currently in No Section into one of the existing Group 1, Group 2, or Group 3 sections. Keep the section names exactly Group 1, Group 2, and Group 3. Choose practical groupings based on the tasks, such as quick wins, errands/communication, or focused work. Keep related tasks together and consider urgency and dependencies. Reuse these three sections; do not create more.
3. Within each group, manually order all its tasks from easiest and quickest to complete at the top to hardest or most time-consuming at the bottom. Use the actual task content to estimate effort, with required prerequisites before dependent tasks. Flag urgent deadlines in your summary so quick wins do not hide time-sensitive work.
4. Keep the section names exactly Group 1, Group 2, and Group 3. If any of these existing groups has a descriptive suffix, rename it to its exact numbered name. Do not add descriptive names or suffixes.
5. Preserve task IDs, titles, descriptions, subtasks, links, labels, priorities, dates, deadlines, reminders, and recurrence. Do not complete or delete tasks, change other projects or sections, or carry out the tasks themselves. If manual ordering is blocked by the current sort setting, explain the blocker rather than claiming the order changed.
6. Read back the results. Verify every task originally in No Section is accounted for exactly once, with no duplicates or missing tasks, and verify the final section names and task order. Report any task you could not move or order. Finish with a concise summary of each group and the first three tasks I should tackle.`;
}

// chatgpt-work.js is injected only when the user has turned Groups + Work on
// AND granted access to chatgpt.com. Otherwise nothing runs on ChatGPT at all.
const WORK_SCRIPT_ID = 'tms-chatgpt-work';
const CHATGPT_ORIGINS = ['https://chatgpt.com/*'];
async function syncWorkScript() {
  const { groupsEnabled } = await chrome.storage.sync.get({ groupsEnabled: false });
  const granted = await chrome.permissions.contains({ origins: CHATGPT_ORIGINS });
  const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: [WORK_SCRIPT_ID] })).length > 0;
  if (groupsEnabled === true && granted) {
    if (!registered) {
      await chrome.scripting.registerContentScripts([{
        id: WORK_SCRIPT_ID,
        matches: CHATGPT_ORIGINS,
        js: ['chatgpt-work.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true
      }]);
    }
  } else if (registered) {
    await chrome.scripting.unregisterContentScripts({ ids: [WORK_SCRIPT_ID] });
  }
}
const safeSync = () => syncWorkScript().catch(error => console.warn('Todoist Task Toolkit: could not update ChatGPT script', error));
chrome.runtime.onInstalled.addListener(safeSync);
chrome.runtime.onStartup.addListener(safeSync);
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'sync' && changes.groupsEnabled) safeSync(); });
chrome.permissions.onAdded.addListener(safeSync);
chrome.permissions.onRemoved.addListener(safeSync);

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const origin = sender.url && new URL(sender.url).origin;
  if (message.type === 'tms-open-work' && ['https://app.todoist.com', 'https://todoist.com'].includes(origin)) {
    (async () => {
      const { groupsEnabled } = await chrome.storage.sync.get({ groupsEnabled: false });
      if (groupsEnabled !== true) throw new Error('Groups + Work is turned off in the extension options.');
      if (!(await chrome.permissions.contains({ origins: CHATGPT_ORIGINS }))) throw new Error('Allow access to chatgpt.com in the extension options first.');
      const project = new URL(message.projectUrl);
      if (project.origin !== origin || !/^\/app\/(inbox|project\/[^/]+)\/?$/.test(project.pathname)) throw new Error('Invalid Todoist project.');
      const id = crypto.randomUUID();
      await chrome.storage.session.set({ [id]: { prompt: buildPrompt(project.origin + project.pathname), expires: Date.now() + 10 * 60 * 1000 } });
      try {
        const tab = await chrome.tabs.create({ url: `https://chatgpt.com/#tms=${id}` });
        await chrome.storage.session.set({ [`tab-${id}`]: tab.id });
      } catch (error) {
        await chrome.storage.session.remove([id, `tab-${id}`]);
        throw error;
      }
      respond({ ok: true });
    })().catch(error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'tms-take-prompt' && origin === 'https://chatgpt.com' && typeof message.id === 'string') {
    (async () => {
      const data = await chrome.storage.session.get([message.id, `tab-${message.id}`]);
      const pending = data[message.id];
      if (!pending || pending.expires < Date.now() || data[`tab-${message.id}`] !== sender.tab?.id) {
        respond({ ok: false });
        return;
      }
      await chrome.storage.session.remove([message.id, `tab-${message.id}`]);
      respond({ ok: true, prompt: pending.prompt });
    })().catch(() => respond({ ok: false }));
    return true;
  }
});
