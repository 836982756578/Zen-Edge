/**
 * Zen Side — 0-RAM Dahili Yerleşik Mini Araçlar (Native Widgets)
 * Webview veya harici süreç başlatmadan anında çalışan 4 yerleşik araç:
 * 1) Yapışkan Notlar (Çoklu Not, Otomatik Kayıt, .txt Dışa Aktarma)
 * 2) Pano Geçmişi (Son 30 Kopyalanan Metin/Link, Sabitleme, Arama)
 * 3) Akıllı Hesaplayıcı + Birim & Canlı Döviz Çevirici
 * 4) Pomodoro Odak Zamanlayıcı (SVG Halka, Oturum Sayacı, Sesli Uyarı)
 */

(function registerZenToolsWidget() {
  // ==================== GÜVENLİ MATEMATİK İFADE ÇÖZÜCÜ (eval KULLANMAZ) ====================
  function evaluateMathExpression(rawExpr) {
    const cleaned = String(rawExpr || '')
      .replace(/,/g, '.')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\s+/g, '');
    if (!cleaned) return null;
    if (!/^[0-9+\-*/%^().]+$/.test(cleaned)) return null;

    const tokens = [];
    let i = 0;
    while (i < cleaned.length) {
      const ch = cleaned[i];
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        let numStr = '';
        let dots = 0;
        while (i < cleaned.length && ((cleaned[i] >= '0' && cleaned[i] <= '9') || cleaned[i] === '.')) {
          if (cleaned[i] === '.') dots++;
          if (dots > 1) return null;
          numStr += cleaned[i++];
        }
        const val = Number(numStr);
        if (!Number.isFinite(val)) return null;
        tokens.push({ type: 'num', value: val });
      } else if ('+-*/%^()'.includes(ch)) {
        tokens.push({ type: 'op', value: ch });
        i++;
      } else {
        return null;
      }
    }

    let pos = 0;
    const peek = () => tokens[pos] || null;
    const consume = () => tokens[pos++];

    function parseExpr() {
      let left = parseTerm();
      while (peek() && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }

    function parseTerm() {
      let left = parsePower();
      while (peek() && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
        const op = consume().value;
        const right = parsePower();
        if (op === '*') left *= right;
        else if (op === '/') {
          if (right === 0) return NaN;
          left /= right;
        } else {
          if (right === 0) return NaN;
          left %= right;
        }
      }
      return left;
    }

    function parsePower() {
      let base = parseUnary();
      if (peek() && peek().value === '^') {
        consume();
        const exp = parsePower();
        base = Math.pow(base, exp);
      }
      return base;
    }

    function parseUnary() {
      if (peek() && peek().value === '+') {
        consume();
        return parseUnary();
      }
      if (peek() && peek().value === '-') {
        consume();
        return -parseUnary();
      }
      return parsePrimary();
    }

    function parsePrimary() {
      const tok = peek();
      if (!tok) throw new Error('Unexpected end');
      if (tok.type === 'num') {
        consume();
        let val = tok.value;
        // "150 * 20%" gibi yüzde ifadeleri için doğal destek
        if (peek() && peek().value === '%' && (!tokens[pos + 1] || '+-)*/'.includes(tokens[pos + 1].value))) {
          consume();
          val = val / 100;
        }
        return val;
      }
      if (tok.value === '(') {
        consume();
        const val = parseExpr();
        if (!peek() || peek().value !== ')') throw new Error('Unclosed paren');
        consume();
        return val;
      }
      throw new Error('Invalid token');
    }

    try {
      const result = parseExpr();
      if (pos !== tokens.length || !Number.isFinite(result)) return null;
      return Math.round(result * 1e10) / 1e10;
    } catch {
      return null;
    }
  }

  // ==================== BİRİM VE DÖVİZ TABLOLARI ====================
  const UNIT_CATEGORIES = {
    currency: {
      label: 'Döviz',
      units: {
        USD: { name: 'ABD Doları ($)', rate: 1 },
        EUR: { name: 'Euro (€)', rate: 0.92 },
        TRY: { name: 'Türk Lirası (₺)', rate: 36.5 },
        GBP: { name: 'İngiliz Sterlini (£)', rate: 0.79 },
        CHF: { name: 'İsviçre Frangı', rate: 0.88 },
        JPY: { name: 'Japon Yeni (¥)', rate: 151.0 }
      }
    },
    length: {
      label: 'Uzunluk',
      units: {
        m: { name: 'Metre (m)', factor: 1 },
        km: { name: 'Kilometre (km)', factor: 1000 },
        cm: { name: 'Santimetre (cm)', factor: 0.01 },
        mm: { name: 'Milimetre (mm)', factor: 0.001 },
        inch: { name: 'İnç (in)', factor: 0.0254 },
        ft: { name: 'Fit (ft)', factor: 0.3048 },
        mile: { name: 'Mil (mi)', factor: 1609.344 }
      }
    },
    weight: {
      label: 'Ağırlık',
      units: {
        kg: { name: 'Kilogram (kg)', factor: 1 },
        g: { name: 'Gram (g)', factor: 0.001 },
        mg: { name: 'Miligram (mg)', factor: 0.000001 },
        ton: { name: 'Ton (t)', factor: 1000 },
        lb: { name: 'Libre (lb)', factor: 0.45359237 },
        oz: { name: 'Ons (oz)', factor: 0.02834952 }
      }
    },
    temp: {
      label: 'Sıcaklık',
      units: {
        C: { name: 'Santigrat (°C)' },
        F: { name: 'Fahrenhayt (°F)' },
        K: { name: 'Kelvin (K)' }
      }
    },
    data: {
      label: 'Veri Boyutu',
      units: {
        KB: { name: 'Kilobayt (KB)', factor: 1024 },
        MB: { name: 'Megabayt (MB)', factor: 1024 ** 2 },
        GB: { name: 'Gigabayt (GB)', factor: 1024 ** 3 },
        TB: { name: 'Terabayt (TB)', factor: 1024 ** 4 }
      }
    }
  };

  function convertUnits(catKey, val, fromKey, toKey) {
    if (!Number.isFinite(val)) return '';
    if (fromKey === toKey) return String(val);

    if (catKey === 'currency') {
      const units = UNIT_CATEGORIES.currency.units;
      const fromRate = units[fromKey]?.rate || 1;
      const toRate = units[toKey]?.rate || 1;
      const inUsd = val / fromRate;
      const out = inUsd * toRate;
      return out >= 100 ? out.toFixed(2) : out.toFixed(4).replace(/\.?0+$/, '');
    }

    if (catKey === 'temp') {
      let c = val;
      if (fromKey === 'F') c = (val - 32) * (5 / 9);
      else if (fromKey === 'K') c = val - 273.15;

      let out = c;
      if (toKey === 'F') out = c * (9 / 5) + 32;
      else if (toKey === 'K') out = c + 273.15;
      return (Math.round(out * 100) / 100).toString();
    }

    const cat = UNIT_CATEGORIES[catKey];
    if (!cat) return '';
    const f1 = cat.units[fromKey]?.factor || 1;
    const f2 = cat.units[toKey]?.factor || 1;
    const out = (val * f1) / f2;
    return (Math.round(out * 1e6) / 1e6).toString();
  }

  function playPomodoroChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + idx * 0.16;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.38);
      });
    } catch {
      // Ses kapalıysa yoksay
    }
  }

  // ==================== ANA WIDGET DENETLEYİCİSİ ====================
  const ZenToolsWidget = {
    activeTab: 'notes',
    clipboardItems: [],
    clipboardPaused: false,
    clipSearchQuery: '',
    calcHistory: [],
    currentConvCat: 'currency',
    ratesStatus: 'Varsayılan kur (Canlı güncellemek için ↻)',
    pomodoro: {
      mode: 'work', // 'work' | 'short' | 'long'
      totalSec: 25 * 60,
      remainSec: 25 * 60,
      running: false,
      timerId: null
    },
    deps: null,

    init(deps) {
      this.deps = deps;
      this.bindTabs();
      this.initNotes();
      this.initClipboard();
      this.initCalcAndConverter();
      this.initPomodoro();
      this.fetchLiveRates(false);
    },

    selectTab(tabId) {
      this.activeTab = tabId;
      document.querySelectorAll('[data-tool-tab]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.toolTab === tabId);
      });
      document.querySelectorAll('.tool-pane').forEach((pane) => {
        pane.classList.toggle('hidden', pane.dataset.toolPane !== tabId);
      });
      if (tabId === 'clipboard') {
        this.refreshClipboardFromMain();
      }
    },

    bindTabs() {
      document.querySelectorAll('[data-tool-tab]').forEach((btn) => {
        btn.addEventListener('click', () => this.selectTab(btn.dataset.toolTab));
      });
    },

    // ==================== 1) HIZLI YAPIŞKAN NOTLAR ====================
    getWidgetsState() {
      const cfg = this.deps.getConfig();
      if (!cfg.widgets) {
        cfg.widgets = {
          notes: [{ id: 'note-1', title: 'Hızlı Not 1', content: '', updatedAt: Date.now() }],
          activeNoteId: 'note-1',
          pinnedClips: [],
          pomodoroSessions: 0
        };
      }
      if (!Array.isArray(cfg.widgets.notes) || cfg.widgets.notes.length === 0) {
        cfg.widgets.notes = [{ id: 'note-1', title: 'Hızlı Not 1', content: '', updatedAt: Date.now() }];
        cfg.widgets.activeNoteId = 'note-1';
      }
      return cfg.widgets;
    },

    initNotes() {
      const pillsBox = document.getElementById('notes-tabs-bar');
      const btnNewNote = document.getElementById('btn-note-add');
      const inputTitle = document.getElementById('note-title-input');
      const textarea = document.getElementById('note-body-textarea');
      const metaLabel = document.getElementById('note-stats-label');
      const btnCopy = document.getElementById('btn-note-copy');
      const btnDownload = document.getElementById('btn-note-export');
      const btnDelete = document.getElementById('btn-note-delete');
      if (!textarea) return;

      let saveTimer = null;
      const persistNotes = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
          const w = this.getWidgetsState();
          const updated = await window.sidebarAPI.updateWidgets({
            notes: w.notes,
            activeNoteId: w.activeNoteId
          });
          this.deps.setConfig(updated);
        }, 240);
      };

      const updateStats = (text) => {
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        if (metaLabel) metaLabel.textContent = `${words} kelime • ${chars} karakter`;
      };

      this.renderNotesUI = () => {
        const w = this.getWidgetsState();
        let active = w.notes.find((n) => n.id === w.activeNoteId) || w.notes[0];
        w.activeNoteId = active.id;

        pillsBox.innerHTML = '';
        w.notes.forEach((note) => {
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = `note-pill ${note.id === active.id ? 'active' : ''}`;
          pill.textContent = note.title || 'Not';
          pill.addEventListener('click', () => {
            w.activeNoteId = note.id;
            this.renderNotesUI();
            persistNotes();
          });
          pillsBox.appendChild(pill);
        });

        inputTitle.value = active.title || '';
        textarea.value = active.content || '';
        btnDelete.disabled = w.notes.length <= 1;
        updateStats(active.content || '');
      };

      inputTitle.addEventListener('input', () => {
        const w = this.getWidgetsState();
        const active = w.notes.find((n) => n.id === w.activeNoteId);
        if (active) {
          active.title = inputTitle.value.trim() || 'Not';
          active.updatedAt = Date.now();
          const activePill = pillsBox.querySelector('.note-pill.active');
          if (activePill) activePill.textContent = active.title;
          persistNotes();
        }
      });

      textarea.addEventListener('input', () => {
        const w = this.getWidgetsState();
        const active = w.notes.find((n) => n.id === w.activeNoteId);
        if (active) {
          active.content = textarea.value;
          active.updatedAt = Date.now();
          updateStats(active.content);
          persistNotes();
        }
      });

      btnNewNote.addEventListener('click', () => {
        const w = this.getWidgetsState();
        const newNote = {
          id: `note-${Date.now().toString(36)}`,
          title: `Not ${w.notes.length + 1}`,
          content: '',
          updatedAt: Date.now()
        };
        w.notes.push(newNote);
        w.activeNoteId = newNote.id;
        this.renderNotesUI();
        persistNotes();
        textarea.focus();
      });

      btnDelete.addEventListener('click', () => {
        const w = this.getWidgetsState();
        if (w.notes.length <= 1) return;
        w.notes = w.notes.filter((n) => n.id !== w.activeNoteId);
        w.activeNoteId = w.notes[0].id;
        this.renderNotesUI();
        persistNotes();
        this.deps.showToast('Not silindi');
      });

      btnCopy.addEventListener('click', async () => {
        await window.sidebarAPI.writeClipboardText(textarea.value || '');
        this.deps.showToast('Not panoya kopyalandı');
      });

      btnDownload.addEventListener('click', () => {
        const w = this.getWidgetsState();
        const active = w.notes.find((n) => n.id === w.activeNoteId) || w.notes[0];
        const blob = new Blob([active.content || ''], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(active.title || 'zen-side-not').replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ_-]/gi, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      });

      this.renderNotesUI();
    },

    async appendNoteText(droppedText) {
      const clean = String(droppedText || '').trim();
      if (!clean) return;
      this.selectTab('notes');
      const w = this.getWidgetsState();
      const active = w.notes.find((n) => n.id === w.activeNoteId) || w.notes[0];
      active.content = active.content ? `${active.content}\n\n${clean}` : clean;
      active.updatedAt = Date.now();
      this.renderNotesUI();
      const updated = await window.sidebarAPI.updateWidgets({
        notes: w.notes,
        activeNoteId: w.activeNoteId
      });
      this.deps.setConfig(updated);
      this.deps.showToast('Metin Hızlı Notlar\'a eklendi');
    },

    // ==================== 2) PANO GEÇMİŞİ (SON 30 KAYIT) ====================
    initClipboard() {
      const searchInput = document.getElementById('clip-search-input');
      const btnPause = document.getElementById('btn-clip-pause');
      const btnClear = document.getElementById('btn-clip-clear');
      if (!searchInput) return;

      searchInput.addEventListener('input', () => {
        this.clipSearchQuery = searchInput.value.trim().toLowerCase();
        this.renderClipboardList();
      });

      btnPause.addEventListener('click', async () => {
        this.clipboardPaused = !this.clipboardPaused;
        await window.sidebarAPI.setClipboardPaused(this.clipboardPaused);
        btnPause.textContent = this.clipboardPaused ? '▶ Devam Et' : '⏸ Duraklat';
        btnPause.classList.toggle('active', this.clipboardPaused);
        this.deps.showToast(this.clipboardPaused ? 'Pano izleme duraklatıldı' : 'Pano izleme aktif');
      });

      btnClear.addEventListener('click', async () => {
        await window.sidebarAPI.clearClipboardHistory();
        this.clipboardItems = [];
        this.renderClipboardList();
        this.deps.showToast('Pano geçmişi temizlendi (Sabitliler korundu)');
      });

      this.refreshClipboardFromMain();
    },

    async refreshClipboardFromMain() {
      try {
        const res = await window.sidebarAPI.getClipboardHistory();
        if (res && Array.isArray(res.items)) {
          this.clipboardItems = res.items;
          this.clipboardPaused = Boolean(res.paused);
          const btnPause = document.getElementById('btn-clip-pause');
          if (btnPause) {
            btnPause.textContent = this.clipboardPaused ? '▶ Devam Et' : '⏸ Duraklat';
            btnPause.classList.toggle('active', this.clipboardPaused);
          }
          this.renderClipboardList();
        }
      } catch {
        // Yoksay
      }
    },

    onClipboardEvent(payload) {
      if (Array.isArray(payload.items)) {
        this.clipboardItems = payload.items;
        this.renderClipboardList();
      }
    },

    renderClipboardList() {
      const listEl = document.getElementById('clip-history-list');
      if (!listEl) return;

      const w = this.getWidgetsState();
      const pinned = Array.isArray(w.pinnedClips) ? w.pinnedClips : [];
      const pinnedSet = new Set(pinned.map((p) => p.text));

      const combined = [
        ...pinned.map((p) => ({ ...p, pinned: true })),
        ...this.clipboardItems.filter((item) => !pinnedSet.has(item.text)).map((item) => ({ ...item, pinned: false }))
      ].filter((item) => {
        if (!this.clipSearchQuery) return true;
        return item.text.toLowerCase().includes(this.clipSearchQuery);
      });

      listEl.innerHTML = '';
      if (combined.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tool-empty-hint';
        empty.textContent = this.clipSearchQuery
          ? 'Aramayla eşleşen pano kaydı bulunamadı.'
          : 'Henüz kopyalanmış metin yok. Herhangi bir yerden metin veya bağlantı kopyaladığınızda otomatik olarak burada listelenir (Son 30 kayıt).';
        listEl.appendChild(empty);
        return;
      }

      combined.forEach((entry) => {
        const card = document.createElement('div');
        card.className = `clip-card ${entry.pinned ? 'is-pinned' : ''}`;

        const textDiv = document.createElement('div');
        textDiv.className = 'clip-text';
        textDiv.textContent = entry.text.length > 260 ? `${entry.text.slice(0, 260)}…` : entry.text;
        textDiv.title = 'Tek tıkla panoya kopyala';
        card.appendChild(textDiv);

        const footer = document.createElement('div');
        footer.className = 'clip-card-footer';

        const isUrl = /^https?:\/\/\S+$/i.test(entry.text.trim());
        const tag = document.createElement('span');
        tag.className = 'clip-meta';
        tag.textContent = `${entry.pinned ? '📌 Sabit • ' : ''}${isUrl ? '🔗 Bağlantı' : `${entry.text.length} krk`}`;
        footer.appendChild(tag);

        const actions = document.createElement('div');
        actions.className = 'clip-actions';

        if (isUrl) {
          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'mini-act-btn';
          openBtn.textContent = '🌐 Aç';
          openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deps.openUrlInEdge(entry.text.trim());
          });
          actions.appendChild(openBtn);

          const addSiteBtn = document.createElement('button');
          addSiteBtn.type = 'button';
          addSiteBtn.className = 'mini-act-btn';
          addSiteBtn.textContent = '+ Sekme';
          addSiteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deps.pinUrlToSidebar(entry.text.trim());
          });
          actions.appendChild(addSiteBtn);
        }

        const pinBtn = document.createElement('button');
        pinBtn.type = 'button';
        pinBtn.className = 'mini-act-btn';
        pinBtn.textContent = entry.pinned ? 'Sabiti Kaldır' : '📌 Sabitle';
        pinBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const curW = this.getWidgetsState();
          let nextPinned = Array.isArray(curW.pinnedClips) ? [...curW.pinnedClips] : [];
          if (entry.pinned) {
            nextPinned = nextPinned.filter((p) => p.text !== entry.text);
          } else {
            nextPinned.unshift({ text: entry.text, time: Date.now() });
          }
          const updated = await window.sidebarAPI.updateWidgets({ pinnedClips: nextPinned });
          this.deps.setConfig(updated);
          this.renderClipboardList();
        });
        actions.appendChild(pinBtn);

        footer.appendChild(actions);
        card.appendChild(footer);

        card.addEventListener('click', async () => {
          await window.sidebarAPI.writeClipboardText(entry.text);
          this.deps.showToast('Panoya kopyalandı ✓');
        });

        listEl.appendChild(card);
      });
    },

    // ==================== 3) HESAPLAYICI & BİRİM / DÖVİZ ÇEVİRİCİ ====================
    initCalcAndConverter() {
      const exprInput = document.getElementById('calc-expr-input');
      const previewEl = document.getElementById('calc-live-result');
      const keypad = document.getElementById('calc-keypad');
      const histEl = document.getElementById('calc-history-strip');
      if (!exprInput) return;

      const updateLive = () => {
        const val = evaluateMathExpression(exprInput.value);
        previewEl.textContent = val !== null ? `= ${val}` : (exprInput.value.trim() ? '…' : '= 0');
      };

      const commitCalc = () => {
        const expr = exprInput.value.trim();
        const val = evaluateMathExpression(expr);
        if (val === null) return;
        this.calcHistory.unshift({ expr, val });
        this.calcHistory = this.calcHistory.slice(0, 6);
        exprInput.value = String(val);
        updateLive();
        renderCalcHistory();
      };

      const renderCalcHistory = () => {
        histEl.innerHTML = '';
        this.calcHistory.forEach((h) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'template-chip';
          chip.textContent = `${h.expr} = ${h.val}`;
          chip.title = 'Tıkla: Sonucu Kopyala';
          chip.addEventListener('click', async () => {
            exprInput.value = String(h.val);
            updateLive();
            await window.sidebarAPI.writeClipboardText(String(h.val));
            this.deps.showToast(`Kopyalandı: ${h.val}`);
          });
          histEl.appendChild(chip);
        });
      };

      exprInput.addEventListener('input', updateLive);
      exprInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitCalc();
        }
      });

      previewEl.addEventListener('click', async () => {
        const val = evaluateMathExpression(exprInput.value);
        if (val !== null) {
          await window.sidebarAPI.writeClipboardText(String(val));
          this.deps.showToast(`Sonuç kopyalandı: ${val}`);
        }
      });

      const keys = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '%', '='];
      keypad.innerHTML = '';
      keys.forEach((k) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `calc-key ${k === '=' ? 'equals' : ''} ${'C()÷×-+%'.includes(k) ? 'op' : ''}`;
        btn.textContent = k;
        btn.addEventListener('click', () => {
          if (k === 'C') {
            exprInput.value = '';
            updateLive();
          } else if (k === '=') {
            commitCalc();
          } else {
            exprInput.value += k;
            updateLive();
          }
          exprInput.focus();
        });
        keypad.appendChild(btn);
      });

      // Birim & Döviz Çevirici
      const catBar = document.getElementById('conv-cat-bar');
      const fromVal = document.getElementById('conv-from-val');
      const fromUnit = document.getElementById('conv-from-unit');
      const toVal = document.getElementById('conv-to-val');
      const toUnit = document.getElementById('conv-to-unit');
      const btnSwap = document.getElementById('btn-conv-swap');
      const btnRefreshRates = document.getElementById('btn-conv-refresh-rates');
      const rateNote = document.getElementById('conv-rate-note');

      this.recomputeConversion = () => {
        const num = parseFloat(String(fromVal.value || '0').replace(',', '.'));
        toVal.value = Number.isFinite(num)
          ? convertUnits(this.currentConvCat, num, fromUnit.value, toUnit.value)
          : '';
        if (rateNote) {
          rateNote.classList.toggle('hidden', this.currentConvCat !== 'currency');
          rateNote.textContent = this.ratesStatus;
        }
        if (btnRefreshRates) {
          btnRefreshRates.classList.toggle('hidden', this.currentConvCat !== 'currency');
        }
      };

      const populateUnits = (catKey) => {
        this.currentConvCat = catKey;
        catBar.querySelectorAll('button').forEach((b) => {
          b.classList.toggle('active', b.dataset.cat === catKey);
        });
        const entries = Object.entries(UNIT_CATEGORIES[catKey].units);
        fromUnit.innerHTML = '';
        toUnit.innerHTML = '';
        entries.forEach(([uKey, uObj]) => {
          fromUnit.add(new Option(uObj.name, uKey));
          toUnit.add(new Option(uObj.name, uKey));
        });
        if (catKey === 'currency') {
          fromUnit.value = 'USD';
          toUnit.value = 'TRY';
        } else if (entries.length >= 2) {
          fromUnit.value = entries[0][0];
          toUnit.value = entries[1][0];
        }
        this.recomputeConversion();
      };

      Object.entries(UNIT_CATEGORIES).forEach(([cKey, cObj]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'note-pill';
        b.dataset.cat = cKey;
        b.textContent = cObj.label;
        b.addEventListener('click', () => populateUnits(cKey));
        catBar.appendChild(b);
      });

      fromVal.addEventListener('input', () => this.recomputeConversion());
      fromUnit.addEventListener('change', () => this.recomputeConversion());
      toUnit.addEventListener('change', () => this.recomputeConversion());
      btnSwap.addEventListener('click', () => {
        const tmp = fromUnit.value;
        fromUnit.value = toUnit.value;
        toUnit.value = tmp;
        this.recomputeConversion();
      });
      if (btnRefreshRates) {
        btnRefreshRates.addEventListener('click', () => this.fetchLiveRates(true));
      }

      populateUnits('currency');
    },

    async fetchLiveRates(showFeedback = false) {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data && data.rates) {
          Object.keys(UNIT_CATEGORIES.currency.units).forEach((code) => {
            if (data.rates[code]) {
              UNIT_CATEGORIES.currency.units[code].rate = data.rates[code];
            }
          });
          const nowStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          this.ratesStatus = `Canlı döviz kuru aktif (Son güncelleme: ${nowStr})`;
          if (this.recomputeConversion) this.recomputeConversion();
          if (showFeedback && this.deps) this.deps.showToast('Canlı döviz kurları güncellendi');
        }
      } catch {
        if (showFeedback && this.deps) this.deps.showToast('Çevrimdışı varsayılan kurlar kullanılıyor');
      }
    },

    // ==================== 4) POMODORO ODAK ZAMANLAYICI ====================
    initPomodoro() {
      const timeLabel = document.getElementById('pomo-time-display');
      const modeCaption = document.getElementById('pomo-mode-caption');
      const ringCircle = document.getElementById('pomo-ring-progress');
      const btnStart = document.getElementById('btn-pomo-toggle');
      const btnReset = document.getElementById('btn-pomo-reset');
      const btnMinus = document.getElementById('btn-pomo-minus');
      const btnPlus = document.getElementById('btn-pomo-plus');
      const sessionsEl = document.getElementById('pomo-sessions-count');
      if (!timeLabel) return;

      const CIRCUMFERENCE = 2 * Math.PI * 54; // r=54 -> ~339.29
      ringCircle.style.strokeDasharray = `${CIRCUMFERENCE}`;

      const formatMMSS = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      };

      const renderPomo = () => {
        const formatted = formatMMSS(this.pomodoro.remainSec);
        timeLabel.textContent = formatted;
        const progress = this.pomodoro.totalSec > 0
          ? (1 - this.pomodoro.remainSec / this.pomodoro.totalSec)
          : 0;
        ringCircle.style.strokeDashoffset = `${CIRCUMFERENCE * (1 - progress)}`;

        const captions = {
          work: 'ODAK OTURUMU',
          short: 'KISA MOLA',
          long: 'UZUN MOLA'
        };
        modeCaption.textContent = captions[this.pomodoro.mode] || 'ODAK';
        btnStart.textContent = this.pomodoro.running ? '⏸ Duraklat' : '▶ Başlat';

        const w = this.getWidgetsState();
        sessionsEl.textContent = String(w.pomodoroSessions || 0);

        document.querySelectorAll('[data-pomo-preset]').forEach((b) => {
          b.classList.toggle('active', b.dataset.pomoPreset === this.pomodoro.mode);
        });

        if (this.deps && typeof this.deps.onPomodoroTick === 'function') {
          this.deps.onPomodoroTick(this.pomodoro.running, formatted);
        }
      };

      const stopTimer = () => {
        this.pomodoro.running = false;
        if (this.pomodoro.timerId) {
          clearInterval(this.pomodoro.timerId);
          this.pomodoro.timerId = null;
        }
      };

      const setPreset = (mode, mins) => {
        stopTimer();
        this.pomodoro.mode = mode;
        this.pomodoro.totalSec = mins * 60;
        this.pomodoro.remainSec = mins * 60;
        renderPomo();
      };

      document.querySelectorAll('[data-pomo-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.pomoPreset;
          const mins = Number(btn.dataset.pomoMins) || 25;
          setPreset(mode, mins);
        });
      });

      btnMinus.addEventListener('click', () => {
        if (this.pomodoro.running) return;
        const next = Math.max(60, this.pomodoro.totalSec - 60);
        this.pomodoro.totalSec = next;
        this.pomodoro.remainSec = next;
        renderPomo();
      });

      btnPlus.addEventListener('click', () => {
        if (this.pomodoro.running) return;
        const next = Math.min(120 * 60, this.pomodoro.totalSec + 60);
        this.pomodoro.totalSec = next;
        this.pomodoro.remainSec = next;
        renderPomo();
      });

      btnReset.addEventListener('click', () => {
        stopTimer();
        this.pomodoro.remainSec = this.pomodoro.totalSec;
        renderPomo();
      });

      btnStart.addEventListener('click', () => {
        if (this.pomodoro.running) {
          stopTimer();
          renderPomo();
          return;
        }
        this.pomodoro.running = true;
        renderPomo();
        this.pomodoro.timerId = setInterval(async () => {
          if (this.pomodoro.remainSec > 1) {
            this.pomodoro.remainSec--;
            renderPomo();
          } else {
            stopTimer();
            this.pomodoro.remainSec = 0;
            playPomodoroChime();
            if (this.pomodoro.mode === 'work') {
              const w = this.getWidgetsState();
              const nextCount = (w.pomodoroSessions || 0) + 1;
              const updated = await window.sidebarAPI.updateWidgets({ pomodoroSessions: nextCount });
              this.deps.setConfig(updated);
              this.deps.showToast(`🎉 Pomodoro tamamlandı! Toplam oturum: ${nextCount}`);
            } else {
              this.deps.showToast('⏰ Mola süresi tamamlandı!');
            }
            this.pomodoro.remainSec = this.pomodoro.totalSec;
            renderPomo();
          }
        }, 1000);
      });

      renderPomo();
    }
  };

  window.ZenToolsWidget = ZenToolsWidget;
})();
