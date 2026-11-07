(() => {
  "use strict";

  // --- Cached selection (captured BEFORE click can deselect) ---
  let cachedTasks = [];

  // --- Toast ---
  const toast = document.createElement("div");
  toast.className = "tms-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);

  let toastTimer;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add("visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
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
    const titleEl =
      el.querySelector(".board_task_details__content__inner_content") ||
      el.querySelector(".task_content") ||
      el.querySelector('[class*="inner_content"]');
    const title = titleEl ? extractTextWithUrls(titleEl) : "Untitled";

    // Description
    const descEl =
      el.querySelector(".board_task_details__description") ||
      el.querySelector('[class*="task_description"]') ||
      el.querySelector('[class*="description"]');
    const description = descEl ? extractTextWithUrls(descEl) : "";

    // Due date
    const dueEl =
      el.querySelector('[class*="due_date"]') ||
      el.querySelector("time");
    const dueDate = dueEl?.textContent?.trim() || "";

    // Subtasks
    const subItems = el.querySelectorAll('[class*="subtask"]');
    const subtasks = Array.from(subItems).map((s) => s.textContent.trim()).filter(Boolean);

    // Task ID from id attribute
    const taskId = el.id?.replace("task-", "") || "";

    return { title, description, dueDate, subtasks, taskId, el };
  }

  // --- Mark a task complete by clicking its native checkbox ---
  function completeTask(el) {
    if (!el || !document.body.contains(el)) return false;
    const checkbox =
      el.querySelector('button[aria-label*="omplete" i]') ||
      el.querySelector('[data-testid="task-checkbox"]') ||
      el.querySelector('button[class*="task_checkbox"]') ||
      el.querySelector('[class*="checkbox"] button') ||
      el.querySelector('[class*="checkbox"]');
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
    const selected = document.querySelectorAll(
      '.board_task[aria-selected="true"], [data-testid="task-card"][aria-selected="true"]'
    );


    const results = [];
    for (const el of selected) {
      results.push(extractFromElement(el));
    }

    // Fallback: also check for data-selection-id presence with selected state
    if (results.length === 0) {
      const withSelectionId = document.querySelectorAll("[data-selection-id]");
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
      document.execCommand("copy");
      ta.remove();
      return true;
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
      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      modal.appendChild(actions);
      backdrop.appendChild(modal);

      const close = (result) => {
        backdrop.remove();
        document.removeEventListener("keydown", onKey, true);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === "Escape") { e.stopPropagation(); close(false); }
        if (e.key === "Enter") { e.stopPropagation(); close(true); }
      };
      const stop = (e) => { e.stopPropagation(); e.stopImmediatePropagation(); };
      confirmBtn.addEventListener("mousedown", (e) => { stop(e); e.preventDefault(); close(true); });
      cancelBtn.addEventListener("mousedown", (e) => { stop(e); e.preventDefault(); close(false); });
      backdrop.addEventListener("mousedown", (e) => {
        if (e.target === backdrop) { stop(e); close(false); }
      });
      // Swallow clicks so Todoist doesn't see them
      backdrop.addEventListener("click", stop, true);
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(backdrop);
      confirmBtn.focus();
    });
  }

  // --- Copy button ---
  const copyBtn = document.createElement("button");
  copyBtn.className = "tms-copy-fab";
  copyBtn.textContent = "Selected tasks";
  copyBtn.setAttribute("aria-label", "Copy selected tasks");
  document.body.appendChild(copyBtn);

  // Use mousedown — fires BEFORE Todoist's click handler deselects
  copyBtn.addEventListener("mousedown", async (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    // Use cached tasks (captured while still selected)
    const tasks = cachedTasks.length > 0 ? cachedTasks : scanSelectedTasks();

    if (tasks.length === 0) {
      showToast("No tasks found — try selecting tasks first");
      return;
    }

    const text = buildCopyText(tasks);
    await copyToClipboard(text);
    showToast(`Copied ${tasks.length} task${tasks.length === 1 ? "" : "s"}`);
    const snapshot = tasks.slice();
    cachedTasks = [];
    const confirmed = await askToComplete(snapshot.length);
    if (confirmed) {
      const done = await completeTasks(snapshot);
      showToast(`Completed ${done} task${done === 1 ? "" : "s"}`);
    }
  });

  // Prevent click from reaching Todoist
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  // --- Watch for selection bar & cache selected tasks ---
  let lastSelectedCount = 0;

  // Open Todoist's native bulk-action menu directly from a Priority button.
  function updateSelectionToolbar() {
    const matchesName = (el, pattern) =>
      [el.getAttribute("aria-label"), el.getAttribute("title"), el.textContent]
        .some((value) => pattern.test((value || "").trim()));
    const labels = document.querySelector('[data-action-hint="multi-select-toolbar-label-picker"]');
    if (!labels) return;
    if (labels.classList.contains("tms-hidden-labels")) return;

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
        const existing = bar.querySelector(".tms-priority-button");
        if (existing) {
          labels.classList.add("tms-hidden-labels");
          return;
        }
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
        labels.classList.add("tms-hidden-labels");
        return;
      }
      bar = bar.parentElement;
    }
  }

  function checkForSelectionBar() {
    updateSelectionToolbar();
    const selectedEls = document.querySelectorAll(
      '.board_task[aria-selected="true"], [data-testid="task-card"][aria-selected="true"]'
    );
    const selectedCount = selectedEls.length;

    // Also check for the native "N selected" action bar (Todoist renders it
    // as a fixed bar with role or specific data attributes near the bottom)
    let nativeBarVisible = false;
    if (selectedCount === 0) {
      const bar = document.querySelector('[data-testid="multi-select-toolbar"], [class*="multi_select"], [class*="selection_toolbar"], [class*="bulk_action"]');
      nativeBarVisible = !!bar;
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
      copyBtn.classList.remove("visible");
    }
  }

  // Poll to keep cache fresh
  setInterval(checkForSelectionBar, 300);

  // --- Keyboard shortcut: Cmd/Ctrl + Shift + C ---
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
      const tasks = cachedTasks.length > 0 ? cachedTasks : scanSelectedTasks();
      if (tasks.length > 0) {
        e.preventDefault();
        const text = buildCopyText(tasks);
        copyToClipboard(text).then(async () => {
          showToast(`Copied ${tasks.length} task${tasks.length === 1 ? "" : "s"}`);
          const snapshot = tasks.slice();
          cachedTasks = [];
          const confirmed = await askToComplete(snapshot.length);
          if (confirmed) {
            const done = await completeTasks(snapshot);
            showToast(`Completed ${done} task${done === 1 ? "" : "s"}`);
          }
        });
      }
    }
  });

})();
