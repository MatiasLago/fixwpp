document.getElementById("toggleBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/web\.whatsapp\.com/.test(tab.url || "")) {
    alert("Abrí WhatsApp Web para usar esta extensión");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "WA_TOGGLE_SIDEBAR" });
});
