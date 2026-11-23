/*
 * My Chat Timestamps: personal-use Chrome extension.
 * Adapted from Hangzhi/chatgpt-timestamp-extension (MIT License, copyright 2025 Hangzhi).
 * See LICENSE for attribution and license terms.
 * All work is local to the ChatGPT tab. No network calls, analytics, or conversation storage.
 */
(() => {
  'use strict';

  const initializedKey = Symbol.for('my-chat-timestamps.initialized');
  if (window[initializedKey]) return;
  window[initializedKey] = true;

  const FORMAT_KEY = 'my-chat-timestamps.format24';
  const USER_ONLY_KEY = 'my-chat-timestamps.userOnly';
  let use24HourFormat = localStorage.getItem(FORMAT_KEY) === 'true';
  let userOnly = localStorage.getItem(USER_ONLY_KEY) !== 'false';
  let updateScheduled = false;

  const own = (obj, key) => obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key)
    ? obj[key] : undefined;

  function conversationId() {
    return location.pathname.match(/\/c\/([^/?#]+)/)?.[1] ?? null;
  }

  function normalizeTimestamp(value) {
    if (value == null || value === '') return null;
    let time = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(time)) time = Date.parse(value) / 1000;
    else if (Math.abs(time) >= 1e12) time /= 1000;
    if (!Number.isFinite(time) || time <= 0) return null;
    return time;
  }

  function formatTimestamp(unixSeconds) {
    if (unixSeconds == null || !Number.isFinite(unixSeconds)) return '';
    const d = new Date(unixSeconds * 1000);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      hour12: !use24HourFormat
    }).format(d);
  }

  function createLabel(time) {
    const label = document.createElement('span');
    label.className = 'my-chat-timestamp';
    label.textContent = formatTimestamp(time);
    label.setAttribute('aria-label', 'Message sent ' + label.textContent);
    label.setAttribute('title', 'Message time in your local time zone');
    label.dir = 'ltr';
    label.style.cssText = [
      'display:block', 'width:fit-content', 'font-size:11px',
      'line-height:1.5', 'font-weight:500', 'opacity:.70',
      'margin-bottom:4px', 'color:inherit', 'text-align:left',
      'font-family:ui-monospace,SFMono-Regular,Consolas,monospace',
      'unicode-bidi:isolate', 'pointer-events:none'
    ].join(';');
    return label;
  }

  // Legacy ChatGPT UI: message metadata available on a React fiber ancestor.
  function legacyMessage(element) {
    const key = Object.keys(element).find(k => k.startsWith('__reactFiber$'));
    if (!key) return null;
    let fiber = element[key];
    for (let i = 0; fiber && i < 15; i++, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (props?.messages?.[0]?.create_time) return props.messages[0];
      if (props?.message?.create_time) return props.message;
    }
    return null;
  }

  function addLegacyTimestamp(container, messageDiv) {
    if (container.dataset.myChatTimestampAdded === 'yes') return;
    const message = legacyMessage(messageDiv);
    const timestamp = normalizeTimestamp(message?.create_time);
    if (timestamp === null || (userOnly && message?.author?.role !== 'user')) return;
    const label = createLabel(timestamp);
    if (!label.textContent) return;
    messageDiv.insertBefore(label, messageDiv.firstChild);
    container.dataset.myChatTimestampAdded = 'yes';
  }

  // New ChatGPT UI: resolve live metadata in the currently committed React tree.
  // This avoids guessing timestamps from render order or the time you open the tab.
  function committedFiber(domNode) {
    const key = Object.keys(domNode).find(k => k.startsWith('__reactFiber$'));
    if (!key) return null;
    const originalPath = [];
    const seen = new Set();
    let fiber = own(domNode, key);
    let root = null;
    for (let depth = 0; fiber && depth < 400; depth++) {
      if (seen.has(fiber)) return null;
      seen.add(fiber);
      originalPath.push(fiber);
      if (own(fiber, 'tag') === 3) {
        const state = own(fiber, 'stateNode');
        const current = own(state, 'current');
        if (current === fiber || current === own(fiber, 'alternate')) {
          root = { current }; break;
        }
      }
      fiber = own(fiber, 'return');
    }
    if (!root) return null;
    const path = [root.current];
    let parent = root.current;
    let work = 0;
    for (let i = originalPath.length - 2; i >= 0; i--) {
      const wanted = originalPath[i];
      const alternate = own(wanted, 'alternate');
      const siblingsSeen = new Set();
      const matches = [];
      let child = own(parent, 'child');
      for (let count = 0; child && count < 1024; count++) {
        if (++work > 4096 || siblingsSeen.has(child)) return null;
        siblingsSeen.add(child);
        if (child === wanted || child === alternate) matches.push(child);
        child = own(child, 'sibling');
      }
      if (child || matches.length !== 1) return null;
      parent = matches[0];
      path.push(parent);
    }
    const views = path.map(f => ({
      memoizedProps: own(f, 'memoizedProps'),
      memoizedState: own(f, 'memoizedState'),
      updateQueue: own(f, 'updateQueue'),
      return: null
    }));
    for (let i = 1; i < views.length; i++) views[i].return = views[i - 1];
    return views[views.length - 1];
  }

  function findTurnInfo(fiber, id) {
    const seen = new Set();
    for (let depth = 0; fiber && depth < 32; depth++, fiber = fiber.return) {
      if (seen.has(fiber)) return null;
      seen.add(fiber);
      const entry = own(fiber.memoizedProps, 'entry');
      const turn = own(entry, 'turn');
      const items = own(turn, 'items');
      if (!Array.isArray(items) || own(entry, 'conversationId') !== id) continue;
      if (typeof own(entry, 'id') !== 'string') return null;
      const userItems = items.filter(item => own(item, 'type') === 'user-message');
      if (userItems.length !== 1) return null;
      const userId = own(userItems[0], 'messageId') || own(userItems[0], 'serverMessageId');
      if (typeof userId !== 'string' || !userId) return null;
      return { entry, turn, items, userItem: userItems[0], userId };
    }
    return null;
  }

  function isSnapshot(obj) {
    return !!obj && typeof obj === 'object' && !Array.isArray(obj) &&
      Object.prototype.hasOwnProperty.call(obj, 'renderedConversation') &&
      Object.prototype.hasOwnProperty.call(obj, 'renderedTurns');
  }

  function liveSnapshot(fiber, info) {
    const candidates = [];
    let remaining = 2048;
    const collect = obj => { if (isSnapshot(obj)) candidates.push(obj); };
    const seenFibers = new Set();
    for (let depth = 0; fiber && depth < 400 && remaining > 0; depth++, fiber = fiber.return) {
      if (seenFibers.has(fiber)) return null;
      seenFibers.add(fiber);
      if (own(fiber.memoizedProps, 'conversationId') !== info.entry.conversationId) continue;
      let hook = fiber.memoizedState;
      const seenHooks = new Set();
      while (hook && remaining > 0) {
        if (seenHooks.has(hook)) return null;
        seenHooks.add(hook);
        remaining--;
        const state = own(hook, 'memoizedState');
        collect(state);
        if (Array.isArray(state)) collect(state[0]);
        hook = own(hook, 'next');
      }
      if (hook || remaining <= 0) break;
      const data = own(own(fiber.updateQueue, 'memoCache'), 'data');
      if (Array.isArray(data) && data.length <= 32) {
        for (const row of data) {
          if (!Array.isArray(row) || row.length > 1024) continue;
          for (const value of row) {
            if (--remaining <= 0) break;
            collect(value);
          }
          if (remaining <= 0) break;
        }
      }
    }
    const valid = [];
    for (const snapshot of candidates) {
      const rendered = own(snapshot, 'renderedConversation');
      const mapping = own(rendered, 'mapping');
      const turns = own(snapshot, 'renderedTurns');
      if (!mapping || typeof mapping !== 'object' || !Array.isArray(turns)) continue;
      const matching = turns.filter(t => own(t, 'id') === info.entry.id && own(t, 'turn') === info.turn);
      if (matching.length !== 1) continue;
      const userNode = own(mapping, info.userId);
      const userMessage = own(userNode, 'message');
      if (own(userNode, 'id') !== info.userId ||
          own(userMessage, 'id') !== info.userId ||
          own(own(userMessage, 'author'), 'role') !== 'user') continue;
      valid.push({ mapping, rendered });
    }
    if (!valid.length) return null;
    const mapping = valid[0].mapping;
    if (valid.some(v => v.mapping !== mapping)) return null;
    return mapping;
  }

  function semanticUnit(turn, role) {
    return turn.querySelector(`[data-chatgpt-search-unit-key$=":${role}"][data-chatgpt-search-message-ids]`);
  }

  function unitIds(unit) {
    return [...new Set((unit?.getAttribute('data-chatgpt-search-message-ids') || '').trim().split(/\s+/).filter(Boolean))];
  }

  function typedIds(item, role) {
    const keys = role === 'user' ? ['messageId', 'serverMessageId'] : ['messageId', 'latestMessageId'];
    return [...new Set(keys.map(k => own(item, k)).filter(x => typeof x === 'string' && x))];
  }

  function messageTimestamp(mapping, id, role) {
    const node = own(mapping, id);
    const msg = own(node, 'message');
    if (own(node, 'id') !== id || own(msg, 'id') !== id || own(own(msg, 'author'), 'role') !== role) return null;
    return normalizeTimestamp(own(msg, 'create_time'));
  }

  function resolveTimestamp(unit, info, mapping, role) {
    if (!unit) return null;
    const ids = unitIds(unit);
    if (!ids.length) return null;
    const typedItems = role === 'user'
      ? [info.userItem]
      : info.items.filter(item => own(item, 'type') === 'assistant-message');
    const selectedId = role === 'assistant'
      ? unit.querySelector('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id')
      : null;
    const candidates = [];
    for (const item of typedItems) {
      for (const id of typedIds(item, role).filter(id => ids.includes(id))) {
        const time = messageTimestamp(mapping, id, role);
        if (time === null) continue;
        candidates.push({ id, time, final: own(item, 'phase') === 'final_answer', selected: id === selectedId });
      }
    }
    if (!candidates.length) return null;
    const final = role === 'assistant' ? candidates.filter(c => c.final) : [];
    const preferred = final.length ? final : candidates;
    const selected = preferred.filter(c => c.selected);
    const chosen = selected.length ? selected : preferred;
    return new Set(chosen.map(c => c.id)).size === 1 ? chosen[0].time : null;
  }

  function insertIntoSurface(surface, role, time) {
    if (!surface || time == null || surface.querySelector(':scope > .my-chat-timestamp')) return;
    const label = createLabel(time);
    if (!label.textContent) return;
    surface.insertBefore(label, surface.firstChild);
  }

  function updateNewShell() {
    const id = conversationId();
    if (!id) return;
    const turns = document.querySelectorAll(
      '[data-app-shell-main-surface] [data-thread-find-target="conversation"] [data-turn-key]'
    );
    for (const turn of turns) {
      const userSurface = turn.querySelector('[data-user-message-bubble]');
      const assistantSurface = userOnly ? null : turn.querySelector('[data-markdown-text-style="assistant-message"]');
      const needsUser = userSurface && !userSurface.querySelector(':scope > .my-chat-timestamp');
      const needsAssistant = assistantSurface && !assistantSurface.querySelector(':scope > .my-chat-timestamp');
      if (!needsUser && !needsAssistant) continue;

      const fiber = committedFiber(turn);
      if (!fiber) continue;
      const info = findTurnInfo(fiber, id);
      if (!info) continue;
      const mapping = liveSnapshot(fiber, info);
      if (!mapping) continue;

      if (needsUser) insertIntoSurface(userSurface, 'user', resolveTimestamp(semanticUnit(turn, 'user'), info, mapping, 'user'));
      if (needsAssistant) insertIntoSurface(assistantSurface, 'assistant', resolveTimestamp(semanticUnit(turn, 'assistant'), info, mapping, 'assistant'));
    }
  }

  function updateLegacy() {
    document.querySelectorAll('section[data-turn-id]').forEach(section => {
      const messageDiv = section.querySelector('div[data-message-id]');
      if (messageDiv) addLegacyTimestamp(section, messageDiv);
    });
    // Older legacy pages sometimes use only data-message-id.
    if (!document.querySelector('section[data-turn-id]')) {
      document.querySelectorAll('div[data-message-id]').forEach(div => addLegacyTimestamp(div, div));
    }
  }

  function refreshAll() {
    document.querySelectorAll('.my-chat-timestamp').forEach(node => node.remove());
    document.querySelectorAll('[data-my-chat-timestamp-added]').forEach(node => delete node.dataset.myChatTimestampAdded);
    render();
  }

  function render() {
    updateLegacy();
    updateNewShell();
  }

  // Debounce mutation churn in lengthy chats. No fetches or polling of network data.
  function scheduleRender() {
    if (updateScheduled) return;
    updateScheduled = true;
    setTimeout(() => {
      updateScheduled = false;
      render();
    }, 350);
  }

  window.addEventListener('my-chat-timestamps:settings-changed', event => {
    // Only settings booleans are read; never message text.
    if (event.detail && typeof event.detail === 'object') {
      use24HourFormat = event.detail.format24 === true;
      userOnly = event.detail.userOnly !== false;
      refreshAll();
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== FORMAT_KEY && event.key !== USER_ONLY_KEY) return;
    use24HourFormat = localStorage.getItem(FORMAT_KEY) === 'true';
    userOnly = localStorage.getItem(USER_ONLY_KEY) !== 'false';
    refreshAll();
  });

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
  else scheduleRender();
  setInterval(scheduleRender, 12000);
})();
