const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  screen,
  session,
  shell,
  dialog,
  globalShortcut,
  nativeImage,
  nativeTheme,
  clipboard,
  desktopCapturer
} = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/**
 * Eski "edge-kenar-cubugu" kullanıcı verilerini (ayarlar, özel genişlikler ve WhatsApp oturumu/çerezleri)
 * yeni "zen-side" dizinine hiçbir veri kaybı olmadan tek seferlik taşır.
 */
function copyDirBestEffort(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (/^(lockfile|Singleton)/i.test(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    try {
      if (entry.isDirectory()) {
        copyDirBestEffort(srcPath, destPath);
      } else if (entry.isFile() && !fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch {
      // Kilitli geçici önbellek dosyalarını yoksay
    }
  }
}

function migrateLegacyUserDataIfNeeded() {
  try {
    const newDir = app.getPath('userData');
    const legacyDir = path.join(app.getPath('appData'), 'edge-kenar-cubugu');
    const legacyConfig = path.join(legacyDir, 'sidebar-config.json');
    const newConfig = path.join(newDir, 'sidebar-config.json');

    if (legacyDir !== newDir && fs.existsSync(legacyConfig) && !fs.existsSync(newConfig)) {
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }
      fs.copyFileSync(legacyConfig, newConfig);
      copyDirBestEffort(path.join(legacyDir, 'custom-icons'), path.join(newDir, 'custom-icons'));
      copyDirBestEffort(path.join(legacyDir, 'Partitions'), path.join(newDir, 'Partitions'));
    }
  } catch (err) {
    console.warn('[Migration] Eski veri taşıma uyarısı:', err.message);
  }
}

migrateLegacyUserDataIfNeeded();

const store = require('./store');
const appBar = require('./win32-appbar');
const adblock = require('./adblock');

const MIN_RAIL_WIDTH = 22;
const MAX_RAIL_WIDTH = 160;
const HANDLE_WIDTH = 4;
const HANDLE_HEIGHT = 110;
const HANDLE_UNREAD_WIDTH = 20;
const HANDLE_UNREAD_HEIGHT = 56;
const MAX_CLIPBOARD_ITEMS = 30;

let mainWindow = null;
let snipWindow = null;
let tray = null;
let isQuitting = false;
let ignoreBlurCount = 0;
let cursorWatchTimer = null;
let clipboardWatchTimer = null;
let outsideTicks = 0;
let edgeHoverTicks = 0;
let wasMouseDown = false;
let lastOutsideCloseAt = 0;

// Pano Geçmişi Durumu (Son 30 Kopyalanan Metin/Link)
let clipboardHistory = [];
let clipboardPaused = false;
let lastSeenClipboardText = '';

// Reklam Engelleyici Sayaç Senkronlayıcı
let pendingAdblockPersist = 0;
let adblockNotifyTimer = null;

let unreadSummary = {
  total: 0,
  badgeText: '',
  details: '',
  topSiteId: null
};

let uiWindowState = {
  mode: 'rail', // 'handle' | 'rail' | 'expanded'
  railWidth: MIN_RAIL_WIDTH,
  panelWidth: 420,
  handleYRatio: 0.38,
  modalOpen: false,
  isDragging: false
};

const chromeVer = process.versions.chrome || '134.0.0.0';
const DESKTOP_EDGE_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36 Edg/${chromeVer}`;
const MOBILE_EDGE_UA = `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Mobile Safari/537.36 EdgA/${chromeVer}`;

// Tek örnek kilidi (uygulama iki kez açılırsa mevcut Zen Side penceresini öne getirir)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      sendEventToRenderer({ type: 'toggle-sidebar', forceOpen: true });
    }
  });
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

let isApplyingGeometry = false;
let geometryResyncTimer = null;

/**
 * Seçili hedef monitörü döner (monitör çıkarılmışsa ana ekrana güvenli biçimde düşer)
 */
function getTargetDisplay() {
  const { settings } = store.get();
  const all = screen.getAllDisplays();
  if (settings.displayId !== null && settings.displayId !== undefined) {
    const found = all.find((d) => String(d.id) === String(settings.displayId));
    if (found) return found;
  }
  return screen.getPrimaryDisplay();
}

function getDisplaysInfoList() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, idx) => ({
    id: d.id,
    isPrimary: d.id === primaryId,
    label: `${idx + 1}. Monitör (${d.bounds.width}×${d.bounds.height}${d.id === primaryId ? ' • Ana' : ''})`,
    width: d.bounds.width,
    height: d.bounds.height,
    workAreaHeight: d.workArea.height
  }));
}

function isEffectiveDark(settings) {
  if (settings.glassTint === 'ios-pearl') return false;
  if (settings.theme === 'light') return false;
  if (settings.theme === 'dark') return true;
  return nativeTheme.shouldUseDarkColors;
}

function syncWindowMaterial() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { settings } = store.get();
  const dark = isEffectiveDark(settings);
  const rounded = uiWindowState.mode === 'handle';
  appBar.applyBackdropMaterial(mainWindow, settings.material || 'acrylic', dark, rounded);
}

function setExactBoundsWithResync(display, dipBounds) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const keepTopmost = uiWindowState.mode === 'expanded' || !appBar.inFullscreenApp;
  appBar.setExactWindowBoundsDip(mainWindow, display, dipBounds, keepTopmost);
  clearTimeout(geometryResyncTimer);
  if (!uiWindowState.isDragging) {
    geometryResyncTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const stillTopmost = uiWindowState.mode === 'expanded' || !appBar.inFullscreenApp;
        appBar.setExactWindowBoundsDip(mainWindow, display, dipBounds, stillTopmost);
      }
    }, 55);
  }
}

function sendEventToRenderer(payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('sidebar:event', payload);
  }
}

/**
 * Yüksek çözünürlüklü 32x32 Zen Side İkon Üreticisi (BGRA Bitmap)
 * hasUnread=true olduğunda sağ üst köşede parlak zümrüt bildirim rozeti çizer.
 */
function createSidebarIcon(hasUnread = false) {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      if (hasUnread) {
        const bDist = Math.hypot(x - 25.5, y - 6.5);
        if (bDist <= 5.2) {
          if (bDist > 3.9) {
            buf[idx] = 255;
            buf[idx + 1] = 255;
            buf[idx + 2] = 255;
            buf[idx + 3] = 255;
          } else {
            buf[idx] = 115;     // B
            buf[idx + 1] = 215; // G
            buf[idx + 2] = 16;  // R (#10d773 parlak zümrüt bildirim noktası)
            buf[idx + 3] = 255;
          }
          continue;
        }
      }

      const left = 2, top = 2, right = 29, bottom = 29, r = 7;
      let inside = x >= left && x <= right && y >= top && y <= bottom;
      if (inside) {
        let cx = x, cy = y;
        if (x < left + r) cx = left + r;
        else if (x > right - r) cx = right - r;
        if (y < top + r) cy = top + r;
        else if (y > bottom - r) cy = bottom - r;

        const dist = Math.hypot(x - cx, y - cy);
        if (dist > r + 0.5) inside = false;
      }

      if (!inside) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Zen Side indigo-camgöbeği gradyan (BGRA sırası)
      const t = (x + y) / (size * 2);
      let red = Math.round(35 + t * 65);
      let green = Math.round(95 + t * 105);
      let blue = Math.round(235 + t * 20);

      if (x >= 20 && x <= 26 && y >= 6 && y <= 25) {
        const isDot =
          (x >= 22 && x <= 24 && ((y >= 8 && y <= 10) || (y >= 14 && y <= 16) || (y >= 20 && y <= 22)));
        if (isDot) {
          red = 255; green = 255; blue = 255;
        } else {
          red = Math.round(red * 0.55);
          green = Math.round(green * 0.55);
          blue = Math.round(blue * 0.65);
        }
      } else if (x >= 7 && x <= 17 && y >= 8 && y <= 23) {
        red = Math.min(255, red + 55);
        green = Math.min(255, green + 55);
        blue = Math.min(255, blue + 35);
      }

      buf[idx] = blue;
      buf[idx + 1] = green;
      buf[idx + 2] = red;
      buf[idx + 3] = 255;
    }
  }

  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

/**
 * URL'yi doğrudan Microsoft Edge içinde (yoksa varsayılan tarayıcıda) açar
 */
function openUrlExternal(url, preferEdge = true) {
  if (!url || !/^https?:\/\//i.test(url)) return;

  if (preferEdge && process.platform === 'win32') {
    const candidates = [
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe')
    ];
    for (const exePath of candidates) {
      if (exePath && fs.existsSync(exePath)) {
        try {
          const child = spawn(exePath, [url], { detached: true, stdio: 'ignore' });
          child.unref();
          return;
        } catch (_e) {
          // Varsayılan tarayıcıya düş
        }
      }
    }
  }

  shell.openExternal(url);
}

/**
 * Oturumları (Session) yapılandırır: temiz Edge User-Agent, izinler ve Dahili Reklam Engelleyici
 */
const configuredPartitions = new Set();
function configurePartitionSession(partitionName) {
  if (configuredPartitions.has(partitionName)) return;
  configuredPartitions.add(partitionName);

  const sess = session.fromPartition(partitionName);
  sess.setUserAgent(DESKTOP_EDGE_UA);

  const majorVer = chromeVer.split('.')[0] || '134';
  sess.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    if (headers['User-Agent'] && headers['User-Agent'].includes('Electron')) {
      headers['User-Agent'] = DESKTOP_EDGE_UA;
    }
    headers['sec-ch-ua'] = `"Microsoft Edge";v="${majorVer}", "Chromium";v="${majorVer}", "Not:A-Brand";v="24"`;
    callback({ requestHeaders: headers });
  });

  // Dahili Reklam ve İzleyici Engelleyici Bağlantısı
  adblock.attachToSession(
    sess,
    () => Boolean(store.get().settings.adblockEnabled),
    (sessionBlockedCount) => {
      pendingAdblockPersist++;
      if (!adblockNotifyTimer) {
        adblockNotifyTimer = setTimeout(() => {
          adblockNotifyTimer = null;
          const curTotal = (Number(store.get().settings.adblockTotalBlocked) || 0) + pendingAdblockPersist;
          pendingAdblockPersist = 0;
          store.updateSettings({ adblockTotalBlocked: curTotal });
          sendEventToRenderer({
            type: 'adblock-stats',
            sessionBlocked: sessionBlockedCount,
            totalBlocked: curTotal
          });
        }, 1200);
      }
    }
  );

  sess.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = [
      'notifications',
      'clipboard-read',
      'clipboard-sanitized-write',
      'media',
      'fullscreen',
      'geolocation',
      'pointerLock'
    ];
    callback(allowed.includes(permission));
  });
}

/**
 * Pano Geçmişi İzleyici (0-RAM Mini Araçlar Pano Modülü İçin Son 30 Kaydı Tutar)
 */
function startClipboardWatcher() {
  if (clipboardWatchTimer) return;
  try {
    const initial = (clipboard.readText() || '').trim();
    if (initial && initial.length <= 20000) {
      lastSeenClipboardText = initial;
      clipboardHistory.push({ text: initial, time: Date.now() });
    }
  } catch {}

  clipboardWatchTimer = setInterval(() => {
    if (clipboardPaused || isQuitting) return;
    try {
      const current = (clipboard.readText() || '').trim();
      if (!current || current === lastSeenClipboardText || current.length > 20000) return;
      lastSeenClipboardText = current;

      clipboardHistory = [
        { text: current, time: Date.now() },
        ...clipboardHistory.filter((item) => item.text !== current)
      ].slice(0, MAX_CLIPBOARD_ITEMS);

      sendEventToRenderer({
        type: 'clipboard-updated',
        items: clipboardHistory
      });
    } catch {
      // Kilitli pano erişiminde yoksay
    }
  }, 900);
}

/**
 * Ekran Görüntüsü Kırp & Yapay Zekaya Sor / WhatsApp'a Gönder (Quick Snip)
 */
async function startQuickSnip() {
  if (snipWindow && !snipWindow.isDestroyed()) {
    snipWindow.focus();
    return false;
  }
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  const display = getTargetDisplay();
  const scale = display.scaleFactor || 1;
  const physW = Math.max(320, Math.round(display.bounds.width * scale));
  const physH = Math.max(240, Math.round(display.bounds.height * scale));

  ignoreBlurCount++;
  try {
    // Kenar çubuğu kırpılacak görüntüyü kapatmasın diye yakalama anında saydamlaştır
    mainWindow.setOpacity(0);
    await new Promise((r) => setTimeout(r, 70));

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physW, height: physH }
    });

    mainWindow.setOpacity(1);

    if (!sources || sources.length === 0) {
      ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
      return false;
    }

    const matched =
      sources.find((s) => String(s.display_id) === String(display.id)) ||
      sources[0];
    const screenshotDataUrl = matched.thumbnail.toDataURL();

    // Kullanıcının mevcut AI ve Mesajlaşma sekmelerinden hızlı gönderim hedefleri üret
    const { sites } = store.get();
    const targets = [];
    sites.forEach((s) => {
      if (targets.length >= 3) return;
      if (/gemini|chatgpt|openai|claude|copilot|perplexity|deepseek/i.test(`${s.url} ${s.name}`)) {
        targets.push({ id: s.id, label: `${s.name}'ye Sor`, emoji: '✨', kind: 'ai' });
      } else if (/whatsapp|telegram|discord|slack|messenger/i.test(`${s.url} ${s.name}`)) {
        targets.push({ id: s.id, label: `${s.name}'a Gönder`, emoji: '💬', kind: 'chat' });
      }
    });

    snipWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      thickFrame: false,
      resizable: false,
      movable: false,
      fullscreen: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#050811',
      webPreferences: {
        preload: path.join(__dirname, 'snip-preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    snipWindow.setAlwaysOnTop(true, 'screen-saver');
    snipWindow.loadFile(path.join(__dirname, 'snip.html'));

    snipWindow.webContents.once('did-finish-load', () => {
      if (!snipWindow || snipWindow.isDestroyed()) return;
      snipWindow.webContents.send('snip:init', {
        screenshotDataUrl,
        targets
      });
      snipWindow.show();
      snipWindow.focus();
    });

    snipWindow.on('closed', () => {
      snipWindow = null;
      setTimeout(() => {
        ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
      }, 220);
    });

    return true;
  } catch (err) {
    try { mainWindow.setOpacity(1); } catch {}
    ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
    console.warn('[QuickSnip] Ekran yakalanamadı:', err.message);
    return false;
  }
}

/**
 * Pencere konum ve boyutunu aktif moda, seçili monitöre, ekran kenarına ve AppBar durumuna göre hesaplar
 */
function applyWindowGeometry() {
  if (!mainWindow || mainWindow.isDestroyed() || isApplyingGeometry) return;
  isApplyingGeometry = true;
  try {
    applyWindowGeometryInner();
  } finally {
    isApplyingGeometry = false;
  }
}

function applyWindowGeometryInner() {
  const { settings } = store.get();
  const display = getTargetDisplay();
  const edge = settings.edge === 'left' ? 'left' : 'right';
  const mode = uiWindowState.mode || 'rail';

  const cleanPhys = appBar.getCleanMonitorWorkAreaPhys(display);
  const scale = display.scaleFactor || 1;
  const cleanTopDip = Math.round(cleanPhys.top / scale);
  const cleanHeightDip = Math.round((cleanPhys.bottom - cleanPhys.top) / scale);

  // 1) Otomatik Gizle Tutamacı Modu
  if (mode === 'handle') {
    if (appBar.registered || appBar.usingSpiFallback) {
      appBar.unregister(display);
    }
    const baseLeft = display.bounds.x;
    const baseRight = display.bounds.x + display.bounds.width;
    const hasUnread = unreadSummary.total > 0;
    const width = hasUnread ? HANDLE_UNREAD_WIDTH : HANDLE_WIDTH;
    const height = hasUnread ? HANDLE_UNREAD_HEIGHT : HANDLE_HEIGHT;
    const x = edge === 'left' ? baseLeft : (baseRight - width);
    const ratio = clamp(uiWindowState.handleYRatio ?? settings.handleYRatio ?? 0.38, 0.05, 0.92);
    const y = cleanTopDip + Math.round((cleanHeightDip - height) * ratio);

    setExactBoundsWithResync(display, { x, y, width, height });
    syncWindowMaterial();
    updateCursorWatcher();
    return;
  }

  // 2) Şerit Modu (minimum 22px, isteğe bağlı genişletilebilir) veya Açık Panel (panelWidth + railWidth)
  const rWidth = clamp(uiWindowState.railWidth || settings.railWidth || MIN_RAIL_WIDTH, MIN_RAIL_WIDTH, MAX_RAIL_WIDTH);
  const maxPanel = Math.max(280, Math.floor(display.bounds.width * 0.78) - rWidth);
  const pWidth = clamp(uiWindowState.panelWidth || settings.panelWidth || 420, 280, maxPanel);
  const totalWidth = mode === 'expanded' ? (pWidth + rWidth) : rWidth;

  if (mode === 'expanded') {
    appBar.ensureTopmost(mainWindow);
  }

  if (settings.dockReserve && !settings.autoHide && appBar.isSupported() && !uiWindowState.isDragging) {
    const reserveWidth = rWidth;
    const reservedRect = appBar.setBounds(mainWindow, display, edge, reserveWidth);

    if (reservedRect) {
      const x = edge === 'left'
        ? reservedRect.x
        : (reservedRect.x + reservedRect.width - totalWidth);

      setExactBoundsWithResync(display, {
        x,
        y: reservedRect.y,
        width: totalWidth,
        height: reservedRect.height
      });
      syncWindowMaterial();
      updateCursorWatcher();
      return;
    }
  } else if ((!settings.dockReserve || settings.autoHide) && (appBar.registered || appBar.usingSpiFallback)) {
    appBar.unregister(display);
  }

  const x = edge === 'left'
    ? display.bounds.x
    : (display.bounds.x + display.bounds.width - totalWidth);

  setExactBoundsWithResync(display, {
    x,
    y: cleanTopDip,
    width: totalWidth,
    height: cleanHeightDip
  });
  syncWindowMaterial();
  updateCursorWatcher();
}

/**
 * Tam Ekran Kenarı Yaklaşma Sensörü + Otomatik Gizleme + Dışarı Tıklayınca Otomatik Sekme Kapatma Denetleyicisi
 */
function updateCursorWatcher() {
  const { settings } = store.get();
  const watchAutoHide =
    Boolean(settings.autoHide) &&
    (uiWindowState.mode === 'handle' || (uiWindowState.mode === 'rail' && !uiWindowState.modalOpen));
  const watchOutsideClick =
    uiWindowState.mode === 'expanded' && !settings.isPinned && !uiWindowState.modalOpen;
  const shouldWatch = watchAutoHide || watchOutsideClick;

  if (!shouldWatch) {
    if (cursorWatchTimer) {
      clearInterval(cursorWatchTimer);
      cursorWatchTimer = null;
    }
    outsideTicks = 0;
    edgeHoverTicks = 0;
    wasMouseDown = false;
    return;
  }

  if (cursorWatchTimer) return;
  outsideTicks = 0;
  edgeHoverTicks = 0;
  wasMouseDown = appBar.isMouseButtonDown();

  cursorWatchTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const curSettings = store.get().settings;
    const mode = uiWindowState.mode;

    const canAutoHide =
      Boolean(curSettings.autoHide) &&
      (mode === 'handle' || (mode === 'rail' && !uiWindowState.modalOpen));
    const canOutsideClose =
      mode === 'expanded' && !curSettings.isPinned && !uiWindowState.modalOpen;

    if (!canAutoHide && !canOutsideClose) {
      updateCursorWatcher();
      return;
    }

    const isDown = appBar.isMouseButtonDown();
    const justPressed = isDown && !wasMouseDown;
    wasMouseDown = isDown;

    const pt = screen.getCursorScreenPoint();

    // 3) AÇIK SEKME MODU -> Boş bir yere veya arka plandaki sayfaya tıklanınca otomatik kapatma
    if (mode === 'expanded') {
      outsideTicks = 0;
      edgeHoverTicks = 0;
      if (curSettings.isPinned || uiWindowState.modalOpen || uiWindowState.isDragging || ignoreBlurCount > 0) {
        return;
      }
      if (justPressed) {
        const b = mainWindow.getBounds();
        const pad = 2;
        const clickedOutside =
          pt.x < b.x - pad ||
          pt.x > b.x + b.width + pad ||
          pt.y < b.y - pad ||
          pt.y > b.y + b.height + pad;

        if (clickedOutside) {
          setTimeout(() => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            if (uiWindowState.mode !== 'expanded') return;
            const latestSettings = store.get().settings;
            if (latestSettings.isPinned || uiWindowState.modalOpen || uiWindowState.isDragging || ignoreBlurCount > 0) {
              return;
            }
            if (appBar.isOwnedPopupForeground(mainWindow)) return;
            lastOutsideCloseAt = Date.now();
            sendEventToRenderer({ type: 'outside-clicked' });
          }, 20);
        }
      }
      return;
    }

    const display = getTargetDisplay();
    const edge = curSettings.edge === 'left' ? 'left' : 'right';
    const cleanPhys = appBar.getCleanMonitorWorkAreaPhys(display);
    const scale = display.scaleFactor || 1;
    const topDip = Math.round(cleanPhys.top / scale);
    const bottomDip = Math.round(cleanPhys.bottom / scale);

    // 1) GİZLİ MOD -> Tam kenar boyunca yaklaşma algılama
    if (mode === 'handle') {
      outsideTicks = 0;
      if (appBar.inFullscreenApp || isDown) {
        edgeHoverTicks = 0;
        return;
      }

      const inVerticalZone = pt.y >= (topDip + 44) && pt.y <= (bottomDip - 8);
      const nearActiveEdge = edge === 'left'
        ? (pt.x >= display.bounds.x - 4 && pt.x <= display.bounds.x + 8)
        : (pt.x >= display.bounds.x + display.bounds.width - 8 && pt.x <= display.bounds.x + display.bounds.width + 4);

      if (inVerticalZone && nearActiveEdge) {
        edgeHoverTicks++;
        if (edgeHoverTicks >= 3) {
          edgeHoverTicks = 0;
          appBar.ensureTopmost(mainWindow);
          sendEventToRenderer({ type: 'auto-hide-reveal' });
        }
      } else {
        edgeHoverTicks = 0;
      }
      return;
    }

    // 2) ŞERİT MODU -> Fare uzaklaştığında otomatik gizleme
    if (mode === 'rail') {
      edgeHoverTicks = 0;
      if (ignoreBlurCount > 0 || uiWindowState.isDragging || isDown) {
        outsideTicks = 0;
        return;
      }

      const rWidth = clamp(
        uiWindowState.railWidth || curSettings.railWidth || MIN_RAIL_WIDTH,
        MIN_RAIL_WIDTH,
        MAX_RAIL_WIDTH
      );
      const padX = 30;
      const nearRailX = edge === 'left'
        ? (pt.x <= display.bounds.x + rWidth + padX)
        : (pt.x >= display.bounds.x + display.bounds.width - rWidth - padX);
      const nearRailY = pt.y >= (topDip - 14) && pt.y <= (bottomDip + 14);

      if (nearRailX && nearRailY) {
        outsideTicks = 0;
      } else {
        outsideTicks++;
        if (outsideTicks >= 11) {
          outsideTicks = 0;
          sendEventToRenderer({ type: 'auto-hide-collapse' });
        }
      }
    }
  }, 45);
}

function registerGlobalHotkeys() {
  globalShortcut.unregisterAll();
  const { settings } = store.get();

  if (settings.hotkey && settings.hotkey.trim()) {
    try {
      globalShortcut.register(settings.hotkey.trim(), () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
        sendEventToRenderer({ type: 'toggle-sidebar' });
      });
    } catch (err) {
      console.warn('[Hotkey] Ana kısayol kaydedilemedi:', err.message);
    }
  }

  if (settings.snipHotkey && settings.snipHotkey.trim()) {
    try {
      globalShortcut.register(settings.snipHotkey.trim(), () => {
        startQuickSnip();
      });
    } catch (err) {
      console.warn('[Hotkey] Ekran kırpma kısayolu kaydedilemedi:', err.message);
    }
  }
}

function buildTrayMenu() {
  if (!tray) return;
  const { settings, workspaces } = store.get();
  const displays = getDisplaysInfoList();
  const targetDisp = getTargetDisplay();

  const workspaceItems = (workspaces || []).map((ws) => ({
    label: `${ws.badge} ${ws.name}`,
    type: 'radio',
    checked: (settings.activeWorkspace || 'all') === ws.id,
    click: () => {
      const updated = store.updateSettings({ activeWorkspace: ws.id });
      sendEventToRenderer({ type: 'config-updated', config: updated });
      buildTrayMenu();
    }
  }));

  const monitorItems = displays.map((d) => ({
    label: d.label,
    type: 'radio',
    checked: targetDisp.id === d.id,
    click: () => {
      const prevDisp = getTargetDisplay();
      if (prevDisp.id !== d.id) {
        appBar.unregister(prevDisp);
      }
      const updated = store.updateSettings({ displayId: d.isPrimary ? null : d.id });
      applyWindowGeometry();
      sendEventToRenderer({ type: 'config-updated', config: updated });
      buildTrayMenu();
    }
  }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Zen Side Göster / Gizle',
      click: () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
        sendEventToRenderer({ type: 'toggle-sidebar' });
      }
    },
    {
      label: '✂️ Ekran Görüntüsü Kırp & Gönder',
      accelerator: settings.snipHotkey || 'Alt+Shift+S',
      click: () => startQuickSnip()
    },
    {
      label: '🧰 Yerleşik Mini Araçlar (Notlar / Pano / Hesap / Pomodoro)',
      click: () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
        sendEventToRenderer({ type: 'open-tools-panel' });
      }
    },
    {
      label: 'Yeni Site Ekle (+)',
      click: () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
        sendEventToRenderer({ type: 'open-add-modal' });
      }
    },
    { type: 'separator' },
    {
      label: 'Çalışma Alanı (Profil)',
      submenu: workspaceItems
    },
    ...(displays.length > 1
      ? [{ label: 'Hedef Monitör', submenu: monitorItems }]
      : []),
    {
      label: `🛡️ Reklam & İzleyici Engelleyici (${settings.adblockTotalBlocked || 0} engellendi)`,
      type: 'checkbox',
      checked: Boolean(settings.adblockEnabled),
      click: (item) => {
        const updated = store.updateSettings({ adblockEnabled: item.checked });
        sendEventToRenderer({ type: 'config-updated', config: updated });
        buildTrayMenu();
      }
    },
    {
      label: 'Pencereler Yanında Dursun (Altında Kalmasın)',
      type: 'checkbox',
      checked: Boolean(settings.dockReserve),
      enabled: appBar.isSupported(),
      click: (item) => {
        const updated = store.updateSettings({ dockReserve: item.checked });
        applyWindowGeometry();
        sendEventToRenderer({ type: 'config-updated', config: updated });
        buildTrayMenu();
      }
    },
    {
      label: 'Boş Yere / Sayfaya Tıklayınca Sekmeyi Kapat',
      type: 'checkbox',
      checked: !settings.isPinned,
      click: (item) => {
        const updated = store.updateSettings({ isPinned: !item.checked });
        updateCursorWatcher();
        sendEventToRenderer({ type: 'config-updated', config: updated });
        buildTrayMenu();
      }
    },
    {
      label: 'Otomatik Kenara Gizle',
      type: 'checkbox',
      checked: Boolean(settings.autoHide),
      click: (item) => {
        const updated = store.updateSettings({ autoHide: item.checked });
        sendEventToRenderer({ type: 'config-updated', config: updated });
        buildTrayMenu();
      }
    },
    {
      label: 'Sekme Görünümü',
      submenu: [
        {
          label: 'Sadece İsim (Varsayılan)',
          type: 'radio',
          checked: (settings.railDisplayMode || 'text') === 'text',
          click: () => {
            const updated = store.updateSettings({ railDisplayMode: 'text' });
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        },
        {
          label: 'Sadece Simge',
          type: 'radio',
          checked: settings.railDisplayMode === 'icon',
          click: () => {
            const updated = store.updateSettings({ railDisplayMode: 'icon' });
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        },
        {
          label: 'Simge + İsim',
          type: 'radio',
          checked: settings.railDisplayMode === 'both',
          click: () => {
            const updated = store.updateSettings({ railDisplayMode: 'both' });
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        }
      ]
    },
    {
      label: 'Arka Plan Sekmelerini Şimdi Uyut (RAM Boşalt)',
      click: () => {
        sendEventToRenderer({ type: 'sleep-all-inactive' });
      }
    },
    {
      label: 'Cam / Mica Efekti',
      submenu: [
        {
          label: 'iOS Buzlu Cam (Acrylic Blur)',
          type: 'radio',
          checked: (settings.material || 'acrylic') === 'acrylic',
          click: () => {
            const updated = store.updateSettings({ material: 'acrylic' });
            syncWindowMaterial();
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        },
        {
          label: 'Windows 11 Mica',
          type: 'radio',
          checked: settings.material === 'mica',
          click: () => {
            const updated = store.updateSettings({ material: 'mica' });
            syncWindowMaterial();
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        },
        {
          label: 'Windows 11 Mica Alt',
          type: 'radio',
          checked: settings.material === 'tabbed',
          click: () => {
            const updated = store.updateSettings({ material: 'tabbed' });
            syncWindowMaterial();
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        },
        {
          label: 'Klasik Mat',
          type: 'radio',
          checked: settings.material === 'none',
          click: () => {
            const updated = store.updateSettings({ material: 'none' });
            syncWindowMaterial();
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        }
      ]
    },
    {
      label: 'Ekran Kenarı',
      submenu: [
        {
          label: 'Sağ Kenar',
          type: 'radio',
          checked: settings.edge !== 'left',
          click: () => {
            const updated = store.updateSettings({ edge: 'right' });
            applyWindowGeometry();
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        },
        {
          label: 'Sol Kenar',
          type: 'radio',
          checked: settings.edge === 'left',
          click: () => {
            const updated = store.updateSettings({ edge: 'left' });
            applyWindowGeometry();
            sendEventToRenderer({ type: 'config-updated', config: updated });
            buildTrayMenu();
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Ayarlar',
      click: () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
        sendEventToRenderer({ type: 'open-settings-modal' });
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        isQuitting = true;
        appBar.unregister(getTargetDisplay());
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function createMainWindow() {
  const { settings, sites } = store.load();

  configurePartitionSession('persist:edge-sidebar');
  sites.forEach((s) => {
    if (s.isolatedSession) {
      configurePartitionSession(`persist:edge-site-${s.id}`);
    }
  });

  uiWindowState.railWidth = clamp(settings.railWidth || MIN_RAIL_WIDTH, MIN_RAIL_WIDTH, MAX_RAIL_WIDTH);
  uiWindowState.panelWidth = settings.panelWidth || 420;
  uiWindowState.handleYRatio = settings.handleYRatio ?? 0.38;
  uiWindowState.mode = settings.autoHide ? 'handle' : 'rail';

  const icon = createSidebarIcon();
  const initDisplay = getTargetDisplay();
  const initX = settings.edge === 'left'
    ? initDisplay.bounds.x
    : (initDisplay.bounds.x + initDisplay.bounds.width - uiWindowState.railWidth);

  mainWindow = new BrowserWindow({
    title: 'Zen Side',
    x: initX,
    y: initDisplay.workArea.y,
    width: uiWindowState.railWidth,
    height: initDisplay.workArea.height,
    show: false,
    minWidth: 4,
    minHeight: 40,
    frame: false,
    thickFrame: false,
    transparent: false,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: Boolean(settings.skipTaskbar),
    hasShadow: true,
    backgroundColor: '#00000000',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: true
    }
  });

  mainWindow.setMinimumSize(4, 40);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  syncWindowMaterial();

  if (process.platform === 'win32' && appBar.isSupported()) {
    const cbMsg = appBar.getCallbackMessage();
    if (cbMsg) {
      mainWindow.hookWindowMessage(cbMsg, (wParamBuf, lParamBuf) => {
        const wParam = wParamBuf.readUInt32LE(0);
        const lParam = lParamBuf.readUInt32LE(0);
        if (wParam === 1) {
          applyWindowGeometry();
        } else if (wParam === 2) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (lParam !== 0 && uiWindowState.mode !== 'expanded') {
              // Tam ekran kontrolünü watchdog doğrular
            } else {
              appBar.ensureTopmost(mainWindow);
            }
          }
        }
      });
    }
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    syncWindowMaterial();
    applyWindowGeometry();
    appBar.ensureTopmost(mainWindow);
    startClipboardWatcher();
    appBar.startWatchdog((isFullscreen) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (isFullscreen && uiWindowState.mode !== 'expanded') {
          mainWindow.setAlwaysOnTop(false);
        } else {
          appBar.ensureTopmost(mainWindow);
        }
      }
    });
  });

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed() && (uiWindowState.mode === 'expanded' || !appBar.inFullscreenApp)) {
      appBar.ensureTopmost(mainWindow);
    }
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (ignoreBlurCount > 0 || uiWindowState.isDragging) return;
      if (appBar.isForeground(mainWindow)) return;
      if (uiWindowState.mode === 'expanded' && !store.get().settings.isPinned && !uiWindowState.modalOpen) {
        lastOutsideCloseAt = Date.now();
      }
      sendEventToRenderer({ type: 'window-blurred' });
    }, 20);
  });

  mainWindow.on('close', () => {
    if (!isQuitting) {
      appBar.unregister(getTargetDisplay());
    }
  });

  // Sistem Tepsisi (Tray)
  tray = new Tray(icon);
  tray.setToolTip('Zen Side');
  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (Date.now() - lastOutsideCloseAt < 350) return;
    mainWindow.show();
    mainWindow.focus();
    sendEventToRenderer({ type: 'toggle-sidebar' });
  });
  buildTrayMenu();

  // Global Kısayollar
  registerGlobalHotkeys();

  const onDisplaysChanged = () => {
    if (!appBar.isUpdatingWorkArea) {
      applyWindowGeometry();
      buildTrayMenu();
      const disp = getTargetDisplay();
      sendEventToRenderer({
        type: 'displays-updated',
        displays: getDisplaysInfoList(),
        screenInfo: {
          width: disp.bounds.width,
          height: disp.bounds.height,
          workAreaHeight: disp.workArea.height
        }
      });
    }
  };
  screen.on('display-metrics-changed', onDisplaysChanged);
  screen.on('display-added', onDisplaysChanged);
  screen.on('display-removed', onDisplaysChanged);
}

/**
 * Webview içindeki OAuth giriş pencerelerini ve Türkçe sağ tık menüsünü yönetir
 */
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview') return;

  contents.setWindowOpenHandler(({ url, frameName, features, disposition }) => {
    const { settings } = store.get();
    const isAuthOrPopup =
      Boolean(features && (features.includes('width') || features.includes('height'))) ||
      /accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com|appleid\.apple\.com|oauth|auth|signin|login/i.test(url) ||
      url === 'about:blank' ||
      (frameName && frameName !== '_blank');

    if (isAuthOrPopup || disposition === 'new-window') {
      ignoreBlurCount++;
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          center: true,
          autoHideMenuBar: true,
          alwaysOnTop: true,
          title: 'Giriş Yap - Zen Side',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      };
    }

    openUrlExternal(url, settings.openLinksInEdge);
    return { action: 'deny' };
  });

  contents.on('did-create-window', (childWin) => {
    childWin.on('closed', () => {
      setTimeout(() => {
        ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
      }, 200);
    });
  });

  contents.on('context-menu', (_e, params) => {
    const menuTemplate = [];

    if (params.isEditable) {
      menuTemplate.push(
        { label: 'Geri Al', role: 'undo', enabled: params.editFlags.canUndo },
        { label: 'Yinele', role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { label: 'Kes', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Kopyala', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Yapıştır', role: 'paste', enabled: params.editFlags.canPaste },
        { label: 'Tümünü Seç', role: 'selectAll' },
        { type: 'separator' }
      );
    } else if (params.selectionText) {
      menuTemplate.push(
        { label: 'Kopyala', role: 'copy' },
        {
          label: `"${params.selectionText.slice(0, 24)}${params.selectionText.length > 24 ? '…' : ''}" için Edge'de Ara`,
          click: () => openUrlExternal(`https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`, true)
        },
        { type: 'separator' }
      );
    }

    if (params.linkURL) {
      menuTemplate.push(
        {
          label: 'Bağlantıyı Bu Sekmede Aç',
          click: () => contents.loadURL(params.linkURL)
        },
        {
          label: 'Bağlantıyı Zen Side\'a Sabitle (+)',
          click: () => {
            sendEventToRenderer({
              type: 'pin-url-to-sidebar',
              url: params.linkURL,
              title: params.linkText || ''
            });
          }
        },
        {
          label: 'Bağlantıyı Microsoft Edge\'de Aç',
          click: () => openUrlExternal(params.linkURL, true)
        },
        {
          label: 'Bağlantı Adresini Kopyala',
          click: () => clipboard.writeText(params.linkURL)
        },
        { type: 'separator' }
      );
    }

    if (params.srcURL && params.mediaType === 'image') {
      menuTemplate.push(
        {
          label: 'Görseli Edge\'de Aç',
          click: () => openUrlExternal(params.srcURL, true)
        },
        {
          label: 'Görsel Adresini Kopyala',
          click: () => clipboard.writeText(params.srcURL)
        },
        { type: 'separator' }
      );
    }

    menuTemplate.push(
      {
        label: 'Geri',
        enabled: contents.navigationHistory ? contents.navigationHistory.canGoBack() : contents.canGoBack(),
        click: () => contents.goBack()
      },
      {
        label: 'İleri',
        enabled: contents.navigationHistory ? contents.navigationHistory.canGoForward() : contents.canGoForward(),
        click: () => contents.goForward()
      },
      {
        label: 'Sayfayı Yenile',
        click: () => contents.reload()
      },
      { type: 'separator' },
      {
        label: 'Bu Sayfayı Microsoft Edge\'de Aç',
        click: () => openUrlExternal(contents.getURL(), true)
      },
      {
        label: 'Bu Sayfayı Zen Side\'a Sabitle (+)',
        click: () => {
          sendEventToRenderer({
            type: 'pin-url-to-sidebar',
            url: contents.getURL(),
            title: contents.getTitle()
          });
        }
      },
      { type: 'separator' },
      {
        label: 'Öğeyi İncele (Geliştirici Araçları)',
        click: () => contents.inspectElement(params.x, params.y)
      }
    );

    ignoreBlurCount++;
    let menuClosed = false;
    const releaseMenuGuard = () => {
      if (menuClosed) return;
      menuClosed = true;
      setTimeout(() => {
        ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
      }, 200);
    };

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup({ window: mainWindow, callback: releaseMenuGuard });
  });
});

// ================= IPC İŞLEYİCİLERİ =================

ipcMain.handle('sidebar:get-init-data', () => {
  const config = store.get();
  const display = getTargetDisplay();
  return {
    config,
    userAgents: {
      desktop: DESKTOP_EDGE_UA,
      mobile: MOBILE_EDGE_UA
    },
    appBarSupported: appBar.isSupported(),
    systemDark: nativeTheme.shouldUseDarkColors,
    displays: getDisplaysInfoList(),
    adblockSessionBlocked: adblock.sessionBlocked,
    screenInfo: {
      width: display.bounds.width,
      height: display.bounds.height,
      workAreaHeight: display.workArea.height
    }
  };
});

ipcMain.handle('sidebar:update-settings', (_e, partial) => {
  const prevDisplay = getTargetDisplay();
  const prev = { ...store.get().settings };
  const updated = store.updateSettings(partial);
  const s = updated.settings;

  if (partial.displayId !== undefined) {
    const nextDisplay = getTargetDisplay();
    if (prevDisplay.id !== nextDisplay.id) {
      appBar.unregister(prevDisplay);
      sendEventToRenderer({
        type: 'displays-updated',
        displays: getDisplaysInfoList(),
        screenInfo: {
          width: nextDisplay.bounds.width,
          height: nextDisplay.bounds.height,
          workAreaHeight: nextDisplay.workArea.height
        }
      });
    }
  }

  if (
    (partial.hotkey !== undefined && partial.hotkey !== prev.hotkey) ||
    (partial.snipHotkey !== undefined && partial.snipHotkey !== prev.snipHotkey)
  ) {
    registerGlobalHotkeys();
  }
  if (partial.skipTaskbar !== undefined && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(Boolean(s.skipTaskbar));
  }
  if (partial.launchAtStartup !== undefined) {
    try {
      const appRoot = path.resolve(__dirname, '..');
      app.setLoginItemSettings({
        openAtLogin: Boolean(s.launchAtStartup),
        path: process.execPath,
        args: app.isPackaged ? [] : [appRoot]
      });
    } catch (_err) {}
  }
  if (partial.railWidth !== undefined) {
    uiWindowState.railWidth = clamp(s.railWidth, MIN_RAIL_WIDTH, MAX_RAIL_WIDTH);
  }
  if (partial.panelWidth !== undefined) {
    uiWindowState.panelWidth = s.panelWidth;
  }
  if (partial.handleYRatio !== undefined) {
    uiWindowState.handleYRatio = s.handleYRatio;
  }

  syncWindowMaterial();
  applyWindowGeometry();
  buildTrayMenu();
  return updated;
});

ipcMain.handle('sidebar:update-sites', (_e, sites) => {
  if (Array.isArray(sites)) {
    sites.forEach((s) => {
      if (s.isolatedSession) {
        configurePartitionSession(`persist:edge-site-${s.id}`);
      }
    });
  }
  return store.updateSites(sites);
});

ipcMain.handle('sidebar:update-widgets', (_e, partialWidgets) => {
  return store.updateWidgets(partialWidgets);
});

ipcMain.handle('sidebar:set-window-state', (_e, state) => {
  uiWindowState = { ...uiWindowState, ...state };
  applyWindowGeometry();
  return true;
});

ipcMain.handle('sidebar:set-unread-summary', (_e, summary) => {
  const prevHasUnread = unreadSummary.total > 0;
  unreadSummary = {
    total: Math.max(0, Number(summary?.total) || 0),
    badgeText: String(summary?.badgeText || ''),
    details: String(summary?.details || ''),
    topSiteId: summary?.topSiteId || null
  };
  const nowHasUnread = unreadSummary.total > 0;

  if (tray) {
    if (prevHasUnread !== nowHasUnread) {
      tray.setImage(createSidebarIcon(nowHasUnread));
    }
    tray.setToolTip(
      nowHasUnread && unreadSummary.details
        ? `Zen Side — ${unreadSummary.details}`
        : 'Zen Side'
    );
  }

  if (uiWindowState.mode === 'handle' && prevHasUnread !== nowHasUnread) {
    applyWindowGeometry();
  }
  return true;
});

// ================= PANO, SÜRÜKLE-BIRAK GÖRSEL & QUICK SNIP IPC =================

ipcMain.handle('sidebar:get-clipboard-history', () => {
  return {
    items: clipboardHistory,
    paused: clipboardPaused
  };
});

ipcMain.handle('sidebar:clear-clipboard-history', () => {
  clipboardHistory = [];
  return true;
});

ipcMain.handle('sidebar:set-clipboard-paused', (_e, paused) => {
  clipboardPaused = Boolean(paused);
  return clipboardPaused;
});

ipcMain.handle('sidebar:write-clipboard-text', (_e, text) => {
  const str = String(text ?? '');
  clipboard.writeText(str);
  const trimmed = str.trim();
  if (trimmed && !clipboardPaused && trimmed.length <= 20000) {
    lastSeenClipboardText = trimmed;
    clipboardHistory = [
      { text: trimmed, time: Date.now() },
      ...clipboardHistory.filter((item) => item.text !== trimmed)
    ].slice(0, MAX_CLIPBOARD_ITEMS);
  }
  return true;
});

ipcMain.handle('sidebar:copy-image-dataurl', (_e, dataUrl) => {
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    if (!img.isEmpty()) {
      clipboard.writeImage(img);
      return true;
    }
  } catch {}
  return false;
});

ipcMain.handle('sidebar:copy-image-file', (_e, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
    const img = nativeImage.createFromPath(filePath);
    if (!img.isEmpty()) {
      clipboard.writeImage(img);
      return true;
    }
  } catch {}
  return false;
});

ipcMain.handle('sidebar:start-quick-snip', async () => {
  return startQuickSnip();
});

ipcMain.handle('snip:cancel', () => {
  if (snipWindow && !snipWindow.isDestroyed()) {
    snipWindow.close();
  }
  return true;
});

ipcMain.handle('snip:complete', async (_e, { action, targetSiteId, pngDataUrl }) => {
  if (snipWindow && !snipWindow.isDestroyed()) {
    snipWindow.close();
  }
  if (!pngDataUrl) return false;

  try {
    const img = nativeImage.createFromDataURL(pngDataUrl);
    if (!img.isEmpty()) {
      clipboard.writeImage(img);
    }

    if (action === 'save') {
      ignoreBlurCount++;
      try {
        const res = await dialog.showSaveDialog(mainWindow, {
          title: 'Ekran Görüntüsünü Kaydet',
          defaultPath: `zen-side-snip-${Date.now()}.png`,
          filters: [{ name: 'PNG Görseli', extensions: ['png'] }]
        });
        if (!res.canceled && res.filePath) {
          fs.writeFileSync(res.filePath, img.toPNG());
          sendEventToRenderer({ type: 'snip-completed', action: 'save' });
        }
      } finally {
        setTimeout(() => {
          ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
        }, 200);
      }
      return true;
    }

    if (action === 'send-to-site' && targetSiteId) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
      sendEventToRenderer({
        type: 'snip-paste-to-site',
        siteId: targetSiteId
      });
      return true;
    }

    sendEventToRenderer({ type: 'snip-completed', action: 'copy' });
    return true;
  } catch (err) {
    console.warn('[QuickSnip] Kırpma tamamlanamadı:', err.message);
    return false;
  }
});

// ================= DİYALOG & BAĞLAM MENÜSÜ IPC =================

ipcMain.handle('sidebar:pick-custom-icon', async () => {
  ignoreBlurCount++;
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Özel Site İkonu Seçin',
      filters: [
        { name: 'Görsel ve İkon Dosyaları', extensions: ['png', 'ico', 'svg', 'jpg', 'jpeg', 'webp', 'gif'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const dataUrl = store.saveCustomIconFile(filePath);
    return {
      canceled: false,
      dataUrl,
      fileName: path.basename(filePath)
    };
  } finally {
    setTimeout(() => {
      ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
    }, 200);
  }
});

ipcMain.handle('sidebar:open-external', (_e, { url, preferEdge }) => {
  openUrlExternal(url, preferEdge);
  return true;
});

ipcMain.handle('sidebar:clear-partition', async (_e, partitionName) => {
  const sess = session.fromPartition(partitionName || 'persist:edge-sidebar');
  await sess.clearStorageData();
  await sess.clearCache();
  return true;
});

ipcMain.handle('sidebar:export-config', async () => {
  ignoreBlurCount++;
  try {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Zen Side Yapılandırmasını Dışa Aktar',
      defaultPath: 'zen-side-yedek.json',
      filters: [{ name: 'JSON Dosyası', extensions: ['json'] }]
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    fs.writeFileSync(res.filePath, JSON.stringify(store.get(), null, 2), 'utf-8');
    return { canceled: false };
  } finally {
    setTimeout(() => {
      ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
    }, 200);
  }
});

ipcMain.handle('sidebar:import-config', async () => {
  ignoreBlurCount++;
  try {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Zen Side Yapılandırmasını İçe Aktar',
      filters: [{ name: 'JSON Dosyası', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (res.canceled || !res.filePaths.length) return { canceled: true };
    const parsed = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf-8'));
    if (!parsed || !Array.isArray(parsed.sites)) {
      throw new Error('Geçersiz yedek dosyası formatı.');
    }
    const saved = store.save(parsed);
    applyWindowGeometry();
    buildTrayMenu();
    return { canceled: false, config: saved };
  } catch (err) {
    return { canceled: true, error: err.message };
  } finally {
    setTimeout(() => {
      ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
    }, 200);
  }
});

ipcMain.handle('sidebar:quit', () => {
  isQuitting = true;
  appBar.unregister(getTargetDisplay());
  app.quit();
});

ipcMain.handle('sidebar:workspace-menu', () => {
  return new Promise((resolve) => {
    ignoreBlurCount++;
    let resolved = false;
    const done = (wsId) => {
      if (resolved) return;
      resolved = true;
      setTimeout(() => {
        ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
      }, 150);
      resolve(wsId);
    };

    const { settings, workspaces } = store.get();
    const curWs = settings.activeWorkspace || 'all';
    const menu = Menu.buildFromTemplate(
      (workspaces || []).map((ws) => ({
        label: `${ws.badge}  ${ws.name}`,
        type: 'radio',
        checked: curWs === ws.id,
        click: () => done(ws.id)
      }))
    );

    menu.popup({
      window: mainWindow,
      callback: () => done(null)
    });
  });
});

ipcMain.handle('sidebar:site-context-menu', (_e, info) => {
  return new Promise((resolve) => {
    ignoreBlurCount++;
    let resolved = false;
    const done = (action) => {
      if (resolved) return;
      resolved = true;
      setTimeout(() => {
        ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
      }, 150);
      resolve(action);
    };

    const { workspaces } = store.get();
    const assignableWorkspaces = (workspaces || []).filter((w) => w.id !== 'all');

    const menu = Menu.buildFromTemplate([
      {
        label: `${info.name} — Aç`,
        click: () => done('open')
      },
      {
        label: '⬒ Alt Bölmede Aç (Çift Sekme / Split-View)',
        click: () => done('open-split')
      },
      {
        label: 'Düzenle & İkon Özelleştir…',
        click: () => done('edit')
      },
      {
        label: 'Çalışma Alanına Ata',
        submenu: assignableWorkspaces.map((ws) => ({
          label: `${ws.badge} ${ws.name}`,
          type: 'radio',
          checked: (info.workspace || 'general') === ws.id,
          click: () => done(`workspace:${ws.id}`)
        }))
      },
      { type: 'separator' },
      {
        label: 'Sayfayı Yenile',
        enabled: Boolean(info.isLoaded),
        click: () => done('reload')
      },
      {
        label: info.isMuted ? 'Sekme Sesini Aç (🔊)' : 'Sekme Sesini Kapat (🔇)',
        enabled: Boolean(info.isLoaded),
        click: () => done('toggle-mute')
      },
      {
        label: info.mobileMode ? 'Masaüstü Görünümüne Geç' : 'Mobil Görünüme Geç',
        click: () => done('toggle-mobile')
      },
      {
        label: 'Bildirimler İçin Uyanık Tut (Otomatik Uyutma)',
        type: 'checkbox',
        checked: Boolean(info.keepAwake),
        click: () => done('toggle-keep-awake')
      },
      {
        label: 'Microsoft Edge\'de Aç',
        click: () => done('open-edge')
      },
      {
        label: 'Şimdi Uyku Moduna Al (RAM Boşalt)',
        enabled: Boolean(info.isLoaded),
        click: () => done('hibernate')
      },
      { type: 'separator' },
      {
        label: 'Yukarı Taşı',
        enabled: info.index > 0,
        click: () => done('move-up')
      },
      {
        label: 'Aşağı Taşı',
        enabled: info.index < info.total - 1,
        click: () => done('move-down')
      },
      { type: 'separator' },
      {
        label: 'Kısayolu Kaldır',
        click: () => done('delete')
      }
    ]);

    menu.popup({
      window: mainWindow,
      callback: () => done(null)
    });
  });
});

ipcMain.handle('sidebar:rail-context-menu', () => {
  return new Promise((resolve) => {
    ignoreBlurCount++;
    let resolved = false;
    const done = (action) => {
      if (resolved) return;
      resolved = true;
      setTimeout(() => {
        ignoreBlurCount = Math.max(0, ignoreBlurCount - 1);
      }, 150);
      resolve(action);
    };

    const { settings, workspaces } = store.get();
    const curDisp = settings.railDisplayMode || 'text';
    const curWs = settings.activeWorkspace || 'all';

    const menu = Menu.buildFromTemplate([
      {
        label: 'Yeni Site Ekle (+)',
        click: () => done('add-site')
      },
      {
        label: '✂️ Ekran Görüntüsü Kırp & Gönder',
        click: () => done('quick-snip')
      },
      {
        label: '🧰 Yerleşik Mini Araçlar (Notlar / Pano / Hesap / Pomodoro)',
        click: () => done('open-tools')
      },
      { type: 'separator' },
      {
        label: 'Çalışma Alanı (Profil)',
        submenu: (workspaces || []).map((ws) => ({
          label: `${ws.badge} ${ws.name}`,
          type: 'radio',
          checked: curWs === ws.id,
          click: () => done(`set-workspace:${ws.id}`)
        }))
      },
      {
        label: 'Sekme Görünümü',
        submenu: [
          {
            label: 'Sadece İsim (Varsayılan)',
            type: 'radio',
            checked: curDisp === 'text',
            click: () => done('display-text')
          },
          {
            label: 'Sadece Simge',
            type: 'radio',
            checked: curDisp === 'icon',
            click: () => done('display-icon')
          },
          {
            label: 'Simge + İsim',
            type: 'radio',
            checked: curDisp === 'both',
            click: () => done('display-both')
          }
        ]
      },
      {
        label: `🛡️ Reklam & İzleyici Engelleyici (${settings.adblockTotalBlocked || 0})`,
        type: 'checkbox',
        checked: Boolean(settings.adblockEnabled),
        click: () => done('toggle-adblock')
      },
      {
        label: 'Arka Plan Sekmelerini Şimdi Uyut (RAM Boşalt)',
        click: () => done('sleep-all-inactive')
      },
      { type: 'separator' },
      {
        label: 'Tam Ekran Uygulamalar Yanında Kalsın',
        type: 'checkbox',
        checked: Boolean(settings.dockReserve),
        enabled: appBar.isSupported(),
        click: () => done('toggle-dock')
      },
      {
        label: 'Boş Yere / Sayfaya Tıklayınca Sekmeyi Kapat',
        type: 'checkbox',
        checked: !settings.isPinned,
        click: () => done('toggle-autoclose-outside')
      },
      {
        label: 'Otomatik Kenara Gizle',
        type: 'checkbox',
        checked: Boolean(settings.autoHide),
        click: () => done('toggle-autohide')
      },
      {
        label: 'Sonraki iOS Cam / Mica Rengi',
        click: () => done('cycle-glass-tint')
      },
      {
        label: 'Şerit Genişliğini Sıfırla (Min: 22px)',
        enabled: (settings.railWidth || MIN_RAIL_WIDTH) > MIN_RAIL_WIDTH,
        click: () => done('reset-rail-width')
      },
      {
        label: settings.edge === 'left' ? 'Sağ Ekran Kenarına Taşı' : 'Sol Ekran Kenarına Taşı',
        click: () => done('flip-edge')
      },
      { type: 'separator' },
      {
        label: 'Zen Side Ayarları…',
        click: () => done('settings')
      },
      { type: 'separator' },
      {
        label: 'Zen Side\'dan Çık',
        click: () => done('quit')
      }
    ]);

    menu.popup({
      window: mainWindow,
      callback: () => done(null)
    });
  });
});

nativeTheme.on('updated', () => {
  syncWindowMaterial();
  sendEventToRenderer({
    type: 'system-theme-changed',
    systemDark: nativeTheme.shouldUseDarkColors
  });
});

app.whenReady().then(() => {
  createMainWindow();

  if (process.argv.includes('--smoke-test')) {
    const rendererErrors = [];
    mainWindow.webContents.on('console-message', (details) => {
      if (details && (details.level === 'error' || details.level >= 3)) {
        rendererErrors.push(`${details.sourceId}:${details.lineNumber} -> ${details.message}`);
      }
    });

    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const savedRailW = store.get().settings.railWidth || MIN_RAIL_WIDTH;
          const railBounds = mainWindow.getBounds();

          uiWindowState.mode = 'handle';
          applyWindowGeometry();
          await wait(60);
          const handleBounds = mainWindow.getBounds();

          unreadSummary = { total: 3, badgeText: '3', details: 'Whatsapp (3)', topSiteId: 'site-whatsapp' };
          applyWindowGeometry();
          await wait(60);
          const unreadHandleBounds = mainWindow.getBounds();
          unreadSummary = { total: 0, badgeText: '', details: '', topSiteId: null };

          uiWindowState.mode = 'rail';
          uiWindowState.railWidth = savedRailW;
          applyWindowGeometry();
          await wait(60);

          const adblockTest = {
            blocksDoubleclick: adblock.shouldBlockRequest({
              url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
              resourceType: 'script'
            }),
            allowsWhatsApp: !adblock.shouldBlockRequest({
              url: 'https://web.whatsapp.com/app.js',
              resourceType: 'script'
            }),
            allowsMainFrame: !adblock.shouldBlockRequest({
              url: 'https://doubleclick.net/',
              resourceType: 'mainFrame'
            })
          };

          const domCheck = await mainWindow.webContents.executeJavaScript(`({
            title: document.title,
            railItems: document.querySelectorAll('.rail-item').length,
            tabLabels: Array.from(document.querySelectorAll('.rail-item .tab-title-text')).map(el => el.textContent),
            hasSplitBtn: Boolean(document.getElementById('btn-split-view')),
            hasSplitBar: Boolean(document.getElementById('split-divider-bar')),
            hasSnipBtn: Boolean(document.getElementById('btn-rail-snip')),
            hasToolsBtn: Boolean(document.getElementById('btn-rail-tools')),
            hasWorkspaceBtn: Boolean(document.getElementById('btn-rail-workspace')),
            hasAdblockBtn: Boolean(document.getElementById('btn-toggle-adblock')),
            toolTabsCount: document.querySelectorAll('[data-tool-tab]').length,
            toolsWidgetLoaded: Boolean(window.ZenToolsWidget),
            monitorOptions: document.getElementById('set-target-display')?.options?.length || 0,
            autoCloseOutsideChecked: document.getElementById('set-autoclose-outside')?.checked
          })`);

          // Mini Araçlar açılış + Dışarı tıklayınca otomatik kapanma testi
          await mainWindow.webContents.executeJavaScript(`document.getElementById('btn-rail-tools')?.click()`);
          await wait(110);
          const toolsOpenMode = uiWindowState.mode;
          const toolsOpenWidth = mainWindow.getBounds().width;

          sendEventToRenderer({ type: 'outside-clicked' });
          await wait(110);
          const afterOutsideMode = uiWindowState.mode;
          const afterOutsideWidth = mainWindow.getBounds().width;

          console.log('SMOKE_RESULT:', JSON.stringify({
            appBarSupported: appBar.isSupported(),
            configVersion: store.get().configVersion,
            isPinned: store.get().settings.isPinned,
            adblockEnabled: store.get().settings.adblockEnabled,
            displaysCount: getDisplaysInfoList().length,
            workspacesCount: store.get().workspaces.length,
            adblockTest,
            railBounds,
            handleBounds,
            unreadHandleBounds,
            outsideClickTest: {
              toolsOpenMode,
              toolsOpenWidth,
              afterOutsideMode,
              afterOutsideWidth
            },
            domCheck,
            rendererErrors
          }));
        } catch (err) {
          console.error('SMOKE_ERR:', err);
          process.exit(1);
        }
        isQuitting = true;
        if (cursorWatchTimer) clearInterval(cursorWatchTimer);
        if (clipboardWatchTimer) clearInterval(clipboardWatchTimer);
        appBar.unregister(getTargetDisplay());
        app.quit();
      }, 950);
    });
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (cursorWatchTimer) clearInterval(cursorWatchTimer);
  if (clipboardWatchTimer) clearInterval(clipboardWatchTimer);
  appBar.stopWatchdog();
  appBar.unregister(getTargetDisplay());
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (clipboardWatchTimer) clearInterval(clipboardWatchTimer);
  appBar.stopWatchdog();
  appBar.unregister(getTargetDisplay());
});

app.on('window-all-closed', () => {
  appBar.stopWatchdog();
  appBar.unregister(getTargetDisplay());
  app.quit();
});
