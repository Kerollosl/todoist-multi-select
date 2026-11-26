const copy = /** @type {HTMLInputElement} */ (document.getElementById("copy"));
const groups = /** @type {HTMLInputElement} */ (document.getElementById("groups"));
const status = /** @type {HTMLElement} */ (document.getElementById("status"));
const ORIGINS = { origins: ["https://chatgpt.com/*"] };
/** @type {HTMLElement} */ (document.getElementById("version")).textContent = "Version " + chrome.runtime.getManifest().version;

chrome.storage.sync.get({ copyEnabled: true, groupsEnabled: false }).then(async (v) => {
  copy.checked = /** @type {boolean} */ (v.copyEnabled);
  // Show "on" only if access to chatgpt.com is still granted.
  groups.checked = /** @type {boolean} */ (v.groupsEnabled) && (await chrome.permissions.contains(ORIGINS));
});

copy.addEventListener("change", async () => {
  await chrome.storage.sync.set({ copyEnabled: copy.checked });
  status.textContent = copy.checked ? "Copy is on." : "Copy is off.";
});

groups.addEventListener("change", async () => {
  if (groups.checked) {
    // permissions.request must run straight from this click.
    const granted = await chrome.permissions.request(ORIGINS);
    if (!granted) {
      groups.checked = false;
      status.textContent = "Groups + Work stays off because access to chatgpt.com was not allowed.";
      return;
    }
    await chrome.storage.sync.set({ groupsEnabled: true });
    status.textContent = "Groups + Work is on. Open a Todoist board to see the sidebar button.";
  } else {
    await chrome.storage.sync.set({ groupsEnabled: false });
    await chrome.permissions.remove(ORIGINS);
    status.textContent = "Groups + Work is off and chatgpt.com access was removed.";
  }
});
