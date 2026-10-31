const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function isMessagingUrl(urlStr) {
  return /whatsapp|telegram|discord|slack|teams\.microsoft|messenger\.com/i.test(urlStr || '');
}

function inferWorkspaceForSite(site) {
  const valid = ['general', 'ai', 'work', 'personal'];
  if (site && valid.includes(site.workspace)) {
    return site.workspace;
  }
  const combined = `${site?.url || ''} ${site?.name || ''}`;
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

const DEFAULT_WORKSPACES = [
  { id: 'all', name: 'Tümü', badge: '✦' },
  { id: 'general', name: 'Genel', badge: '🌐' },
  { id: 'ai', name: 'Yapay Zeka', badge: '✨' },
  { id: 'work', name: 'İş', badge: '💼' },
  { id: 'personal', name: 'Kişisel', badge: '🏠' }
];

const DEFAULT_WIDGETS = {
  notes: [
    {
      id: 'note-1',
      title: 'Hızlı Not 1',
      content: '',
      updatedAt: Date.now()
    }
  ],
  activeNoteId: 'note-1',
  pinnedClips: [],
  pomodoroSessions: 0,
  pomodoroWorkMins: 25,
  pomodoroBreakMins: 5
};

const DEFAULT_CONFIG = {
  configVersion: 8,
  settings: {
    edge: 'right',            // 'right' | 'left'
    displayId: null,          // Hedef monitör ID (null = Ana Ekran)
    activeWorkspace: 'all',   // 'all' | 'general' | 'ai' | 'work' | 'personal'
    theme: 'dark',            // 'dark' | 'light' | 'system'
    material: 'none',         // 'none' (Zen Sade #323232 Mat) | 'mica' | 'acrylic' | 'tabbed'
    glassTint: 'zen-clean',   // 'zen-clean' | 'ios-crystal' | 'mica-ocean' | 'ios-aurora' | 'ios-emerald' | 'ios-rose' | 'ios-sunset' | 'ios-midnight' | 'ios-pearl'
    railDisplayMode: 'icon',  // 'icon' (Sadece Simge - Varsayılan) | 'text' (Sadece İsim) | 'both' (Simge + İsim)
    autoSleepMinutes: 15,     // Hareketsiz arka plan sekmelerini uyutma süresi (dk, 0 = Kapalı)
    adblockEnabled: true,     // Dahili ağ katmanı reklam & izleyici engelleyici
    adblockTotalBlocked: 0,   // Toplam engellenen reklam/izleyici sayacı
    splitRatio: 0.5,          // Çift sekme (Split-View) dikey bölünme oranı (0.22 - 0.78)
    autoHide: false,          // Otomatik kenara gizle (tam ekran kenar sensörlü)
    dockReserve: true,        // Masaüstü alanını daralt (tam ekran uygulamalar şeridin yanında durur)
    isPinned: false,          // Varsayılan false: boş bir yere / sayfaya tıklanınca açık sekme otomatik kapanır
    railWidth: 42,            // Kapalı şerit genişliği (varsayılan 42px sade simge şeridi, 22-160px arası ayarlanabilir)
    panelWidth: 420,          // Açık uygulama paneli genişliği (hafızada tutulur)
    lastOpenedSiteId: null,   // Son açılan sekme kimliği
    handleYRatio: 0.38,       // Kenara gizle tutamacının dikey konumu
    hotkey: 'Alt+S',          // Global aç/gizle kısayolu
    snipHotkey: 'Alt+Shift+S',// Global ekran kırp & gönder kısayolu
    openLinksInEdge: true,    // Dış bağlantıları Microsoft Edge ile aç
    skipTaskbar: false,       // Görev çubuğundan gizle
    launchAtStartup: false    // Windows açılışında başlat
  },
  workspaces: DEFAULT_WORKSPACES,
  widgets: DEFAULT_WIDGETS,
  sites: [
    {
      id: 'site-whatsapp',
      name: 'Whatsapp',
      url: 'https://web.whatsapp.com',
      workspace: 'personal',
      iconType: 'favicon',
      iconValue: '',
      iconBg: 'linear-gradient(135deg, #10b981, #059669)',
      iconColor: '#ffffff',
      mobileMode: false,
      keepAwake: true,
      zoom: 1.0,
      customWidth: null,
      isolatedSession: false
    },
    {
      id: 'site-google',
      name: 'Google',
      url: 'https://www.google.com',
      workspace: 'general',
      iconType: 'favicon',
      iconValue: '',
      iconBg: 'linear-gradient(135deg, #0078d4, #00b7c3)',
      iconColor: '#ffffff',
      mobileMode: false,
      keepAwake: false,
      zoom: 1.0,
      customWidth: null,
      isolatedSession: false
    },
    {
      id: 'site-translate',
      name: 'Çeviri',
      url: 'https://translate.google.com',
      workspace: 'work',
      iconType: 'preset',
      iconValue: 'translate',
      iconBg: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      iconColor: '#ffffff',
      mobileMode: false,
      keepAwake: false,
      zoom: 1.0,
      customWidth: null,
      isolatedSession: false
    },
    {
      id: 'site-gemini',
      name: 'Gemini',
      url: 'https://gemini.google.com',
      workspace: 'ai',
      iconType: 'favicon',
      iconValue: '',
      iconBg: 'linear-gradient(135deg, #6366f1, #a855f7)',
      iconColor: '#ffffff',
      mobileMode: false,
      keepAwake: false,
      zoom: 1.0,
      customWidth: null,
      isolatedSession: false
    }
  ]
};

class ConfigStore {
  constructor() {
    this.userDataDir = app.getPath('userData');
    this.filePath = path.join(this.userDataDir, 'sidebar-config.json');
    this.iconsDir = path.join(this.userDataDir, 'custom-icons');
    this.data = null;
  }

  ensureDirs() {
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
    if (!fs.existsSync(this.iconsDir)) {
      fs.mkdirSync(this.iconsDir, { recursive: true });
    }
  }

  load() {
    this.ensureDirs();
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        let sites = Array.isArray(parsed.sites) ? parsed.sites : DEFAULT_CONFIG.sites;
        const mergedSettings = { ...DEFAULT_CONFIG.settings, ...(parsed.settings || {}) };

        mergedSettings.railWidth = Math.max(22, Math.min(160, Number(mergedSettings.railWidth) || 42));
        mergedSettings.splitRatio = Math.max(0.22, Math.min(0.78, Number(mergedSettings.splitRatio) || 0.5));

        if ((parsed.configVersion || 1) < 3) {
          mergedSettings.dockReserve = true;
          const hasWa = sites.some((s) => /whatsapp/i.test(s.url || '') || /whatsapp/i.test(s.name || ''));
          if (!hasWa) {
            sites = [DEFAULT_CONFIG.sites[0], ...sites];
          }
        }

        if ((parsed.configVersion || 1) < 5) {
          mergedSettings.isPinned = false;
        }

        if ((parsed.configVersion || 1) < 6) {
          mergedSettings.adblockEnabled = true;
          mergedSettings.activeWorkspace = 'all';
        }

        if ((parsed.configVersion || 1) < 7) {
          mergedSettings.railDisplayMode = 'icon';
          mergedSettings.glassTint = 'zen-clean';
          mergedSettings.material = 'none';
          mergedSettings.activeWorkspace = 'all';
          if (!parsed.settings?.railWidth || Number(parsed.settings.railWidth) < 40) {
            mergedSettings.railWidth = 42;
          }
        }

        if ((parsed.configVersion || 1) < 8) {
          // Google, Gemini, Gmail gibi servislerde Botguard güvenlik engeline takılmamak için masaüstü moduna geçir
          sites = sites.map((s) => {
            if (/google\.|gemini\.|gmail\./i.test(s.url || '')) {
              return { ...s, mobileMode: false };
            }
            return s;
          });
        }

        sites = sites.map((s) => ({
          ...s,
          type: s.type === 'folder' ? 'folder' : 'site',
          keepAwake: s.type === 'folder'
            ? false
            : (typeof s.keepAwake === 'boolean' ? s.keepAwake : isMessagingUrl(s.url)),
          workspace: inferWorkspaceForSite(s)
        }));

        const mergedWidgets = {
          ...JSON.parse(JSON.stringify(DEFAULT_WIDGETS)),
          ...(parsed.widgets || {})
        };
        if (!Array.isArray(mergedWidgets.notes) || mergedWidgets.notes.length === 0) {
          mergedWidgets.notes = JSON.parse(JSON.stringify(DEFAULT_WIDGETS.notes));
          mergedWidgets.activeNoteId = mergedWidgets.notes[0].id;
        }
        if (!Array.isArray(mergedWidgets.pinnedClips)) {
          mergedWidgets.pinnedClips = [];
        }

        this.data = {
          configVersion: 8,
          settings: mergedSettings,
          workspaces: Array.isArray(parsed.workspaces) && parsed.workspaces.length >= 2
            ? parsed.workspaces
            : DEFAULT_WORKSPACES,
          widgets: mergedWidgets,
          sites
        };
        this.save();
        return this.data;
      }
    } catch (err) {
      console.error('[Store] Yapılandırma okunamadı, varsayılanlar yüklenecek:', err.message);
    }

    this.data = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    this.save();
    return this.data;
  }

  get() {
    if (!this.data) return this.load();
    return this.data;
  }

  save(newData) {
    if (newData) {
      const merged = { ...DEFAULT_CONFIG.settings, ...(newData.settings || {}) };
      merged.railWidth = Math.max(22, Math.min(160, Number(merged.railWidth) || 42));
      merged.splitRatio = Math.max(0.22, Math.min(0.78, Number(merged.splitRatio) || 0.5));
      this.data = {
        configVersion: 7,
        settings: merged,
        workspaces: Array.isArray(newData.workspaces) && newData.workspaces.length
          ? newData.workspaces
          : (this.data?.workspaces || DEFAULT_WORKSPACES),
        widgets: newData.widgets || this.data?.widgets || JSON.parse(JSON.stringify(DEFAULT_WIDGETS)),
        sites: Array.isArray(newData.sites) ? newData.sites : (this.data ? this.data.sites : [])
      };
    }
    this.ensureDirs();
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    return this.data;
  }

  updateSettings(partialSettings) {
    const current = this.get();
    const patch = { ...partialSettings };
    const targetSiteId = patch.activeSiteWidthId;
    delete patch.activeSiteWidthId;

    const merged = { ...current.settings, ...patch };
    merged.railWidth = Math.max(22, Math.min(160, Math.round(Number(merged.railWidth) || 42)));
    merged.splitRatio = Math.max(0.22, Math.min(0.78, Number(merged.splitRatio) || 0.5));
    if (merged.panelWidth !== undefined) {
      merged.panelWidth = Math.max(280, Math.min(2400, Math.round(Number(merged.panelWidth) || 420)));
    }

    if (targetSiteId && patch.panelWidth !== undefined && Array.isArray(current.sites)) {
      const site = current.sites.find((s) => s.id === targetSiteId);
      if (site) {
        site.customWidth = merged.panelWidth;
      }
    }

    current.settings = merged;
    return this.save(current);
  }

  updateSites(sites) {
    const current = this.get();
    current.sites = (Array.isArray(sites) ? sites : []).map((s) => ({
      ...s,
      type: s.type === 'folder' ? 'folder' : 'site',
      workspace: inferWorkspaceForSite(s)
    }));
    return this.save(current);
  }

  updateWidgets(partialWidgets) {
    const current = this.get();
    current.widgets = {
      ...(current.widgets || DEFAULT_WIDGETS),
      ...(partialWidgets || {})
    };
    return this.save(current);
  }

  saveCustomIconFile(sourceFilePath) {
    this.ensureDirs();
    const ext = path.extname(sourceFilePath).toLowerCase() || '.png';
    const mimeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.gif': 'image/gif'
    };
    const mime = mimeMap[ext] || 'image/png';
    const buf = fs.readFileSync(sourceFilePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  }
}

module.exports = new ConfigStore();
