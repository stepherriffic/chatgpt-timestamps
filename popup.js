'use strict';
const FORMAT_KEY = 'my-chat-timestamps.format24';
const USER_ONLY_KEY = 'my-chat-timestamps.userOnly';
const format24 = document.getElementById('format24');
const userOnly = document.getElementById('userOnly');
const statusEl = document.getElementById('status');
let allowedTabId = null;

function isChatGptUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && (url.hostname === 'chatgpt.com' || url.hostname === 'chat.openai.com');
  } catch { return false; }
}

async function runOnTab(func, args = []) {
  const result = await chrome.scripting.executeScript({
    target: { tabId: allowedTabId },
    world: 'MAIN',
    func,
    args
  });
  return result[0]?.result;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isChatGptUrl(tab.url)) {
    statusEl.textContent = 'Switch to a ChatGPT tab to change settings.';
    format24.disabled = userOnly.disabled = true;
    return;
  }
  allowedTabId = tab.id;
  try {
    const settings = await runOnTab((formatKey, userKey) => ({
      format24: localStorage.getItem(formatKey) === 'true',
      userOnly: localStorage.getItem(userKey) !== 'false'
    }), [FORMAT_KEY, USER_ONLY_KEY]);
    format24.checked = settings?.format24 === true;
    userOnly.checked = settings?.userOnly !== false;
    statusEl.textContent = 'Changes apply immediately to this tab.';
  } catch {
    statusEl.textContent = 'Could not access this tab. Refresh ChatGPT and try again.';
    format24.disabled = userOnly.disabled = true;
  }
}

async function saveSettings() {
  if (allowedTabId === null) return;
  const settings = { format24: format24.checked, userOnly: userOnly.checked };
  try {
    await runOnTab((formatKey, userKey, prefs) => {
      localStorage.setItem(formatKey, String(prefs.format24));
      localStorage.setItem(userKey, String(prefs.userOnly));
      window.dispatchEvent(new CustomEvent('my-chat-timestamps:settings-changed', { detail: prefs }));
    }, [FORMAT_KEY, USER_ONLY_KEY, settings]);
    statusEl.textContent = 'Saved. Your messages stay in ChatGPT.';
  } catch {
    statusEl.textContent = 'Could not save. Refresh the ChatGPT tab and try again.';
  }
}
format24.addEventListener('change', saveSettings);
userOnly.addEventListener('change', saveSettings);
init();
