
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

// Devuelve false cuando el contexto de la extension ya no es valido (ej: tras recargar)
function isContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function saveState(value) {
  if (!isContextValid()) return;
  try {
    chrome.storage.local.set({ sidebarHidden: value });
  } catch {}
}

function findSidebarContainer() {
  const list = $(CHAT_LIST_QS);
  if (!list) return null;

  let node = list;
  while (node && node !== document.body) {
    const parent = node.parentElement;
    if (!parent) break;
    const sib = parent.nextElementSibling;
    if (sib && $(CHAT_PANEL_QS, sib)) {
      return parent;
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
  return $(CHAT_PANEL_QS);
}

// Retorna los elementos hermanos entre sidebar y chat (divisores, separadores, etc.)
function findDividers(sidebar, chat) {
  const dividers = [];
  if (!sidebar || !chat) return dividers;
  let sib = sidebar.nextElementSibling;
  while (sib && sib !== chat) {
    dividers.push(sib);
    sib = sib.nextElementSibling;
  }
  return dividers;
}

let current = { sidebar: null, chat: null, dividers: [] };
let hiddenState = false;

function applyHidden(sidebar, chat, dividers) {
  if (!sidebar || !chat) return false;

  const parent = sidebar.parentElement;

  sidebar.style.transition = 'width .25s ease, max-width .25s ease, opacity .2s ease';
  sidebar.style.flex = '0 0 0';
  sidebar.style.width = '0';
  sidebar.style.maxWidth = '0';
  sidebar.style.minWidth = '0';
  sidebar.style.overflow = 'hidden';
  sidebar.style.opacity = '0';
  sidebar.style.border = 'none';
  sidebar.style.boxShadow = 'none';

  // Eliminar gap del contenedor flex padre (causa mas comun de la linea residual)
  if (parent) {
    parent.style.gap = '0';
    parent.style.columnGap = '0';
  }

  // Eliminar border-left del panel de chat
  chat.style.borderLeft = 'none';

  for (const d of dividers) {
    d.style.display = 'none';
  }

  chat.style.transition = 'flex .25s ease, width .25s ease, max-width .25s ease';
  chat.style.flex = '1 1 100%';
  chat.style.width = '100%';
  chat.style.maxWidth = '100%';

  return true;
}

function clearHidden(sidebar, chat, dividers) {
  if (!sidebar || !chat) return;

  const parent = sidebar.parentElement;

  sidebar.style.transition = '';
  sidebar.style.flex = '';
  sidebar.style.width = '';
  sidebar.style.maxWidth = '';
  sidebar.style.minWidth = '';
  sidebar.style.overflow = '';
  sidebar.style.opacity = '';
  sidebar.style.border = '';
  sidebar.style.boxShadow = '';

  if (parent) {
    parent.style.gap = '';
    parent.style.columnGap = '';
  }

  chat.style.borderLeft = '';

  for (const d of dividers) {
    d.style.display = '';
  }

  chat.style.transition = '';
  chat.style.flex = '';
  chat.style.width = '';
  chat.style.maxWidth = '';
}

function setHidden(nextHidden) {
  // Guardar la intencion primero — el MutationObserver la aplica cuando el DOM este listo
  hiddenState = nextHidden;
  saveState(hiddenState);

  const sidebar  = findSidebarContainer();
  const chat     = findChatContainer(sidebar);
  const dividers = findDividers(sidebar, chat);
  current = { sidebar, chat, dividers };

  if (!sidebar || !chat) return;

  if (nextHidden) applyHidden(sidebar, chat, dividers);
  else            clearHidden(sidebar, chat, dividers);
}

function toggleHidden() {
  setHidden(!hiddenState);
}

// Detecta si el boton Chats esta seleccionado
function isInChatsView() {
  const chatsBtn = document.querySelector('button[aria-label="Chats"]');
  if (!chatsBtn) return false;
  return chatsBtn.getAttribute('data-navbar-item-selected') === 'true';
}

function hijackChatsButton() {
  const selectors = [
    'button[aria-label="Chats"]',
    'button[title="Chats"]',
    'header button[aria-label*="Chat"]'
  ];

  let chatsBtn = null;
  for (const selector of selectors) {
    chatsBtn = document.querySelector(selector);
    if (chatsBtn && !chatsBtn.dataset.fixwppModified) break;
  }

  if (!chatsBtn || chatsBtn.dataset.fixwppModified) return;

  chatsBtn.dataset.fixwppModified = "true";

  chatsBtn.addEventListener("click", (e) => {
    if (!isInChatsView()) return;
    e.stopPropagation();
    e.preventDefault();
    toggleHidden();
  }, true);

  chatsBtn.setAttribute("title", "Mostrar/Ocultar chats");
}

// Observer unico: re-aplica estado y re-hijackea boton (con debounce)
let hijackTimer = null;
const domObserver = new MutationObserver(() => {
  // Si el contexto de la extension ya no es valido, desconectar y salir
  if (!isContextValid()) {
    domObserver.disconnect();
    return;
  }

  if (hiddenState) {
    const sidebar  = findSidebarContainer();
    const chat     = findChatContainer(sidebar);
    const dividers = findDividers(sidebar, chat);
    if (sidebar && chat && (sidebar !== current.sidebar || chat !== current.chat)) {
      applyHidden(sidebar, chat, dividers);
      current = { sidebar, chat, dividers };
    }
  }

  clearTimeout(hijackTimer);
  hijackTimer = setTimeout(hijackChatsButton, 300);
});

domObserver.observe(document.body, { childList: true, subtree: true });

// Restaurar estado al cargar
(async function init() {
  try {
    const { sidebarHidden } = await chrome.storage.local.get('sidebarHidden');
    setHidden(!!sidebarHidden);
  } catch {
    setHidden(false);
  }

  hijackChatsButton();
})();

try {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'WA_TOGGLE_SIDEBAR') {
      toggleHidden();
      sendResponse?.({ ok: true, hidden: hiddenState });
      return true;
    }
    if (msg?.type === 'WA_GET_STATE') {
      sendResponse?.({ hidden: hiddenState });
      return true;
    }
  });
} catch {}
