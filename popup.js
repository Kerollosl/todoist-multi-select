/** @type {HTMLElement} */ (document.getElementById("version")).textContent = "Version " + chrome.runtime.getManifest().version;
chrome.storage.sync.get({ groupsEnabled: false }).then(({ groupsEnabled }) => {
  /** @type {HTMLElement} */ (document.getElementById("groupsState")).textContent = groupsEnabled ? "(on)" : "(off)";
});
/** @type {HTMLElement} */ (document.getElementById("options")).addEventListener("click", () => chrome.runtime.openOptionsPage());
