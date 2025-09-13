
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
  if (!chat) return false;

  // Expandir el chat
  chat.style.transition = 'flex .25s ease, width .25s ease, max-width .25s ease';
  chat.style.flex = '1 1 100%';
  chat.style.width = '100%';
  chat.style.maxWidth = '100%';

  const container = chat.parentElement;
  if (!container) return true;

  for (const child of container.children) {
    if (child === chat) continue; // no ocultar chat

    // mantiene visible la barra de iconos
    if (child.querySelector('button[aria-label="Chats"]')) continue;

    // Colapsar cualquier otro panel lateral
    child.style.transition = 'width .25s ease, max-width .25s ease, opacity .2s ease';
    child.style.flex = '0 0 0';
    child.style.width = '0';
    child.style.maxWidth = '0';
    child.style.minWidth = '0';
    child.style.overflow = 'hidden';
    child.style.opacity = '0';
  }

  return true;
}

function clearHidden(sidebar, chat) {
  if (!chat) return;

  const container = chat.parentElement;
  if (!container) return;

  for (const child of container.children) {
    // restaurar todos
    child.style.transition = '';
    child.style.flex = '';
    child.style.width = '';
    child.style.maxWidth = '';
    child.style.minWidth = '';
    child.style.overflow = '';
    child.style.opacity = '';
    child.style.display = '';
  }
}

function setHidden(nextHidden) {
  // redescubrir nodos en cada toggle por si wpp rearmo el DOM
  const sidebar = findSidebarContainer();
  const chat    = findChatContainer(sidebar);
  current = { sidebar, chat };

  if (!sidebar || !chat) {
    console.warn('[HideWPP] No se pudo encontrar sidebar/chat.');
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

  // reaplicar si wpp re-renderiza
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

function createSidebarButton() {
  if (document.getElementById("hidewpp-side-btn")) return;

  const referenceBtn = document.querySelector(
    'button[aria-label="Chats"], button[aria-label="Status"], button[aria-label="Communities"]'
  );
  if (!referenceBtn) return;

  const container = referenceBtn.parentElement?.parentElement;
  if (!container) return;

  // boton
  const btn = document.createElement("button");
  btn.id = "hidewpp-side-btn";
  btn.setAttribute("title", "Mostrar/Ocultar chats");
  btn.style.width = "18px";          
  btn.style.height = "18px";
  btn.style.margin = "6px auto";     
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.border = "none";
  btn.style.background = "transparent";
  btn.style.cursor = "pointer";
  btn.style.borderRadius = "50%";
  btn.style.color = "white";
  btn.style.padding = "0";
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
      <rect x="3" y="4" width="7" height="16" rx="1"></rect>
      <rect x="14" y="4" width="7" height="16" rx="1"></rect>
    </svg>
  `;

  btn.addEventListener("click", () => {
    toggleHidden();
  });

  container.appendChild(btn);
}

const sideObserver = new MutationObserver(() => {
  createSidebarButton();
});
sideObserver.observe(document.body, { childList: true, subtree: true });

createSidebarButton();