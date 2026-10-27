(() => {
  'use strict';
  const id = new URLSearchParams(location.hash.slice(1)).get('tms');
  if (!id || !/^[a-f0-9-]{36}$/.test(id) || location.pathname !== '/') return;
  const pluginId = 'plugin_asdk_app_6943b73823548191a9f9216c6790c453';
  const mentionSelector = '[plugin-mention-name="app-6943b73823548191a9f9216c6790c453"]';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el && el.getClientRects().length && !el.closest('[inert], [aria-hidden="true"]');
  const find = (selector, root = document) => [...root.querySelectorAll(selector)].find(visible);
  const button = text => [...document.querySelectorAll('button')].find(el => visible(el) && (el.getAttribute('aria-label') || el.textContent.trim()) === text);
  const composer = () => find('[contenteditable="true"][aria-label="Work with ChatGPT"]');
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
    const picker = await waitFor(() => button('Select ChatGPT model'), 'Cannot find the Work model picker.');
    picker.click();
    let menu = await waitFor(() => find('[role="menu"][aria-labelledby]'), 'Cannot open the model picker.');
    const toggle = find('[data-model-picker-view-toggle]', menu);
    if (toggle) toggle.click();
    const luna = await waitFor(() => [...document.querySelectorAll('[role="menuitemradio"]')].find(el => visible(el) && el.textContent.trim() === 'GPT-6 Luna'), 'GPT-6 Luna is not available in this picker.');
    if (luna.getAttribute('aria-disabled') === 'true') throw new Error('GPT-6 Luna is unavailable for this account.');
    luna.click();
    menu = await waitFor(() => find('[role="menu"] [data-reasoning-slider]')?.closest('[role="menu"]'), 'Cannot find Luna reasoning effort.');
    const selected = menu.querySelector('[role="menuitemradio"][aria-checked="true"]');
    if (selected?.textContent.trim() !== 'GPT-6 Luna') throw new Error('Could not verify GPT-6 Luna.');
    for (let attempt = 0; picker.getAttribute('data-selected-reasoning-effort') !== 'medium' && attempt < 6; attempt++) {
      const slider = find('[data-reasoning-slider]', menu);
      const value = Number(menu.querySelector('[role="slider"]')?.getAttribute('aria-valuenow'));
      if (!slider || !Number.isFinite(value)) throw new Error('Cannot read Luna effort.');
      slider.focus();
      const key = value > 1 ? 'ArrowLeft' : 'ArrowRight';
      slider.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      slider.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }));
      await sleep(150);
    }
    if (picker.getAttribute('data-selected-reasoning-effort') !== 'medium') throw new Error('Could not select Medium effort.');
    picker.click();
    await waitFor(() => picker.getAttribute('aria-expanded') === 'false', 'Close the model picker to continue.');
  }
  async function selectTodoist() {
    const plugins = [...document.querySelectorAll('button[aria-label="Plugins"]')].find(visible);
    if (!plugins) throw new Error('Cannot find the Work Plugins picker.');
    plugins.click();
    const search = await waitFor(() => find('input[placeholder="Search plugins…"]'), 'Cannot search Work plugins.');
    setInput(search, 'Todoist');
    const option = await waitFor(() => find(`[data-plugin-impression-id="${pluginId}"]`), 'The Todoist plugin is not available. Connect it in ChatGPT first.');
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
      showStatus('Todoist Task Toolkit: preparing Work · GPT-6 Luna · Medium…');
      // Never replace a draft, even if the site restored one into this new tab.
      const draft = find('[contenteditable="true"][role="textbox"]');
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
      const picker = button('Select ChatGPT model');
      if (!composer()?.querySelector(mentionSelector) || picker?.getAttribute('data-selected-reasoning-effort') !== 'medium' || button('Work')?.getAttribute('aria-pressed') !== 'true') throw new Error('Work settings changed before submission. The prompt is ready for manual review.');
      picker.click();
      const menu = await waitFor(() => find('[role="menu"] [data-reasoning-slider]')?.closest('[role="menu"]'), 'Cannot verify the final Work model.');
      if (menu.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent.trim() !== 'GPT-6 Luna') throw new Error('The model changed before submission. Select GPT-6 Luna manually.');
      picker.click();
      await waitFor(() => picker.getAttribute('aria-expanded') === 'false', 'Close the model picker before sending.');
      const send = await waitFor(() => {
        const el = button('Send');
        return el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el;
      }, 'The prompt is ready. Press Send in ChatGPT to start.');
      const finalInput = composer();
      const finalPicker = button('Select ChatGPT model');
      if (location.pathname !== '/' || !finalInput?.querySelector(mentionSelector) || draftText(finalInput) !== normalized(prompt) || finalPicker?.getAttribute('data-selected-reasoning-effort') !== 'medium' || !finalPicker?.textContent.includes('GPT-6 Luna') || finalPicker.getAttribute('aria-expanded') !== 'false' || button('Work')?.getAttribute('aria-pressed') !== 'true') {
        throw new Error('The draft or Work settings changed. Review them and send manually.');
      }
      // Exactly one click. Never retry an uncertain submission.
      send.click();
      await waitFor(() => draftText(composer()) !== normalized(prompt), 'Send was clicked once, but submission could not be confirmed. Check the conversation before sending again.');
      showStatus('Sorting request submitted to ChatGPT Work · GPT-6 Luna · Medium.');
      setTimeout(() => document.getElementById('tms-work-status')?.remove(), 6000);
    } catch (error) {
      showStatus(`Todoist groups are ready. ${error.message} Automatic submission stopped.`, prompt);
    }
  }
  start();
})();
