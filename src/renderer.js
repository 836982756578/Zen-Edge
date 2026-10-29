/**
 * Zen Side v2.0 — Renderer Denetleyicisi
 * Geliştirici: Serkan ŞENTÜRK (sL.)
 */

(async function initZenSideApp() {
  const initData = await window.sidebarAPI.getInitData();

  let config = initData.config;
  const userAgents = initData.userAgents;
  const appBarSupported = initData.appBarSupported;
  let systemDark = initData.systemDark;
  let displays = Array.isArray(initData.displays) ? initData.displays : [];
  let screenInfo = initData.screenInfo;

  // Çalışma zamanı durumu
  let activeSiteId = null;
  let splitSiteId = null;             // Alt bölmedeki ikinci sekme (Split-View)
  let toolsViewOpen = false;          // 0-RAM Yerleşik Mini Araçlar görünümü açık mı
  let lastOpenedSiteId =
    (config.settings.lastOpenedSiteId && config.sites.some((s) => s.id === config.settings.lastOpenedSiteId))
      ? config.settings.lastOpenedSiteId
      : (config.sites[0]?.id || null);
  let drawerOpen = false;
  let railTemporarilyRevealed = false;
  const webviewMap = new Map();       // siteId -> <webview>
  const readySet = new Set();         // dom-ready tamamlanmış siteId kümesi
  const lastActiveMap = new Map();    // siteId -> son etkileşim zamanı (ms)
  const sleepingSitesSet = new Set(); // Uyku moduna alınmış siteId kümesi
  const lastUrlMap = new Map();       // siteId -> uyku öncesi son açık URL
  const unreadMap = new Map();        // siteId -> { count: string, numeric: number, rawTitle: string }
  const audibleSet = new Set();       // Şu an ses çalan siteId kümesi
  const mutedSet = new Set();         // Sesi kapatılmış siteId kümesi
  let topUnreadSiteId = null;

  // Site düzenleme formu durumu
  let editingSiteId = null;
  let nameManuallyEdited = false;
  let workspaceManuallyEdited = false;
  let formIconState = {
    iconType: 'favicon',
    iconValue: '',
    iconBg: window.SIDEBAR_PRESETS.gradients[0].value
  };

  // DOM Referansları
  const body = document.body;
  const edgeHandle = document.getElementById('edge-handle');
  const edgeUnreadBadge = document.getElementById('edge-unread-badge');
  const appTower = document.getElementById('app-tower');
  const webviewsStage = document.getElementById('webviews-stage');
  const toolsStage = document.getElementById('tools-stage');
  const emptyPlaceholder = document.getElementById('empty-stage-placeholder');
  const loadingBar = document.getElementById('loading-bar');
  const resizeGrip = document.getElementById('resize-grip');
  const railResizeGrip = document.getElementById('rail-resize-grip');

  // Split-View (Çift Sekme Bölünmüş Görünüm)
  const splitDividerBar = document.getElementById('split-divider-bar');
  const splitDragHandle = document.getElementById('split-drag-handle');
  const splitSiteBadge = document.getElementById('split-site-badge');
  const splitSiteSelect = document.getElementById('split-site-select');
  const btnSplitSwap = document.getElementById('btn-split-swap');
  const btnSplitReload = document.getElementById('btn-split-reload');
  const btnSplitOpenEdge = document.getElementById('btn-split-open-edge');
  const btnSplitClose = document.getElementById('btn-split-close');

  // Üst çubuk
  const headerTitleBox = document.getElementById('header-title-box');
  const headerSiteBadge = document.getElementById('header-site-badge');
  const headerSiteName = document.getElementById('header-site-name');
  const headerSiteDomain = document.getElementById('header-site-domain');
  const headerWebActions = document.getElementById('header-web-actions');
  const inlineUrlForm = document.getElementById('inline-url-form');
  const inlineUrlInput = document.getElementById('inline-url-input');
  const btnNavBack = document.getElementById('btn-nav-back');
  const btnNavForward = document.getElementById('btn-nav-forward');
  const btnNavReload = document.getElementById('btn-nav-reload');
  const btnToggleUa = document.getElementById('btn-toggle-ua');
  const btnToggleAdblock = document.getElementById('btn-toggle-adblock');
  const btnSplitView = document.getElementById('btn-split-view');
  const btnEditCurrent = document.getElementById('btn-edit-current');
  const btnOpenEdge = document.getElementById('btn-open-edge');
  const btnPinDrawer = document.getElementById('btn-pin-drawer');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');

  // Rail butonları
  const btnRailBrand = document.getElementById('btn-rail-brand');
  const btnRailWorkspace = document.getElementById('btn-rail-workspace');
  const railWsBadge = document.getElementById('rail-ws-badge');
  const btnRailAdd = document.getElementById('btn-rail-add');
  const btnEmptyAdd = document.getElementById('btn-empty-add');
  const btnRailSnip = document.getElementById('btn-rail-snip');
  const btnRailTools = document.getElementById('btn-rail-tools');
  const btnRailDisplay = document.getElementById('btn-rail-display');
  const btnRailGlass = document.getElementById('btn-rail-glass');
  const btnRailDock = document.getElementById('btn-rail-dock');
  const btnRailAutohide = document.getElementById('btn-rail-autohide');
  const btnRailSettings = document.getElementById('btn-rail-settings');

  // Site Ekle / Özelleştir Stüdyosu
  const siteModal = document.getElementById('studio-site-modal');
  const studioModalTitle = document.getElementById('studio-modal-title');
  const siteForm = document.getElementById('site-editor-form');
  const inputSiteUrl = document.getElementById('input-site-url');
  const inputSiteName = document.getElementById('input-site-name');
  const inputSiteWorkspace = document.getElementById('input-site-workspace');
  const inputMonogram = document.getElementById('input-monogram-text');
  const inputCustomIconUrl = document.getElementById('input-custom-icon-url');
  const inputCustomBgColor = document.getElementById('input-custom-bg-color');
  const inputMobileMode = document.getElementById('input-mobile-mode');
  const inputKeepAwake = document.getElementById('input-keep-awake');
  const inputIsolatedSession = document.getElementById('input-isolated-session');
  const inputSiteZoom = document.getElementById('input-site-zoom');
  const zoomValueLabel = document.getElementById('zoom-value-label');
  const previewIconBox = document.getElementById('preview-icon-box');
  const previewTabAccent = document.getElementById('preview-tab-accent');
  const previewTabText = document.getElementById('preview-tab-text');
  const previewTitleText = document.getElementById('preview-title-text');
  const previewUrlText = document.getElementById('preview-url-text');
  const quickTemplatesSection = document.getElementById('quick-templates-section');
  const quickTemplatesStrip = document.getElementById('quick-templates-strip');
  const presetIconsGrid = document.getElementById('preset-icons-grid');
  const emojiPickerGrid = document.getElementById('emoji-picker-grid');
  const gradientSwatches = document.getElementById('gradient-swatches');
  const btnUploadIcon = document.getElementById('btn-upload-icon');
  const btnDeleteSite = document.getElementById('btn-delete-site');
  const btnCancelSite = document.getElementById('btn-cancel-site');
  const btnCloseSiteModal = document.getElementById('btn-close-site-modal');

  // Ayarlar Stüdyosu
  const settingsModal = document.getElementById('studio-settings-modal');
  const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
  const workspaceFilterBar = document.getElementById('workspace-filter-bar');
  const setTargetDisplay = document.getElementById('set-target-display');
  const setAdblockEnabled = document.getElementById('set-adblock-enabled');
  const adblockStatsBadge = document.getElementById('adblock-stats-badge');
  const glassTintGrid = document.getElementById('glass-tint-grid');
  const setPanelWidth = document.getElementById('set-panel-width');
  const panelWidthLabel = document.getElementById('panel-width-label');
  const setRailWidth = document.getElementById('set-rail-width');
  const railWidthLabel = document.getElementById('rail-width-label');
  const setDockReserve = document.getElementById('set-dock-reserve');
  const setAutocloseOutside = document.getElementById('set-autoclose-outside');
  const setAutohide = document.getElementById('set-autohide');
  const setOpenInEdge = document.getElementById('set-open-in-edge');
  const setSkipTaskbar = document.getElementById('set-skip-taskbar');
  const setLaunchStartup = document.getElementById('set-launch-startup');
  const setHotkey = document.getElementById('set-hotkey');
  const btnApplyHotkey = document.getElementById('btn-apply-hotkey');
  const setSnipHotkey = document.getElementById('set-snip-hotkey');
  const btnApplySnipHotkey = document.getElementById('btn-apply-snip-hotkey');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const btnClearCookies = document.getElementById('btn-clear-cookies');
  const btnQuitApp = document.getElementById('btn-quit-app');
  const sleepStatusLabel = document.getElementById('sleep-status-label');
  const btnSleepNow = document.getElementById('btn-sleep-now');

  const toastBanner = document.getElementById('toast-banner');
  let toastTimer = null;

  // ==================== YARDIMCI FONKSİYONLAR ====================

  function showToast(msg) {
    toastBanner.textContent = msg;
    toastBanner.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastBanner.classList.add('hidden');
    }, 2400);
  }

  function normalizeUrl(raw, allowSearch = false) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^(localhost|127\.0\.0\.1|192\.168\.|10\.)/i.test(trimmed)) {
      return `http://${trimmed}`;
    }
    if (!trimmed.includes(' ') && trimmed.includes('.')) {
      return `https://${trimmed}`;
    }
    if (allowSearch) {
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }
    return `https://${trimmed}`;
  }

  function extractDomain(urlStr) {
    try {
      const u = new URL(normalizeUrl(urlStr));
      return u.hostname.replace(/^www\./i, '');
    } catch {
      return '';
    }
  }

  function deriveNameFromUrl(urlStr) {
    const host = extractDomain(urlStr);
    if (!host) return '';
    const parts = host.split('.');
    const core = parts.length > 2 && ['web', 'm', 'app', 'open', 'mail'].includes(parts[0])
      ? parts[1]
      : parts[0];
    return core.charAt(0).toUpperCase() + core.slice(1);
  }

  function inferWorkspaceFromUrlOrName(urlStr, nameStr = '') {
    const combined = `${urlStr || ''} ${nameStr || ''}`;
    if (/gemini|chatgpt|openai|claude|copilot|perplexity|deepseek|huggingface|poe\.com/i.test(combined)) {
      return 'ai';
    }
    if (/whatsapp|telegram|discord|messenger|instagram|youtube|spotify|netflix|twitter|x\.com/i.test(combined)) {
      return 'personal';
    }
    if (/github|gitlab|notion|slack|teams|jira|trello|linkedin|docs\.google|drive\.google|calendar\.google|outlook|office/i.test(combined)) {
      return 'work';
    }
    return 'general';
  }

  function getGoogleFaviconUrl(urlStr) {
    try {
      const u = new URL(normalizeUrl(urlStr));
      return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(u.origin)}`;
    } catch {
      return '';
    }
  }

  function getMonogramFallback(name) {
    const clean = (name || '?').trim();
    if (!clean) return '?';
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }

  function isStudioOpen() {
    return !siteModal.classList.contains('hidden') || !settingsModal.classList.contains('hidden');
  }

  function getActiveSite() {
    return config.sites.find((s) => s.id === activeSiteId) || null;
  }

  function getWorkspacesList() {
    return Array.isArray(config.workspaces) && config.workspaces.length
      ? config.workspaces
      : [
          { id: 'all', name: 'Tümü', badge: '✦' },
          { id: 'general', name: 'Genel', badge: '🌐' },
          { id: 'ai', name: 'Yapay Zeka', badge: '✨' },
          { id: 'work', name: 'İş', badge: '💼' },
          { id: 'personal', name: 'Kişisel', badge: '🏠' }
        ];
  }

  function getVisibleSites() {
    const activeWs = config.settings.activeWorkspace || 'all';
    if (activeWs === 'all') return config.sites;
    return config.sites.filter((s) => (s.workspace || 'general') === activeWs);
  }

  function isMessagingUrl(urlStr) {
    return /whatsapp|telegram|discord|slack|teams\.microsoft|messenger\.com/i.test(urlStr || '');
  }

  function parseUnreadFromTitle(rawTitle) {
    const cleaned = String(rawTitle || '')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
      .trim();
    if (!cleaned) return { count: '', numeric: 0 };

    const leadMatch = cleaned.match(/^[(\[]\s*(\d{1,3}\+?)\s*[)\]]/);
    if (leadMatch) {
      const n = parseInt(leadMatch[1], 10) || 1;
      return { count: n > 99 ? '99+' : leadMatch[1], numeric: n };
    }

    const kwMatch = cleaned.match(
      /(?:inbox|gelen\s*kutusu|okunmamış|unread|messages?|mesaj|bildirim|whatsapp|telegram|discord|slack|messenger|teams|mail)\s*[(\[]\s*(\d{1,3}\+?)\s*[)\]]/i
    );
    if (kwMatch) {
      const n = parseInt(kwMatch[1], 10) || 0;
      if (n > 0) {
        return { count: n > 99 ? '99+' : kwMatch[1], numeric: n };
      }
    }

    if (/^[•●◉]\s+/.test(cleaned)) {
      return { count: '•', numeric: 1 };
    }

    return { count: '', numeric: 0 };
  }

  function syncUnreadSummaryUI() {
    let total = 0;
    let hasDotOnly = false;
    const detailsList = [];
    let firstSiteId = null;

    config.sites.forEach((site) => {
      const u = unreadMap.get(site.id);
      if (u && u.numeric > 0) {
        if (!firstSiteId) firstSiteId = site.id;
        if (u.count === '•') {
          hasDotOnly = true;
          detailsList.push(`${site.name} (•)`);
        } else {
          total += u.numeric;
          detailsList.push(`${site.name} (${u.count})`);
        }
      }
    });

    const effectiveTotal = total > 0 ? total : (hasDotOnly ? 1 : 0);
    const badgeText = total > 99 ? '99+' : (total > 0 ? String(total) : (hasDotOnly ? '•' : ''));
    topUnreadSiteId = firstSiteId;

    if (edgeHandle) {
      edgeHandle.classList.toggle('has-unread', effectiveTotal > 0);
      edgeHandle.title = effectiveTotal > 0
        ? `Yeni Bildirim: ${detailsList.join(', ')} (Tıklayın veya kenara yaklaşın)`
        : 'Zen Side\'ı Aç (Fareyi ekran kenarına yaklaştırınca otomatik açılır)';
    }
    if (edgeUnreadBadge) {
      edgeUnreadBadge.textContent = badgeText || '0';
      edgeUnreadBadge.classList.toggle('hidden', effectiveTotal === 0);
    }

    if (window.sidebarAPI && typeof window.sidebarAPI.setUnreadSummary === 'function') {
      window.sidebarAPI.setUnreadSummary({
        total: effectiveTotal,
        badgeText,
        details: detailsList.join(', '),
        topSiteId: firstSiteId
      });
    }
  }

  function updateSiteUnreadFromTitle(siteId, rawTitle) {
    const parsed = parseUnreadFromTitle(rawTitle);
    const prev = unreadMap.get(siteId) || { count: '', numeric: 0 };
    if (prev.count === parsed.count && prev.numeric === parsed.numeric) {
      return;
    }

    if (parsed.numeric > 0) {
      unreadMap.set(siteId, { ...parsed, rawTitle: String(rawTitle || '') });
    } else {
      unreadMap.delete(siteId);
    }

    renderRail();
    if (activeSiteId === siteId && !toolsViewOpen) {
      updateHeaderUI();
    }
    syncUnreadSummaryUI();
  }

  function updateSleepStatusUI() {
    if (!sleepStatusLabel) return;
    const activeCount = webviewMap.size;
    const sleepingCount = sleepingSitesSet.size;
    sleepStatusLabel.textContent = sleepingCount > 0
      ? `Bellekte aktif: ${activeCount} sekme • Uykuda: ${sleepingCount} sekme`
      : `Bellekte aktif: ${activeCount} sekme`;
  }

  function updateAdblockUI() {
    const enabled = Boolean(config.settings.adblockEnabled);
    const total = Number(config.settings.adblockTotalBlocked) || 0;
    if (btnToggleAdblock) {
      btnToggleAdblock.classList.toggle('active', enabled);
      btnToggleAdblock.title = `Dahili Reklam & İzleyici Engelleyici: ${enabled ? 'Aktif' : 'Kapalı'}\n(Toplam engellenen: ${total})`;
    }
    if (setAdblockEnabled) {
      setAdblockEnabled.checked = enabled;
    }
    if (adblockStatsBadge) {
      adblockStatsBadge.textContent = `🛡️ Engellenen reklam & izleyici: ${total}`;
    }
  }

  function populateMonitorsSelect() {
    if (!setTargetDisplay) return;
    setTargetDisplay.innerHTML = '';
    const savedId = config.settings.displayId;
    displays.forEach((d) => {
      const val = d.isPrimary ? '' : String(d.id);
      const opt = new Option(d.label, val);
      if ((savedId === null || savedId === undefined) && d.isPrimary) {
        opt.selected = true;
      } else if (savedId !== null && savedId !== undefined && String(savedId) === String(d.id)) {
        opt.selected = true;
      }
      setTargetDisplay.appendChild(opt);
    });
  }

  function renderWorkspaceControls() {
    const wsList = getWorkspacesList();
    const curWsId = config.settings.activeWorkspace || 'all';
    const curWs = wsList.find((w) => w.id === curWsId) || wsList[0];

    if (railWsBadge) {
      railWsBadge.textContent = curWs.badge || '✦';
    }
    if (btnRailWorkspace) {
      btnRailWorkspace.classList.toggle('filtered', curWs.id !== 'all');
      btnRailWorkspace.title = `Çalışma Alanı: ${curWs.name}\n(Sol Tık: Sonraki Profil | Sağ Tık: Profil Seç)`;
    }

    if (workspaceFilterBar) {
      workspaceFilterBar.innerHTML = '';
      wsList.forEach((ws) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `note-pill ${ws.id === curWs.id ? 'active' : ''}`;
        chip.textContent = `${ws.badge} ${ws.name}`;
        chip.addEventListener('click', () => setActiveWorkspace(ws.id));
        workspaceFilterBar.appendChild(chip);
      });
    }
  }

  async function setActiveWorkspace(wsId) {
    const wsList = getWorkspacesList();
    const target = wsList.find((w) => w.id === wsId) || wsList[0];
    config = await window.sidebarAPI.updateSettings({ activeWorkspace: target.id });
    renderWorkspaceControls();
    renderRail();
    showToast(`Çalışma Alanı: ${target.badge} ${target.name}`);
  }

  function renderIconInto(el, siteLike) {
    el.innerHTML = '';
    const type = siteLike.iconType || 'favicon';
    const bg = siteLike.iconBg || 'rgba(255, 255, 255, 0.08)';

    if (type === 'favicon') {
      el.style.background = siteLike.iconBg && siteLike.iconBg !== 'rgba(255, 255, 255, 0.09)'
        ? siteLike.iconBg
        : '';
      el.style.color = '#ffffff';
      const favSrc = siteLike.cachedFavicon || getGoogleFaviconUrl(siteLike.url);
      if (favSrc) {
        const img = document.createElement('img');
        img.src = favSrc;
        img.alt = siteLike.name || '';
        img.onerror = () => {
          el.innerHTML = '';
          const span = document.createElement('span');
          span.className = 'monogram-label';
          span.textContent = getMonogramFallback(siteLike.name);
          el.appendChild(span);
        };
        el.appendChild(img);
        return;
      }
    }

    if (type === 'preset') {
      el.style.background = bg;
      el.style.color = '#ffffff';
      const svg = window.SIDEBAR_PRESETS.icons[siteLike.iconValue] || window.SIDEBAR_PRESETS.icons.globe;
      el.innerHTML = svg;
      return;
    }

    if (type === 'custom' && siteLike.iconValue) {
      el.style.background = bg;
      const img = document.createElement('img');
      img.src = siteLike.iconValue;
      img.alt = siteLike.name || '';
      img.onerror = () => {
        el.innerHTML = '';
        const span = document.createElement('span');
        span.className = 'monogram-label';
        span.textContent = getMonogramFallback(siteLike.name);
        el.appendChild(span);
      };
      el.appendChild(img);
      return;
    }

    el.style.background = bg;
    el.style.color = '#ffffff';
    const span = document.createElement('span');
    span.className = 'monogram-label';
    span.textContent = (siteLike.iconValue || getMonogramFallback(siteLike.name)).slice(0, 4);
    el.appendChild(span);
  }

  // ==================== TEMA, MICA/CAM, KENAR VE PENCERE DURUMU ====================

  function getClampedRailWidth() {
    return Math.max(22, Math.min(160, Number(config.settings.railWidth) || 22));
  }

  function applyThemeAndEdge() {
    const material = config.settings.material || 'acrylic';
    const glassTint = config.settings.glassTint || 'ios-crystal';
    document.documentElement.setAttribute('data-material', material);
    document.documentElement.setAttribute('data-tint', glassTint);

    const themePref = config.settings.theme || 'dark';
    let effectiveTheme = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;
    if (glassTint === 'ios-pearl') {
      effectiveTheme = 'light';
    }
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    const edge = config.settings.edge === 'left' ? 'left' : 'right';
    body.classList.toggle('edge-left', edge === 'left');
    body.classList.toggle('edge-right', edge === 'right');

    const railWidth = getClampedRailWidth();
    body.style.setProperty('--rail-w', `${railWidth}px`);
    body.classList.toggle('wide-rail', railWidth >= 58);

    const dispMode = ['text', 'icon', 'both'].includes(config.settings.railDisplayMode)
      ? config.settings.railDisplayMode
      : 'text';
    body.classList.toggle('display-text', dispMode === 'text');
    body.classList.toggle('display-icon', dispMode === 'icon');
    body.classList.toggle('display-both', dispMode === 'both');

    btnRailDock.classList.toggle('active', Boolean(config.settings.dockReserve));
    btnRailAutohide.classList.toggle('active', Boolean(config.settings.autoHide));
    if (btnRailTools) {
      btnRailTools.classList.toggle('active', drawerOpen && toolsViewOpen && !isStudioOpen());
    }
    btnPinDrawer.classList.toggle('active', Boolean(config.settings.isPinned));
    btnPinDrawer.title = config.settings.isPinned
      ? 'Sekme Sabitli: Boş bir yere / sayfaya tıklayınca açık kalır (Otomatik kapanması için tıklayın)'
      : 'Otomatik Kapanma Aktif: Boş bir yere / sayfaya tıklayınca kapanır (Sabitlemek için tıklayın)';

    if (btnRailDisplay) {
      const dispLabels = {
        text: 'Sadece İsim',
        icon: 'Sadece Simge',
        both: 'Simge + İsim'
      };
      btnRailDisplay.classList.toggle('active', dispMode !== 'text');
      btnRailDisplay.title = `Sekme Görünümü: ${dispLabels[dispMode]}\n(Tıkla: İsim / Sadece Simge / Simge + İsim)`;
    }
    if (btnRailGlass) {
      const tintObj = (window.SIDEBAR_PRESETS.glassTints || []).find((t) => t.id === glassTint);
      btnRailGlass.classList.toggle('active', material !== 'none');
      btnRailGlass.title = `Mica / iOS Cam Rengi: ${tintObj ? tintObj.name : glassTint}\n(Tıkla: Sonraki Cam Rengi | Shift+Tık: Mica/iOS Cam Motoru)`;
    }

    if (!appBarSupported) {
      btnRailDock.style.display = 'none';
      document.getElementById('row-dock-reserve').style.display = 'none';
    }

    const activeSite = toolsViewOpen ? null : getActiveSite();
    const effectivePanelW = Math.round(activeSite?.customWidth || config.settings.panelWidth || 420);
    const maxPanelW = Math.max(420, Math.floor(screenInfo.width * 0.78) - railWidth);
    if (setPanelWidth) {
      setPanelWidth.max = String(maxPanelW);
      setPanelWidth.value = String(Math.min(maxPanelW, Math.max(280, effectivePanelW)));
    }
    if (panelWidthLabel) panelWidthLabel.textContent = `${effectivePanelW} px`;
    if (setRailWidth) setRailWidth.value = String(railWidth);
    if (railWidthLabel) railWidthLabel.textContent = `${railWidth} px`;
    setDockReserve.checked = Boolean(config.settings.dockReserve);
    if (setAutocloseOutside) setAutocloseOutside.checked = !config.settings.isPinned;
    setAutohide.checked = Boolean(config.settings.autoHide);
    setOpenInEdge.checked = config.settings.openLinksInEdge !== false;
    setSkipTaskbar.checked = Boolean(config.settings.skipTaskbar);
    setLaunchStartup.checked = Boolean(config.settings.launchAtStartup);
    setHotkey.value = config.settings.hotkey || 'Alt+S';
    if (setSnipHotkey) setSnipHotkey.value = config.settings.snipHotkey || 'Alt+Shift+S';

    const sleepMins = String(config.settings.autoSleepMinutes ?? 15);
    document.querySelectorAll('[data-display-choice]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.displayChoice === dispMode);
    });
    document.querySelectorAll('[data-sleep-choice]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sleepChoice === sleepMins);
    });
    document.querySelectorAll('[data-edge-choice]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.edgeChoice === edge);
    });
    document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themeChoice === themePref);
    });
    document.querySelectorAll('[data-material-choice]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.materialChoice === material);
    });
    document.querySelectorAll('.glass-tint-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.tintId === glassTint);
    });

    populateMonitorsSelect();
    renderWorkspaceControls();
    updateAdblockUI();
    updateSleepStatusUI();
  }

  async function syncWindowMode() {
    const studioActive = isStudioOpen();
    let targetMode = 'rail';

    if (drawerOpen || studioActive) {
      targetMode = 'expanded';
    } else if (config.settings.autoHide && !railTemporarilyRevealed) {
      targetMode = 'handle';
    } else {
      targetMode = 'rail';
    }

    const railWidth = getClampedRailWidth();
    const activeSite = toolsViewOpen ? null : getActiveSite();
    let effectiveWidth = activeSite?.customWidth || config.settings.panelWidth || 420;
    if ((studioActive || toolsViewOpen) && effectiveWidth < 420) {
      effectiveWidth = 420;
    }

    body.classList.toggle('mode-handle', targetMode === 'handle');
    body.classList.toggle('mode-rail', targetMode === 'rail');
    body.classList.toggle('mode-expanded', targetMode === 'expanded');

    await window.sidebarAPI.setWindowState({
      mode: targetMode,
      railWidth,
      panelWidth: effectiveWidth,
      handleYRatio: config.settings.handleYRatio ?? 0.38,
      modalOpen: studioActive,
      isDragging: false
    });
  }

  // ==================== ÇİFT SEKME BÖLÜNMÜŞ GÖRÜNÜM (SPLIT-VIEW) ====================

  function isSplitActive() {
    return Boolean(
      !toolsViewOpen &&
      drawerOpen &&
      activeSiteId &&
      splitSiteId &&
      splitSiteId !== activeSiteId &&
      config.sites.some((s) => s.id === splitSiteId)
    );
  }

  function updateSplitBarUI() {
    if (!splitDividerBar || !splitSiteSelect) return;
    const secondary = config.sites.find((s) => s.id === splitSiteId);
    if (!secondary) return;

    renderIconInto(splitSiteBadge, secondary);
    splitSiteSelect.innerHTML = '';
    config.sites
      .filter((s) => s.id !== activeSiteId)
      .forEach((s) => {
        const opt = new Option(s.name, s.id);
        if (s.id === splitSiteId) opt.selected = true;
        splitSiteSelect.appendChild(opt);
      });
  }

  function syncWebviewVisibility() {
    const splitOn = isSplitActive();
    if (!splitOn && splitSiteId === activeSiteId) {
      splitSiteId = null;
    }

    const ratio = Math.max(0.22, Math.min(0.78, Number(config.settings.splitRatio) || 0.5));
    webviewsStage.style.setProperty('--split-ratio', String(ratio));
    webviewsStage.classList.toggle('split-active', splitOn);
    if (splitDividerBar) splitDividerBar.classList.toggle('hidden', !splitOn);
    if (btnSplitView) btnSplitView.classList.toggle('active', splitOn);

    webviewsStage.classList.toggle('hidden', toolsViewOpen);
    if (toolsStage) toolsStage.classList.toggle('hidden', !toolsViewOpen);
    if (headerWebActions) headerWebActions.classList.toggle('hidden', toolsViewOpen);

    webviewMap.forEach((view, id) => {
      view.classList.toggle('active-view', !toolsViewOpen && id === activeSiteId);
      view.classList.toggle('split-secondary-view', splitOn && id === splitSiteId);
    });

    if (splitOn) {
      updateSplitBarUI();
    }
  }

  async function openSplitWithSite(targetSecondaryId) {
    if (config.sites.length < 2) {
      showToast('Bölünmüş görünüm için en az 2 sekme gereklidir');
      return;
    }

    closeAllStudios(false);
    toolsViewOpen = false;

    if (!activeSiteId || activeSiteId === targetSecondaryId) {
      const fallbackPrimary =
        (lastOpenedSiteId && lastOpenedSiteId !== targetSecondaryId && config.sites.some((s) => s.id === lastOpenedSiteId))
          ? lastOpenedSiteId
          : config.sites.find((s) => s.id !== targetSecondaryId)?.id;
      if (!fallbackPrimary) return;
      activeSiteId = fallbackPrimary;
    }

    const primarySite = config.sites.find((s) => s.id === activeSiteId);
    const secondarySite = config.sites.find((s) => s.id === targetSecondaryId);
    if (!primarySite || !secondarySite) return;

    splitSiteId = secondarySite.id;
    drawerOpen = true;
    railTemporarilyRevealed = true;
    emptyPlaceholder.classList.add('hidden');

    createOrGetWebview(primarySite);
    createOrGetWebview(secondarySite);

    syncWebviewVisibility();
    applyThemeAndEdge();
    updateHeaderUI();
    renderRail();
    await syncWindowMode();
    showToast(`⬒ Bölünmüş Görünüm: ${primarySite.name} + ${secondarySite.name}`);
  }

  function closeSplitView() {
    splitSiteId = null;
    syncWebviewVisibility();
    renderRail();
  }

  // ==================== SÜRÜKLE & BIRAK SÜPER GÜCÜ ====================

  function pasteClipboardIntoWebview(wv, isImage = false) {
    if (!wv) return;
    const doPaste = () => {
      try {
        wv.focus();
        wv.executeJavaScript(`
          (function() {
            const cur = document.activeElement;
            const isEditable = cur && (cur.tagName === 'TEXTAREA' || cur.tagName === 'INPUT' || cur.isContentEditable);
            if (!isEditable) {
              const candidate = document.querySelector(
                '[contenteditable="true"][role="textbox"], div[contenteditable="true"], textarea, input[type="search"], input[type="text"]'
              );
              if (candidate) candidate.focus();
            }
          })();
        `).catch(() => {});
        setTimeout(() => {
          try {
            wv.focus();
            wv.paste();
          } catch {}
        }, 90);
      } catch {}
    };

    const siteId = wv.dataset.siteId;
    if (readySet.has(siteId)) {
      setTimeout(doPaste, isImage ? 220 : 120);
    } else {
      wv.addEventListener('dom-ready', () => {
        setTimeout(doPaste, 520);
      }, { once: true });
    }
  }

  async function deliverDroppedTextToSite(site, rawText) {
    const text = String(rawText || '').trim();
    if (!text) return;

    closeAllStudios(false);
    await openSiteInDrawer(site.id);
    const wv = createOrGetWebview(site);
    const host = extractDomain(site.url).toLowerCase();

    // 1) Google Çeviri veya DeepL -> Doğrudan anında çeviri
    if (host.includes('translate.google.')) {
      const trUrl = `https://translate.google.com/?sl=auto&tl=tr&text=${encodeURIComponent(text)}&op=translate`;
      if (readySet.has(site.id)) wv.loadURL(trUrl);
      else wv.setAttribute('src', trUrl);
      showToast(`"${text.slice(0, 26)}${text.length > 26 ? '…' : ''}" çevriliyor`);
      return;
    }

    if (host.includes('deepl.com')) {
      const dlUrl = `https://www.deepl.com/translator#auto/tr/${encodeURIComponent(text)}`;
      if (readySet.has(site.id)) wv.loadURL(dlUrl);
      else wv.setAttribute('src', dlUrl);
      showToast(`${site.name} üzerinde çevriliyor`);
      return;
    }

    // 2) Arama Motorları & YouTube -> Doğrudan arama (veya URL ise doğrudan açma)
    const isGoogleSearchHost =
      /^(www\.)?google\.[a-z.]+$/i.test(host) &&
      !/gemini|translate|docs|drive|mail|calendar|keep/i.test(host);

    if (isGoogleSearchHost || host.includes('bing.com') || host.includes('duckduckgo.com')) {
      const targetUrl = /^https?:\/\/\S+$/i.test(text)
        ? text
        : (host.includes('bing.com')
            ? `https://www.bing.com/search?q=${encodeURIComponent(text)}`
            : (host.includes('duckduckgo.com')
                ? `https://duckduckgo.com/?q=${encodeURIComponent(text)}`
                : `https://www.google.com/search?q=${encodeURIComponent(text)}`));
      if (readySet.has(site.id)) wv.loadURL(targetUrl);
      else wv.setAttribute('src', targetUrl);
      showToast(`${site.name} üzerinde açıldı`);
      return;
    }

    if (host.includes('youtube.com')) {
      const ytUrl = /^https?:\/\/\S+$/i.test(text)
        ? text
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`;
      if (readySet.has(site.id)) wv.loadURL(ytUrl);
      else wv.setAttribute('src', ytUrl);
      showToast(`YouTube'da aranıyor`);
      return;
    }

    // 3) Gemini, ChatGPT, Claude, WhatsApp vb. Mesajlaşma / Yapay Zeka -> Panoya kopyala & mesaj kutusuna yapıştır
    await window.sidebarAPI.writeClipboardText(text);
    pasteClipboardIntoWebview(wv, false);
    showToast(`Metin ${site.name} sekmesine aktarıldı`);
  }

  async function deliverDroppedFilesToSite(site, fileList) {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    let copied = false;

    const nativePath = window.sidebarAPI.getFilePath(file);
    if (nativePath && /\.(png|jpe?g|webp|gif|bmp|ico)$/i.test(nativePath)) {
      copied = await window.sidebarAPI.copyImageFile(nativePath);
    }

    if (!copied && file.type && file.type.startsWith('image/')) {
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        copied = await window.sidebarAPI.copyImageDataUrl(dataUrl);
      }
    }

    closeAllStudios(false);
    await openSiteInDrawer(site.id);
    const wv = createOrGetWebview(site);

    if (copied) {
      pasteClipboardIntoWebview(wv, true);
      showToast(`Görsel ${site.name} sekmesine yapıştırıldı`);
    } else if (nativePath) {
      await window.sidebarAPI.writeClipboardText(nativePath);
      pasteClipboardIntoWebview(wv, false);
      showToast(`Dosya yolu kopyalandı: ${file.name}`);
    }
  }

  // ==================== İKON KULESİ (RAIL) ÇİZİMİ & SÜRÜKLE-BIRAK ====================

  let draggedSiteId = null;

  function renderRail() {
    appTower.innerHTML = '';
    const visibleSites = getVisibleSites();

    visibleSites.forEach((site, index) => {
      const fullIdx = config.sites.findIndex((s) => s.id === site.id);
      const btn = document.createElement('div');
      btn.className = 'rail-item';

      const isLoaded = webviewMap.has(site.id);
      const isSleeping = !isLoaded && sleepingSitesSet.has(site.id);
      const isAudible = isLoaded && audibleSet.has(site.id);
      const isMuted = isLoaded && mutedSet.has(site.id);
      const unread = unreadMap.get(site.id);
      const hasUnread = Boolean(unread && unread.numeric > 0);
      const isPrimaryActive = drawerOpen && !toolsViewOpen && activeSiteId === site.id && !isStudioOpen();
      const isSecondarySplit = isSplitActive() && splitSiteId === site.id && !isStudioOpen();

      if (isPrimaryActive || isSecondarySplit) {
        btn.classList.add('active');
      }
      if (isLoaded) btn.classList.add('is-loaded');
      if (isSleeping) btn.classList.add('is-sleeping');
      if (isAudible) btn.classList.add('is-audible');
      if (isMuted) btn.classList.add('is-muted');
      if (hasUnread) btn.classList.add('has-unread');

      const statusNotes = [];
      if (isSecondarySplit) statusNotes.push('⬒ Alt Bölmede Açık');
      if (hasUnread) statusNotes.push(`🔔 ${unread.count} Yeni Bildirim`);
      if (isAudible && !isMuted) statusNotes.push('🔊 Ses Çalıyor');
      if (isMuted) statusNotes.push('🔇 Sessize Alındı');
      if (isSleeping) statusNotes.push('💤 Uyku Modunda');
      else if (site.keepAwake) statusNotes.push('⚡ Bildirimler İçin Uyanık');

      const shortcutHint = index < 9 ? ` [Alt+${index + 1}]` : '';
      btn.title = [
        `${site.name}${shortcutHint}`,
        statusNotes.length ? statusNotes.join(' • ') : null,
        `${extractDomain(site.url)} (Shift+Tık: Bölünmüş Görünüm | Metin/Görsel Sürükle-Bırak)`
      ].filter(Boolean).join('\n');

      btn.draggable = true;
      btn.dataset.id = site.id;

      // 1) Renkli ince vurgu çizgisi
      const accentBar = document.createElement('span');
      accentBar.className = 'tab-accent-bar';
      if (site.iconBg && site.iconBg !== 'rgba(255, 255, 255, 0.09)') {
        accentBar.style.background = site.iconBg;
      }
      btn.appendChild(accentBar);

      // 2) Okunmamış bildirim sayacı rozeti
      if (hasUnread) {
        const badge = document.createElement('span');
        badge.className = 'tab-unread-badge';
        badge.textContent = unread.count;
        btn.appendChild(badge);
      }

      // 3) Durum noktası
      const liveDot = document.createElement('span');
      liveDot.className = 'tab-live-dot';
      btn.appendChild(liveDot);

      // 4) Uygulama Simgesi
      const iconBox = document.createElement('div');
      iconBox.className = 'tab-icon-box';
      renderIconInto(iconBox, site);
      btn.appendChild(iconBox);

      // 5) Sekme Başlığı
      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title-text';
      const baseName = site.name || 'Site';
      if (hasUnread) {
        titleSpan.textContent = unread.count === '•'
          ? `• ${baseName}`
          : `(${unread.count}) ${baseName}`;
      } else {
        titleSpan.textContent = baseName;
      }
      btn.appendChild(titleSpan);

      // Sol tık: Aç veya daralt (Shift+Tık: Alt Bölmede Split-View olarak aç!)
      btn.addEventListener('click', (e) => {
        if (e.shiftKey) {
          openSplitWithSite(site.id);
          return;
        }
        if (isStudioOpen()) {
          closeAllStudios(false);
          openSiteInDrawer(site.id);
          return;
        }
        if (drawerOpen && !toolsViewOpen && activeSiteId === site.id) {
          collapseDrawer();
        } else {
          openSiteInDrawer(site.id);
        }
      });

      // Sağ tık: Bağlam menüsü
      btn.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = await window.sidebarAPI.showSiteContextMenu({
          id: site.id,
          name: site.name,
          workspace: site.workspace || 'general',
          mobileMode: Boolean(site.mobileMode),
          keepAwake: Boolean(site.keepAwake),
          isMuted: mutedSet.has(site.id),
          isLoaded: webviewMap.has(site.id),
          index: fullIdx,
          total: config.sites.length
        });
        handleSiteContextAction(site.id, action);
      });

      // Sürükle-bırak: Hem Sekme Sıralama hem Dışarıdan Metin/Görsel/URL Bırakma Süper Gücü
      btn.addEventListener('dragstart', (e) => {
        draggedSiteId = site.id;
        e.dataTransfer.effectAllowed = 'move';
      });

      btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedSiteId !== null) {
          if (draggedSiteId === site.id) return;
          e.dataTransfer.dropEffect = 'move';
          btn.classList.add('drag-over');
        } else {
          e.dataTransfer.dropEffect = 'copy';
          btn.classList.add('external-drop-target');
        }
      });

      btn.addEventListener('dragleave', () => {
        btn.classList.remove('drag-over', 'external-drop-target');
      });

      btn.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove('drag-over', 'external-drop-target');

        // 1) Sekme kendi içinde sıralanıyorsa
        if (draggedSiteId !== null) {
          if (draggedSiteId === site.id) return;
          const fromIdx = config.sites.findIndex((s) => s.id === draggedSiteId);
          const toIdx = config.sites.findIndex((s) => s.id === site.id);
          draggedSiteId = null;
          if (fromIdx === -1 || toIdx === -1) return;

          const moved = config.sites.splice(fromIdx, 1)[0];
          config.sites.splice(toIdx, 0, moved);
          config = await window.sidebarAPI.updateSites(config.sites);
          renderRail();
          return;
        }

        // 2) Dışarıdan metin, URL veya görsel sürüklenip sekmenin üzerine bırakıldıysa
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          await deliverDroppedFilesToSite(site, e.dataTransfer.files);
          return;
        }

        const droppedText =
          e.dataTransfer.getData('text/plain') ||
          e.dataTransfer.getData('text/uri-list') ||
          '';
        if (droppedText.trim()) {
          await deliverDroppedTextToSite(site, droppedText);
        }
      });

      btn.addEventListener('dragend', () => {
        draggedSiteId = null;
        document.querySelectorAll('.rail-item.drag-over, .rail-item.external-drop-target').forEach((el) => {
          el.classList.remove('drag-over', 'external-drop-target');
        });
      });

      appTower.appendChild(btn);
    });
  }

  async function handleSiteContextAction(siteId, action) {
    if (!action) return;
    const idx = config.sites.findIndex((s) => s.id === siteId);
    if (idx === -1) return;
    const site = config.sites[idx];

    if (action.startsWith('workspace:')) {
      const targetWs = action.split(':')[1] || 'general';
      site.workspace = targetWs;
      config = await window.sidebarAPI.updateSites(config.sites);
      renderRail();
      const wsObj = getWorkspacesList().find((w) => w.id === targetWs);
      showToast(`${site.name} → ${wsObj ? wsObj.name : targetWs}`);
      return;
    }

    switch (action) {
      case 'open':
        closeAllStudios(false);
        openSiteInDrawer(site.id);
        break;
      case 'open-split':
        openSplitWithSite(site.id);
        break;
      case 'edit':
        openSiteEditor(site.id);
        break;
      case 'reload': {
        const wv = webviewMap.get(site.id);
        if (wv) wv.reload();
        break;
      }
      case 'toggle-mute': {
        const wv = webviewMap.get(site.id);
        if (wv) {
          const nextMuted = !mutedSet.has(site.id);
          if (nextMuted) mutedSet.add(site.id);
          else mutedSet.delete(site.id);
          try { wv.setAudioMuted(nextMuted); } catch {}
          renderRail();
          showToast(nextMuted ? `${site.name} sesi kapatıldı` : `${site.name} sesi açıldı`);
        }
        break;
      }
      case 'toggle-mobile': {
        site.mobileMode = !site.mobileMode;
        config = await window.sidebarAPI.updateSites(config.sites);
        recreateWebviewIfLoaded(site);
        if (activeSiteId === site.id) updateHeaderUI();
        showToast(site.mobileMode ? 'Mobil görünüm etkinleştirildi' : 'Masaüstü görünümü etkinleştirildi');
        break;
      }
      case 'toggle-keep-awake': {
        site.keepAwake = !site.keepAwake;
        config = await window.sidebarAPI.updateSites(config.sites);
        if (site.keepAwake && !webviewMap.has(site.id)) {
          createOrGetWebview(site);
        }
        renderRail();
        showToast(
          site.keepAwake
            ? `${site.name} bildirimler için uyanık tutulacak`
            : `${site.name} hareketsiz kalınca otomatik uyutulacak`
        );
        break;
      }
      case 'open-edge': {
        const wv = webviewMap.get(site.id);
        const currentUrl = (wv && safeGetWebviewUrl(wv)) || lastUrlMap.get(site.id) || site.url;
        window.sidebarAPI.openExternal(currentUrl, true);
        break;
      }
      case 'hibernate':
        hibernateSiteWebview(site.id, { collapseIfActive: true });
        showToast(`${site.name} uyku moduna alındı (RAM boşaltıldı)`);
        break;
      case 'move-up':
        if (idx > 0) {
          [config.sites[idx - 1], config.sites[idx]] = [config.sites[idx], config.sites[idx - 1]];
          config = await window.sidebarAPI.updateSites(config.sites);
          renderRail();
          syncUnreadSummaryUI();
        }
        break;
      case 'move-down':
        if (idx < config.sites.length - 1) {
          [config.sites[idx + 1], config.sites[idx]] = [config.sites[idx], config.sites[idx + 1]];
          config = await window.sidebarAPI.updateSites(config.sites);
          renderRail();
          syncUnreadSummaryUI();
        }
        break;
      case 'delete':
        await deleteSiteById(site.id);
        break;
    }
  }

  // ==================== WEBVIEW YAŞAM DÖNGÜSÜ, OTOMATİK UYKU & CANLI BİLDİRİMLER ====================

  function safeGetWebviewUrl(wv) {
    try {
      return wv.getURL();
    } catch {
      return '';
    }
  }

  function safeGetWebviewTitle(wv) {
    try {
      return wv.getTitle();
    } catch {
      return '';
    }
  }

  function createOrGetWebview(site) {
    if (webviewMap.has(site.id)) {
      lastActiveMap.set(site.id, Date.now());
      return webviewMap.get(site.id);
    }

    const wv = document.createElement('webview');
    const partition = site.isolatedSession ? `persist:edge-site-${site.id}` : 'persist:edge-sidebar';
    const restoreUrl = lastUrlMap.get(site.id) || normalizeUrl(site.url);
    wv.setAttribute('partition', partition);
    wv.setAttribute('useragent', site.mobileMode ? userAgents.mobile : userAgents.desktop);
    wv.setAttribute('allowpopups', 'true');
    wv.setAttribute('src', restoreUrl);
    wv.dataset.siteId = site.id;

    sleepingSitesSet.delete(site.id);
    readySet.delete(site.id);
    lastActiveMap.set(site.id, Date.now());

    wv.addEventListener('did-start-loading', () => {
      if (activeSiteId === site.id && !toolsViewOpen) {
        loadingBar.classList.add('loading');
      }
    });

    wv.addEventListener('did-stop-loading', () => {
      const curTitle = safeGetWebviewTitle(wv);
      if (curTitle) {
        updateSiteUnreadFromTitle(site.id, curTitle);
      }
      if (activeSiteId === site.id && !toolsViewOpen) {
        loadingBar.classList.remove('loading');
        updateHeaderNavButtons();
      }
    });

    wv.addEventListener('dom-ready', () => {
      readySet.add(site.id);
      try {
        wv.setZoomFactor(site.zoom || 1.0);
        if (mutedSet.has(site.id)) {
          wv.setAudioMuted(true);
        }
      } catch {}
      const curTitle = safeGetWebviewTitle(wv);
      if (curTitle) {
        updateSiteUnreadFromTitle(site.id, curTitle);
      }
      if (activeSiteId === site.id && !toolsViewOpen) {
        updateHeaderNavButtons();
      }
    });

    wv.addEventListener('did-navigate', (e) => {
      lastActiveMap.set(site.id, Date.now());
      if (e.url && /^https?:\/\//i.test(e.url)) {
        lastUrlMap.set(site.id, e.url);
      }
      if (activeSiteId === site.id && !toolsViewOpen) {
        headerSiteDomain.textContent = extractDomain(e.url) || e.url;
        updateHeaderNavButtons();
      }
    });

    wv.addEventListener('did-navigate-in-page', (e) => {
      if (e.isMainFrame) {
        lastActiveMap.set(site.id, Date.now());
        if (e.url && /^https?:\/\//i.test(e.url)) {
          lastUrlMap.set(site.id, e.url);
        }
        if (activeSiteId === site.id && !toolsViewOpen) {
          headerSiteDomain.textContent = extractDomain(e.url) || e.url;
          updateHeaderNavButtons();
        }
      }
    });

    wv.addEventListener('page-title-updated', (e) => {
      updateSiteUnreadFromTitle(site.id, e.title || '');
      if (activeSiteId === site.id && !toolsViewOpen && e.title) {
        headerSiteName.title = e.title;
      }
    });

    wv.addEventListener('media-started-playing', () => {
      audibleSet.add(site.id);
      lastActiveMap.set(site.id, Date.now());
      renderRail();
    });

    wv.addEventListener('media-paused', () => {
      audibleSet.delete(site.id);
      renderRail();
    });

    wv.addEventListener('page-favicon-updated', async (e) => {
      if (e.favicons && e.favicons.length > 0) {
        const bestFav = e.favicons[e.favicons.length - 1];
        if (bestFav && site.cachedFavicon !== bestFav) {
          site.cachedFavicon = bestFav;
          await window.sidebarAPI.updateSites(config.sites);
          if (site.iconType === 'favicon' || config.settings.railDisplayMode !== 'text') {
            renderRail();
            if (activeSiteId === site.id && !toolsViewOpen) updateHeaderUI();
          }
        }
      }
    });

    webviewsStage.appendChild(wv);
    webviewMap.set(site.id, wv);
    updateSleepStatusUI();
    return wv;
  }

  function recreateWebviewIfLoaded(site) {
    if (!webviewMap.has(site.id)) return;
    const wasPrimary = activeSiteId === site.id && drawerOpen && !toolsViewOpen;
    const wasSecondary = isSplitActive() && splitSiteId === site.id;
    const oldWv = webviewMap.get(site.id);
    const liveUrl = safeGetWebviewUrl(oldWv);
    if (liveUrl && /^https?:\/\//i.test(liveUrl)) {
      lastUrlMap.set(site.id, liveUrl);
    }
    oldWv.remove();
    webviewMap.delete(site.id);
    readySet.delete(site.id);
    audibleSet.delete(site.id);

    if (wasPrimary || wasSecondary || site.keepAwake) {
      createOrGetWebview(site);
    }
    syncWebviewVisibility();
    updateSleepStatusUI();
    renderRail();
  }

  function hibernateSiteWebview(siteId, { collapseIfActive = false } = {}) {
    const wv = webviewMap.get(siteId);
    if (!wv) return false;

    const liveUrl = safeGetWebviewUrl(wv);
    if (liveUrl && /^https?:\/\//i.test(liveUrl)) {
      lastUrlMap.set(siteId, liveUrl);
    }

    wv.remove();
    webviewMap.delete(siteId);
    readySet.delete(siteId);
    audibleSet.delete(siteId);
    sleepingSitesSet.add(siteId);
    updateSleepStatusUI();

    if (splitSiteId === siteId) {
      splitSiteId = null;
    }

    if (collapseIfActive && activeSiteId === siteId) {
      activeSiteId = null;
      collapseDrawer();
    } else {
      syncWebviewVisibility();
      renderRail();
    }
    return true;
  }

  function unloadSiteWebview(siteId) {
    hibernateSiteWebview(siteId, { collapseIfActive: true });
  }

  function sleepAllInactiveTabs(showFeedback = true) {
    let sleptCount = 0;
    for (const siteId of [...webviewMap.keys()]) {
      if (drawerOpen && !toolsViewOpen && (activeSiteId === siteId || splitSiteId === siteId)) continue;
      const site = config.sites.find((s) => s.id === siteId);
      if (site?.keepAwake || audibleSet.has(siteId)) continue;
      if (hibernateSiteWebview(siteId, { collapseIfActive: false })) {
        sleptCount++;
      }
    }
    updateSleepStatusUI();
    renderRail();
    if (showFeedback) {
      showToast(
        sleptCount > 0
          ? `${sleptCount} arka plan sekmesi uyku moduna alındı (RAM boşaltıldı)`
          : 'Uyutulacak boşta arka plan sekmesi yok'
      );
    }
    return sleptCount;
  }

  function checkAutoSleepTabs() {
    const mins = Number(config.settings.autoSleepMinutes ?? 15);
    if (!mins || mins <= 0) return;

    const now = Date.now();
    if (drawerOpen && !toolsViewOpen) {
      if (activeSiteId) lastActiveMap.set(activeSiteId, now);
      if (splitSiteId) lastActiveMap.set(splitSiteId, now);
    }

    const maxIdleMs = mins * 60 * 1000;
    for (const siteId of [...webviewMap.keys()]) {
      if (drawerOpen && !toolsViewOpen && (activeSiteId === siteId || splitSiteId === siteId)) continue;
      const site = config.sites.find((s) => s.id === siteId);
      if (!site || site.keepAwake || audibleSet.has(siteId)) continue;

      const lastUsed = lastActiveMap.get(siteId) || now;
      if (now - lastUsed >= maxIdleMs) {
        hibernateSiteWebview(siteId, { collapseIfActive: false });
      }
    }
  }

  function preloadKeepAwakeSites() {
    let loadedAny = false;
    config.sites.forEach((site) => {
      if (site.keepAwake && !webviewMap.has(site.id)) {
        createOrGetWebview(site);
        loadedAny = true;
      }
    });
    if (loadedAny) {
      renderRail();
      updateSleepStatusUI();
    }
  }

  async function openSiteInDrawer(siteId) {
    const site = config.sites.find((s) => s.id === siteId);
    if (!site) return;

    toolsViewOpen = false;
    activeSiteId = site.id;
    lastOpenedSiteId = site.id;
    if (splitSiteId === site.id) {
      splitSiteId = null;
    }
    drawerOpen = true;
    railTemporarilyRevealed = true;
    lastActiveMap.set(site.id, Date.now());

    if (config.settings.lastOpenedSiteId !== site.id) {
      config = await window.sidebarAPI.updateSettings({ lastOpenedSiteId: site.id });
    }

    emptyPlaceholder.classList.add('hidden');
    const currentSite = config.sites.find((s) => s.id === siteId) || site;
    createOrGetWebview(currentSite);

    syncWebviewVisibility();
    applyThemeAndEdge();
    updateHeaderUI();
    renderRail();
    await syncWindowMode();
  }

  async function openToolsInDrawer(initialTab = null) {
    closeAllStudios(false);
    closeInlineUrlBar();
    toolsViewOpen = true;
    drawerOpen = true;
    railTemporarilyRevealed = true;

    if (initialTab && window.ZenToolsWidget) {
      window.ZenToolsWidget.selectTab(initialTab);
    } else if (window.ZenToolsWidget && window.ZenToolsWidget.activeTab === 'clipboard') {
      window.ZenToolsWidget.refreshClipboardFromMain();
    }

    syncWebviewVisibility();
    applyThemeAndEdge();
    updateHeaderUI();
    renderRail();
    await syncWindowMode();
  }

  async function collapseDrawer() {
    drawerOpen = false;
    toolsViewOpen = false;
    closeInlineUrlBar();
    syncWebviewVisibility();
    applyThemeAndEdge();
    renderRail();
    await syncWindowMode();
  }

  function updateHeaderUI() {
    if (toolsViewOpen) {
      headerSiteBadge.innerHTML = '';
      headerSiteBadge.style.background = 'var(--accent-soft)';
      headerSiteBadge.style.color = 'var(--accent-glow)';
      headerSiteBadge.textContent = '🧰';
      headerSiteName.textContent = 'Zen Side Mini Araçlar';
      headerSiteDomain.textContent = 'Notlar • Pano Geçmişi • Hesap & Kur • Pomodoro';
      headerTitleBox.style.pointerEvents = 'none';
      return;
    }

    headerTitleBox.style.pointerEvents = 'auto';
    const site = getActiveSite();
    if (!site) {
      headerSiteName.textContent = 'Zen Side';
      headerSiteDomain.textContent = 'Kısayol seçin veya ekleyin';
      headerSiteBadge.innerHTML = '';
      emptyPlaceholder.classList.remove('hidden');
      return;
    }

    renderIconInto(headerSiteBadge, site);
    const unread = unreadMap.get(site.id);
    if (unread && unread.numeric > 0) {
      headerSiteName.textContent = unread.count === '•'
        ? `• ${site.name}`
        : `(${unread.count}) ${site.name}`;
    } else {
      headerSiteName.textContent = site.name;
    }

    const wv = webviewMap.get(site.id);
    const liveUrl = (wv && safeGetWebviewUrl(wv)) || lastUrlMap.get(site.id) || site.url;
    headerSiteDomain.textContent = extractDomain(liveUrl) || site.url;

    btnToggleUa.classList.toggle('active', Boolean(site.mobileMode));
    btnToggleUa.title = site.mobileMode
      ? 'Şu an: Mobil Görünüm (Masaüstüne geçmek için tıklayın)'
      : 'Şu an: Masaüstü Görünümü (Mobile geçmek için tıklayın)';

    updateHeaderNavButtons();
  }

  function updateHeaderNavButtons() {
    const site = getActiveSite();
    const wv = site ? webviewMap.get(site.id) : null;
    if (!wv) {
      btnNavBack.disabled = true;
      btnNavForward.disabled = true;
      return;
    }
    try {
      btnNavBack.disabled = !wv.canGoBack();
      btnNavForward.disabled = !wv.canGoForward();
    } catch {
      btnNavBack.disabled = true;
      btnNavForward.disabled = true;
    }
  }

  // ==================== ÜST ARAÇ ÇUBUĞU & SPLIT-VIEW OLAYLARI ====================

  function closeInlineUrlBar() {
    inlineUrlForm.classList.add('hidden');
    headerTitleBox.classList.remove('hidden');
  }

  headerTitleBox.addEventListener('click', () => {
    if (toolsViewOpen) return;
    const site = getActiveSite();
    if (!site) return;
    const wv = webviewMap.get(site.id);
    inlineUrlInput.value = (wv && safeGetWebviewUrl(wv)) || site.url;
    headerTitleBox.classList.add('hidden');
    inlineUrlForm.classList.remove('hidden');
    inlineUrlInput.focus();
    inlineUrlInput.select();
  });

  inlineUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeInlineUrlBar();
    }
  });

  inlineUrlInput.addEventListener('blur', () => {
    setTimeout(closeInlineUrlBar, 150);
  });

  inlineUrlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const site = getActiveSite();
    if (!site) return;
    const targetUrl = normalizeUrl(inlineUrlInput.value, true);
    if (targetUrl) {
      const wv = createOrGetWebview(site);
      wv.loadURL(targetUrl);
    }
    closeInlineUrlBar();
  });

  btnNavBack.addEventListener('click', () => {
    const wv = activeSiteId ? webviewMap.get(activeSiteId) : null;
    if (wv) {
      try { if (wv.canGoBack()) wv.goBack(); } catch {}
    }
  });

  btnNavForward.addEventListener('click', () => {
    const wv = activeSiteId ? webviewMap.get(activeSiteId) : null;
    if (wv) {
      try { if (wv.canGoForward()) wv.goForward(); } catch {}
    }
  });

  btnNavReload.addEventListener('click', () => {
    const wv = activeSiteId ? webviewMap.get(activeSiteId) : null;
    if (wv) wv.reload();
  });

  btnToggleUa.addEventListener('click', async () => {
    const site = getActiveSite();
    if (!site) return;
    site.mobileMode = !site.mobileMode;
    config = await window.sidebarAPI.updateSites(config.sites);
    recreateWebviewIfLoaded(site);
    updateHeaderUI();
    showToast(site.mobileMode ? 'Mobil görünüme geçildi' : 'Masaüstü görünümüne geçildi');
  });

  if (btnToggleAdblock) {
    btnToggleAdblock.addEventListener('click', async () => {
      const next = !config.settings.adblockEnabled;
      config = await window.sidebarAPI.updateSettings({ adblockEnabled: next });
      updateAdblockUI();
      showToast(next ? '🛡️ Reklam & İzleyici Engelleyici açıldı' : 'Reklam Engelleyici kapatıldı');
    });
  }

  if (btnSplitView) {
    btnSplitView.addEventListener('click', () => {
      if (isSplitActive()) {
        closeSplitView();
        showToast('Bölünmüş görünüm kapatıldı');
        return;
      }
      const candidates = config.sites.filter((s) => s.id !== activeSiteId);
      if (candidates.length === 0) {
        showToast('Bölünmüş görünüm için ikinci bir site ekleyin');
        return;
      }
      const preferred =
        candidates.find((s) => /gemini|chatgpt|translate|çeviri/i.test(`${s.url} ${s.name}`)) ||
        candidates[0];
      openSplitWithSite(preferred.id);
    });
  }

  if (splitSiteSelect) {
    splitSiteSelect.addEventListener('change', () => {
      if (splitSiteSelect.value) {
        openSplitWithSite(splitSiteSelect.value);
      }
    });
  }

  if (btnSplitSwap) {
    btnSplitSwap.addEventListener('click', () => {
      if (!isSplitActive()) return;
      const prevTop = activeSiteId;
      activeSiteId = splitSiteId;
      splitSiteId = prevTop;
      syncWebviewVisibility();
      updateHeaderUI();
      renderRail();
    });
  }

  if (btnSplitReload) {
    btnSplitReload.addEventListener('click', () => {
      const wv = splitSiteId ? webviewMap.get(splitSiteId) : null;
      if (wv) wv.reload();
    });
  }

  if (btnSplitOpenEdge) {
    btnSplitOpenEdge.addEventListener('click', () => {
      const s = config.sites.find((item) => item.id === splitSiteId);
      if (!s) return;
      const wv = webviewMap.get(s.id);
      const url = (wv && safeGetWebviewUrl(wv)) || s.url;
      window.sidebarAPI.openExternal(url, true);
    });
  }

  if (btnSplitClose) {
    btnSplitClose.addEventListener('click', () => {
      closeSplitView();
    });
  }

  // Split-View Dikey Sürükleme Tutamacı
  let isSplitResizing = false;
  let splitPointerId = null;

  if (splitDragHandle) {
    splitDragHandle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isSplitResizing = true;
      splitPointerId = e.pointerId;
      body.classList.add('is-split-resizing');
      try {
        splitDragHandle.setPointerCapture(e.pointerId);
      } catch {}
    });

    splitDragHandle.addEventListener('pointermove', (e) => {
      if (!isSplitResizing) return;
      const stageRect = webviewsStage.getBoundingClientRect();
      if (stageRect.height < 120) return;
      const relY = e.clientY - stageRect.top;
      const nextRatio = Math.max(0.22, Math.min(0.78, relY / stageRect.height));
      config.settings.splitRatio = nextRatio;
      webviewsStage.style.setProperty('--split-ratio', String(nextRatio));
    });

    const finishSplitResize = async () => {
      if (!isSplitResizing) return;
      isSplitResizing = false;
      body.classList.remove('is-split-resizing');
      if (splitPointerId !== null) {
        try {
          if (splitDragHandle.hasPointerCapture(splitPointerId)) {
            splitDragHandle.releasePointerCapture(splitPointerId);
          }
        } catch {}
      }
      splitPointerId = null;
      config = await window.sidebarAPI.updateSettings({
        splitRatio: config.settings.splitRatio
      });
    };

    splitDragHandle.addEventListener('pointerup', finishSplitResize);
    splitDragHandle.addEventListener('pointercancel', finishSplitResize);
    splitDragHandle.addEventListener('lostpointercapture', finishSplitResize);
  }

  btnEditCurrent.addEventListener('click', () => {
    if (activeSiteId) {
      openSiteEditor(activeSiteId);
    } else {
      openSiteEditor(null);
    }
  });

  btnOpenEdge.addEventListener('click', () => {
    const site = getActiveSite();
    if (!site) return;
    const wv = webviewMap.get(site.id);
    const url = (wv && safeGetWebviewUrl(wv)) || site.url;
    window.sidebarAPI.openExternal(url, true);
  });

  btnPinDrawer.addEventListener('click', async () => {
    config = await window.sidebarAPI.updateSettings({
      isPinned: !config.settings.isPinned
    });
    applyThemeAndEdge();
    await syncWindowMode();
    showToast(
      config.settings.isPinned
        ? 'Sekme sabitlendi (Boş yere / sayfaya tıklayınca açık kalacak)'
        : 'Boş bir yere / sayfaya tıklayınca otomatik kapanma açıldı'
    );
  });

  btnCloseDrawer.addEventListener('click', (e) => {
    if (e.shiftKey && activeSiteId && !toolsViewOpen) {
      unloadSiteWebview(activeSiteId);
      showToast('Sekme uyku moduna alındı (RAM boşaltıldı)');
      return;
    }
    closeAllStudios(false);
    collapseDrawer();
  });

  // ==================== GENİŞLİK SÜRÜKLE-BOYUTLANDIRMA (PANEL & ŞERİT - HAFIZALI) ====================

  let isResizing = false;
  let resizePointerId = null;
  let startScreenX = 0;
  let startWidth = 420;
  let currentResizeWidth = 420;
  let resizeSaveDebounce = null;

  async function persistPanelWidthToMemory(widthToSave, showConfirmToast = false) {
    clearTimeout(resizeSaveDebounce);
    const finalW = Math.round(Math.max(280, widthToSave));
    const site = toolsViewOpen ? null : getActiveSite();
    if (site) {
      site.customWidth = finalW;
    }
    config.settings.panelWidth = finalW;

    config = await window.sidebarAPI.updateSettings({
      panelWidth: finalW,
      activeSiteWidthId: site ? site.id : null
    });
    applyThemeAndEdge();
    if (showConfirmToast) {
      showToast(`Açılır sekme genişliği hafızaya alındı: ${finalW} px`);
    }
  }

  resizeGrip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    resizePointerId = e.pointerId;
    startScreenX = e.screenX;
    const site = toolsViewOpen ? null : getActiveSite();
    startWidth = Math.round(site?.customWidth || config.settings.panelWidth || 420);
    currentResizeWidth = startWidth;
    body.classList.add('is-resizing');
    try {
      resizeGrip.setPointerCapture(e.pointerId);
    } catch {}
  });

  resizeGrip.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const edge = config.settings.edge === 'left' ? 'left' : 'right';
    const delta = edge === 'right' ? (startScreenX - e.screenX) : (e.screenX - startScreenX);
    const rW = getClampedRailWidth();
    const maxW = Math.max(320, Math.floor(screenInfo.width * 0.78) - rW);
    const newWidth = Math.round(Math.max(280, Math.min(maxW, startWidth + delta)));

    currentResizeWidth = newWidth;
    const site = toolsViewOpen ? null : getActiveSite();
    if (site) {
      site.customWidth = newWidth;
    }
    config.settings.panelWidth = newWidth;

    if (setPanelWidth) setPanelWidth.value = String(newWidth);
    if (panelWidthLabel) panelWidthLabel.textContent = `${newWidth} px`;

    window.sidebarAPI.setWindowState({
      mode: 'expanded',
      railWidth: rW,
      panelWidth: newWidth,
      modalOpen: isStudioOpen(),
      isDragging: true
    });

    clearTimeout(resizeSaveDebounce);
    resizeSaveDebounce = setTimeout(() => {
      window.sidebarAPI.updateSettings({
        panelWidth: newWidth,
        activeSiteWidthId: site ? site.id : null
      });
    }, 220);
  });

  async function finishPanelResize(e) {
    if (!isResizing) return;
    isResizing = false;
    body.classList.remove('is-resizing');
    if (e && resizePointerId !== null) {
      try {
        if (resizeGrip.hasPointerCapture(resizePointerId)) {
          resizeGrip.releasePointerCapture(resizePointerId);
        }
      } catch {}
    }
    resizePointerId = null;
    const changed = Math.abs(currentResizeWidth - startWidth) >= 2;
    await persistPanelWidthToMemory(currentResizeWidth, changed);
    await syncWindowMode();
  }

  resizeGrip.addEventListener('pointerup', finishPanelResize);
  resizeGrip.addEventListener('pointercancel', finishPanelResize);
  resizeGrip.addEventListener('lostpointercapture', finishPanelResize);

  // Şerit Genişlik Tutamacı (Min: 22px -> Maks: 160px)
  let isRailResizing = false;
  let railPointerId = null;
  let startRailScreenX = 0;
  let startRailWidth = 22;

  if (railResizeGrip) {
    railResizeGrip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isRailResizing = true;
      railPointerId = e.pointerId;
      startRailScreenX = e.screenX;
      startRailWidth = getClampedRailWidth();
      body.classList.add('is-rail-resizing');
      try {
        railResizeGrip.setPointerCapture(e.pointerId);
      } catch {}
    });

    railResizeGrip.addEventListener('pointermove', (e) => {
      if (!isRailResizing) return;
      const edge = config.settings.edge === 'left' ? 'left' : 'right';
      const delta = edge === 'right' ? (startRailScreenX - e.screenX) : (e.screenX - startRailScreenX);
      const newRailW = Math.round(Math.max(22, Math.min(160, startRailWidth + delta)));

      config.settings.railWidth = newRailW;
      body.style.setProperty('--rail-w', `${newRailW}px`);
      body.classList.toggle('wide-rail', newRailW >= 58);
      if (setRailWidth) setRailWidth.value = String(newRailW);
      if (railWidthLabel) railWidthLabel.textContent = `${newRailW} px`;

      const studioActive = isStudioOpen();
      const targetMode = (drawerOpen || studioActive) ? 'expanded' : 'rail';
      const activeSite = toolsViewOpen ? null : getActiveSite();
      const pWidth = activeSite?.customWidth || config.settings.panelWidth || 420;

      window.sidebarAPI.setWindowState({
        mode: targetMode,
        railWidth: newRailW,
        panelWidth: pWidth,
        modalOpen: studioActive,
        isDragging: true
      });
    });

    async function finishRailResize() {
      if (!isRailResizing) return;
      isRailResizing = false;
      body.classList.remove('is-rail-resizing');
      if (railPointerId !== null) {
        try {
          if (railResizeGrip.hasPointerCapture(railPointerId)) {
            railResizeGrip.releasePointerCapture(railPointerId);
          }
        } catch {}
      }
      railPointerId = null;
      config = await window.sidebarAPI.updateSettings({
        railWidth: getClampedRailWidth()
      });
      applyThemeAndEdge();
      await syncWindowMode();
    }

    railResizeGrip.addEventListener('pointerup', finishRailResize);
    railResizeGrip.addEventListener('pointercancel', finishRailResize);
    railResizeGrip.addEventListener('lostpointercapture', finishRailResize);

    railResizeGrip.addEventListener('dblclick', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      config = await window.sidebarAPI.updateSettings({ railWidth: 22 });
      applyThemeAndEdge();
      await syncWindowMode();
      showToast('Şerit minimum genişliğe (22px) sıfırlandı');
    });
  }

  // ==================== KENARA GİZLE TUTAMACI ====================

  let handleHoverTimer = null;
  let handleDragging = false;
  let handleDragMoved = false;
  let handleDragStartY = 0;
  let handleStartRatio = 0.38;

  edgeHandle.addEventListener('mouseenter', () => {
    if (handleDragging) return;
    clearTimeout(handleHoverTimer);
    handleHoverTimer = setTimeout(() => {
      if (!handleDragging) {
        railTemporarilyRevealed = true;
        syncWindowMode();
      }
    }, 140);
  });

  edgeHandle.addEventListener('mouseleave', () => {
    clearTimeout(handleHoverTimer);
  });

  edgeHandle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    clearTimeout(handleHoverTimer);
    handleDragging = true;
    handleDragMoved = false;
    handleDragStartY = e.screenY;
    handleStartRatio = config.settings.handleYRatio ?? 0.38;
  });

  window.addEventListener('mousemove', (e) => {
    if (!handleDragging) return;
    const dy = e.screenY - handleDragStartY;
    if (Math.abs(dy) > 4) {
      handleDragMoved = true;
    }
    if (handleDragMoved) {
      const usableH = Math.max(200, (screenInfo.workAreaHeight || 900) - 136);
      const nextRatio = Math.max(0.05, Math.min(0.92, handleStartRatio + dy / usableH));
      config.settings.handleYRatio = nextRatio;
      window.sidebarAPI.setWindowState({
        mode: 'handle',
        handleYRatio: nextRatio
      });
    }
  });

  window.addEventListener('mouseup', async () => {
    if (!handleDragging) return;
    const wasMoved = handleDragMoved;
    handleDragging = false;
    handleDragMoved = false;

    if (wasMoved) {
      config = await window.sidebarAPI.updateSettings({
        handleYRatio: config.settings.handleYRatio
      });
    } else if (topUnreadSiteId && config.sites.some((s) => s.id === topUnreadSiteId)) {
      await openSiteInDrawer(topUnreadSiteId);
    } else {
      railTemporarilyRevealed = true;
      await syncWindowMode();
    }
  });

  // ==================== RAIL KONTROL BUTONLARI ====================

  btnRailBrand.addEventListener('click', () => {
    if (isStudioOpen()) {
      closeAllStudios(true);
      return;
    }
    if (drawerOpen) {
      collapseDrawer();
    } else {
      const targetId = activeSiteId || lastOpenedSiteId || config.sites[0]?.id;
      if (targetId) {
        openSiteInDrawer(targetId);
      } else {
        openSiteEditor(null);
      }
    }
  });

  if (btnRailWorkspace) {
    btnRailWorkspace.addEventListener('click', async () => {
      const wsList = getWorkspacesList();
      const curIdx = wsList.findIndex((w) => w.id === (config.settings.activeWorkspace || 'all'));
      const nextWs = wsList[(curIdx + 1) % wsList.length];
      await setActiveWorkspace(nextWs.id);
    });

    btnRailWorkspace.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const chosen = await window.sidebarAPI.showWorkspaceMenu();
      if (chosen) {
        await setActiveWorkspace(chosen);
      }
    });
  }

  if (btnRailSnip) {
    btnRailSnip.addEventListener('click', () => {
      window.sidebarAPI.startQuickSnip();
    });
  }

  if (btnRailTools) {
    btnRailTools.addEventListener('click', () => {
      if (drawerOpen && toolsViewOpen && !isStudioOpen()) {
        collapseDrawer();
      } else {
        openToolsInDrawer();
      }
    });

    // Mini Araçlar ikonuna metin sürüklenip bırakıldığında doğrudan Hızlı Notlar'a ekle!
    btnRailTools.addEventListener('dragover', (e) => {
      if (draggedSiteId !== null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      btnRailTools.classList.add('external-drop-target');
    });

    btnRailTools.addEventListener('dragleave', () => {
      btnRailTools.classList.remove('external-drop-target');
    });

    btnRailTools.addEventListener('drop', async (e) => {
      if (draggedSiteId !== null) return;
      e.preventDefault();
      e.stopPropagation();
      btnRailTools.classList.remove('external-drop-target');
      const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list') || '';
      await openToolsInDrawer('notes');
      if (text.trim() && window.ZenToolsWidget) {
        await window.ZenToolsWidget.appendNoteText(text);
      }
    });
  }

  // (+) Yeni Site Ekle butonuna URL sürüklenip bırakıldığında otomatik site ekleme penceresini doldur!
  btnRailAdd.addEventListener('dragover', (e) => {
    if (draggedSiteId !== null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    btnRailAdd.classList.add('external-drop-target');
  });

  btnRailAdd.addEventListener('dragleave', () => {
    btnRailAdd.classList.remove('external-drop-target');
  });

  btnRailAdd.addEventListener('drop', async (e) => {
    if (draggedSiteId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    btnRailAdd.classList.remove('external-drop-target');
    const raw = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim();
    if (raw) {
      await openSiteEditor(null, { url: normalizeUrl(raw, false) });
    }
  });

  async function setDisplayMode(nextMode) {
    if (!['text', 'icon', 'both'].includes(nextMode)) return;
    config = await window.sidebarAPI.updateSettings({ railDisplayMode: nextMode });
    applyThemeAndEdge();
    renderRail();
    const labels = {
      text: 'Sekme Görünümü: Sadece İsim',
      icon: 'Sekme Görünümü: Sadece Simge',
      both: 'Sekme Görünümü: Simge + İsim'
    };
    showToast(labels[nextMode]);
  }

  async function cycleDisplayMode() {
    const order = ['text', 'icon', 'both'];
    const cur = ['text', 'icon', 'both'].includes(config.settings.railDisplayMode)
      ? config.settings.railDisplayMode
      : 'text';
    const nextMode = order[(order.indexOf(cur) + 1) % order.length];
    await setDisplayMode(nextMode);
  }

  async function cycleGlassTintOrMaterial(cycleMaterial = false) {
    if (cycleMaterial) {
      const order = ['acrylic', 'mica', 'tabbed', 'none'];
      const cur = config.settings.material || 'acrylic';
      const nextMat = order[(order.indexOf(cur) + 1) % order.length];
      config = await window.sidebarAPI.updateSettings({ material: nextMat });
      applyThemeAndEdge();
      const labels = {
        acrylic: 'iOS Buzlu Cam (Acrylic Blur)',
        mica: 'Windows 11 Mica',
        tabbed: 'Windows 11 Mica Alt',
        none: 'Mat Görünüm'
      };
      showToast(labels[nextMat] || nextMat);
      return;
    }

    const tints = window.SIDEBAR_PRESETS.glassTints || [];
    if (!tints.length) return;
    const curId = config.settings.glassTint || 'ios-crystal';
    const curIdx = tints.findIndex((t) => t.id === curId);
    const nextTint = tints[(curIdx + 1) % tints.length];
    const patch = { glassTint: nextTint.id };
    if (config.settings.material === 'none') {
      patch.material = 'acrylic';
    }
    config = await window.sidebarAPI.updateSettings(patch);
    applyThemeAndEdge();
    showToast(`Cam Rengi: ${nextTint.name}`);
  }

  document.getElementById('sidebar-rail').addEventListener('contextmenu', async (e) => {
    if (e.target.closest('.rail-item') || e.target.closest('#btn-rail-workspace')) return;
    e.preventDefault();
    const action = await window.sidebarAPI.showRailContextMenu();
    if (!action) return;
    if (action.startsWith('set-workspace:')) {
      await setActiveWorkspace(action.split(':')[1] || 'all');
      return;
    }
    if (action === 'add-site') openSiteEditor(null);
    else if (action === 'quick-snip') window.sidebarAPI.startQuickSnip();
    else if (action === 'open-tools') openToolsInDrawer();
    else if (action === 'display-text') await setDisplayMode('text');
    else if (action === 'display-icon') await setDisplayMode('icon');
    else if (action === 'display-both') await setDisplayMode('both');
    else if (action === 'toggle-adblock') btnToggleAdblock?.click();
    else if (action === 'sleep-all-inactive') sleepAllInactiveTabs(true);
    else if (action === 'toggle-dock') btnRailDock.click();
    else if (action === 'toggle-autoclose-outside') btnPinDrawer.click();
    else if (action === 'toggle-autohide') btnRailAutohide.click();
    else if (action === 'cycle-glass-tint') await cycleGlassTintOrMaterial(false);
    else if (action === 'reset-rail-width') {
      config = await window.sidebarAPI.updateSettings({ railWidth: 22 });
      applyThemeAndEdge();
      await syncWindowMode();
      showToast('Şerit genişliği 22px olarak sıfırlandı');
    } else if (action === 'flip-edge') {
      const nextEdge = config.settings.edge === 'left' ? 'right' : 'left';
      config = await window.sidebarAPI.updateSettings({ edge: nextEdge });
      applyThemeAndEdge();
      await syncWindowMode();
    } else if (action === 'settings') openSettingsStudio();
    else if (action === 'quit') window.sidebarAPI.quitApp();
  });

  btnRailAdd.addEventListener('click', () => openSiteEditor(null));
  btnEmptyAdd.addEventListener('click', () => openSiteEditor(null));

  if (btnRailDisplay) {
    btnRailDisplay.addEventListener('click', () => {
      cycleDisplayMode();
    });
  }

  if (btnRailGlass) {
    btnRailGlass.addEventListener('click', (e) => {
      cycleGlassTintOrMaterial(Boolean(e.shiftKey));
    });
  }

  btnRailDock.addEventListener('click', async () => {
    const nextDock = !config.settings.dockReserve;
    config = await window.sidebarAPI.updateSettings({
      dockReserve: nextDock
    });
    applyThemeAndEdge();
    await syncWindowMode();
    showToast(nextDock ? 'Tam ekran uygulamalar artık yanında hizalanacak' : 'Yüzen kenar çubuğu moduna geçildi');
  });

  btnRailAutohide.addEventListener('click', async () => {
    const nextHide = !config.settings.autoHide;
    railTemporarilyRevealed = !nextHide;
    config = await window.sidebarAPI.updateSettings({
      autoHide: nextHide
    });
    applyThemeAndEdge();
    if (nextHide && !drawerOpen && !isStudioOpen()) {
      railTemporarilyRevealed = false;
    }
    await syncWindowMode();
    showToast(nextHide ? 'Otomatik kenara gizleme açıldı' : 'Otomatik kenara gizleme kapatıldı');
  });

  btnRailSettings.addEventListener('click', () => {
    if (!settingsModal.classList.contains('hidden')) {
      closeAllStudios(true);
    } else {
      openSettingsStudio();
    }
  });

  // ==================== STÜDYO 1: SİTE EKLE & İKON ÖZELLEŞTİR ====================

  function buildStaticPickers() {
    quickTemplatesStrip.innerHTML = '';
    window.SIDEBAR_PRESETS.quickTemplates.forEach((tpl) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'template-chip';
      chip.textContent = tpl.name;
      chip.addEventListener('click', () => {
        inputSiteUrl.value = tpl.url;
        inputSiteName.value = tpl.name;
        nameManuallyEdited = true;
        inputMobileMode.checked = Boolean(tpl.mobileMode);
        if (inputKeepAwake) inputKeepAwake.checked = isMessagingUrl(tpl.url);
        if (inputSiteWorkspace && !workspaceManuallyEdited) {
          inputSiteWorkspace.value = inferWorkspaceFromUrlOrName(tpl.url, tpl.name);
        }
        selectIconTab(tpl.iconType || 'favicon');
        updateLivePreview();
      });
      quickTemplatesStrip.appendChild(chip);
    });

    presetIconsGrid.innerHTML = '';
    Object.entries(window.SIDEBAR_PRESETS.icons).forEach(([key, svgHtml]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-choice-btn';
      btn.dataset.iconKey = key;
      btn.innerHTML = svgHtml;
      btn.addEventListener('click', () => {
        formIconState.iconType = 'preset';
        formIconState.iconValue = key;
        highlightSelectedPreset();
        updateLivePreview();
      });
      presetIconsGrid.appendChild(btn);
    });

    emojiPickerGrid.innerHTML = '';
    window.SIDEBAR_PRESETS.emojis.forEach((em) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-btn';
      btn.textContent = em;
      btn.addEventListener('click', () => {
        inputMonogram.value = em;
        formIconState.iconType = 'monogram';
        formIconState.iconValue = em;
        updateLivePreview();
      });
      emojiPickerGrid.appendChild(btn);
    });

    gradientSwatches.innerHTML = '';
    window.SIDEBAR_PRESETS.gradients.forEach((g) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'swatch-btn';
      sw.title = g.name;
      sw.style.background = g.value;
      sw.dataset.bgVal = g.value;
      sw.addEventListener('click', () => {
        formIconState.iconBg = g.value;
        highlightSelectedSwatch();
        updateLivePreview();
      });
      gradientSwatches.appendChild(sw);
    });

    if (glassTintGrid && Array.isArray(window.SIDEBAR_PRESETS.glassTints)) {
      glassTintGrid.innerHTML = '';
      window.SIDEBAR_PRESETS.glassTints.forEach((tint) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'glass-tint-card';
        card.dataset.tintId = tint.id;

        const orb = document.createElement('span');
        orb.className = 'glass-orb';
        orb.style.background = tint.swatch;

        const label = document.createElement('span');
        label.textContent = tint.name;

        card.appendChild(orb);
        card.appendChild(label);

        card.addEventListener('click', async () => {
          const patch = { glassTint: tint.id };
          if (config.settings.material === 'none') {
            patch.material = 'acrylic';
          }
          config = await window.sidebarAPI.updateSettings(patch);
          applyThemeAndEdge();
          showToast(`Cam Rengi: ${tint.name}`);
        });

        glassTintGrid.appendChild(card);
      });
    }
  }

  function highlightSelectedPreset() {
    presetIconsGrid.querySelectorAll('.icon-choice-btn').forEach((b) => {
      b.classList.toggle('selected', b.dataset.iconKey === formIconState.iconValue);
    });
  }

  function highlightSelectedSwatch() {
    gradientSwatches.querySelectorAll('.swatch-btn').forEach((b) => {
      b.classList.toggle('selected', b.dataset.bgVal === formIconState.iconBg);
    });
  }

  function selectIconTab(tabName) {
    formIconState.iconType = tabName;
    document.querySelectorAll('[data-icon-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.iconTab === tabName);
    });
    document.getElementById('pane-favicon').classList.toggle('hidden', tabName !== 'favicon');
    document.getElementById('pane-preset').classList.toggle('hidden', tabName !== 'preset');
    document.getElementById('pane-monogram').classList.toggle('hidden', tabName !== 'monogram');
    document.getElementById('pane-custom').classList.toggle('hidden', tabName !== 'custom');

    if (tabName === 'preset' && !window.SIDEBAR_PRESETS.icons[formIconState.iconValue]) {
      formIconState.iconValue = 'globe';
    }
    if (tabName === 'monogram') {
      formIconState.iconValue = inputMonogram.value.trim() || getMonogramFallback(inputSiteName.value);
    }
    if (tabName === 'custom') {
      formIconState.iconValue = inputCustomIconUrl.value.trim();
    }

    highlightSelectedPreset();
    highlightSelectedSwatch();
    updateLivePreview();
  }

  document.querySelectorAll('[data-icon-tab]').forEach((btn) => {
    btn.addEventListener('click', () => selectIconTab(btn.dataset.iconTab));
  });

  function updateLivePreview() {
    const rawUrl = inputSiteUrl.value.trim();
    const normUrl = normalizeUrl(rawUrl);
    const dispName = inputSiteName.value.trim() || deriveNameFromUrl(rawUrl) || 'Whatsapp';

    previewTitleText.textContent = dispName;
    previewUrlText.textContent = normUrl || 'https://...';

    if (previewTabText) previewTabText.textContent = dispName;
    if (previewTabAccent) {
      previewTabAccent.style.background =
        formIconState.iconBg && formIconState.iconBg !== 'rgba(255, 255, 255, 0.09)'
          ? formIconState.iconBg
          : 'var(--accent-glow)';
    }

    const existing = editingSiteId ? config.sites.find((s) => s.id === editingSiteId) : null;
    const sameDomain = existing && extractDomain(existing.url) === extractDomain(normUrl);

    renderIconInto(previewIconBox, {
      name: dispName,
      url: normUrl,
      cachedFavicon: sameDomain ? existing.cachedFavicon : null,
      iconType: formIconState.iconType,
      iconValue: formIconState.iconValue,
      iconBg: formIconState.iconBg
    });
  }

  inputSiteUrl.addEventListener('input', () => {
    if (!editingSiteId) {
      if (!nameManuallyEdited) {
        const derived = deriveNameFromUrl(inputSiteUrl.value);
        if (derived) inputSiteName.value = derived;
      }
      if (inputKeepAwake && isMessagingUrl(inputSiteUrl.value)) {
        inputKeepAwake.checked = true;
      }
      if (inputSiteWorkspace && !workspaceManuallyEdited) {
        inputSiteWorkspace.value = inferWorkspaceFromUrlOrName(inputSiteUrl.value, inputSiteName.value);
      }
    }
    updateLivePreview();
  });

  inputSiteName.addEventListener('input', () => {
    nameManuallyEdited = Boolean(inputSiteName.value.trim());
    if (formIconState.iconType === 'monogram' && !inputMonogram.value.trim()) {
      formIconState.iconValue = getMonogramFallback(inputSiteName.value);
    }
    updateLivePreview();
  });

  if (inputSiteWorkspace) {
    inputSiteWorkspace.addEventListener('change', () => {
      workspaceManuallyEdited = true;
    });
  }

  inputMonogram.addEventListener('input', () => {
    formIconState.iconType = 'monogram';
    formIconState.iconValue = inputMonogram.value.trim();
    updateLivePreview();
  });

  inputCustomIconUrl.addEventListener('input', () => {
    formIconState.iconType = 'custom';
    formIconState.iconValue = inputCustomIconUrl.value.trim();
    updateLivePreview();
  });

  inputCustomBgColor.addEventListener('input', () => {
    formIconState.iconBg = inputCustomBgColor.value;
    highlightSelectedSwatch();
    updateLivePreview();
  });

  inputSiteZoom.addEventListener('input', () => {
    zoomValueLabel.textContent = `%${inputSiteZoom.value}`;
  });

  btnUploadIcon.addEventListener('click', async () => {
    const res = await window.sidebarAPI.pickCustomIcon();
    if (!res.canceled && res.dataUrl) {
      formIconState.iconType = 'custom';
      formIconState.iconValue = res.dataUrl;
      inputCustomIconUrl.value = res.dataUrl;
      updateLivePreview();
      showToast(`İkon yüklendi: ${res.fileName}`);
    }
  });

  async function openSiteEditor(siteId = null, prefill = null) {
    settingsModal.classList.add('hidden');
    editingSiteId = siteId;
    nameManuallyEdited = Boolean(siteId);
    workspaceManuallyEdited = Boolean(siteId);

    const existing = siteId ? config.sites.find((s) => s.id === siteId) : null;

    if (existing) {
      studioModalTitle.textContent = `${existing.name} — Düzenle & İkon Özelleştir`;
      quickTemplatesSection.classList.add('hidden');
      btnDeleteSite.classList.remove('hidden');

      inputSiteUrl.value = existing.url;
      inputSiteName.value = existing.name;
      if (inputSiteWorkspace) inputSiteWorkspace.value = existing.workspace || 'general';
      inputMobileMode.checked = Boolean(existing.mobileMode);
      if (inputKeepAwake) inputKeepAwake.checked = Boolean(existing.keepAwake);
      inputIsolatedSession.checked = Boolean(existing.isolatedSession);
      const zoomPct = Math.round((existing.zoom || 1.0) * 100);
      inputSiteZoom.value = String(zoomPct);
      zoomValueLabel.textContent = `%${zoomPct}`;

      formIconState = {
        iconType: existing.iconType || 'favicon',
        iconValue: existing.iconValue || '',
        iconBg: existing.iconBg || window.SIDEBAR_PRESETS.gradients[0].value
      };

      inputMonogram.value = existing.iconType === 'monogram' ? (existing.iconValue || '') : '';
      inputCustomIconUrl.value = existing.iconType === 'custom' ? (existing.iconValue || '') : '';
      selectIconTab(formIconState.iconType);
    } else {
      studioModalTitle.textContent = 'Yeni Site Ekle & İkon Özelleştir';
      quickTemplatesSection.classList.remove('hidden');
      btnDeleteSite.classList.add('hidden');

      inputSiteUrl.value = prefill?.url || '';
      inputSiteName.value = prefill?.title || (prefill?.url ? deriveNameFromUrl(prefill.url) : '');
      nameManuallyEdited = Boolean(inputSiteName.value);
      const curActiveWs = config.settings.activeWorkspace;
      const defaultWs = (curActiveWs && curActiveWs !== 'all')
        ? curActiveWs
        : inferWorkspaceFromUrlOrName(prefill?.url || '', inputSiteName.value);
      if (inputSiteWorkspace) inputSiteWorkspace.value = defaultWs;
      workspaceManuallyEdited = Boolean(curActiveWs && curActiveWs !== 'all');

      inputMobileMode.checked = prefill?.url ? !isMessagingUrl(prefill.url) : true;
      if (inputKeepAwake) inputKeepAwake.checked = isMessagingUrl(prefill?.url || '');
      inputIsolatedSession.checked = false;
      inputSiteZoom.value = '100';
      zoomValueLabel.textContent = '%100';
      inputMonogram.value = '';
      inputCustomIconUrl.value = '';

      const autoGradient = window.SIDEBAR_PRESETS.gradients[config.sites.length % 7].value;
      formIconState = {
        iconType: 'favicon',
        iconValue: '',
        iconBg: autoGradient
      };
      selectIconTab('favicon');
    }

    siteModal.classList.remove('hidden');
    renderRail();
    await syncWindowMode();
    setTimeout(() => inputSiteUrl.focus(), 60);
  }

  async function closeAllStudios(sync = true) {
    siteModal.classList.add('hidden');
    settingsModal.classList.add('hidden');
    renderRail();
    if (sync) {
      await syncWindowMode();
    }
  }

  btnCloseSiteModal.addEventListener('click', () => closeAllStudios(true));
  btnCancelSite.addEventListener('click', () => closeAllStudios(true));

  siteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const normUrl = normalizeUrl(inputSiteUrl.value);
    if (!normUrl) return;

    const finalName = inputSiteName.value.trim() || deriveNameFromUrl(normUrl) || 'Web Sitesi';
    const zoomFactor = Number(inputSiteZoom.value || 100) / 100;
    const keepAwakeFlag = inputKeepAwake ? Boolean(inputKeepAwake.checked) : isMessagingUrl(normUrl);
    const chosenWs = inputSiteWorkspace ? inputSiteWorkspace.value : inferWorkspaceFromUrlOrName(normUrl, finalName);

    let finalIconVal = formIconState.iconValue;
    if (formIconState.iconType === 'monogram') {
      finalIconVal = inputMonogram.value.trim() || getMonogramFallback(finalName);
    } else if (formIconState.iconType === 'custom') {
      finalIconVal = inputCustomIconUrl.value.trim();
      if (!finalIconVal) {
        formIconState.iconType = 'favicon';
      }
    }

    // Aktif bir çalışma alanı filtresi varken farklı bir çalışma alanına eklenirse görünür olması için Tümü'ne veya o alana geç
    if (config.settings.activeWorkspace !== 'all' && config.settings.activeWorkspace !== chosenWs) {
      config = await window.sidebarAPI.updateSettings({ activeWorkspace: chosenWs });
    }

    if (editingSiteId) {
      const idx = config.sites.findIndex((s) => s.id === editingSiteId);
      if (idx !== -1) {
        const old = config.sites[idx];
        const needReload =
          old.url !== normUrl ||
          Boolean(old.mobileMode) !== inputMobileMode.checked ||
          Boolean(old.isolatedSession) !== inputIsolatedSession.checked;

        if (old.url !== normUrl) {
          lastUrlMap.delete(old.id);
        }

        const updatedSite = {
          ...old,
          name: finalName,
          url: normUrl,
          workspace: chosenWs,
          cachedFavicon: old.url === normUrl ? old.cachedFavicon : null,
          iconType: formIconState.iconType,
          iconValue: finalIconVal,
          iconBg: formIconState.iconBg,
          mobileMode: inputMobileMode.checked,
          keepAwake: keepAwakeFlag,
          isolatedSession: inputIsolatedSession.checked,
          zoom: zoomFactor
        };

        config.sites[idx] = updatedSite;
        config = await window.sidebarAPI.updateSites(config.sites);

        if (needReload) {
          recreateWebviewIfLoaded(updatedSite);
        } else if (webviewMap.has(updatedSite.id)) {
          try { webviewMap.get(updatedSite.id).setZoomFactor(zoomFactor); } catch {}
        }

        await closeAllStudios(false);
        await openSiteInDrawer(updatedSite.id);
        showToast(`${finalName} güncellendi`);
        return;
      }
    }

    const newSite = {
      id: `site-${Date.now().toString(36)}`,
      name: finalName,
      url: normUrl,
      workspace: chosenWs,
      iconType: formIconState.iconType,
      iconValue: finalIconVal,
      iconBg: formIconState.iconBg,
      mobileMode: inputMobileMode.checked,
      keepAwake: keepAwakeFlag,
      isolatedSession: inputIsolatedSession.checked,
      zoom: zoomFactor,
      customWidth: null
    };

    config.sites.push(newSite);
    config = await window.sidebarAPI.updateSites(config.sites);
    await closeAllStudios(false);
    await openSiteInDrawer(newSite.id);
    showToast(`${finalName} Zen Side'a eklendi`);
  });

  async function deleteSiteById(siteId) {
    const idx = config.sites.findIndex((s) => s.id === siteId);
    if (idx === -1) return;
    const removed = config.sites.splice(idx, 1)[0];

    const wv = webviewMap.get(siteId);
    if (wv) {
      wv.remove();
      webviewMap.delete(siteId);
    }
    readySet.delete(siteId);
    sleepingSitesSet.delete(siteId);
    lastUrlMap.delete(siteId);
    lastActiveMap.delete(siteId);
    unreadMap.delete(siteId);
    audibleSet.delete(siteId);
    mutedSet.delete(siteId);

    if (splitSiteId === siteId) {
      splitSiteId = null;
    }

    if (activeSiteId === siteId) {
      activeSiteId = config.sites[0]?.id || null;
      if (!activeSiteId && !toolsViewOpen) {
        drawerOpen = false;
      }
    }

    config = await window.sidebarAPI.updateSites(config.sites);
    syncUnreadSummaryUI();
    updateSleepStatusUI();
    await closeAllStudios(false);

    if (drawerOpen && activeSiteId && !toolsViewOpen) {
      await openSiteInDrawer(activeSiteId);
    } else {
      syncWebviewVisibility();
      updateHeaderUI();
      renderRail();
      await syncWindowMode();
    }
    showToast(`${removed.name} kaldırıldı`);
  }

  btnDeleteSite.addEventListener('click', async () => {
    if (editingSiteId) {
      await deleteSiteById(editingSiteId);
    }
  });

  // ==================== STÜDYO 2: AYARLAR ====================

  async function openSettingsStudio() {
    siteModal.classList.add('hidden');
    applyThemeAndEdge();
    settingsModal.classList.remove('hidden');
    renderRail();
    await syncWindowMode();
  }

  btnCloseSettingsModal.addEventListener('click', () => closeAllStudios(true));

  if (setTargetDisplay) {
    setTargetDisplay.addEventListener('change', async () => {
      const raw = setTargetDisplay.value;
      const nextId = raw ? Number(raw) : null;
      config = await window.sidebarAPI.updateSettings({ displayId: nextId });
      applyThemeAndEdge();
      await syncWindowMode();
      showToast('Hedef monitör güncellendi');
    });
  }

  if (setAdblockEnabled) {
    setAdblockEnabled.addEventListener('change', async () => {
      config = await window.sidebarAPI.updateSettings({ adblockEnabled: setAdblockEnabled.checked });
      updateAdblockUI();
      showToast(setAdblockEnabled.checked ? '🛡️ Reklam & İzleyici Engelleyici açıldı' : 'Reklam Engelleyici kapatıldı');
    });
  }

  document.querySelectorAll('[data-material-choice]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mat = btn.dataset.materialChoice;
      config = await window.sidebarAPI.updateSettings({ material: mat });
      applyThemeAndEdge();
      const labels = {
        acrylic: 'iOS Buzlu Cam (Acrylic Blur)',
        mica: 'Windows 11 Mica',
        tabbed: 'Windows 11 Mica Alt',
        none: 'Mat Görünüm'
      };
      showToast(labels[mat] || mat);
    });
  });

  if (setPanelWidth) {
    setPanelWidth.addEventListener('input', () => {
      const rW = getClampedRailWidth();
      const maxW = Math.max(420, Math.floor(screenInfo.width * 0.78) - rW);
      const nextPanelW = Math.round(Math.max(280, Math.min(maxW, Number(setPanelWidth.value) || 420)));
      config.settings.panelWidth = nextPanelW;
      const site = toolsViewOpen ? null : getActiveSite();
      if (site) site.customWidth = nextPanelW;
      if (panelWidthLabel) panelWidthLabel.textContent = `${nextPanelW} px`;

      window.sidebarAPI.setWindowState({
        mode: 'expanded',
        railWidth: rW,
        panelWidth: Math.max(420, nextPanelW),
        modalOpen: true,
        isDragging: true
      });
    });

    setPanelWidth.addEventListener('change', async () => {
      const rW = getClampedRailWidth();
      const maxW = Math.max(420, Math.floor(screenInfo.width * 0.78) - rW);
      const nextPanelW = Math.round(Math.max(280, Math.min(maxW, Number(setPanelWidth.value) || 420)));
      await persistPanelWidthToMemory(nextPanelW, true);
      await syncWindowMode();
    });
  }

  if (setRailWidth) {
    setRailWidth.addEventListener('input', () => {
      const nextRailW = Math.max(22, Math.min(160, Number(setRailWidth.value) || 22));
      config.settings.railWidth = nextRailW;
      body.style.setProperty('--rail-w', `${nextRailW}px`);
      body.classList.toggle('wide-rail', nextRailW >= 58);
      if (railWidthLabel) railWidthLabel.textContent = `${nextRailW} px`;

      const activeSite = toolsViewOpen ? null : getActiveSite();
      let effectiveWidth = activeSite?.customWidth || config.settings.panelWidth || 420;
      if (effectiveWidth < 420) effectiveWidth = 420;

      window.sidebarAPI.setWindowState({
        mode: 'expanded',
        railWidth: nextRailW,
        panelWidth: effectiveWidth,
        modalOpen: true,
        isDragging: true
      });
    });

    setRailWidth.addEventListener('change', async () => {
      const nextRailW = Math.max(22, Math.min(160, Number(setRailWidth.value) || 22));
      config = await window.sidebarAPI.updateSettings({ railWidth: nextRailW });
      applyThemeAndEdge();
      await syncWindowMode();
    });
  }

  document.querySelectorAll('[data-display-choice]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await setDisplayMode(btn.dataset.displayChoice);
    });
  });

  document.querySelectorAll('[data-sleep-choice]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mins = Number(btn.dataset.sleepChoice) || 0;
      config = await window.sidebarAPI.updateSettings({ autoSleepMinutes: mins });
      applyThemeAndEdge();
      showToast(
        mins > 0
          ? `Otomatik uyku modu: ${mins} dakika hareketsizlik sonrası`
          : 'Otomatik sekme uyku modu kapatıldı'
      );
    });
  });

  if (btnSleepNow) {
    btnSleepNow.addEventListener('click', () => {
      sleepAllInactiveTabs(true);
    });
  }

  document.querySelectorAll('[data-edge-choice]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      config = await window.sidebarAPI.updateSettings({ edge: btn.dataset.edgeChoice });
      applyThemeAndEdge();
      await syncWindowMode();
    });
  });

  document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const choice = btn.dataset.themeChoice;
      const patch = { theme: choice };
      if (choice === 'dark' && config.settings.glassTint === 'ios-pearl') {
        patch.glassTint = 'ios-crystal';
      }
      config = await window.sidebarAPI.updateSettings(patch);
      applyThemeAndEdge();
    });
  });

  setDockReserve.addEventListener('change', async () => {
    config = await window.sidebarAPI.updateSettings({
      dockReserve: setDockReserve.checked
    });
    applyThemeAndEdge();
    await syncWindowMode();
  });

  if (setAutocloseOutside) {
    setAutocloseOutside.addEventListener('change', async () => {
      const autoCloseEnabled = setAutocloseOutside.checked;
      config = await window.sidebarAPI.updateSettings({
        isPinned: !autoCloseEnabled
      });
      applyThemeAndEdge();
      await syncWindowMode();
      showToast(
        autoCloseEnabled
          ? 'Boş bir yere / sayfaya tıklayınca otomatik kapanma açıldı'
          : 'Sekme sabitlendi (Dışarı tıklayınca açık kalacak)'
      );
    });
  }

  setAutohide.addEventListener('change', async () => {
    railTemporarilyRevealed = true;
    config = await window.sidebarAPI.updateSettings({
      autoHide: setAutohide.checked
    });
    applyThemeAndEdge();
    await syncWindowMode();
  });

  setOpenInEdge.addEventListener('change', async () => {
    config = await window.sidebarAPI.updateSettings({ openLinksInEdge: setOpenInEdge.checked });
  });

  setSkipTaskbar.addEventListener('change', async () => {
    config = await window.sidebarAPI.updateSettings({ skipTaskbar: setSkipTaskbar.checked });
  });

  setLaunchStartup.addEventListener('change', async () => {
    config = await window.sidebarAPI.updateSettings({ launchAtStartup: setLaunchStartup.checked });
  });

  function bindAcceleratorCapture(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' || e.key === 'Enter') return;
      e.preventDefault();
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (parts.length === 0) parts.push('Alt');

      const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(keyName);
      inputEl.value = parts.join('+');
    });
  }

  bindAcceleratorCapture(setHotkey);
  bindAcceleratorCapture(setSnipHotkey);

  btnApplyHotkey.addEventListener('click', async () => {
    config = await window.sidebarAPI.updateSettings({ hotkey: setHotkey.value.trim() || 'Alt+S' });
    showToast(`Kısayol kaydedildi: ${config.settings.hotkey}`);
  });

  if (btnApplySnipHotkey) {
    btnApplySnipHotkey.addEventListener('click', async () => {
      config = await window.sidebarAPI.updateSettings({ snipHotkey: setSnipHotkey.value.trim() || 'Alt+Shift+S' });
      showToast(`Ekran kırpma kısayolu kaydedildi: ${config.settings.snipHotkey}`);
    });
  }

  btnExportJson.addEventListener('click', async () => {
    const res = await window.sidebarAPI.exportConfig();
    if (!res.canceled) showToast('Yedek başarıyla dışa aktarıldı');
  });

  btnImportJson.addEventListener('click', async () => {
    const res = await window.sidebarAPI.importConfig();
    if (!res.canceled && res.config) {
      config = res.config;
      webviewMap.forEach((wv) => wv.remove());
      webviewMap.clear();
      readySet.clear();
      sleepingSitesSet.clear();
      lastUrlMap.clear();
      lastActiveMap.clear();
      unreadMap.clear();
      audibleSet.clear();
      mutedSet.clear();
      activeSiteId = null;
      splitSiteId = null;
      toolsViewOpen = false;
      drawerOpen = false;
      syncUnreadSummaryUI();
      updateSleepStatusUI();
      syncWebviewVisibility();
      applyThemeAndEdge();
      renderRail();
      if (window.ZenToolsWidget && window.ZenToolsWidget.renderNotesUI) {
        window.ZenToolsWidget.renderNotesUI();
        window.ZenToolsWidget.renderClipboardList();
      }
      await closeAllStudios(true);
      preloadKeepAwakeSites();
      showToast('Yedek başarıyla yüklendi');
    } else if (res.error) {
      showToast(`Hata: ${res.error}`);
    }
  });

  btnClearCookies.addEventListener('click', async () => {
    await window.sidebarAPI.clearPartitionData('persist:edge-sidebar');
    webviewMap.forEach((wv) => wv.reload());
    showToast('Paylaşılan oturum verileri temizlendi');
  });

  btnQuitApp.addEventListener('click', () => {
    window.sidebarAPI.quitApp();
  });

  // ==================== HIZLI KLAVYE KISAYOLLARI (Alt+1..9, Alt+0 & Escape) ====================

  window.addEventListener('keydown', (e) => {
    if (document.activeElement === setHotkey || document.activeElement === setSnipHotkey) return;

    if (e.key === 'Escape') {
      if (!inlineUrlForm.classList.contains('hidden')) {
        closeInlineUrlBar();
        return;
      }
      if (isStudioOpen()) {
        closeAllStudios(true);
        return;
      }
      if (drawerOpen) {
        collapseDrawer();
      }
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === '0') {
      e.preventDefault();
      if (drawerOpen && toolsViewOpen && !isStudioOpen()) collapseDrawer();
      else openToolsInDrawer();
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
      const visible = getVisibleSites();
      const targetSite = visible[Number(e.key) - 1];
      if (targetSite) {
        e.preventDefault();
        if (isStudioOpen()) closeAllStudios(false);
        if (drawerOpen && !toolsViewOpen && activeSiteId === targetSite.id) {
          collapseDrawer();
        } else {
          openSiteInDrawer(targetSite.id);
        }
      }
    }
  });

  // ==================== MAIN SÜREÇ OLAYLARI ====================

  window.sidebarAPI.onMainEvent(async (payload) => {
    switch (payload.type) {
      case 'window-blurred':
      case 'outside-clicked':
        if (!config.settings.isPinned && !isStudioOpen() && !isResizing && !isRailResizing && !isSplitResizing) {
          if (drawerOpen) {
            closeInlineUrlBar();
            drawerOpen = false;
            toolsViewOpen = false;
            syncWebviewVisibility();
            applyThemeAndEdge();
            renderRail();
          }
          if (config.settings.autoHide) {
            railTemporarilyRevealed = false;
          }
          await syncWindowMode();
        }
        break;

      case 'auto-hide-reveal':
        if (config.settings.autoHide && !railTemporarilyRevealed) {
          railTemporarilyRevealed = true;
          await syncWindowMode();
        }
        break;

      case 'auto-hide-collapse':
        if (config.settings.autoHide && !drawerOpen && !isStudioOpen()) {
          railTemporarilyRevealed = false;
          await syncWindowMode();
        }
        break;

      case 'sleep-all-inactive':
        sleepAllInactiveTabs(true);
        break;

      case 'adblock-stats':
        config.settings.adblockTotalBlocked = payload.totalBlocked;
        updateAdblockUI();
        break;

      case 'clipboard-updated':
        if (window.ZenToolsWidget) {
          window.ZenToolsWidget.onClipboardEvent(payload);
        }
        break;

      case 'displays-updated':
        if (Array.isArray(payload.displays)) displays = payload.displays;
        if (payload.screenInfo) screenInfo = payload.screenInfo;
        populateMonitorsSelect();
        break;

      case 'open-tools-panel':
        railTemporarilyRevealed = true;
        await openToolsInDrawer();
        break;

      case 'snip-completed':
        showToast(payload.action === 'save' ? '✂️ Ekran görüntüsü kaydedildi ve panoya kopyalandı' : '✂️ Ekran görüntüsü panoya kopyalandı');
        break;

      case 'snip-paste-to-site': {
        const site = config.sites.find((s) => s.id === payload.siteId);
        if (site) {
          closeAllStudios(false);
          await openSiteInDrawer(site.id);
          const wv = createOrGetWebview(site);
          pasteClipboardIntoWebview(wv, true);
          showToast(`✂️ Kırpılan görüntü ${site.name} sekmesine aktarıldı`);
        }
        break;
      }

      case 'toggle-sidebar':
        if (payload.forceOpen) {
          railTemporarilyRevealed = true;
          await syncWindowMode();
          return;
        }
        if (config.settings.autoHide && !railTemporarilyRevealed && !drawerOpen) {
          railTemporarilyRevealed = true;
          await syncWindowMode();
        } else if (drawerOpen) {
          await collapseDrawer();
        } else {
          const visible = getVisibleSites();
          const target = topUnreadSiteId || activeSiteId || lastOpenedSiteId || visible[0]?.id || config.sites[0]?.id;
          if (target) await openSiteInDrawer(target);
          else await openSiteEditor(null);
        }
        break;

      case 'open-add-modal':
        railTemporarilyRevealed = true;
        await openSiteEditor(null);
        break;

      case 'open-settings-modal':
        railTemporarilyRevealed = true;
        await openSettingsStudio();
        break;

      case 'pin-url-to-sidebar':
        railTemporarilyRevealed = true;
        await openSiteEditor(null, { url: payload.url, title: payload.title });
        break;

      case 'config-updated':
        config = payload.config;
        applyThemeAndEdge();
        renderRail();
        await syncWindowMode();
        break;

      case 'system-theme-changed':
        systemDark = payload.systemDark;
        applyThemeAndEdge();
        break;
    }
  });

  // ==================== ARKA PLAN BİLDİRİM & OTOMATİK UYKU ZAMANLAYICILARI ====================

  setInterval(() => {
    if (drawerOpen && !toolsViewOpen) {
      if (activeSiteId) lastActiveMap.set(activeSiteId, Date.now());
      if (splitSiteId) lastActiveMap.set(splitSiteId, Date.now());
    }
    webviewMap.forEach((wv, siteId) => {
      const curTitle = safeGetWebviewTitle(wv);
      if (curTitle) {
        updateSiteUnreadFromTitle(siteId, curTitle);
      }
    });
  }, 2500);

  setInterval(() => {
    checkAutoSleepTabs();
  }, 25000);

  // ==================== BAŞLATMA ====================

  if (window.ZenToolsWidget) {
    window.ZenToolsWidget.init({
      getConfig: () => config,
      setConfig: (nextCfg) => {
        if (nextCfg) config = nextCfg;
      },
      showToast,
      openUrlInEdge: (url) => window.sidebarAPI.openExternal(url, true),
      pinUrlToSidebar: (url) => openSiteEditor(null, { url }),
      onPomodoroTick: (isRunning, formattedTime) => {
        if (btnRailTools) {
          btnRailTools.classList.toggle('pomo-running', isRunning);
          btnRailTools.title = isRunning
            ? `⏱️ Pomodoro Çalışıyor (${formattedTime}) — Mini Araçları Aç`
            : '0-RAM Yerleşik Mini Araçlar (Notlar • Pano Geçmişi • Hesap & Kur • Pomodoro)';
        }
      }
    });
  }

  buildStaticPickers();
  syncWebviewVisibility();
  applyThemeAndEdge();
  renderRail();
  updateHeaderUI();
  syncUnreadSummaryUI();
  await syncWindowMode();

  setTimeout(() => {
    preloadKeepAwakeSites();
  }, 1500);
})();
