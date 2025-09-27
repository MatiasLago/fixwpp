chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-sidebar") {
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        chrome.tabs.create({ url: "https://web.whatsapp.com/" });
        return;
      }
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: "WA_TOGGLE_SIDEBAR" });
      }
    });
  }
});
