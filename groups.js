(() => {
  "use strict";
  const names = ["Group 1", "Group 2", "Group 3"];
  let busy = false;
  const sections = () => [...document.querySelectorAll('[data-testid="board-section"]')];
  const title = el => el.querySelector('.board_section__title')?.textContent.trim();
  const groupName = name => {
    const match = /^Group ([123])(?:$|\s|[—–:|\-])/i.exec(name || '');
    return match ? `Group ${match[1]}` : null;
  };
  const noSection = () => sections().find(el => el.getAttribute('data-column-navigation-element') === 'null');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitFor(fn) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const result = fn();
      if (result) return result;
      await sleep(100);
    }
    throw new Error('Todoist did not confirm the change. Check your sections before retrying.');
  }
  function projectUrl() {
    const url = new URL(location.href);
    return /^\/app\/(inbox|project\/[^/]+)\/?$/.test(url.pathname)
      ? url.origin + url.pathname : null;
  }
  function checkContext(url) {
    if (projectUrl() !== url) throw new Error('The project changed. Return to the original board and retry.');
  }
  function scroller() {
    let el = (noSection() || sections()[0])?.parentElement;
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return el;
      el = el.parentElement;
    }
    return null;
  }
  // Todoist virtualizes wide boards. Scan every column before deciding a group is missing.
  async function scanBoard(url) {
    const found = new Map();
    const scroll = scroller();
    const original = scroll?.scrollLeft || 0;
    try {
      if (scroll) scroll.scrollLeft = 0;
      for (let page = 0; page < 100; page++) {
        await sleep(120);
        checkContext(url);
        for (const section of sections()) {
          const name = groupName(title(section));
          if (name) {
            const id = section.getAttribute('data-column-navigation-element');
            if (found.has(name) && found.get(name) !== id) throw new Error(`There are multiple ${name} sections. Rename duplicates before sorting.`);
            found.set(name, id);
          }
        }
        if (!scroll || scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 2) return found;
        scroll.scrollLeft += Math.max(100, scroll.clientWidth / 2);
      }
      throw new Error('This board is too wide to check safely. No groups were created.');
    } finally {
      if (scroll?.isConnected) scroll.scrollLeft = original;
      await sleep(120);
    }
  }
  async function createGroup(name, anchorName, url) {
    checkContext(url);
    if (document.querySelector('[data-testid="section-form"]')) throw new Error('Finish or cancel the open section form first.');
    let column = anchorName ? sections().find(el => groupName(title(el)) === anchorName) : noSection();
    const scroll = scroller();
    if (!column && scroll) { scroll.scrollLeft = 0; await sleep(120); }
    for (let page = 0; !column && scroll && page < 100; page++) {
      checkContext(url);
      column = anchorName ? sections().find(el => groupName(title(el)) === anchorName) : noSection();
      if (column) break;
      scroll.scrollLeft += Math.max(100, scroll.clientWidth / 2);
      await sleep(120);
      column = anchorName ? sections().find(el => groupName(title(el)) === anchorName) : noSection();
    }
    // Named sections have an extra sortable wrapper that No Section does not.
    // Scope insertion to the column's stable outer wrapper, not its direct parent.
    const wrapper = column?.closest('[data-drag-scroll-target]');
    const trigger = wrapper?.querySelector('.board_add_section_trigger__container button');
    if (!trigger) throw new Error(`Cannot find Add section after ${anchorName || 'No Section'}. No further sections were created; reload Todoist and retry.`);
    trigger.click();
    const input = await waitFor(() => document.querySelector('[data-testid="section-form"] input[name="section_name"]'));
    checkContext(url);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const submit = await waitFor(() => {
      const button = input.closest('form')?.querySelector('button[type="submit"]');
      return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && button;
    });
    checkContext(url);
    submit.click();
    // Never retry a timed-out submission: it may already have succeeded remotely.
    await waitFor(() => sections().find(el => groupName(title(el)) === name));
    await waitFor(() => !document.querySelector('[data-testid="section-form"]'));
  }
  async function run(button) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = 'Preparing groups…';
    try {
      const url = projectUrl();
      if (!url) throw new Error('Open an Inbox or project board first.');
      const existing = await scanBoard(url);
      for (let index = 0; index < names.length; index++) {
        if (!existing.has(names[index])) await createGroup(names[index], names[index - 1], url);
      }
      checkContext(url);
      const confirmed = await scanBoard(url);
      if (!names.every(name => confirmed.has(name))) throw new Error('Could not verify all three groups. ChatGPT Work was not started.');
      const response = await chrome.runtime.sendMessage({ type: 'tms-open-work', projectUrl: url });
      if (!response?.ok) throw new Error(response?.error || 'Could not open ChatGPT Work. Reload the extension and try again.');
      button.textContent = 'Groups ready · Work opened';
    } catch (error) {
      button.textContent = 'Groups + Work';
      alert(error.message);
    } finally {
      busy = false;
      button.disabled = false;
    }
  }
  function mount() {
    const navigation = document.querySelector('#top-menu');
    const existingItem = document.querySelector('.tms-group-nav-item');
    const available = !!projectUrl() && sections().length > 0;
    if (existingItem) {
      existingItem.hidden = !available;
      existingItem.querySelector('button').disabled = busy;
      return;
    }
    if (!navigation || !available) return;
    const item = document.createElement('li');
    item.className = 'tms-group-nav-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tms-group-btn';
    button.textContent = 'Groups + Work';
    button.dataset.tmsVersion = '1.2.0';
    button.title = 'Todoist Task Toolkit v1.2.0 — Prepare three groups and organize tasks with ChatGPT Work · GPT-6 Luna · Medium';
    button.disabled = busy;
    button.addEventListener('mousedown', event => event.stopPropagation());
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      run(button);
    });
    item.appendChild(button);
    navigation.appendChild(item);
  }
  setInterval(mount, 500);
  mount();
})();
