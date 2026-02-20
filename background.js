chrome.commands.onCommand.addListener(function (command) {
  if (command === 'highlight-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'highlight' });
      }
    });
  }
});
