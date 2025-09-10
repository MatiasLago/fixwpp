const btn = document.getElementById("toggleBtn");

async function getActiveWaTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/web\.whatsapp\.com/.test(tab.url || "")) return null;
  return tab;
}

function setLabel(hidden) {
  btn.textContent = hidden ? "Mostrar chats" : "Ocultar chats";
}

async function refreshLabel() {
  const tab = await getActiveWaTab();
  if (!tab) {
    btn.textContent = "Abrí WhatsApp Web";
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  chrome.tabs.sendMessage(tab.id, { type: "WA_GET_STATE" }, (resp) => {
    setLabel(Boolean(resp?.hidden));
  });
}

btn.addEventListener("click", async () => {
  const tab = await getActiveWaTab();
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "WA_TOGGLE_SIDEBAR" }, (resp) => {
    setLabel(Boolean(resp?.hidden));
  });
});

// Actualiza el texto al abrir el popup
refreshLabel();
