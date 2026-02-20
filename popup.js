(function () {
  var highlightsEl = document.getElementById('highlights');
  var emptyEl = document.getElementById('empty');
  var urlEl = document.getElementById('url');
  var hintEl = document.getElementById('hint');

  // Show keyboard shortcut hint
  var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  hintEl.textContent = 'Select text + ' + (isMac ? '\u2318' : 'Ctrl') + '+Shift+H to highlight';

  function getPageKey(url) {
    try {
      var u = new URL(url);
      return u.origin + u.pathname;
    } catch (e) {
      return url;
    }
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function truncate(text, max) {
    return text.length <= max ? text : text.substring(0, max) + '\u2026';
  }

  function render(highlights, pk) {
    highlightsEl.innerHTML = '';

    if (!highlights.length) {
      emptyEl.style.display = '';
      return;
    }

    emptyEl.style.display = 'none';

    // Newest first
    var sorted = highlights.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    for (var i = 0; i < sorted.length; i++) {
      var h = sorted[i];

      var item = document.createElement('div');
      item.className = 'highlight-item';

      var textDiv = document.createElement('div');
      textDiv.className = 'highlight-text';

      var textSpan = document.createElement('span');
      textSpan.className = 'text';
      textSpan.textContent = truncate(h.text, 120);

      var meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = formatDate(h.createdAt);

      textDiv.appendChild(textSpan);
      textDiv.appendChild(meta);

      var delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '\u00D7';
      delBtn.title = 'Remove highlight';
      delBtn.dataset.id = h.id;
      delBtn.addEventListener('click', (function (id) {
        return function () { deleteHighlight(id, pk); };
      })(h.id));

      item.appendChild(textDiv);
      item.appendChild(delBtn);
      highlightsEl.appendChild(item);
    }

    // Clear all button when more than one highlight
    if (highlights.length > 1) {
      var clearDiv = document.createElement('div');
      clearDiv.className = 'clear-all';
      var clearBtn = document.createElement('button');
      clearBtn.textContent = 'Clear all highlights';
      clearBtn.addEventListener('click', function () { clearAll(pk); });
      clearDiv.appendChild(clearBtn);
      highlightsEl.appendChild(clearDiv);
    }
  }

  function deleteHighlight(id, pk) {
    chrome.storage.local.get([pk], function (r) {
      var highlights = (r[pk] || []).filter(function (h) { return h.id !== id; });
      chrome.storage.local.set({ [pk]: highlights }, function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'remove', id: id });
        });
        render(highlights, pk);
      });
    });
  }

  function clearAll(pk) {
    chrome.storage.local.get([pk], function (r) {
      var old = r[pk] || [];
      chrome.storage.local.remove(pk, function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            for (var i = 0; i < old.length; i++) {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'remove', id: old[i].id });
            }
          }
        });
        render([], pk);
      });
    });
  }

  // Init
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs[0]) return;
    urlEl.textContent = tabs[0].url;
    var pk = getPageKey(tabs[0].url);
    chrome.storage.local.get([pk], function (r) {
      render(r[pk] || [], pk);
    });
  });
})();
