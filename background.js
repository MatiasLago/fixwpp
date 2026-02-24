chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-sidebar") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs?.[0];

    if (activeTab && /^https:\/\/web\.whatsapp\.com/.test(activeTab.url || "")) {
      chrome.tabs.sendMessage(activeTab.id, { type: "WA_TOGGLE_SIDEBAR" });
      return;
    }

    // La tab activa no es WA — buscar cualquier tab de WA y enfocarla
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (waTabs) => {
      if (!waTabs || waTabs.length === 0) {
        chrome.tabs.create({ url: "https://web.whatsapp.com/" });
      } else {
        chrome.tabs.update(waTabs[0].id, { active: true });
        chrome.windows.update(waTabs[0].windowId, { focused: true });
      }
    });
  });
});
