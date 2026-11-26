const { app, BrowserWindow, ipcMain, Menu, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function readTenantConfig() {
  try {
    const cfgPath = path.join(__dirname, 'tenant.config.json');
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
  } catch {
    // Ignorar errores de lectura de configuración embebida
  }
  return {};
}

const tenantCfg = readTenantConfig();
const BASE_URL = (
  process.env.VORA_DESKTOP_BASE_URL ||
  tenantCfg.baseUrl ||
  'https://vora-weld-mu.vercel.app'
).replace(/\/+$/, '');
const TENANT_SLUG = String(process.env.VORA_TENANT_SLUG || tenantCfg.slug || '')
  .trim()
  .toLowerCase();
const TENANT_NAME = String(process.env.VORA_TENANT_NAME || tenantCfg.name || '').trim();
const APP_URL = (
  process.env.VORA_DESKTOP_URL ||
  tenantCfg.appUrl ||
  (TENANT_SLUG ? `${BASE_URL}/t/${TENANT_SLUG}/login` : BASE_URL)
).replace(/\/+$/, '');
const APP_TITLE = TENANT_NAME ? `VORA · ${TENANT_NAME}` : 'VORA · Sistema Comercial y POS';

if (TENANT_SLUG) {
  app.setName(`vora-${TENANT_SLUG}`);
  app.setPath('userData', path.join(app.getPath('appData'), 'VORA', TENANT_SLUG));
  if (process.platform === 'win32') {
    app.setAppUserModelId(`com.venesoftca.vora.desktop.${TENANT_SLUG}`);
  }
}

const ICON_PATH = path.join(__dirname, 'build', 'icon.png');
const OFFLINE_PAGE = path.join(__dirname, 'offline.html');

const TRUSTED_HOST_SUFFIXES = ['vercel.app', 'vora.venesoftca.com', 'localhost', '127.0.0.1'];

function getStateFile() {
  return path.join(app.getPath('userData'), 'vora-desktop-state.json');
}

function readDesktopState() {
  try {
    const raw = fs.readFileSync(getStateFile(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeDesktopState(patch) {
  try {
    const next = { ...readDesktopState(), ...patch };
    fs.writeFileSync(getStateFile(), JSON.stringify(next), 'utf8');
  } catch {
    // Ignorar error de escritura en disco
  }
}

function isTrustedAppUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'file:') return true;
    const host = parsed.hostname.toLowerCase();
    return TRUSTED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

function isPosShellUrl(rawUrl) {
  try {
    if (!isTrustedAppUrl(rawUrl)) return false;
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'file:') return false;
    const match = parsed.pathname.match(/^\/t\/([^/]+)\/pos\/?$/i);
    if (!match) return false;
    if (TENANT_SLUG && match[1].toLowerCase() !== TENANT_SLUG) return false;
    return true;
  } catch {
    return false;
  }
}

function isWrongTenantUrl(rawUrl) {
  if (!TENANT_SLUG) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'file:') return false;
    const match = parsed.pathname.match(/^\/t\/([^/]+)(?:\/|$)/i);
    if (match && match[1].toLowerCase() !== TENANT_SLUG) return true;
    return false;
  } catch {
    return false;
  }
}

let mainWindow = null;
let customerWindow = null;
let lastCustomerPayload = null;
let triedOfflinePosFallback = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: APP_TITLE,
    icon: ICON_PATH,
    backgroundColor: '#F6F2E9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.maximize();
    mainWindow.show();
  });

  const recordPosUrl = (url) => {
    if (isPosShellUrl(url)) {
      triedOfflinePosFallback = false;
      writeDesktopState({ lastPosUrl: url });
    }
  };
  mainWindow.webContents.on('did-navigate', (_e, url) => recordPosUrl(url));
  mainWindow.webContents.on('did-navigate-in-page', (_e, url) => recordPosUrl(url));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isWrongTenantUrl(url)) {
      event.preventDefault();
      void mainWindow.loadURL(APP_URL);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _errDesc, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // Ignorar abortos de navegación normal
    if (validatedUrl && validatedUrl.startsWith('file://')) return;

    const state = readDesktopState();
    const lastPosUrl = state.lastPosUrl;
    if (
      lastPosUrl &&
      isPosShellUrl(lastPosUrl) &&
      !triedOfflinePosFallback &&
      validatedUrl !== lastPosUrl
    ) {
      // Si el inicio hacia APP_URL falla sin internet, intentamos abrir el último POS cacheado por el Service Worker.
      triedOfflinePosFallback = true;
      void mainWindow.loadURL(lastPosUrl);
      return;
    }

    mainWindow.loadFile(OFFLINE_PAGE, { query: { url: APP_URL } });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedAppUrl(url)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        icon: ICON_PATH,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      },
    };
  });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.control && input.key.toLowerCase() === 'r') {
      triedOfflinePosFallback = false;
      mainWindow.reload();
    }
  });

  mainWindow.on('closed', () => {
    if (customerWindow && !customerWindow.isDestroyed()) {
      customerWindow.close();
    }
    mainWindow = null;
  });

  void mainWindow.loadURL(APP_URL);
}

function getSecondaryDisplay() {
  const primary = screen.getPrimaryDisplay();
  const all = screen.getAllDisplays();
  return all.find((d) => d.id !== primary.id) || null;
}

function openOrFocusCustomerWindow(targetUrl) {
  if (!isTrustedAppUrl(targetUrl)) {
    return { ok: false, onExternalDisplay: false };
  }

  const external = getSecondaryDisplay();
  const targetDisplay = external || screen.getPrimaryDisplay();
  const { x, y, width, height } = targetDisplay.workArea;

  if (customerWindow && !customerWindow.isDestroyed()) {
    if (external) {
      customerWindow.setBounds({ x, y, width, height });
      customerWindow.maximize();
    }
    if (customerWindow.webContents.getURL() !== targetUrl) {
      void customerWindow.loadURL(targetUrl);
    }
    customerWindow.focus();
    if (lastCustomerPayload) {
      customerWindow.webContents.send('vora:customer-display-state', lastCustomerPayload);
    }
    return { ok: true, onExternalDisplay: Boolean(external) };
  }

  customerWindow = new BrowserWindow({
    x: external ? x : undefined,
    y: external ? y : undefined,
    width: external ? width : 1120,
    height: external ? height : 760,
    title: 'VORA · Pantalla del Cliente',
    icon: ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: '#F6F5F0',
    fullscreen: Boolean(external),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  customerWindow.webContents.once('did-finish-load', () => {
    if (customerWindow && !customerWindow.isDestroyed() && lastCustomerPayload) {
      customerWindow.webContents.send('vora:customer-display-state', lastCustomerPayload);
    }
  });

  customerWindow.on('closed', () => {
    customerWindow = null;
  });

  void customerWindow.loadURL(targetUrl);
  return { ok: true, onExternalDisplay: Boolean(external) };
}

ipcMain.handle('vora:get-displays', () => {
  const all = screen.getAllDisplays();
  const external = getSecondaryDisplay();
  return { count: all.length, hasExternal: Boolean(external) };
});

ipcMain.handle('vora:open-customer-display', (_event, url) => {
  return openOrFocusCustomerWindow(String(url || APP_URL));
});

ipcMain.handle('vora:close-customer-display', () => {
  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.close();
  }
});

ipcMain.on('vora:customer-display-sync', (_event, payload) => {
  lastCustomerPayload = payload;
  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.webContents.send('vora:customer-display-state', payload);
  }
});

ipcMain.handle('vora:get-printers', async (event) => {
  try {
    const printers = await event.sender.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: Boolean(p.isDefault),
    }));
  } catch {
    return [];
  }
});

ipcMain.handle('vora:print-silent', (event, options = {}) => {
  return new Promise((resolve) => {
    const webContents = event.sender;
    const silent = options?.silent !== false;
    webContents.print(
      {
        silent,
        printBackground: true,
        ...(options?.deviceName ? { deviceName: String(options.deviceName) } : {}),
      },
      (success, failureReason) => {
        if (success) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: failureReason || 'Error de impresión' });
        }
      },
    );
  });
});

ipcMain.handle('vora:retry-load', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    triedOfflinePosFallback = false;
    void mainWindow.loadURL(APP_URL);
  }
});

ipcMain.handle('vora:open-last-pos', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const state = readDesktopState();
    if (state.lastPosUrl && isPosShellUrl(state.lastPosUrl)) {
      triedOfflinePosFallback = true;
      void mainWindow.loadURL(state.lastPosUrl);
    }
  }
});

ipcMain.handle('vora:get-desktop-info', () => {
  const state = readDesktopState();
  const safeLastPosUrl =
    state.lastPosUrl && isPosShellUrl(state.lastPosUrl) ? state.lastPosUrl : null;
  return {
    version: app.getVersion(),
    lastPosUrl: safeLastPosUrl,
    tenantSlug: TENANT_SLUG || null,
    tenantName: TENANT_NAME || null,
    appUrl: APP_URL,
  };
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
