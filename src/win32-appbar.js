/**
 * Windows Native AppBar, WorkArea, Maximized Window Snapper & DWM Mica/Acrylic Manager
 * 1) Masaüstü alanını şerit/panel genişliği kadar daraltır (SHAppBarMessage + SPI_SETWORKAREA).
 * 2) Halihazırda tam ekran büyütülmüş (Maximized / IsZoomed) pencereleri DWM sınırlarına göre
 *    milimetrik olarak kenar çubuğunun yanına hizalar (asla altında kalmaz!).
 * 3) SWP_NOSENDCHANGING ile 22px ve 6px gerçek pencere genişliğini setShape olmadan uygular;
 *    böylece Windows 11 DWM Mica ve iOS Buzlu Cam (Acrylic) donanım efektleri her genişlikte çalışır.
 */

let koffi = null;
let SHAppBarMessage = null;
let RegisterWindowMessageW = null;
let SystemParametersInfoW = null;
let SendMessageTimeoutW = null;
let SetWindowPos = null;
let GetTopWindow = null;
let GetWindow = null;
let GetForegroundWindow = null;
let GetWindowThreadProcessId = null;
let IsWindowVisible = null;
let IsZoomed = null;
let IsIconic = null;
let GetWindowRect = null;
let GetClassNameW = null;
let GetAsyncKeyState = null;
let DwmGetWindowAttribute = null;
let DwmSetWindowAttribute = null;
let DwmExtendFrameIntoClientArea = null;
let APPBARDATA = null;
let RECT = null;
let MARGINS = null;

const ABM_NEW = 0x00000000;
const ABM_REMOVE = 0x00000001;
const ABM_QUERYPOS = 0x00000002;
const ABM_SETPOS = 0x00000003;

const ABE_LEFT = 0;
const ABE_RIGHT = 2;

const SPI_SETWORKAREA = 0x002F;
const WM_SETTINGCHANGE = 0x001A;
const HWND_BROADCAST = 0xFFFF;
const SMTO_ABORTIFHUNG = 0x0002;

const GW_HWNDNEXT = 2;
const HWND_TOPMOST = -1;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_NOSENDCHANGING = 0x0400;
const SWP_ASYNCWINDOWPOS = 0x4000;

const IGNORED_SHELL_CLASSES = new Set([
  'Progman',
  'WorkerW',
  'Shell_TrayWnd',
  'Shell_SecondaryTrayWnd',
  'Windows.UI.Core.CoreWindow',
  'XamlExplorerHostIslandWindow',
  'MultitaskingViewFrame',
  'ForegroundStaging'
]);

const DWMWA_EXTENDED_FRAME_BOUNDS = 9;
const DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
const DWMWA_WINDOW_CORNER_PREFERENCE = 33;
const DWMWA_SYSTEMBACKDROP_TYPE = 38;

function initWin32() {
  if (SHAppBarMessage) return true;
  if (process.platform !== 'win32') return false;

  try {
    koffi = require('koffi');
    RECT = koffi.struct('RECT', {
      left: 'int32_t',
      top: 'int32_t',
      right: 'int32_t',
      bottom: 'int32_t'
    });

    MARGINS = koffi.struct('MARGINS', {
      cxLeftWidth: 'int32_t',
      cxRightWidth: 'int32_t',
      cyTopHeight: 'int32_t',
      cyBottomHeight: 'int32_t'
    });

    const abdFields = {
      cbSize: 'uint32_t',
      hWnd: 'uintptr_t',
      uCallbackMessage: 'uint32_t',
      uEdge: 'uint32_t',
      rc: RECT,
      lParam: 'intptr_t'
    };

    APPBARDATA = process.arch === 'ia32'
      ? koffi.pack('APPBARDATA', abdFields, 1)
      : koffi.struct('APPBARDATA', abdFields);

    const shell32 = koffi.load('shell32.dll');
    const user32 = koffi.load('user32.dll');
    const dwmapi = koffi.load('dwmapi.dll');

    SHAppBarMessage = shell32.func('uintptr_t __stdcall SHAppBarMessage(uint32_t dwMessage, _Inout_ APPBARDATA *pData)');
    RegisterWindowMessageW = user32.func('uint32_t __stdcall RegisterWindowMessageW(str16 lpString)');
    SystemParametersInfoW = user32.func('int __stdcall SystemParametersInfoW(uint32_t uiAction, uint32_t uiParam, _Inout_ RECT *pvParam, uint32_t fWinIni)');
    SendMessageTimeoutW = user32.func('uintptr_t __stdcall SendMessageTimeoutW(uintptr_t hWnd, uint32_t Msg, uintptr_t wParam, uintptr_t lParam, uint32_t fuFlags, uint32_t uTimeout, _Out_ uintptr_t *lpdwResult)');
    SetWindowPos = user32.func('int __stdcall SetWindowPos(uintptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)');
    GetTopWindow = user32.func('uintptr_t __stdcall GetTopWindow(uintptr_t hWnd)');
    GetWindow = user32.func('uintptr_t __stdcall GetWindow(uintptr_t hWnd, uint32_t uCmd)');
    GetForegroundWindow = user32.func('uintptr_t __stdcall GetForegroundWindow()');
    GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hWnd, _Out_ uint32_t *lpdwProcessId)');
    IsWindowVisible = user32.func('int __stdcall IsWindowVisible(uintptr_t hWnd)');
    IsZoomed = user32.func('int __stdcall IsZoomed(uintptr_t hWnd)');
    IsIconic = user32.func('int __stdcall IsIconic(uintptr_t hWnd)');
    GetWindowRect = user32.func('int __stdcall GetWindowRect(uintptr_t hWnd, _Out_ RECT *lpRect)');
    GetClassNameW = user32.func('int __stdcall GetClassNameW(uintptr_t hWnd, _Out_ uint8_t *lpClassName, int nMaxCount)');
    GetAsyncKeyState = user32.func('int16_t __stdcall GetAsyncKeyState(int vKey)');

    DwmGetWindowAttribute = dwmapi.func('int __stdcall DwmGetWindowAttribute(uintptr_t hwnd, uint32_t dwAttribute, _Out_ RECT *pvAttribute, uint32_t cbAttribute)');
    DwmSetWindowAttribute = dwmapi.func('int __stdcall DwmSetWindowAttribute(uintptr_t hwnd, uint32_t dwAttribute, _In_ int32_t *pvAttribute, uint32_t cbAttribute)');
    DwmExtendFrameIntoClientArea = dwmapi.func('int __stdcall DwmExtendFrameIntoClientArea(uintptr_t hwnd, _In_ MARGINS *pMarInset)');

    return true;
  } catch (err) {
    console.warn('[Win32] Modül başlatılamadı:', err.message);
    return false;
  }
}

function readHwnd(browserWindow) {
  const buf = browserWindow.getNativeWindowHandle();
  if (buf.length >= 8) {
    return buf.readBigUInt64LE(0);
  }
  return buf.readUInt32LE(0);
}

function sameHwnd(a, b) {
  if (!a || !b) return false;
  return BigInt(a) === BigInt(b);
}

function broadcastWorkAreaChange() {
  if (!SendMessageTimeoutW) return;
  try {
    const out = [0];
    SendMessageTimeoutW(HWND_BROADCAST, WM_SETTINGCHANGE, SPI_SETWORKAREA, 0, SMTO_ABORTIFHUNG, 70, out);
  } catch {
    // Yoksay
  }
}

class Win32AppBar {
  constructor() {
    this.registered = false;
    this.usingSpiFallback = false;
    this.isUpdatingWorkArea = false;
    this.hwnd = null;
    this.callbackMsg = 0;
    this.baselineVerticalDip = null; // Görev çubuğu hariç temiz dikey sınırlar
    this.activeWorkAreaPhys = null;
    this.fullMonitorPhys = null;
    this.lastKey = null;
    this.cachedRect = null;
    this.watchdogTimer = null;
    this.onFullscreenChange = null;
    this.inFullscreenApp = false;
  }

  isSupported() {
    return initWin32();
  }

  /**
   * Fare sol, sağ veya orta tuşunun basılı tutulup tutulmadığını kontrol eder
   */
  isMouseButtonDown() {
    if (!initWin32() || !GetAsyncKeyState) return false;
    try {
      return (
        ((GetAsyncKeyState(0x01) & 0x8000) !== 0) ||
        ((GetAsyncKeyState(0x02) & 0x8000) !== 0) ||
        ((GetAsyncKeyState(0x04) & 0x8000) !== 0)
      );
    } catch {
      return false;
    }
  }

  getWindowPid(hwnd) {
    if (!hwnd || !initWin32() || !GetWindowThreadProcessId) return 0;
    try {
      const pidOut = [0];
      GetWindowThreadProcessId(hwnd, pidOut);
      return pidOut[0] >>> 0;
    } catch {
      return 0;
    }
  }

  /**
   * Kenar çubuğu penceresinin (veya dosya seçici / açılır menü gibi uygulamaya ait alt pencerenin)
   * halen aktif ön plan penceresi olup olmadığını döner
   */
  isForeground(browserWindow) {
    if (!browserWindow || browserWindow.isDestroyed()) return false;
    if (!initWin32() || !GetForegroundWindow) return browserWindow.isFocused();
    try {
      const fg = GetForegroundWindow();
      if (!fg) return false;
      const hwnd = readHwnd(browserWindow);
      if (sameHwnd(fg, hwnd)) return true;
      const fgPid = this.getWindowPid(fg);
      return fgPid > 0 && fgPid === process.pid;
    } catch {
      return browserWindow.isFocused();
    }
  }

  /**
   * Ön plandaki pencerenin ana kenar çubuğu dışında uygulamamıza ait bir alt pencere
   * (örn. WhatsApp dosya yükleme penceresi, sağ tık menüsü veya OAuth popup) olup olmadığını döner
   */
  isOwnedPopupForeground(browserWindow) {
    if (!browserWindow || browserWindow.isDestroyed()) return false;
    if (!initWin32() || !GetForegroundWindow) return false;
    try {
      const fg = GetForegroundWindow();
      if (!fg) return false;
      const hwnd = readHwnd(browserWindow);
      if (sameHwnd(fg, hwnd)) return false;
      const fgPid = this.getWindowPid(fg);
      return fgPid > 0 && fgPid === process.pid;
    } catch {
      return false;
    }
  }

  getCallbackMessage() {
    if (!initWin32()) return 0;
    if (!this.callbackMsg) {
      this.callbackMsg = RegisterWindowMessageW('EdgeKenarCubuguAppBarCallback') || (0x0400 + 101);
    }
    return this.callbackMsg;
  }

  /**
   * Görev çubuğu yüksekliğini koruyan temiz monitör çalışma alanını fiziksel piksel olarak döner
   */
  getCleanMonitorWorkAreaPhys(display) {
    const scale = display.scaleFactor || 1;
    // İlk okumada (veya çözünürlük değiştiğinde) görev çubuğu hariç dikey alanı kaydet
    if (
      !this.baselineVerticalDip ||
      this.baselineVerticalDip.monHeight !== display.bounds.height ||
      this.baselineVerticalDip.monY !== display.bounds.y
    ) {
      const wy = display.workArea.y;
      const wh = display.workArea.height;
      this.baselineVerticalDip = {
        monY: display.bounds.y,
        monHeight: display.bounds.height,
        top: wy,
        bottom: wh > 100 ? (wy + wh) : (display.bounds.y + display.bounds.height)
      };
    }

    return {
      left: Math.round(display.bounds.x * scale),
      top: Math.round(this.baselineVerticalDip.top * scale),
      right: Math.round((display.bounds.x + display.bounds.width) * scale),
      bottom: Math.round(this.baselineVerticalDip.bottom * scale)
    };
  }

  getFullMonitorPhys(display) {
    const scale = display.scaleFactor || 1;
    return {
      left: Math.round(display.bounds.x * scale),
      top: Math.round(display.bounds.y * scale),
      right: Math.round((display.bounds.x + display.bounds.width) * scale),
      bottom: Math.round((display.bounds.y + display.bounds.height) * scale)
    };
  }

  /**
   * Win32 minimum genişlik (36px) sınırına takılmadan gerçek 22px veya 6px pencere boyutu uygular
   * ve keepTopmost aktifken pencereyi mevcut ekrandaki tüm sayfaların en üstünde (HWND_TOPMOST) tutar.
   */
  setExactWindowBoundsDip(browserWindow, display, dipBounds, keepTopmost = true) {
    if (!browserWindow || browserWindow.isDestroyed()) return;
    if (!initWin32() || !SetWindowPos) {
      browserWindow.setBounds(dipBounds);
      return;
    }

    const scale = display.scaleFactor || 1;
    const hwnd = readHwnd(browserWindow);
    const px = Math.round(dipBounds.x * scale);
    const py = Math.round(dipBounds.y * scale);
    const pw = Math.max(4, Math.round(dipBounds.width * scale));
    const ph = Math.max(20, Math.round(dipBounds.height * scale));

    const insertAfter = keepTopmost ? HWND_TOPMOST : 0;
    const flags = keepTopmost
      ? (SWP_NOACTIVATE | SWP_NOSENDCHANGING)
      : (SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOSENDCHANGING);

    SetWindowPos(
      hwnd,
      insertAfter,
      px,
      py,
      pw,
      ph,
      flags
    );
  }

  /**
   * Pencereyi odağı çalmadan mevcut ekrandaki tüm pencerelerin/sayfaların en üst katmanına sabitler
   */
  ensureTopmost(browserWindow) {
    if (!browserWindow || browserWindow.isDestroyed()) return;
    try {
      browserWindow.setAlwaysOnTop(true, 'screen-saver');
    } catch {}
    if (!initWin32() || !SetWindowPos) return;
    try {
      const hwnd = readHwnd(browserWindow);
      SetWindowPos(
        hwnd,
        HWND_TOPMOST,
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING
      );
    } catch {}
  }

  /**
   * Windows 11 DWM Donanım Mica / Acrylic (iOS Buzlu Cam) efektini doğrudan DWM üzerinden uygular.
   * Electron setBackgroundMaterial'in 42px çerçeve kayması hatasına yol açmadan 6px/22px/442px tam DOM uyumu sağlar.
   */
  applyBackdropMaterial(browserWindow, material = 'acrylic', isDark = true, rounded = false) {
    if (!browserWindow || browserWindow.isDestroyed()) return;
    if (!initWin32() || !DwmSetWindowAttribute) return;

    try {
      const hwnd = readHwnd(browserWindow);
      const isGlass = material !== 'none';

      if (DwmExtendFrameIntoClientArea) {
        const m = isGlass ? -1 : 0;
        DwmExtendFrameIntoClientArea(hwnd, {
          cxLeftWidth: m,
          cxRightWidth: m,
          cyTopHeight: m,
          cyBottomHeight: m
        });
      }

      DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, [isDark ? 1 : 0], 4);

      // DWMSBT_DISABLE=1, DWMSBT_MAINWINDOW(Mica)=2, DWMSBT_TRANSIENTWINDOW(Acrylic)=3, DWMSBT_TABBEDWINDOW=4
      const backdropMap = { none: 1, mica: 2, acrylic: 3, tabbed: 4 };
      const backdropVal = backdropMap[material] || 3;
      DwmSetWindowAttribute(hwnd, DWMWA_SYSTEMBACKDROP_TYPE, [backdropVal], 4);

      // Kenara tam yapışıkken keskin köşe (1 = DWMWCP_DONOTROUND), tutamaçta yuvarlatılmış (2 = DWMWCP_ROUND)
      DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, [rounded ? 2 : 1], 4);
    } catch {
      // Yoksay
    }
  }

  /**
   * Bir pencerenin (Maximized / IsZoomed) DWM görünür sınırlarını hedef çalışma alanına milimetrik hizalar
   */
  snapSingleMaximizedWindow(hwnd, targetArea, monArea) {
    if (!hwnd || sameHwnd(hwnd, this.hwnd)) return;
    if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || !IsZoomed(hwnd)) return;

    const winRect = { left: 0, top: 0, right: 0, bottom: 0 };
    if (!GetWindowRect(hwnd, winRect)) return;

    const frameRect = { ...winRect };
    if (DwmGetWindowAttribute) {
      const hr = DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, frameRect, 16);
      if (hr !== 0) {
        Object.assign(frameRect, winRect);
      }
    }

    // Sadece ana monitördeki pencereleri hizala (ikinci monitöre dokunma)
    const cx = (frameRect.left + frameRect.right) / 2;
    const cy = (frameRect.top + frameRect.bottom) / 2;
    if (cx < monArea.left || cx > monArea.right || cy < monArea.top || cy > monArea.bottom) {
      return;
    }

    const diffL = Math.abs(frameRect.left - targetArea.left);
    const diffR = Math.abs(frameRect.right - targetArea.right);
    const diffT = Math.abs(frameRect.top - targetArea.top);
    const diffB = Math.abs(frameRect.bottom - targetArea.bottom);

    if (diffL <= 2 && diffR <= 2 && diffT <= 2 && diffB <= 2) {
      return; // Zaten kusursuz hizalı
    }

    // Windows 10/11 görünmez DWM gölge kenar boşluklarını (~8px) koru
    const padL = Math.max(0, Math.min(24, frameRect.left - winRect.left));
    const padT = Math.max(0, Math.min(24, frameRect.top - winRect.top));
    const padR = Math.max(0, Math.min(24, winRect.right - frameRect.right));
    const padB = Math.max(0, Math.min(24, winRect.bottom - frameRect.bottom));

    const newX = targetArea.left - padL;
    const newY = targetArea.top - padT;
    const newW = (targetArea.right - targetArea.left) + padL + padR;
    const newH = (targetArea.bottom - targetArea.top) + padT + padB;

    SetWindowPos(
      hwnd,
      0,
      newX,
      newY,
      newW,
      newH,
      SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS
    );
  }

  /**
   * Tüm tam ekran büyütülmüş (Maximized) pencereleri yeni çalışma alanına hizalar
   */
  syncAllMaximizedWindows(targetArea, monArea) {
    if (!initWin32() || !GetTopWindow || !targetArea || !monArea) return;
    try {
      let cur = GetTopWindow(0);
      let guard = 0;
      while (cur && guard < 400) {
        guard++;
        this.snapSingleMaximizedWindow(cur, targetArea, monArea);
        cur = GetWindow(cur, GW_HWNDNEXT);
      }
    } catch {
      // Yoksay
    }
  }

  /**
   * Kullanıcı başka bir uygulamayı yeni tam ekran yaptığında (Maximize) anında kenar çubuğunun yanına hizalar;
   * gerçek tam ekran video/oyun (F11 / YouTube) açıldığında ise kenar çubuğunu arkaya alır.
   */
  startWatchdog(onFullscreenCallback) {
    if (onFullscreenCallback) {
      this.onFullscreenChange = onFullscreenCallback;
    }
    if (this.watchdogTimer || !initWin32()) return;

    this.watchdogTimer = setInterval(() => {
      if (!this.activeWorkAreaPhys || !this.fullMonitorPhys) return;
      try {
        const fg = GetForegroundWindow();
        if (!fg || sameHwnd(fg, this.hwnd) || !IsWindowVisible(fg)) return;

        // Masaüstü (WorkerW / Progman) ve Başlat/Görev Çubuğu kabuk pencerelerini tam ekran oyun sanma!
        if (GetClassNameW) {
          const clsBuf = Buffer.alloc(160);
          const chars = GetClassNameW(fg, clsBuf, 78);
          if (chars > 0) {
            const clsName = clsBuf.toString('utf16le', 0, chars * 2);
            if (IGNORED_SHELL_CLASSES.has(clsName)) {
              if (this.inFullscreenApp) {
                this.inFullscreenApp = false;
                if (this.onFullscreenChange) this.onFullscreenChange(false);
              }
              return;
            }
          }
        }

        // 1) Gerçek Tam Ekran (F11 / Video / Oyun - Görev çubuğunu bile kaplayan pencere) kontrolü
        if (!IsZoomed(fg)) {
          const wr = { left: 0, top: 0, right: 0, bottom: 0 };
          if (GetWindowRect(fg, wr)) {
            const mon = this.fullMonitorPhys;
            const coversFullMonitor =
              wr.left <= mon.left &&
              wr.top <= mon.top &&
              wr.right >= mon.right &&
              wr.bottom >= mon.bottom;

            if (coversFullMonitor !== this.inFullscreenApp) {
              this.inFullscreenApp = coversFullMonitor;
              if (this.onFullscreenChange) this.onFullscreenChange(coversFullMonitor);
            }
          }
          return;
        }

        if (this.inFullscreenApp) {
          this.inFullscreenApp = false;
          if (this.onFullscreenChange) this.onFullscreenChange(false);
        }

        // 2) Normal Büyütülmüş Pencere (Maximized): Kenar çubuğunun altına taşmışsa yanına hizala!
        this.snapSingleMaximizedWindow(fg, this.activeWorkAreaPhys, this.fullMonitorPhys);
      } catch {
        // Yoksay
      }
    }, 380);
  }

  stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  register(browserWindow) {
    if (!initWin32() || !browserWindow || browserWindow.isDestroyed()) return false;
    const hwnd = readHwnd(browserWindow);
    if (this.registered && sameHwnd(this.hwnd, hwnd)) return true;

    if (this.registered) {
      this.unregister();
    }

    const abd = {
      cbSize: koffi.sizeof(APPBARDATA),
      hWnd: hwnd,
      uCallbackMessage: this.getCallbackMessage(),
      uEdge: ABE_RIGHT,
      rc: { left: 0, top: 0, right: 0, bottom: 0 },
      lParam: 0
    };

    const res = SHAppBarMessage(ABM_NEW, abd);
    this.registered = Boolean(res);
    this.hwnd = hwnd;
    return this.registered;
  }

  setBounds(browserWindow, display, edge, widthDip) {
    if (!initWin32() || !browserWindow || browserWindow.isDestroyed()) return null;

    this.hwnd = readHwnd(browserWindow);
    const scale = display.scaleFactor || 1;
    const physWidth = Math.round(widthDip * scale);
    const uEdge = edge === 'left' ? ABE_LEFT : ABE_RIGHT;
    const cleanArea = this.getCleanMonitorWorkAreaPhys(display);
    const fullMon = this.getFullMonitorPhys(display);

    const targetWorkArea = {
      left: uEdge === ABE_LEFT ? cleanArea.left + physWidth : cleanArea.left,
      top: cleanArea.top,
      right: uEdge === ABE_LEFT ? cleanArea.right : cleanArea.right - physWidth,
      bottom: cleanArea.bottom
    };

    this.activeWorkAreaPhys = targetWorkArea;
    this.fullMonitorPhys = fullMon;

    const cacheKey = `${uEdge}:${physWidth}:${cleanArea.left},${cleanArea.top},${cleanArea.right},${cleanArea.bottom}`;
    if (this.lastKey === cacheKey && this.cachedRect && (this.registered || this.usingSpiFallback)) {
      return this.cachedRect;
    }

    // 1. Katman: Resmi Windows Shell SHAppBarMessage
    if (this.registered || this.register(browserWindow)) {
      const abd = {
        cbSize: koffi.sizeof(APPBARDATA),
        hWnd: this.hwnd,
        uCallbackMessage: this.getCallbackMessage(),
        uEdge,
        rc: {
          left: uEdge === ABE_LEFT ? cleanArea.left : cleanArea.right - physWidth,
          top: cleanArea.top,
          right: uEdge === ABE_LEFT ? cleanArea.left + physWidth : cleanArea.right,
          bottom: cleanArea.bottom
        },
        lParam: 0
      };

      SHAppBarMessage(ABM_QUERYPOS, abd);

      if (uEdge === ABE_LEFT) {
        abd.rc.right = abd.rc.left + physWidth;
      } else {
        abd.rc.left = abd.rc.right - physWidth;
      }

      SHAppBarMessage(ABM_SETPOS, abd);
      this.usingSpiFallback = false;

      this.cachedRect = {
        x: Math.round(abd.rc.left / scale),
        y: Math.round(abd.rc.top / scale),
        width: Math.round((abd.rc.right - abd.rc.left) / scale),
        height: Math.round((abd.rc.bottom - abd.rc.top) / scale)
      };
      this.lastKey = cacheKey;

      // Halihazırda büyütülmüş pencereleri de anında yanına hizala
      setTimeout(() => this.syncAllMaximizedWindows(targetWorkArea, fullMon), 40);
      return this.cachedRect;
    }

    // 2. Katman: SPI_SETWORKAREA + Maximized Pencere Hizalayıcı
    if (SystemParametersInfoW) {
      this.isUpdatingWorkArea = true;
      try {
        SystemParametersInfoW(SPI_SETWORKAREA, 0, targetWorkArea, 0);
        broadcastWorkAreaChange();
      } finally {
        this.isUpdatingWorkArea = false;
      }

      this.usingSpiFallback = true;
      const barLeft = uEdge === ABE_LEFT ? cleanArea.left : cleanArea.right - physWidth;
      this.cachedRect = {
        x: Math.round(barLeft / scale),
        y: Math.round(cleanArea.top / scale),
        width: widthDip,
        height: Math.round((cleanArea.bottom - cleanArea.top) / scale)
      };
      this.lastKey = cacheKey;

      setTimeout(() => this.syncAllMaximizedWindows(targetWorkArea, fullMon), 40);
      return this.cachedRect;
    }

    return null;
  }

  unregister(display = null) {
    const cleanArea = display ? this.getCleanMonitorWorkAreaPhys(display) : null;
    const fullMon = display ? this.getFullMonitorPhys(display) : this.fullMonitorPhys;

    if (this.registered && this.hwnd && SHAppBarMessage) {
      try {
        const abd = {
          cbSize: koffi.sizeof(APPBARDATA),
          hWnd: this.hwnd,
          uCallbackMessage: 0,
          uEdge: ABE_RIGHT,
          rc: { left: 0, top: 0, right: 0, bottom: 0 },
          lParam: 0
        };
        SHAppBarMessage(ABM_REMOVE, abd);
      } catch (err) {
        console.warn('[AppBar] ABM_REMOVE uyarısı:', err.message);
      }
    }

    if (this.usingSpiFallback && SystemParametersInfoW && cleanArea) {
      try {
        this.isUpdatingWorkArea = true;
        try {
          SystemParametersInfoW(SPI_SETWORKAREA, 0, cleanArea, 0);
          broadcastWorkAreaChange();
        } finally {
          this.isUpdatingWorkArea = false;
        }
      } catch {
        // Yoksay
      }
    }

    if (cleanArea && fullMon) {
      this.syncAllMaximizedWindows(cleanArea, fullMon);
    }

    this.registered = false;
    this.usingSpiFallback = false;
    this.activeWorkAreaPhys = null;
    this.lastKey = null;
    this.cachedRect = null;
  }
}

module.exports = new Win32AppBar();
