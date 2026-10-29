/**
 * Zen Side — 0-RAM Yerleşik Klasör & Dosya Gezgini Modülü (Folder Explorer Widget)
 * Kenar çubuğuna sabitlenen klasörlere tıklandığında içindeki alt klasörleri ve dosyaları
 * gerçek Windows ikonları, görsel küçük resimleri, ekmek kırıntısı (breadcrumb) gezintisi,
 * arama/sıralama, hızlı önizleme ve çift yönlü sürükle-bırak desteğiyle listeler.
 */

(function registerZenFolderWidget() {
  const FOLDER_SVG =
    '<svg viewBox="0 0 24 24" class="native-folder-svg"><path fill="#f59e0b" d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.9c.7 0 1.36.3 1.83.82l1.22 1.36c.28.31.68.49 1.1.49h4.95A2.5 2.5 0 0 1 21 9.17v8.33A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/><path fill="#fbbf24" d="M3 9.5A2 2 0 0 1 5 7.5h14a2 2 0 0 1 2 2v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-8Z"/></svg>';

  const FILE_FALLBACK_EMOJI = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    pdf: '📕',
    doc: '📘',
    sheet: '📗',
    slide: '📙',
    archive: '🗜️',
    code: '📄',
    exe: '⚙️',
    file: '📄'
  };

  function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    const val = b / Math.pow(1024, idx);
    return `${idx === 0 ? Math.round(val) : val.toFixed(val >= 100 ? 0 : 1)} ${units[idx]}`;
  }

  function formatShortDate(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return `Bugün ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const dayStr = `${d.getDate()} ${months[d.getMonth()]}`;
    return d.getFullYear() === now.getFullYear() ? dayStr : `${dayStr} ${d.getFullYear()}`;
  }

  const ZenFolderWidget = {
    deps: null,
    activeSite: null,
    currentPath: '',
    lastPayload: null,
    historyBySite: new Map(), // siteId -> { stack: string[], index: number }
    searchQuery: '',
    sortBy: 'name',   // 'name' | 'date' | 'size' | 'type'
    viewMode: 'list', // 'list' | 'grid'
    showHidden: false,
    promptAction: null,
    internalDragActive: false,

    init(deps) {
      this.deps = deps;
      this.cacheElements();
      this.bindEvents();
    },

    cacheElements() {
      this.stageEl = document.getElementById('folder-stage');
      this.btnRoot = document.getElementById('btn-folder-root');
      this.btnUp = document.getElementById('btn-folder-up');
      this.breadcrumbsEl = document.getElementById('folder-breadcrumbs');
      this.btnNewFolder = document.getElementById('btn-folder-new');
      this.btnOpenExplorer = document.getElementById('btn-folder-explorer');

      this.promptBar = document.getElementById('folder-inline-prompt');
      this.promptLabel = document.getElementById('folder-prompt-label');
      this.promptInput = document.getElementById('folder-prompt-input');
      this.btnPromptOk = document.getElementById('btn-folder-prompt-ok');
      this.btnPromptCancel = document.getElementById('btn-folder-prompt-cancel');

      this.searchInput = document.getElementById('folder-search-input');
      this.sortSelect = document.getElementById('folder-sort-select');
      this.btnViewToggle = document.getElementById('btn-folder-view-toggle');
      this.btnHiddenToggle = document.getElementById('btn-folder-hidden-toggle');

      this.itemsContainer = document.getElementById('folder-items-container');
      this.statsLabel = document.getElementById('folder-stats-label');

      this.previewOverlay = document.getElementById('folder-preview-overlay');
      this.previewTitle = document.getElementById('folder-preview-title');
      this.previewMeta = document.getElementById('folder-preview-meta');
      this.previewBody = document.getElementById('folder-preview-body');
      this.btnPreviewCopy = document.getElementById('btn-folder-preview-copy');
      this.btnPreviewOpen = document.getElementById('btn-folder-preview-open');
      this.btnPreviewClose = document.getElementById('btn-folder-preview-close');
      this.currentPreviewData = null;
    },

    bindEvents() {
      if (!this.stageEl) return;

      this.btnRoot?.addEventListener('click', () => {
        if (this.activeSite?.folderPath) {
          this.navigateTo(this.activeSite.folderPath, true);
        }
      });

      this.btnUp?.addEventListener('click', () => {
        if (this.lastPayload?.parentPath) {
          this.navigateTo(this.lastPayload.parentPath, true);
        }
      });

      this.btnOpenExplorer?.addEventListener('click', () => {
        if (this.currentPath) {
          window.sidebarAPI.openPath(this.currentPath);
        }
      });

      this.btnNewFolder?.addEventListener('click', () => {
        this.openInlinePrompt('Yeni Klasör Adı:', 'Yeni Klasör', async (val) => {
          if (!this.currentPath) return;
          const res = await window.sidebarAPI.createSubfolder({
            parentDir: this.currentPath,
            folderName: val
          });
          if (!res.ok) {
            this.deps.showToast(`Hata: ${res.error}`);
            return;
          }
          this.deps.showToast(`📁 "${res.name}" oluşturuldu`);
          await this.reloadCurrentDirectory();
        });
      });

      this.btnPromptOk?.addEventListener('click', () => this.submitInlinePrompt());
      this.btnPromptCancel?.addEventListener('click', () => this.closeInlinePrompt());
      this.promptInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitInlinePrompt();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.closeInlinePrompt();
        }
      });

      this.searchInput?.addEventListener('input', () => {
        this.searchQuery = this.searchInput.value.trim().toLowerCase();
        this.renderItems();
      });

      this.sortSelect?.addEventListener('change', async () => {
        this.sortBy = this.sortSelect.value || 'name';
        this.renderItems();
        await this.persistSiteFolderPrefs();
      });

      this.btnViewToggle?.addEventListener('click', async () => {
        this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
        this.syncToolbarControls();
        this.renderItems();
        await this.persistSiteFolderPrefs();
      });

      this.btnHiddenToggle?.addEventListener('click', async () => {
        this.showHidden = !this.showHidden;
        this.syncToolbarControls();
        await this.persistSiteFolderPrefs();
        await this.reloadCurrentDirectory();
      });

      // Hızlı Önizleme Kontrolleri
      this.btnPreviewClose?.addEventListener('click', () => this.closePreview());
      this.btnPreviewOpen?.addEventListener('click', () => {
        if (this.currentPreviewData?.path) {
          window.sidebarAPI.openPath(this.currentPreviewData.path);
        }
      });
      this.btnPreviewCopy?.addEventListener('click', async () => {
        const d = this.currentPreviewData;
        if (!d) return;
        if (d.kind === 'image') {
          const ok = await window.sidebarAPI.copyImageFile(d.path);
          this.deps.showToast(ok ? '🖼️ Görsel panoya kopyalandı' : 'Görsel kopyalanamadı');
        } else if (d.kind === 'text') {
          await window.sidebarAPI.writeClipboardText(d.content || '');
          this.deps.showToast('📋 Dosya içeriği panoya kopyalandı');
        }
      });

      // Dışarıdan klasör panelinin içine dosya sürükleyip bırakarak kopyalama
      this.stageEl.addEventListener('dragover', (e) => {
        if (this.internalDragActive) return;
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          this.itemsContainer?.classList.add('folder-drop-active');
        }
      });

      this.stageEl.addEventListener('dragleave', (e) => {
        if (!this.stageEl.contains(e.relatedTarget)) {
          this.itemsContainer?.classList.remove('folder-drop-active');
        }
      });

      this.stageEl.addEventListener('drop', async (e) => {
        this.itemsContainer?.classList.remove('folder-drop-active');
        if (this.internalDragActive) return;
        if (!e.dataTransfer?.files?.length || !this.currentPath) return;
        e.preventDefault();
        e.stopPropagation();

        const paths = [];
        for (const f of Array.from(e.dataTransfer.files)) {
          const p = window.sidebarAPI.getFilePath(f);
          if (p) paths.push(p);
        }
        if (!paths.length) return;

        const res = await window.sidebarAPI.copyFilesIntoFolder({
          sourcePaths: paths,
          targetDir: this.currentPath
        });
        if (res.ok && res.copiedCount > 0) {
          this.deps.showToast(`📥 ${res.copiedCount} öğe bu klasöre kopyalandı`);
          await this.reloadCurrentDirectory();
        } else if (res.error) {
          this.deps.showToast(`Kopyalama hatası: ${res.error}`);
        }
      });
    },

    async persistSiteFolderPrefs() {
      if (!this.activeSite || !this.deps) return;
      const cfg = this.deps.getConfig();
      const target = cfg.sites.find((s) => s.id === this.activeSite.id);
      if (!target) return;
      target.folderSortBy = this.sortBy;
      target.folderViewMode = this.viewMode;
      target.showHiddenFiles = this.showHidden;
      const updated = await window.sidebarAPI.updateSites(cfg.sites);
      this.deps.setConfig(updated);
      this.activeSite = target;
    },

    syncToolbarControls() {
      if (this.sortSelect) {
        this.sortSelect.value = this.sortBy;
      }
      if (this.btnViewToggle) {
        this.btnViewToggle.textContent = this.viewMode === 'grid' ? '⊞' : '☰';
        this.btnViewToggle.title = this.viewMode === 'grid'
          ? 'Görünüm: Izgara (Listeye geçmek için tıklayın)'
          : 'Görünüm: Liste (Izgaraya geçmek için tıklayın)';
        this.btnViewToggle.classList.toggle('active', this.viewMode === 'grid');
      }
      if (this.btnHiddenToggle) {
        this.btnHiddenToggle.classList.toggle('active', this.showHidden);
        this.btnHiddenToggle.title = this.showHidden
          ? 'Gizli dosyalar gösteriliyor (Gizlemek için tıklayın)'
          : 'Gizli dosyaları göster';
      }
    },

    openInlinePrompt(label, initialValue, onConfirm) {
      if (!this.promptBar || !this.promptInput) return;
      this.promptAction = onConfirm;
      if (this.promptLabel) this.promptLabel.textContent = label;
      this.promptInput.value = initialValue || '';
      this.promptBar.classList.remove('hidden');
      this.promptInput.focus();
      const dotIdx = initialValue ? initialValue.lastIndexOf('.') : -1;
      if (dotIdx > 0) {
        this.promptInput.setSelectionRange(0, dotIdx);
      } else {
        this.promptInput.select();
      }
    },

    closeInlinePrompt() {
      this.promptAction = null;
      this.promptBar?.classList.add('hidden');
    },

    async submitInlinePrompt() {
      const fn = this.promptAction;
      const val = (this.promptInput?.value || '').trim();
      this.closeInlinePrompt();
      if (fn && val) {
        await fn(val);
      }
    },

    closePreview() {
      this.currentPreviewData = null;
      this.previewOverlay?.classList.add('hidden');
      if (this.previewBody) this.previewBody.innerHTML = '';
    },

    async openPreviewForItem(itemPath) {
      const res = await window.sidebarAPI.previewFile(itemPath);
      if (!res.ok) {
        this.deps.showToast(res.error || 'Bu dosya önizlenemiyor');
        return;
      }
      this.currentPreviewData = res;
      if (this.previewTitle) this.previewTitle.textContent = res.name;
      if (this.previewMeta) {
        this.previewMeta.textContent = `${formatBytes(res.size)} • ${formatShortDate(res.mtimeMs)}${res.truncated ? ' • (İlk 120 KB)' : ''}`;
      }
      if (this.previewBody) {
        this.previewBody.innerHTML = '';
        if (res.kind === 'image') {
          const img = document.createElement('img');
          img.className = 'folder-preview-img';
          img.src = res.fileUrl;
          img.alt = res.name;
          this.previewBody.appendChild(img);
        } else {
          const pre = document.createElement('pre');
          pre.className = 'folder-preview-code';
          pre.textContent = res.content || '';
          this.previewBody.appendChild(pre);
        }
      }
      this.previewOverlay?.classList.remove('hidden');
    },

    async openFolderSite(site) {
      if (!site || !site.folderPath) return;
      this.activeSite = site;
      this.sortBy = site.folderSortBy || 'name';
      this.viewMode = site.folderViewMode || 'list';
      this.showHidden = Boolean(site.showHiddenFiles);
      this.searchQuery = '';
      if (this.searchInput) this.searchInput.value = '';
      this.closeInlinePrompt();
      this.closePreview();
      this.syncToolbarControls();

      let hist = this.historyBySite.get(site.id);
      if (!hist || !hist.stack.length) {
        hist = { stack: [site.folderPath], index: 0 };
        this.historyBySite.set(site.id, hist);
      }
      const targetDir = hist.stack[hist.index] || site.folderPath;
      await this.navigateTo(targetDir, false);
    },

    canGoBack() {
      if (!this.activeSite) return false;
      const hist = this.historyBySite.get(this.activeSite.id);
      return Boolean(hist && hist.index > 0);
    },

    canGoForward() {
      if (!this.activeSite) return false;
      const hist = this.historyBySite.get(this.activeSite.id);
      return Boolean(hist && hist.index < hist.stack.length - 1);
    },

    async goBack() {
      if (!this.canGoBack()) return;
      const hist = this.historyBySite.get(this.activeSite.id);
      hist.index--;
      await this.navigateTo(hist.stack[hist.index], false);
    },

    async goForward() {
      if (!this.canGoForward()) return;
      const hist = this.historyBySite.get(this.activeSite.id);
      hist.index++;
      await this.navigateTo(hist.stack[hist.index], false);
    },

    async reloadCurrentDirectory() {
      if (!this.currentPath && this.activeSite?.folderPath) {
        this.currentPath = this.activeSite.folderPath;
      }
      if (this.currentPath) {
        await this.navigateTo(this.currentPath, false);
      }
    },

    async navigateTo(dirPath, recordHistory = true) {
      if (!dirPath) return;
      this.closeInlinePrompt();
      this.closePreview();

      const payload = await window.sidebarAPI.readDirectory({
        dirPath,
        showHidden: this.showHidden
      });

      if (!payload.ok) {
        this.lastPayload = payload;
        this.currentPath = dirPath;
        this.renderErrorState(payload.error || 'Klasör açılamadı.');
        this.deps?.onDirectoryChanged?.();
        return;
      }

      this.currentPath = payload.resolvedPath;
      this.lastPayload = payload;

      if (recordHistory && this.activeSite) {
        let hist = this.historyBySite.get(this.activeSite.id);
        if (!hist) {
          hist = { stack: [this.currentPath], index: 0 };
          this.historyBySite.set(this.activeSite.id, hist);
        } else if (hist.stack[hist.index] !== this.currentPath) {
          hist.stack = hist.stack.slice(0, hist.index + 1);
          hist.stack.push(this.currentPath);
          hist.index = hist.stack.length - 1;
        }
      }

      if (this.btnUp) {
        this.btnUp.disabled = !payload.parentPath;
      }
      if (this.btnRoot && this.activeSite) {
        const atRoot =
          String(this.currentPath).toLowerCase() === String(this.activeSite.folderPath).toLowerCase();
        this.btnRoot.classList.toggle('active', atRoot);
      }

      this.renderBreadcrumbs();
      this.renderItems();
      this.deps?.onDirectoryChanged?.();
    },

    renderBreadcrumbs() {
      if (!this.breadcrumbsEl || !this.currentPath) return;
      this.breadcrumbsEl.innerHTML = '';

      const rootPath = this.activeSite?.folderPath || '';
      const normCur = this.currentPath.replace(/\//g, '\\');
      const normRoot = rootPath.replace(/\//g, '\\');

      // Sabitlenen kök klasörün içindeysek kök klasörden itibaren temiz ekmek kırıntısı göster
      if (normRoot && normCur.toLowerCase().startsWith(normRoot.toLowerCase())) {
        const rootChip = document.createElement('button');
        rootChip.type = 'button';
        rootChip.className = 'folder-crumb';
        rootChip.textContent = this.activeSite.name || normRoot;
        rootChip.title = normRoot;
        rootChip.addEventListener('click', () => this.navigateTo(normRoot, true));
        this.breadcrumbsEl.appendChild(rootChip);

        const rel = normCur.slice(normRoot.length).replace(/^\\+/, '');
        if (rel) {
          const segments = rel.split('\\').filter(Boolean);
          let acc = normRoot;
          segments.forEach((seg) => {
            acc = `${acc.replace(/\\+$/, '')}\\${seg}`;
            const targetPath = acc;

            const sep = document.createElement('span');
            sep.className = 'folder-crumb-sep';
            sep.textContent = '›';
            this.breadcrumbsEl.appendChild(sep);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'folder-crumb';
            btn.textContent = seg;
            btn.title = targetPath;
            btn.addEventListener('click', () => this.navigateTo(targetPath, true));
            this.breadcrumbsEl.appendChild(btn);
          });
        }
      } else {
        // Kök klasörün de üstüne çıkıldıysa tam yol parçalarını göster
        const parts = normCur.split('\\').filter(Boolean);
        let acc = '';
        parts.forEach((part, idx) => {
          acc = idx === 0 ? `${part}\\` : `${acc.replace(/\\+$/, '')}\\${part}`;
          const targetPath = acc;
          if (idx > 0) {
            const sep = document.createElement('span');
            sep.className = 'folder-crumb-sep';
            sep.textContent = '›';
            this.breadcrumbsEl.appendChild(sep);
          }
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'folder-crumb';
          btn.textContent = part;
          btn.title = targetPath;
          btn.addEventListener('click', () => this.navigateTo(targetPath, true));
          this.breadcrumbsEl.appendChild(btn);
        });
      }

      this.breadcrumbsEl.scrollLeft = this.breadcrumbsEl.scrollWidth;
    },

    renderErrorState(errMsg) {
      if (!this.itemsContainer) return;
      this.itemsContainer.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'folder-empty-state';

      const title = document.createElement('div');
      title.className = 'folder-empty-title';
      title.textContent = '⚠️ Klasöre Erişilemedi';

      const desc = document.createElement('div');
      desc.className = 'folder-empty-desc';
      desc.textContent = errMsg;

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary-btn compact-btn';
      editBtn.textContent = 'Klasör Yolunu Düzenle';
      editBtn.addEventListener('click', () => {
        if (this.activeSite) {
          this.deps?.openFolderEditor?.(this.activeSite.id);
        }
      });

      box.append(title, desc, editBtn);
      this.itemsContainer.appendChild(box);
      if (this.statsLabel) this.statsLabel.textContent = 'Klasör bulunamadı';
    },

    getSortedFilteredItems() {
      const raw = this.lastPayload?.items || [];
      const q = this.searchQuery;
      const filtered = q
        ? raw.filter((item) => item.name.toLowerCase().includes(q))
        : raw.slice();

      const collator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });
      const mode = this.sortBy;

      filtered.sort((a, b) => {
        // Klasörler her zaman üstte listelenir
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        if (mode === 'date') {
          return (b.mtimeMs || 0) - (a.mtimeMs || 0);
        }
        if (mode === 'size' && !a.isDirectory) {
          return (b.size || 0) - (a.size || 0);
        }
        if (mode === 'type' && !a.isDirectory) {
          const cmpExt = collator.compare(a.ext || '', b.ext || '');
          if (cmpExt !== 0) return cmpExt;
        }
        return collator.compare(a.name, b.name);
      });

      return filtered;
    },

    renderItems() {
      if (!this.itemsContainer || !this.lastPayload?.ok) return;
      this.itemsContainer.innerHTML = '';
      this.itemsContainer.classList.toggle('view-grid', this.viewMode === 'grid');
      this.itemsContainer.classList.toggle('view-list', this.viewMode !== 'grid');

      const items = this.getSortedFilteredItems();
      const p = this.lastPayload;

      if (this.statsLabel) {
        const parts = [];
        parts.push(`${p.folderCount} klasör`);
        parts.push(`${p.fileCount} dosya`);
        if (p.totalBytes > 0) parts.push(formatBytes(p.totalBytes));
        if (this.searchQuery) parts.push(`Filtre: ${items.length} eşleşme`);
        this.statsLabel.textContent = parts.join(' • ');
      }

      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'folder-empty-state';
        const icon = document.createElement('div');
        icon.className = 'folder-empty-emoji';
        icon.textContent = this.searchQuery ? '🔍' : '📂';
        const title = document.createElement('div');
        title.className = 'folder-empty-title';
        title.textContent = this.searchQuery ? 'Aramayla eşleşen öğe bulunamadı' : 'Bu klasör boş';
        const desc = document.createElement('div');
        desc.className = 'folder-empty-desc';
        desc.textContent = this.searchQuery
          ? 'Farklı bir anahtar kelime deneyin.'
          : 'Dışarıdan herhangi bir dosyayı buraya sürükleyip bırakarak klasöre kopyalayabilirsiniz.';
        empty.append(icon, title, desc);
        this.itemsContainer.appendChild(empty);
        return;
      }

      const frag = document.createDocumentFragment();

      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = `folder-entry ${item.isDirectory ? 'is-dir' : 'is-file'}`;
        row.draggable = true;
        row.title = item.isDirectory
          ? `📁 ${item.name}\nSol Tık: Klasörün içine gir\nSağ Tık: Seçenekler`
          : `${item.name}\nBoyut: ${formatBytes(item.size)} • ${formatShortDate(item.mtimeMs)}\nSol Tık: Aç | Sürükle: Başka uygulamaya bırak`;

        // 1) İkon / Küçük Resim (Thumbnail)
        const visual = document.createElement('div');
        visual.className = 'folder-entry-visual';

        if (item.isDirectory) {
          visual.innerHTML = FOLDER_SVG;
        } else if (item.thumbUrl) {
          const img = document.createElement('img');
          img.className = 'folder-thumb-img';
          img.loading = 'lazy';
          img.src = item.thumbUrl;
          img.alt = item.name;
          visual.appendChild(img);
        } else if (item.sysIcon) {
          const img = document.createElement('img');
          img.className = 'folder-sys-icon';
          img.src = item.sysIcon;
          img.alt = item.ext || 'file';
          visual.appendChild(img);
        } else {
          const span = document.createElement('span');
          span.className = 'folder-fallback-emoji';
          span.textContent = FILE_FALLBACK_EMOJI[item.category] || '📄';
          visual.appendChild(span);
        }
        row.appendChild(visual);

        // 2) Dosya / Klasör Başlığı ve Alt Bilgi
        const info = document.createElement('div');
        info.className = 'folder-entry-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'folder-entry-name';
        nameEl.textContent = item.name;

        const metaEl = document.createElement('div');
        metaEl.className = 'folder-entry-meta';
        metaEl.textContent = item.isDirectory
          ? `Klasör • ${formatShortDate(item.mtimeMs)}`
          : `${formatBytes(item.size)} • ${formatShortDate(item.mtimeMs)}`;

        info.append(nameEl, metaEl);
        row.appendChild(info);

        // 3) Hızlı Aksiyon Düğmeleri (Hover)
        const actions = document.createElement('div');
        actions.className = 'folder-entry-actions';

        if (!item.isDirectory && item.canPreview) {
          const prevBtn = document.createElement('button');
          prevBtn.type = 'button';
          prevBtn.className = 'folder-mini-btn';
          prevBtn.textContent = '👁';
          prevBtn.title = 'Zen Side İçinde Hızlı Önizle';
          prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openPreviewForItem(item.path);
          });
          actions.appendChild(prevBtn);
        }

        const revealBtn = document.createElement('button');
        revealBtn.type = 'button';
        revealBtn.className = 'folder-mini-btn';
        revealBtn.textContent = item.isDirectory ? '🗂' : '📍';
        revealBtn.title = item.isDirectory ? 'Dosya Gezgininde Aç' : 'Dosya Gezgininde Göster';
        revealBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.isDirectory) window.sidebarAPI.openPath(item.path);
          else window.sidebarAPI.revealInExplorer(item.path);
        });
        actions.appendChild(revealBtn);

        row.appendChild(actions);

        // Sol Tık: Klasör ise içine gir, dosya ise varsayılan uygulamayla aç
        row.addEventListener('click', async () => {
          if (item.isDirectory) {
            await this.navigateTo(item.path, true);
          } else {
            const res = await window.sidebarAPI.openPath(item.path);
            if (!res.ok && res.error) {
              this.deps.showToast(`Açılamadı: ${res.error}`);
            }
          }
        });

        // Dış Uygulamalara Doğrudan Dosya Sürükleme (WhatsApp / Tarayıcı / Masaüstü vb.)
        row.addEventListener('dragstart', (e) => {
          e.preventDefault();
          this.internalDragActive = true;
          window.sidebarAPI.startNativeFileDrag(item.path);
          setTimeout(() => {
            this.internalDragActive = false;
          }, 400);
        });

        // Sağ Tık Menüsü
        row.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const action = await window.sidebarAPI.showFolderItemContextMenu({
            name: item.name,
            path: item.path,
            isDirectory: item.isDirectory,
            category: item.category,
            canPreview: item.canPreview
          });
          if (action) {
            await this.handleItemContextAction(item, action);
          }
        });

        frag.appendChild(row);
      });

      this.itemsContainer.appendChild(frag);
    },

    async handleItemContextAction(item, action) {
      if (action.startsWith('send-to-site:')) {
        const targetSiteId = action.split(':')[1];
        if (targetSiteId && this.deps?.sendFileToSite) {
          await this.deps.sendFileToSite(targetSiteId, item);
        }
        return;
      }

      switch (action) {
        case 'open':
          if (item.isDirectory) await this.navigateTo(item.path, true);
          else await window.sidebarAPI.openPath(item.path);
          break;

        case 'preview':
          await this.openPreviewForItem(item.path);
          break;

        case 'pin-subfolder':
          if (item.isDirectory && this.deps?.pinFolderDirectly) {
            await this.deps.pinFolderDirectly(item.path, item.name);
          }
          break;

        case 'open-explorer':
          await window.sidebarAPI.openPath(item.path);
          break;

        case 'reveal':
          await window.sidebarAPI.revealInExplorer(item.path);
          break;

        case 'copy-image': {
          const ok = await window.sidebarAPI.copyImageFile(item.path);
          this.deps.showToast(ok ? '🖼️ Görsel panoya kopyalandı' : 'Görsel kopyalanamadı');
          break;
        }

        case 'copy-path':
          await window.sidebarAPI.writeClipboardText(item.path);
          this.deps.showToast('📋 Dosya yolu panoya kopyalandı');
          break;

        case 'rename':
          this.openInlinePrompt('Yeni Ad:', item.name, async (newName) => {
            if (newName === item.name) return;
            const res = await window.sidebarAPI.renameFsItem({
              oldPath: item.path,
              newName
            });
            if (!res.ok) {
              this.deps.showToast(`Yeniden adlandırılamadı: ${res.error}`);
              return;
            }
            this.deps.showToast(`✏️ "${res.name}" olarak değiştirildi`);
            await this.reloadCurrentDirectory();
          });
          break;

        case 'trash': {
          const res = await window.sidebarAPI.trashFsItem(item.path);
          if (res.ok) {
            this.deps.showToast(`🗑️ "${item.name}" Çöp Kutusu'na taşındı`);
            await this.reloadCurrentDirectory();
          } else if (res.error) {
            this.deps.showToast(`Silinemedi: ${res.error}`);
          }
          break;
        }
      }
    }
  };

  window.ZenFolderWidget = ZenFolderWidget;
})();
