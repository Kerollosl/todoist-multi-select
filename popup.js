document.getElementById("version").textContent = "Version " + chrome.runtime.getManifest().version;
chrome.storage.sync.get({ groupsEnabled: false }).then(({ groupsEnabled }) => {
  document.getElementById("groupsState").textContent = groupsEnabled ? "(on)" : "(off)";
});
document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
