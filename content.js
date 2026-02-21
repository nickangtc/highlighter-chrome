(function () {
  'use strict';

  const CLS = 'hltr-mark';

  function pageKey() {
    const u = new URL(location.href);
    return u.origin + u.pathname;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // -- Styles --
  var DEL_CLS = 'hltr-del';
  const css = document.createElement('style');
  css.textContent = [
    '.' + CLS + '{',
    'background-color:#fef08a!important;',
    'padding:0 1px!important;',
    'border-radius:2px!important;',
    'box-decoration-break:clone;',
    '-webkit-box-decoration-break:clone;',
    '}',
    '.' + DEL_CLS + '{',
    'position:absolute;',
    'top:-7px;right:-7px;',
    'width:15px;height:15px;',
    'background:#888;color:#fff;',
    'border-radius:50%;',
    'font-size:11px;line-height:15px;text-align:center;',
    'cursor:pointer;z-index:999999;',
    'font-family:sans-serif;font-style:normal;font-weight:400;',
    'pointer-events:auto;user-select:none;',
    '}',
    '.' + DEL_CLS + ':hover{background:#e74c3c;}'
  ].join('');
  (document.head || document.documentElement).appendChild(css);

  // -- Note prompt --
  var NOTE_DISMISS = 30000;
  var noteEl = null;
  var noteTimer = null;
  var noteBar = null;
  var noteTyping = false;
  var noteHighlightId = null;
  var notePageKeyRef = null;

  (function injectNoteStyles() {
    var s = document.createElement('style');
    s.textContent = [
      '.hltr-note-prompt {',
      '  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);',
      '  background: #1a1a2e; color: #fff; border-radius: 12px;',
      '  padding: 12px 16px; z-index: 999999;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  font-size: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);',
      '  display: flex; align-items: center; gap: 10px;',
      '  max-width: 480px; width: calc(100% - 40px);',
      '  animation: hltr-slide-up 0.25s ease-out;',
      '}',
      '@keyframes hltr-slide-up {',
      '  from { transform: translateX(-50%) translateY(20px); opacity: 0; }',
      '  to { transform: translateX(-50%) translateY(0); opacity: 1; }',
      '}',
      '.hltr-note-prompt label { white-space: nowrap; font-weight: 500; }',
      '.hltr-note-prompt input {',
      '  flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);',
      '  border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 13px;',
      '  outline: none; min-width: 0;',
      '}',
      '.hltr-note-prompt input::placeholder { color: rgba(255,255,255,0.4); }',
      '.hltr-note-prompt input:focus { border-color: rgba(255,255,255,0.5); }',
      '.hltr-note-prompt .hltr-note-dismiss {',
      '  background: none; border: none; color: rgba(255,255,255,0.4);',
      '  cursor: pointer; font-size: 18px; padding: 0 4px; line-height: 1;',
      '}',
      '.hltr-note-prompt .hltr-note-dismiss:hover { color: rgba(255,255,255,0.7); }',
      '.hltr-note-track {',
      '  position: absolute; bottom: 0; left: 12px; right: 12px; height: 3px;',
      '  background: rgba(255,255,255,0.1); border-radius: 0 0 10px 10px; overflow: hidden;',
      '}',
      '.hltr-note-bar {',
      '  height: 100%; background: rgba(255,255,255,0.35); border-radius: 0 0 10px 10px;',
      '  width: 100%; transform-origin: left;',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  function startNoteCountdown() {
    noteTyping = false;
    if (noteBar) {
      noteBar.style.transition = 'none';
      noteBar.style.transform = 'scaleX(1)';
      noteBar.offsetWidth;
      noteBar.style.transition = 'transform ' + NOTE_DISMISS + 'ms linear';
      noteBar.style.transform = 'scaleX(0)';
    }
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { hideNotePrompt(); }, NOTE_DISMISS);
  }

  function pauseNoteCountdown() {
    noteTyping = true;
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
    if (noteBar) {
      var computed = window.getComputedStyle(noteBar);
      var current = computed.transform;
      noteBar.style.transition = 'none';
      noteBar.style.transform = current;
    }
  }

  function showNotePrompt(id, pk) {
    hideNotePrompt();
    noteHighlightId = id;
    notePageKeyRef = pk;

    noteEl = document.createElement('div');
    noteEl.className = 'hltr-note-prompt';

    var label = document.createElement('label');
    label.textContent = 'Note';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Why did this stand out?';

    var dismiss = document.createElement('button');
    dismiss.className = 'hltr-note-dismiss';
    dismiss.textContent = '\u00d7';
    dismiss.title = 'Dismiss';

    var track = document.createElement('div');
    track.className = 'hltr-note-track';
    noteBar = document.createElement('div');
    noteBar.className = 'hltr-note-bar';
    track.appendChild(noteBar);

    noteEl.appendChild(label);
    noteEl.appendChild(input);
    noteEl.appendChild(dismiss);
    noteEl.appendChild(track);
    document.body.appendChild(noteEl);

    setTimeout(function () { input.focus(); }, 100);

    input.addEventListener('input', function () {
      if (!noteTyping) pauseNoteCountdown();
    });

    input.addEventListener('focus', function () {
      if (input.value.length > 0) pauseNoteCountdown();
    });

    input.addEventListener('blur', function () {
      if (noteTyping) startNoteCountdown();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.value.trim()) {
        saveHighlightNote(noteHighlightId, notePageKeyRef, input.value.trim());
        hideNotePrompt();
      } else if (e.key === 'Escape') {
        hideNotePrompt();
      }
    });

    dismiss.addEventListener('click', function () {
      hideNotePrompt();
    });

    startNoteCountdown();
  }

  function hideNotePrompt() {
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
    if (noteEl && noteEl.parentNode) noteEl.parentNode.removeChild(noteEl);
    noteEl = null;
    noteBar = null;
    noteHighlightId = null;
    notePageKeyRef = null;
    noteTyping = false;
  }

  function saveHighlightNote(id, pk, note) {
    chrome.storage.local.get([pk], function (res) {
      var arr = res[pk] || [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) {
          arr[i].note = note;
          break;
        }
      }
      chrome.storage.local.set({ [pk]: arr });
    });
  }

  // -- XPath --
  function xpath(node) {
    if (!node || node === document) return '';
    if (node === document.body) return '/html/body';
    if (node === document.documentElement) return '/html';
    if (node.id) return '//*[@id="' + node.id + '"]';
    var parent = node.parentNode;
    var sibs = Array.from(parent.children).filter(function (c) { return c.tagName === node.tagName; });
    return xpath(parent) + '/' + node.tagName.toLowerCase() + '[' + (sibs.indexOf(node) + 1) + ']';
  }

  function fromXPath(xp) {
    try {
      return document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) { return null; }
  }

  // -- Text node helpers --
  function closestBlock(node) {
    var el = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (el && el !== document.body && el !== document.documentElement) {
      try {
        var d = window.getComputedStyle(el).display;
        if (d !== 'inline' && d !== 'inline-block' && d !== 'inline-flex'
            && d !== 'inline-grid' && d !== 'inline-table') return el;
      } catch (e) { return el; }
      el = el.parentNode;
    }
    return el || document.body;
  }

  // Collect text nodes with offsets, inserting virtual newlines between block boundaries
  function collectTextNodes(root) {
    var entries = [];
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n, off = 0, lastBlock = null;
    while ((n = w.nextNode())) {
      var block = closestBlock(n);
      if (lastBlock && block !== lastBlock) {
        off += 1; // virtual newline between blocks
      }
      entries.push({ node: n, offset: off });
      off += n.textContent.length;
      lastBlock = block;
    }
    // Build full text with virtual newlines
    var full = '';
    for (var i = 0; i < entries.length; i++) {
      while (full.length < entries[i].offset) full += '\n';
      full += entries[i].node.textContent;
    }
    return { entries: entries, full: full };
  }

  // -- Check if selection is already fully highlighted --
  function isAlreadyHighlighted(range) {
    var container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
    // Entire range within a single highlight span
    if (container.closest && container.closest('.' + CLS)) return true;
    // Check every text node in range
    var walker = document.createTreeWalker(
      container, NodeFilter.SHOW_TEXT, null
    );
    var tn, found = false;
    while ((tn = walker.nextNode())) {
      if (!range.intersectsNode(tn)) continue;
      // Check if this text node's highlighted portion is non-empty
      var r = document.createRange();
      r.setStart(tn, tn === range.startContainer ? range.startOffset : 0);
      r.setEnd(tn, tn === range.endContainer ? range.endOffset : tn.textContent.length);
      if (r.toString().length === 0) continue;
      found = true;
      if (!tn.parentNode.closest('.' + CLS)) return false;
    }
    return found;
  }

  // -- Create highlight from current selection --
  function highlightSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

    var range = sel.getRangeAt(0);

    // Idempotent: skip if already fully highlighted
    if (isAlreadyHighlighted(range)) {
      sel.removeAllRanges();
      return;
    }

    var text = sel.toString();
    var id = uid();

    // Find ancestor for context storage
    var ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode;

    var aXPath = xpath(ancestor);
    var col = collectTextNodes(ancestor);
    var full = col.full;
    var idx = full.indexOf(text);
    // Fallback: try normalized match for cross-paragraph selections
    if (idx === -1) {
      var normText = text.replace(/\s+/g, ' ').trim();
      var normFull = full.replace(/\s+/g, ' ');
      var ni = normFull.indexOf(normText);
      if (ni >= 0) idx = ni;
    }
    var ctxBefore = idx >= 0 ? full.substring(Math.max(0, idx - 50), idx) : '';
    var ctxAfter = idx >= 0 ? full.substring(idx + text.length, idx + text.length + 50) : '';

    // Collect text nodes intersecting the range
    var container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    var tns = [];
    var tn;
    while ((tn = walker.nextNode())) {
      if (range.intersectsNode(tn)) tns.push(tn);
    }

    // Wrap each text node portion
    for (var i = 0; i < tns.length; i++) {
      var t = tns[i];
      var r = document.createRange();
      r.setStart(t, t === range.startContainer ? range.startOffset : 0);
      r.setEnd(t, t === range.endContainer ? range.endOffset : t.textContent.length);
      if (r.toString().length === 0) continue;

      var span = document.createElement('span');
      span.className = CLS;
      span.dataset.hid = id;
      try { r.surroundContents(span); }
      catch (e) {
        var frag = r.extractContents();
        span.appendChild(frag);
        r.insertNode(span);
      }
    }

    sel.removeAllRanges();

    // Save to storage
    var data = {
      id: id,
      text: text,
      xpath: aXPath,
      ctxBefore: ctxBefore,
      ctxAfter: ctxAfter,
      note: '',
      createdAt: new Date().toISOString()
    };
    var key = pageKey();
    chrome.storage.local.get([key], function (res) {
      var arr = res[key] || [];
      arr.push(data);
      chrome.storage.local.set({ [key]: arr }, function () {
        showNotePrompt(id, key);
      });
    });
  }

  // -- Re-apply a stored highlight --
  function applyStored(data) {
    var el = fromXPath(data.xpath);
    if (el && tryApply(el, data)) return true;
    return tryApply(document.body, data);
  }

  function tryApply(root, data) {
    var col = collectTextNodes(root);
    var entries = col.entries;
    var full = col.full;

    var best = -1;
    var endPos;

    // Strategy 1: exact match with context
    var search = 0;
    while (true) {
      var idx = full.indexOf(data.text, search);
      if (idx === -1) break;
      var before = full.substring(Math.max(0, idx - 50), idx);
      var after = full.substring(idx + data.text.length, idx + data.text.length + 50);
      if (best === -1) best = idx;
      if (ctxOk(before, data.ctxBefore) && ctxOk(after, data.ctxAfter)) { best = idx; break; }
      search = idx + 1;
    }
    if (best >= 0) {
      endPos = best + data.text.length;
    }

    // Strategy 2: normalized whitespace match
    if (best === -1) {
      var normText = data.text.replace(/\s+/g, ' ').trim();
      if (normText) {
        var normFull = '';
        var toOrig = [];
        var ws = false;
        for (var c = 0; c < full.length; c++) {
          if (/\s/.test(full[c])) {
            if (!ws && normFull.length > 0) {
              normFull += ' ';
              toOrig.push(c);
            }
            ws = true;
          } else {
            normFull += full[c];
            toOrig.push(c);
            ws = false;
          }
        }
        var ni = normFull.indexOf(normText);
        if (ni >= 0) {
          best = toOrig[ni];
          var lastNorm = ni + normText.length - 1;
          // Map end: find original position after last matched char
          if (lastNorm + 1 < toOrig.length) {
            endPos = toOrig[lastNorm + 1];
          } else {
            endPos = full.length;
          }
        }
      }
    }

    if (best === -1) return false;

    // Collect text nodes to wrap
    var toWrap = [];
    for (var j = 0; j < entries.length; j++) {
      var nd = entries[j];
      var nEnd = nd.offset + nd.node.textContent.length;
      if (nEnd <= best || nd.offset >= endPos) continue;
      toWrap.push({
        node: nd.node,
        start: Math.max(0, best - nd.offset),
        end: Math.min(nd.node.textContent.length, endPos - nd.offset)
      });
    }

    // Wrap in reverse order so earlier nodes aren't affected by splits
    for (var k = toWrap.length - 1; k >= 0; k--) {
      var wr = toWrap[k];
      var target = wr.node;
      if (wr.start > 0) target = target.splitText(wr.start);
      if (wr.end - wr.start < target.textContent.length) target.splitText(wr.end - wr.start);
      var span = document.createElement('span');
      span.className = CLS;
      span.dataset.hid = data.id;
      target.parentNode.insertBefore(span, target);
      span.appendChild(target);
    }

    return toWrap.length > 0;
  }

  function ctxOk(actual, expected) {
    if (!expected || expected.length < 5) return true;
    var snip = expected.slice(-15);
    return actual.includes(snip);
  }

  // -- Remove highlight from DOM --
  function removeFromDOM(id) {
    var spans = document.querySelectorAll('.' + CLS + '[data-hid="' + id + '"]');
    spans.forEach(function (span) {
      var p = span.parentNode;
      while (span.firstChild) p.insertBefore(span.firstChild, span);
      span.remove();
      p.normalize();
    });
  }

  // Remove from both DOM and storage
  function removeHighlight(id) {
    removeFromDOM(id);
    var key = pageKey();
    chrome.storage.local.get([key], function (res) {
      var arr = (res[key] || []).filter(function (h) { return h.id !== id; });
      chrome.storage.local.set({ [key]: arr });
    });
  }

  // -- Hover delete button --
  var activeDelBtn = null;
  var activeDelHid = null;

  function showDelete(hid) {
    if (activeDelHid === hid) return;
    hideDelete();
    var spans = document.querySelectorAll('.' + CLS + '[data-hid="' + hid + '"]');
    if (!spans.length) return;
    var last = spans[spans.length - 1];
    last.style.position = 'relative';
    var btn = document.createElement('span');
    btn.className = DEL_CLS;
    btn.textContent = '\u00d7';
    last.appendChild(btn);
    activeDelBtn = btn;
    activeDelHid = hid;
  }

  function hideDelete() {
    if (activeDelBtn && activeDelBtn.parentNode) {
      activeDelBtn.parentNode.removeChild(activeDelBtn);
    }
    activeDelBtn = null;
    activeDelHid = null;
  }

  document.addEventListener('mouseover', function (e) {
    var mark = e.target.closest('.' + CLS);
    if (mark) {
      showDelete(mark.dataset.hid);
      return;
    }
    if (e.target.closest('.' + DEL_CLS)) return;
    hideDelete();
  });

  document.addEventListener('click', function (e) {
    var del = e.target.closest('.' + DEL_CLS);
    if (!del) return;
    e.preventDefault();
    e.stopPropagation();
    var hid = activeDelHid;
    hideDelete();
    if (hid) removeHighlight(hid);
  }, true);

  // -- Load stored highlights --
  function load() {
    var key = pageKey();
    chrome.storage.local.get([key], function (res) {
      var arr = res[key] || [];
      var applied = new Set(
        Array.from(document.querySelectorAll('.' + CLS)).map(function (el) { return el.dataset.hid; })
      );
      for (var i = 0; i < arr.length; i++) {
        if (!applied.has(arr[i].id)) applyStored(arr[i]);
      }
    });
  }

  // -- Message listener --
  chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
    if (msg.action === 'highlight') {
      highlightSelection();
      reply({ ok: true });
    } else if (msg.action === 'remove') {
      removeFromDOM(msg.id);
      reply({ ok: true });
    }
    return false;
  });

  // -- Keyboard shortcut --
  var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  var shortcut = { key: 'e', ctrlKey: !isMac, shiftKey: true, altKey: false, metaKey: isMac };

  function matchesShortcut(e) {
    return e.key.toLowerCase() === shortcut.key
      && e.ctrlKey === shortcut.ctrlKey
      && e.shiftKey === shortcut.shiftKey
      && e.altKey === shortcut.altKey
      && e.metaKey === shortcut.metaKey;
  }

  document.addEventListener('keydown', function (e) {
    if (matchesShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      highlightSelection();
    }
  }, true);

  chrome.storage.local.get(['hltr_shortcut'], function (r) {
    if (r.hltr_shortcut) shortcut = r.hltr_shortcut;
  });

  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.hltr_shortcut) shortcut = changes.hltr_shortcut.newValue;
  });

  // -- Init --
  load();
})();
