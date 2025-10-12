
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

function createSidebarButton() {
  if (document.getElementById("FixWpp-side-btn")) return;

  const referenceBtn = document.querySelector(
    'button[aria-label="Chats"], button[aria-label="Status"], button[aria-label="Communities"]'
  );
  if (!referenceBtn) return;

  // Buscar el wrapper del boton de referencia para insertar al mismo nivel
  const wrapper = referenceBtn.parentElement;
  const container = wrapper?.parentElement;
  if (!container) return;

  // Crear un wrapper similar al de los otros botones
  const btnWrapper = document.createElement("div");
  btnWrapper.id = "FixWpp-side-btn-wrapper";
  btnWrapper.style.cssText = wrapper.style.cssText; // Copiar estilos del wrapper de referencia

  const btn = document.createElement("button");
  btn.id = "FixWpp-side-btn";
  btn.setAttribute("title", "Mostrar/Ocultar chats");
  btn.setAttribute("aria-label", "Toggle sidebar");
  btn.style.width = "32px";
  btn.style.height = "32px";
  btn.style.margin = "6px auto";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.border = "none";
  btn.style.background = "transparent";
  btn.style.cursor = "pointer";
  btn.style.borderRadius = "50%";
  btn.style.padding = "0";
  btn.style.transition = "background-color .15s ease-out";

  // Hover effect
  btn.addEventListener("mouseenter", () => {
    btn.style.backgroundColor = "rgba(255,255,255,0.1)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.backgroundColor = "transparent";
  });

  btn.innerHTML = `
    <img src="${chrome.runtime.getURL("icons/panel-icon.png")}"
         alt="toggle sidebar"
         style="width:24px; height:24px;">
  `;

  btn.addEventListener("click", () => {
    toggleHidden();
  });

  btnWrapper.appendChild(btn);

  // Insertar al final del contenedor, debajo de los otros botones
  container.appendChild(btnWrapper);
}


const sideObserver = new MutationObserver(() => {
  createSidebarButton();
});
sideObserver.observe(document.body, { childList: true, subtree: true });

createSidebarButton();