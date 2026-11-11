(() => {
  'use strict';
  const id = new URLSearchParams(location.hash.slice(1)).get('tms');
  if (!id || !/^[a-f0-9-]{36}$/.test(id) || location.pathname !== '/') return;
  // Every ChatGPT page detail this automation relies on lives here. Values are unchanged
  // and have to be re-checked on the live site whenever ChatGPT changes. If anything is
  // missing, the script stops, explains, and offers the prompt to copy instead of guessing.
  const SELECTORS = {
    pluginId: 'plugin_asdk_app_6943b73823548191a9f9216c6790c453',
    mention: '[plugin-mention-name="app-6943b73823548191a9f9216c6790c453"]',
    composer: '[contenteditable="true"][aria-label="Work with ChatGPT"]',
    anyTextbox: '[contenteditable="true"][role="textbox"]',
    modelPickerLabel: 'Select ChatGPT model',
    modelMenu: '[role="menu"][aria-labelledby]',
    modelViewToggle: '[data-model-picker-view-toggle]',
    modelOption: '[role="menuitemradio"]',
    checkedModel: '[role="menuitemradio"][aria-checked="true"]',
    menuRoot: '[role="menu"]',
    reasoningMenu: '[role="menu"] [data-reasoning-slider]',
    reasoningSlider: '[data-reasoning-slider]',
    pluginsButton: 'button[aria-label="Plugins"]',
    pluginSearch: 'input[placeholder="Search plugins…"]',
    pluginOption: id => `[data-plugin-impression-id="${id}"]`,
  };
  // The model and effort the hand-off asks ChatGPT Work to use.
  const MODEL_NAME = 'GPT-6 Luna';
  const EFFORT = 'medium';
  const pluginId = SELECTORS.pluginId;
  const mentionSelector = SELECTORS.mention;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el && el.getClientRects().length && !el.closest('[inert], [aria-hidden="true"]');
  const find = (selector, root = document) => [...root.querySelectorAll(selector)].find(visible);
  const button = text => [...document.querySelectorAll('button')].find(el => visible(el) && (el.getAttribute('aria-label') || el.textContent.trim()) === text);
  const composer = () => find(SELECTORS.composer);
  const normalized = text => (text || '').replace(/\s+/g, ' ').trim();
  function draftText(input) {
    if (!input) return '';
    const clone = input.cloneNode(true);
    clone.querySelectorAll(mentionSelector).forEach(el => el.remove());
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      if (node.tagName === 'BR') return '\n';
      const text = [...node.childNodes].map(walk).join('');
      return text + (/^(P|DIV|LI)$/.test(node.tagName) ? '\n' : '');
    }
    return normalized(walk(clone));
  }
  async function waitFor(fn, message, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = fn();
      if (result) return result;
      await sleep(150);
    }
    throw new Error(message);
  }
  function setInput(input, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function showStatus(text, prompt) {
    let panel = document.getElementById('tms-work-status');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'tms-work-status';
      panel.setAttribute('role', 'status');
      panel.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;max-width:min(360px,calc(100vw - 32px));padding:14px;border:1px solid #8886;border-radius:10px;background:Canvas;color:CanvasText;font:13px/1.5 system-ui;box-shadow:0 4px 20px #0002';
      document.body.appendChild(panel);
    }
    panel.replaceChildren();
    const label = document.createElement('div');
    label.textContent = text;
    panel.appendChild(label);
    if (prompt) {
      const copy = document.createElement('button');
      copy.textContent = 'Copy sorting prompt';
      copy.style.cssText = 'margin:10px 10px 0 0;padding:5px 8px;cursor:pointer';
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(prompt); copy.textContent = 'Copied'; }
        catch {
          const field = document.createElement('textarea');
          field.value = prompt;
          field.style.cssText = 'width:100%;height:160px';
          panel.appendChild(field);
          field.select();
        }
      };
      panel.appendChild(copy);
    }
    const close = document.createElement('button');
    close.textContent = 'Dismiss';
    close.style.cssText = 'margin-top:10px;padding:5px 8px;cursor:pointer';
    close.onclick = () => panel.remove();
    panel.appendChild(close);
  }
  async function selectModel() {
    const picker = await waitFor(() => button(SELECTORS.modelPickerLabel), 'Cannot find the Work model picker.');
    picker.click();
    let menu = await waitFor(() => find(SELECTORS.modelMenu), 'Cannot open the model picker.');
    const toggle = find(SELECTORS.modelViewToggle, menu);
    if (toggle) toggle.click();
    const luna = await waitFor(() => [...document.querySelectorAll(SELECTORS.modelOption)].find(el => visible(el) && el.textContent.trim() === MODEL_NAME), 'GPT-6 Luna is not available in this picker.');
    if (luna.getAttribute('aria-disabled') === 'true') throw new Error('GPT-6 Luna is unavailable for this account.');
    luna.click();
    menu = await waitFor(() => find(SELECTORS.reasoningMenu)?.closest(SELECTORS.menuRoot), 'Cannot find Luna reasoning effort.');
    const selected = menu.querySelector(SELECTORS.checkedModel);
    if (selected?.textContent.trim() !== MODEL_NAME) throw new Error('Could not verify GPT-6 Luna.');
    for (let attempt = 0; picker.getAttribute('data-selected-reasoning-effort') !== EFFORT && attempt < 6; attempt++) {
      const slider = find(SELECTORS.reasoningSlider, menu);
      const value = Number(menu.querySelector('[role="slider"]')?.getAttribute('aria-valuenow'));
      if (!slider || !Number.isFinite(value)) throw new Error('Cannot read Luna effort.');
      slider.focus();
      const key = value > 1 ? 'ArrowLeft' : 'ArrowRight';
      slider.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      slider.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }));
      await sleep(150);
    }
    if (picker.getAttribute('data-selected-reasoning-effort') !== EFFORT) throw new Error('Could not select Medium effort.');
    picker.click();
    await waitFor(() => picker.getAttribute('aria-expanded') === 'false', 'Close the model picker to continue.');
  }
  async function selectTodoist() {
    const plugins = [...document.querySelectorAll(SELECTORS.pluginsButton)].find(visible);
    if (!plugins) throw new Error('Cannot find the Work Plugins picker.');
    plugins.click();
    const search = await waitFor(() => find(SELECTORS.pluginSearch), 'Cannot search Work plugins.');
    setInput(search, 'Todoist');
    const option = await waitFor(() => find(SELECTORS.pluginOption(pluginId)), 'The Todoist plugin is not available. Connect it in ChatGPT first.');
    if (option.getAttribute('aria-disabled') === 'true') throw new Error('The Todoist plugin is unavailable.');
    option.click();
    await waitFor(() => composer()?.querySelector(mentionSelector), 'Could not add the Todoist plugin mention.');
    return composer();
  }
  async function start() {
    let prompt;
    try {
      await waitFor(() => button('Work') || composer(), 'Sign in to ChatGPT, then try Groups + Work again.', 60000);
      let result;
      for (let attempt = 0; attempt < 10; attempt++) {
        result = await chrome.runtime.sendMessage({ type: 'tms-take-prompt', id });
        if (result?.ok) break;
        await sleep(250);
      }
      if (!result?.ok) throw new Error('This Work handoff expired or was already used. Start again from Todoist.');
      prompt = result.prompt;
      history.replaceState(history.state, '', location.pathname + location.search);
      showStatus('Todoist Task Toolkit: preparing Work…');
      // Never replace a draft, even if the site restored one into this new tab.
      const draft = find(SELECTORS.anyTextbox);
      if (draft?.textContent.trim()) throw new Error('An existing draft was preserved. Copy the sorting prompt and start a new Work task manually.');
      const work = button('Work');
      if (work && work.getAttribute('aria-pressed') !== 'true') work.click();
      let input = await waitFor(composer, 'Could not activate Work mode.');
      if (input.textContent.trim()) throw new Error('An existing Work draft was preserved.');
      await selectModel();
      // Do not overwrite a draft entered while controls were being prepared.
      input = composer();
      if (!input || input.textContent.trim()) throw new Error('The Work composer changed or now contains a draft.');
      input = await selectTodoist();
      const remainingText = input.cloneNode(true);
      remainingText.querySelectorAll(mentionSelector).forEach(el => el.remove());
      if (remainingText.textContent.trim()) throw new Error('The Work composer now contains a draft.');
      input.focus();
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand('insertText', false, '\n' + prompt)) throw new Error('Could not insert the sorting prompt.');
      await waitFor(() => draftText(composer()) === normalized(prompt), 'Could not verify the sorting prompt.');
      const picker = button(SELECTORS.modelPickerLabel);
      if (!composer()?.querySelector(mentionSelector) || picker?.getAttribute('data-selected-reasoning-effort') !== EFFORT || button('Work')?.getAttribute('aria-pressed') !== 'true') throw new Error('Work settings changed before submission. The prompt is ready for manual review.');
      picker.click();
      const menu = await waitFor(() => find(SELECTORS.reasoningMenu)?.closest(SELECTORS.menuRoot), 'Cannot verify the final Work model.');
      if (menu.querySelector(SELECTORS.checkedModel)?.textContent.trim() !== MODEL_NAME) throw new Error('The model changed before submission. Select GPT-6 Luna manually.');
      picker.click();
      await waitFor(() => picker.getAttribute('aria-expanded') === 'false', 'Close the model picker before sending.');
      const send = await waitFor(() => {
        const el = button('Send');
        return el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el;
      }, 'The prompt is ready. Press Send in ChatGPT to start.');
      const finalInput = composer();
      const finalPicker = button(SELECTORS.modelPickerLabel);
      if (location.pathname !== '/' || !finalInput?.querySelector(mentionSelector) || draftText(finalInput) !== normalized(prompt) || finalPicker?.getAttribute('data-selected-reasoning-effort') !== EFFORT || !finalPicker?.textContent.includes(MODEL_NAME) || finalPicker.getAttribute('aria-expanded') !== 'false' || button('Work')?.getAttribute('aria-pressed') !== 'true') {
        throw new Error('The draft or Work settings changed. Review them and send manually.');
      }
      // Exactly one click. Never retry an uncertain submission.
      send.click();
      await waitFor(() => draftText(composer()) !== normalized(prompt), 'Send was clicked once, but submission could not be confirmed. Check the conversation before sending again.');
      showStatus('Sorting request submitted to ChatGPT Work.');
      setTimeout(() => document.getElementById('tms-work-status')?.remove(), 6000);
    } catch (error) {
      showStatus(`Todoist groups are ready. ${error.message} Automatic submission stopped.`, prompt);
    }
  }
  start();
})();
