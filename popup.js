const toggleBtn = document.getElementById("toggleBtn");
const openBtn = document.getElementById("openBtn");

async function getActiveWaTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/web\.whatsapp\.com/.test(tab.url || "")) return null;
  return tab;
}

function updateToggleButton(hidden) {
  toggleBtn.style.display = "block";
  openBtn.style.display = "none";
  if (hidden) {
    toggleBtn.textContent = "Mostrar chats";
    toggleBtn.className = "show";
  } else {
    toggleBtn.textContent = "Ocultar chats";
    toggleBtn.className = "hide";
  }
}

async function refreshState() {
  const tab = await getActiveWaTab();
  if (!tab) {
    toggleBtn.style.display = "none";
    openBtn.style.display = "block";
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "WA_GET_STATE" }, (resp) => {
    updateToggleButton(Boolean(resp?.hidden));
  });
}

toggleBtn.addEventListener("click", async () => {
  const tab = await getActiveWaTab();
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "WA_TOGGLE_SIDEBAR" }, (resp) => {
    updateToggleButton(Boolean(resp?.hidden));
  });
});

openBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://web.whatsapp.com/" });
});

refreshState();
