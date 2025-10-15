
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

// Sube desde el chat list hasta encontrar un padre cuyo siguiente hermano sea el panel
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

// toggle + estilos inline 
let current = { sidebar: null, chat: null };
let hiddenState = false;
let mo = null;

function applyHidden(sidebar, chat) {
  if (!sidebar || !chat) return false;

  // Ocultar solo el sidebar especifico (panel de chats izquierdo)
  sidebar.style.transition = 'width .25s ease, max-width .25s ease, opacity .2s ease';
  sidebar.style.flex = '0 0 0';
  sidebar.style.width = '0';
  sidebar.style.maxWidth = '0';
  sidebar.style.minWidth = '0';
  sidebar.style.overflow = 'hidden';
  sidebar.style.opacity = '0';

  // Expandir el chat para ocupar el espacio del sidebar
  chat.style.transition = 'flex .25s ease, width .25s ease, max-width .25s ease';
  chat.style.flex = '1 1 100%';
  chat.style.width = '100%';
  chat.style.maxWidth = '100%';

  return true;
}

function clearHidden(sidebar, chat) {
  if (!sidebar || !chat) return;

  // Restaurar el sidebar
  sidebar.style.transition = '';
  sidebar.style.flex = '';
  sidebar.style.width = '';
  sidebar.style.maxWidth = '';
  sidebar.style.minWidth = '';
  sidebar.style.overflow = '';
  sidebar.style.opacity = '';

  // Restaurar el chat
  chat.style.transition = '';
  chat.style.flex = '';
  chat.style.width = '';
  chat.style.maxWidth = '';
}

function setHidden(nextHidden) {
  // redescubrir nodos en cada toggle por si wpp rearmo el DOM
  const sidebar = findSidebarContainer();
  const chat    = findChatContainer(sidebar);
  current = { sidebar, chat };

  if (!sidebar || !chat) {
    console.warn('[FixWpp] No se pudo encontrar sidebar/chat.');
    return;
  }

  if (nextHidden) applyHidden(sidebar, chat);
  else            clearHidden(sidebar, chat);

  hiddenState = nextHidden;
  chrome.storage.local.set({ sidebarHidden: hiddenState }).catch(() => {});
}

function toggleHidden() {
  setHidden(!hiddenState);
}

// sirve para el popup.
function computeHiddenState() {
  const sidebar = findSidebarContainer();
  if (!sidebar) return false;
  const cs = getComputedStyle(sidebar);
  const w  = sidebar.getBoundingClientRect().width;
  return cs.display === 'none' ||
         cs.maxWidth === '0px' ||
         cs.width === '0px' ||
         cs.flex.startsWith('0 0 0') ||
         cs.opacity === '0' ||
         w < 2;
}

// restaurar estado al cargar
(async function init() {
  try {
    const { sidebarHidden } = await chrome.storage.local.get('sidebarHidden');
    setHidden(!!sidebarHidden);
  } catch {
    setHidden(false);
  }

  // reaplicar si wpp rerenderiza
  if (mo) mo.disconnect();
  mo = new MutationObserver(() => {
    if (!hiddenState) return;
    const sidebar = findSidebarContainer();
    const chat    = findChatContainer(sidebar);
    if (!sidebar || !chat) return;
    if (sidebar !== current.sidebar || chat !== current.chat) {
      applyHidden(sidebar, chat);
      current = { sidebar, chat };
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();

// para saber si esta activo o no
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'WA_TOGGLE_SIDEBAR') {
    toggleHidden();
    sendResponse?.({ ok: true, hidden: computeHiddenState() });
    return true;
  }
  if (msg?.type === 'WA_GET_STATE') {
    sendResponse?.({ hidden: computeHiddenState() });
    return true;
  }
});

// Detecta si estamos en la vista de chats (lista de conversaciones visible)
function isInChatsView() {
  // Verificar el boton chats
  const chatsBtn = document.querySelector('button[aria-label="Chats"]');

  if (chatsBtn) {
    const isSelected = chatsBtn.getAttribute('data-navbar-item-selected') === 'true';
    console.log('[FixWpp Debug] Chats button selected:', isSelected);
    return isSelected;
  }

  // Fallback: verificar si otros botones estan seleccionados
  const allNavButtons = document.querySelectorAll('button[data-navbar-item-selected="true"]');
  console.log('[FixWpp Debug] Botones seleccionados:', allNavButtons);

  for (const btn of allNavButtons) {
    const label = btn.getAttribute('aria-label') || '';
    console.log('[FixWpp Debug] Botón activo:', label);
    if (label.includes('Status') || label.includes('Estados') ||
        label.includes('Communities') || label.includes('Comunidades') ||
        label.includes('Channels') || label.includes('Canales')) {
      return false;
    }
  }

  return true;
}

// Modifica el comportamiento del boton de Chats para toggle del panel lateral
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

  // Marcar como modificado para no volver a agregar el listener
  chatsBtn.dataset.fixwppModified = "true";

  console.log('[FixWpp] Botón de Chats interceptado:', chatsBtn);

  // Agregar el click listener
  chatsBtn.addEventListener("click", (e) => {
    const inChatsView = isInChatsView();
    console.log('[FixWpp] Click en Chats. inChatsView:', inChatsView);

    // Si NO estamos en la vista de chats (estamos en Status/Communities)
    if (!inChatsView) {
      console.log('[FixWpp] No estamos en Chat, permitir navegación normal');
      // Dejar que WhatsApp maneje el click normalmente para navegar a Chats
      return;
    }

    // Si YA estamos en Chats, hacer toggle del sidebar
    console.log('[FixWpp] Estamos en Chat, haciendo toggle');
    e.stopPropagation();
    e.preventDefault();
    toggleHidden();
  }, true); // usar capture para interceptar antes que WhatsApp

  chatsBtn.setAttribute("title", "Mostrar/Ocultar chats");
}

const sideObserver = new MutationObserver(() => {
  hijackChatsButton();
});
sideObserver.observe(document.body, { childList: true, subtree: true });

hijackChatsButton();