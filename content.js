
const CHAT_LIST_QS = [
  '[data-testid="chat-list"]',
  '[data-testid="chat-list-panel"]',
  '[aria-label="Chat list"]',
  '[aria-label="Lista de chats"]',
  '[role="grid"]'
];

const CHAT_PANEL_QS = [
  '#main',
  '[data-testid="conversation-panel-wrapper"]',
  '[data-testid="conversation-panel"]',
  '[aria-label="Message list"]'
];

function $(qsArr, root = document) {
  for (const q of qsArr) {
    const el = root.querySelector(q);
    if (el) return el;
  }
  return null;
}

// sube desde el chat list hasta encontrar un padre cuyo siguiente hermano sea el panel de conversacion.
function findSidebarContainer() {
  const list = $(CHAT_LIST_QS);
  if (!list) return null;

  let node = list;
  while (node && node !== document.body) {
    const parent = node.parentElement;
    if (!parent) break;  // candidato: su siguiente hermano contiene el chat panel
    const sib = parent.nextElementSibling;
    if (sib && $(CHAT_PANEL_QS, sib)) {
      return parent; // ESTE es el wrapper del sidebar que necesitamos colapsar
    }
    node = parent;
  }
  return null;
}

function findChatContainer(sidebarContainer) {
  if (!sidebarContainer) return null;
  let sib = sidebarContainer.nextElementSibling;
  while (sib) {
    if ($(CHAT_PANEL_QS, sib)) return sib;
    sib = sib.nextElementSibling;
  }
  // fallback global
  return $(CHAT_PANEL_QS);
}

// toggle + estilos inline 

let current = { sidebar: null, chat: null, container: null };
let hiddenState = false;
let mo = null;

function applyHidden(sidebar, chat) {
  if (!sidebar || !chat) return false;

  // transiciones suaves
  sidebar.style.transition = 'width .25s ease, max-width .25s ease, opacity .2s ease';
  chat.style.transition    = 'flex .25s ease, width .25s ease, max-width .25s ease';

  // colapsar sidebar por completo
  sidebar.style.display   = 'block';                    
  sidebar.style.flex      = '0 0 0';
  sidebar.style.width     = '0';
  sidebar.style.maxWidth  = '0';
  sidebar.style.minWidth  = '0';
  sidebar.style.overflow  = 'hidden';
  sidebar.style.opacity   = '0';

  // expandir chat
  chat.style.flex         = '1 1 100%';
  chat.style.width        = '100%';
  chat.style.maxWidth     = '100%';

  return true;
}

function clearHidden(sidebar, chat) {
  if (!sidebar || !chat) return;

  for (const el of [sidebar, chat]) {
    el.style.transition = '';
    el.style.flex = '';
    el.style.width = '';
    el.style.maxWidth = '';
    el.style.minWidth = '';
    el.style.overflow = '';
    el.style.opacity = '';
    el.style.display = '';
  }
}

function setHidden(nextHidden) {
  // redescubrir nodos en cada toggle por si wpp rearmo el DOM
  const sidebar = findSidebarContainer();
  const chat    = findChatContainer(sidebar);

  current = { sidebar, chat, container: sidebar?.parentElement || null };

  if (!sidebar || !chat) {
    console.warn('[WA Hider] No se pudo encontrar sidebar/chat.');
    return;
  }

  if (nextHidden) {
    applyHidden(sidebar, chat);
  } else {
    clearHidden(sidebar, chat);
  }

  hiddenState = nextHidden;
  chrome.storage.local.set({ sidebarHidden: hiddenState }).catch(() => {});
}

function toggleHidden() {
  setHidden(!hiddenState);
}

// restaurar estado al cargar
(async function init() {
  try {
    const { sidebarHidden } = await chrome.storage.local.get('sidebarHidden');
    setHidden(!!sidebarHidden);
  } catch {
    setHidden(false);
  }

  // reaplicar si wpp re-renderiza
  if (mo) mo.disconnect();
  mo = new MutationObserver(() => {
    if (!hiddenState) return;
    const sidebar = findSidebarContainer();
    const chat    = findChatContainer(sidebar);
    if (!sidebar || !chat) return;
    if (sidebar !== current.sidebar || chat !== current.chat) {
      applyHidden(sidebar, chat);
      current = { sidebar, chat, container: sidebar?.parentElement || null };
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();

// mensajes desde popup/atajo
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'WA_TOGGLE_SIDEBAR') {
    toggleHidden();
    sendResponse?.({ ok: true, hidden: hiddenState });
    return true;
  }
});
