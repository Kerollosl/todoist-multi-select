(() => {
  "use strict";

  const SEL = self.TMS_SELECTORS;
  const firstMatch = (root, list) => {
    for (const selector of list) {
      const found = root.querySelector(selector);
      if (found) return found;
    }
    return null;
  };

  // --- Settings (Copy is on unless the user turns it off in Options) ---
  let copyEnabled = true;
  chrome.storage.sync.get({ copyEnabled: true }).then((v) => { copyEnabled = v.copyEnabled; schedule(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.copyEnabled) { copyEnabled = changes.copyEnabled.newValue !== false; schedule(); }
  });

  // --- Cached selection (captured BEFORE click can deselect) ---
  let cachedTasks = [];

  // --- Toast ---
  const toast = document.createElement("div");
  toast.className = "tms-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);

  let toastTimer;
  function showToast(msg, ms = 2500) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add("visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), ms);
  }
  // Shared with groups.js (same content-script world) so errors use the toast, not alert().
  self.TMS_TOAST = showToast;

  // --- Theme: follow Todoist's own background, not just the OS setting ---
  function updateTheme() {
    let bg = "";
    for (const el of [document.body, document.documentElement]) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) { bg = c; break; }
    }
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg);
    const dark = m
      ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) < 128
      : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.tmsTheme = dark ? "dark" : "light";
  }

  // --- Walk a DOM subtree, preserving anchor URLs ---
  function extractTextWithUrls(el) {
    if (!el) return "";

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toUpperCase();

      if (tag === "A") {
        const href = node.href || ""; // node.href resolves to absolute URL
        const inner = Array.from(node.childNodes).map(walk).join("").trim();
        const text = inner || node.textContent.trim();
        // Use markdown link syntax to keep URL bound to its text
        if (href && !href.startsWith("javascript:") && href !== "#" && href !== text) {
          return `[${text}](${href})`;
        }
        return text || href;
      }

      if (tag === "BR") return "\n";
      if (["P", "DIV", "LI"].includes(tag)) {
        return Array.from(node.childNodes).map(walk).join("") + "\n";
      }

      return Array.from(node.childNodes).map(walk).join("");
    }

    return walk(el).replace(/\n+$/, "").trim();
  }

  // --- Extract task content from a board_task element ---
  function extractFromElement(el) {
    // Title: inner_content class holds the task name
    const titleEl = firstMatch(el, SEL.taskTitle);
    const title = titleEl ? extractTextWithUrls(titleEl) : "Untitled";

    // Description
    const descEl = firstMatch(el, SEL.taskDescription);
    const description = descEl ? extractTextWithUrls(descEl) : "";

    // Due date
    const dueEl = firstMatch(el, SEL.taskDue);
    const dueDate = dueEl?.textContent?.trim() || "";

    // Subtasks
    const subItems = el.querySelectorAll(SEL.taskSubtasks);
    const subtasks = Array.from(subItems).map((s) => s.textContent.trim()).filter(Boolean);

    // Task ID from id attribute
    const taskId = el.id?.replace("task-", "") || "";

    return { title, description, dueDate, subtasks, taskId, el };
  }

  // --- Mark a task complete by clicking its native checkbox ---
  function completeTask(el) {
    if (!el || !document.body.contains(el)) return false;
    const checkbox = firstMatch(el, SEL.taskCheckbox);
    if (!checkbox) return false;
    checkbox.click();
    return true;
  }

  async function completeTasks(tasks) {
    let done = 0;
    for (const t of tasks) {
      if (completeTask(t.el)) done++;
      // small delay so Todoist processes each click
      await new Promise((r) => setTimeout(r, 80));
    }
    return done;
  }

  // --- Scan DOM for currently selected tasks ---
  function scanSelectedTasks() {
    // board_task elements with aria-selected="true"
    const selected = document.querySelectorAll(SEL.selectedTask);

    const results = [];
    for (const el of selected) {
      results.push(extractFromElement(el));
    }

    // Fallback: also check for data-selection-id presence with selected state
    if (results.length === 0) {
      const withSelectionId = document.querySelectorAll(SEL.selectionIdTask);
      for (const el of withSelectionId) {
        if (el.getAttribute("aria-selected") === "true") {
          results.push(extractFromElement(el));
        }
      }
    }

    return results;
  }

  // --- Build formatted text ---
  function buildCopyText(tasks) {
    return tasks
      .map((t, i) => {
        const lines = [`${i + 1}. ${t.title}`];
        if (t.description) {
          t.description
            .split("\n")
            .filter((d) => d.trim())
            .forEach((d) => lines.push(`    - ${d.trim()}`));
        }
        return lines.join("\n");
      })
      .join("\n\n");
  }

  // --- Copy to clipboard ---
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  // --- Confirm modal: ask to mark copied tasks complete ---
  function askToComplete(count) {
    return new Promise((resolve) => {
      const mk = (tag, cls, text) => {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (text != null) el.textContent = text;
        return el;
      };
      const backdrop = mk("div", "tms-modal-backdrop");
      const modal = mk("div", "tms-modal");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      const plural = count > 1 ? "s" : "";
      modal.setAttribute("aria-labelledby", "tms-modal-title");
      modal.setAttribute("aria-describedby", "tms-modal-body");
      const title = mk("div", "tms-modal-title", `Copied ${count} task${plural}`);
      title.id = "tms-modal-title";
      const body = mk("div", "tms-modal-body", `Mark ${count > 1 ? "them" : "it"} complete now?`);
      body.id = "tms-modal-body";
      modal.appendChild(title);
      modal.appendChild(body);
      const actions = mk("div", "tms-modal-actions");
      const cancelBtn = mk("button", "tms-btn tms-btn-ghost", "Keep");
      const confirmBtn = mk("button", "tms-btn tms-btn-primary", "Mark complete");
      cancelBtn.type = confirmBtn.type = "button";
      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      modal.appendChild(actions);
      backdrop.appendChild(modal);

      const previousFocus = document.activeElement;
      const close = (result) => {
        backdrop.remove();
        document.removeEventListener("keydown", onKey, true);
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        resolve(result);
      };
      // Enter and Space activate whichever button has focus (Keep by default);
      // only Escape and Tab are handled here.
      const onKey = (e) => {
        if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(false); return; }
        if (e.key === "Tab") {
          e.stopPropagation();
          e.preventDefault();
          const order = [cancelBtn, confirmBtn];
          const at = order.indexOf(document.activeElement);
          const next = e.shiftKey ? (at <= 0 ? 1 : at - 1) : (at === 1 ? 0 : 1);
          order[next].focus();
          return;
        }
        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
      };
      const stop = (e) => { e.stopPropagation(); };
      cancelBtn.addEventListener("click", (e) => { stop(e); close(false); });
      confirmBtn.addEventListener("click", (e) => { stop(e); close(true); });
      backdrop.addEventListener("mousedown", (e) => {
        stop(e);
        if (e.target === backdrop) close(false);
      });
      // Keep Todoist from seeing clicks inside the dialog (bubble phase, so the buttons still get them).
      backdrop.addEventListener("click", stop);
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(backdrop);
      cancelBtn.focus();
    });
  }

  // --- Copy button ---
  const copyBtn = document.createElement("button");
  copyBtn.className = "tms-copy-fab";
  copyBtn.type = "button";
  copyBtn.textContent = "Selected tasks";
  copyBtn.setAttribute("aria-label", "Copy selected tasks");
  document.body.appendChild(copyBtn);

  async function copySelection() {
    if (!copyEnabled) return;
    // Use cached tasks (captured while still selected)
    const tasks = cachedTasks.length > 0 ? cachedTasks : scanSelectedTasks();

    if (tasks.length === 0) {
      showToast("No tasks found. Select some tasks first.");
      return;
    }

    const text = buildCopyText(tasks);
    if (!(await copyToClipboard(text))) {
      showToast("Could not copy. Your browser blocked clipboard access.", 4000);
      return;
    }
    showToast(`Copied ${tasks.length} task${tasks.length === 1 ? "" : "s"}`);
    const snapshot = tasks.slice();
    cachedTasks = [];
    const confirmed = await askToComplete(snapshot.length);
    if (confirmed) {
      const done = await completeTasks(snapshot);
      showToast(`Completed ${done} task${done === 1 ? "" : "s"}`);
    }
  }

  // Mouse: use mousedown, which fires BEFORE Todoist's click handler deselects.
  copyBtn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();
    copySelection();
  });

  // Keyboard activation (Enter/Space) arrives as a click with detail 0.
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.detail === 0) copySelection();
  }, true);

  // --- Watch for selection bar & cache selected tasks ---
  let lastSelectedCount = 0;

  // Add a Priority button beside Todoist's native Labels button (Labels stays visible).
  // It opens Todoist's own bulk-action menu.
  function updateSelectionToolbar() {
    const matchesName = (el, pattern) =>
      [el.getAttribute("aria-label"), el.getAttribute("title"), el.textContent]
        .some((value) => pattern.test((value || "").trim()));
    const labels = document.querySelector(SEL.labelsToolbarButton);
    if (!labels) return;

    let bar = labels.parentElement;
    while (bar && bar !== document.body) {
      const buttons = Array.from(bar.querySelectorAll('button, [role="button"]'));
      // The final icon-only control is Todoist's More actions button. Its
      // accessible name can vary, so use the toolbar structure as a fallback.
      const nativeButtons = buttons.filter((el) => !el.classList.contains("tms-priority-button"));
      const more = nativeButtons.find((el) => matchesName(el, /more actions/i)) || nativeButtons.at(-1);
      const deleteButton = nativeButtons.find((el) => matchesName(el, /^delete(?:\s|$)/i));
      const isToolbar = nativeButtons.length >= 3 && nativeButtons.length <= 12 &&
        deleteButton && more !== deleteButton && nativeButtons.indexOf(more) > nativeButtons.indexOf(deleteButton);
      if (isToolbar && more && more !== labels) {
        if (bar.querySelector(".tms-priority-button")) return;
        const priority = document.createElement("button");
        priority.type = "button";
        // Preserve Todoist's button and inner text classes so typography,
        // spacing, hover and focus states match the neighboring controls.
        priority.className = `${labels.className} tms-priority-button`;
        priority.setAttribute("aria-label", "Priority");
        priority.setAttribute("aria-haspopup", "true");
        priority.append(...Array.from(labels.childNodes, (node) => node.cloneNode(true)));
        const icon = priority.querySelector("svg");
        if (icon) {
          icon.setAttribute("aria-hidden", "true");
          icon.innerHTML = '<path d="M5.5 20V4.5c4-3 8 3 13 0v10c-5 3-9-3-13 0" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        const textNodes = document.createTreeWalker(priority, NodeFilter.SHOW_TEXT);
        while (textNodes.nextNode()) {
          if (textNodes.currentNode.textContent.trim() === "Labels") {
            textNodes.currentNode.textContent = "Priority";
          }
        }
        priority.addEventListener("click", () => more.click());
        labels.insertAdjacentElement("afterend", priority);
        return;
      }
      bar = bar.parentElement;
    }
  }

  function checkForSelectionBar() {
    updateTheme();
    if (!copyEnabled) {
      copyBtn.classList.remove("visible");
      return;
    }
    updateSelectionToolbar();
    const selectedCount = document.querySelectorAll(SEL.selectedTask).length;

    // Also check for the native "N selected" action bar (Todoist renders it
    // as a fixed bar with role or specific data attributes near the bottom)
    let nativeBarVisible = false;
    if (selectedCount === 0) {
      nativeBarVisible = !!document.querySelector(SEL.nativeSelectionBar);
    }

    const hasSelection = selectedCount > 0 || nativeBarVisible;

    if (hasSelection) {
      // Only re-scan if count changed to avoid redundant DOM walks
      if (selectedCount !== lastSelectedCount) {
        const found = scanSelectedTasks();
        if (found.length > 0) {
          cachedTasks = found;
          copyBtn.textContent = `${found.length} task${found.length > 1 ? "s" : ""} selected`;
          copyBtn.setAttribute("aria-label", `Copy ${found.length} selected task${found.length > 1 ? "s" : ""}`);
        }
        lastSelectedCount = selectedCount;
      }
      copyBtn.classList.add("visible");
    } else {
      if (lastSelectedCount > 0) lastSelectedCount = 0;
      cachedTasks = [];
      copyBtn.classList.remove("visible");
    }
  }

  // One throttled MutationObserver replaces the old 300ms polling. The first
  // change runs a check at once (so selection is cached before a click can
  // deselect it); further changes within 120ms are coalesced into one more check.
  let lastRun = 0;
  let pending = 0;
  function schedule() {
    const wait = 120 - (performance.now() - lastRun);
    if (wait <= 0) { lastRun = performance.now(); checkForSelectionBar(); return; }
    if (!pending) pending = setTimeout(() => { pending = 0; schedule(); }, wait);
  }
  const ours = (node) => {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !!el && (el === copyBtn || el === toast || el.closest(".tms-modal-backdrop, .tms-toast, .tms-priority-button") !== null);
  };
  new MutationObserver((records) => {
    // Ignore our own UI changes so we never trigger ourselves.
    if (records.some((r) => !ours(r.target))) schedule();
  }).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-selected", "class", "style"],
  });
  schedule();

  // --- Keyboard shortcut: Cmd/Ctrl + Shift + C (e.code works on every layout) ---
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyC" && copyEnabled) {
      const tasks = cachedTasks.length > 0 ? cachedTasks : scanSelectedTasks();
      if (tasks.length > 0) {
        e.preventDefault();
        copySelection();
      }
    }
  });

})();
