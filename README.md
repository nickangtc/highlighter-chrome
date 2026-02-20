# Highlighter

A personal Chrome extension for highlighting text on any webpage. Highlights persist across sessions.

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Use

- Select text and press **Cmd+Shift+E** (Mac) or **Ctrl+Shift+E** (Windows/Linux)
- Hover a highlight and click the **x** to delete it
- Click the extension icon to see all highlights for the current page
- Change the shortcut from the popup

## How it works

Highlights are stored in `chrome.storage.local` keyed by page URL (origin + pathname). On page load, stored highlights are re-applied by searching for the text in the DOM using context matching. Cross-paragraph highlights use block-boundary-aware text matching with a normalized whitespace fallback.
