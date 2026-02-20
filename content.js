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
  const css = document.createElement('style');
  css.textContent = [
    '.' + CLS + '{',
    'background-color:#fef08a!important;',
    'padding:0 1px!important;',
    'border-radius:2px!important;',
    'box-decoration-break:clone;',
    '-webkit-box-decoration-break:clone;',
    '}'
  ].join('');
  (document.head || document.documentElement).appendChild(css);

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
  function textNodesUnder(root) {
    var out = [];
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n, off = 0;
    while ((n = w.nextNode())) {
      out.push({ node: n, offset: off });
      off += n.textContent.length;
    }
    return out;
  }

  // -- Create highlight from current selection --
  function highlightSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

    var range = sel.getRangeAt(0);
    var text = sel.toString();
    var id = uid();

    // Find ancestor for context storage
    var ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode;

    var aXPath = xpath(ancestor);
    var full = ancestor.textContent;
    var idx = full.indexOf(text);
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
      createdAt: new Date().toISOString()
    };
    var key = pageKey();
    chrome.storage.local.get([key], function (res) {
      var arr = res[key] || [];
      arr.push(data);
      chrome.storage.local.set({ [key]: arr });
    });
  }

  // -- Re-apply a stored highlight --
  function applyStored(data) {
    var el = fromXPath(data.xpath);
    if (el && tryApply(el, data)) return true;
    return tryApply(document.body, data);
  }

  function tryApply(root, data) {
    var nodes = textNodesUnder(root);
    var full = '';
    for (var i = 0; i < nodes.length; i++) full += nodes[i].node.textContent;

    // Find best match using context
    var best = -1;
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
    if (best === -1) return false;

    var endPos = best + data.text.length;

    // Collect text nodes to wrap
    var toWrap = [];
    for (var j = 0; j < nodes.length; j++) {
      var nd = nodes[j];
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
      var w = toWrap[k];
      var target = w.node;
      if (w.start > 0) target = target.splitText(w.start);
      if (w.end - w.start < target.textContent.length) target.splitText(w.end - w.start);
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

  // -- Init --
  load();
})();
