# Zen Side v2.0 — Windows 10/11 Akıllı Masaüstü Kenar Çubuğu

![Version](https://img.shields.io/badge/S%C3%BCr%C3%BCm-v2.0.1-6366F1)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D4?logo=windows)
![Electron](https://img.shields.io/badge/Chromium-134%20%2F%20Electron%2035-47848F?logo=electron)
![Win32 DWM](https://img.shields.io/badge/Win32-DWM%20Mica%20%26%20AppBar-8B5CF6)
![AdBlock](https://img.shields.io/badge/AdBlock-Dahili%20A%C4%9F%20Kalkan%C4%B1-10B981)
![License](https://img.shields.io/badge/Lisans-MIT-22C55E)

**Zen Side**, Windows 10 ve Windows 11 masaüstünüze **donanım hızlandırmalı Windows 11 Mica & iOS Buzlu Cam (Acrylic)**, **Çift Sekme Bölünmüş Görünüm (Split-View)**, **Sürükle & Bırak Süper Gücü**, **0-RAM Yerleşik Mini Araçlar**, **Dahili Reklam & İzleyici Engelleyici**, **Ekran Görüntüsü Kırp & Yapay Zekaya Sor (`✂️`)**, **Çoklu Monitör & Çalışma Alanları** ve **Canlı WhatsApp Bildirim Rozetleri** kazandıran açık kaynaklı, ultra ince masaüstü kenar çubuğudur.

> **Geliştirici:** Serkan ŞENTÜRK (`sL.`) — [github.com/836982756578/Zen-Side](https://github.com/836982756578/Zen-Side)

---

## 🌟 Zen Side v2.0 Öne Çıkan Özellikler

### 1. ⬒ Çift Sekme Bölünmüş Görünüm (Split-View / Alt-Üst İki Uygulama)
- Kenar çubuğu açıkken paneli **üstte WhatsApp, altta Gemini veya Çeviri** olacak şekilde aynı anda ikiye bölebilirsiniz.
- **Sıfır Yeniden Yükleme Mimarisi:** Web görünümleri yeniden oluşturulmaz; açık oturumunuz kesilmeden anında bölünür.
- Ortadaki sürükleme çubuğundan üst/alt yükseklik oranını istediğiniz gibi ayarlayabilir (hafızaya alınır), tek tuşla panelleri yer değiştirebilir (`⇅`) veya şeritteki herhangi bir sekmeye **`Shift + Sol Tık`** (ya da sağ tık → *Alt Bölmede Aç*) yaparak alt bölmeye gönderebilirsiniz.

### 2. 🚀 Sürükle & Bırak (Drag & Drop) Süper Gücü
- Herhangi bir programdan veya tarayıcıdan bir **metni, bağlantıyı (URL) veya görsel dosyasını** sürükleyip kenardaki bir sekmenin üzerine bıraktığınızda sekme otomatik açılır ve içeriği akıllıca işler:
  - **Çeviri (Google Translate / DeepL):** Sürüklenen metni anında çevirir.
  - **Gemini / ChatGPT / Claude / WhatsApp:** Sürüklenen metni veya görseli doğrudan sohbet kutusuna yapıştırır.
  - **Google / Bing / DuckDuckGo / YouTube:** Bağlantıyı doğrudan açar veya metni anında aratır.
  - **`+` (Yeni Site Ekle) butonuna URL bırakma:** Adresi hazır doldurulmuş site ekleme penceresini açar.
  - **`🧰` (Mini Araçlar) butonuna metin bırakma:** Metni doğrudan Hızlı Yapışkan Notlar'a ekler.

### 3. 🧰 0-RAM Yerleşik Mini Araçlar (Web Sayfası Yüklemeden Anında Açılır)
Şeritteki **`🧰`** butonuna veya **`Alt + 0`** kısayoluna bastığınızda Chromium alt süreci başlatmadan `0 MB` ek RAM ile çalışan 4 yerleşik üretkenlik aracı açılır:
- **📝 Yapışkan Notlar (Scratchpad):** Çoklu not desteği, başlıklandırma, anında otomatik kayıt, tek tıkla kopyalama ve `.txt` dışa aktarma.
- **📋 Pano Geçmişi:** Kopyaladığınız son 30 metni ve bağlantıyı arka planda yakalar; arama yapabilir, önemli öğeleri sabitleyebilir (`📌`), tek tıkla kopyalayabilir, Edge'de açabilir veya yeni sekme olarak şeride ekleyebilirsiniz.
- **🧮 Akıllı Hesaplayıcı & Canlı Döviz / Birim Çevirici:** Güvenli matematiksel ifade çözücü, işlem geçmişi, canlı döviz kurları (`USD`, `EUR`, `TRY`, `GBP`, `JPY`, `CHF`, `CAD`, `AUD` — çevrimdışı yedekli) ve Uzunluk / Ağırlık / Sıcaklık / Veri Boyutu dönüştürücü.
- **⏱️ Pomodoro Odak Zamanlayıcı:** `25 dk Odak` / `5 dk Kısa Mola` / `15 dk Uzun Mola`, `±1 dk` hassas ayar, SVG ilerleme halkası, oturum sayacı, WebAudio sesli bildirim ve çalışırken şerit üzerinde canlı yeşil gösterge noktası.

### 4. 🛡️ Dahili Reklam ve İzleyici Engelleyici (Built-in AdBlock)
- Electron ağ katmanında (`webRequest.onBeforeRequest`) çalışan yerleşik reklam ve izleyici kalkanı; haber siteleri, sözlükler ve arama sayfalarındaki `105+` reklam/telemetri ağını sayfa yüklenmeden engeller.
- WhatsApp Web, Google OAuth, Gemini, Çeviri ve ChatGPT oturumlarını bozmayan akıllı birinci taraf beyaz listesine sahiptir.
- Üst çubuktaki **`🛡️`** kalkan düğmesinden, Ayarlar'dan veya sağ tık menüsünden tek tuşla açıp kapatabilir ve engellenen toplam reklam sayısını canlı görebilirsiniz.

### 5. ✂️ Ekran Görüntüsü Kırp & Yapay Zekaya Sor (Quick Snip)
- Şeritteki **`✂️`** makas ikonuna veya **`Alt + Shift + S`** global kısayoluna bastığınızda Zen Side saniyenin onda biri sürede şeffaflaşır ve HiDPI tam ekran kırpma arayüzü açılır.
- Ekrandan istediğiniz alanı seçtiğinizde kayan cam araç çubuğu üzerinden tek tıkla:
  - **✨ Gemini'ye Sor** (Görüntüyü panoya kopyalar, Gemini sekmesini açar ve sohbet kutusuna yapıştırır)
  - **💬 Whatsapp'a Gönder** (WhatsApp sekmesini açar ve görüntüyü yapıştırır)
  - **📋 Panoya Kopyala** veya **💾 PNG Olarak Kaydet** işlemlerini yapabilirsiniz.

### 6. 🖥️ Çoklu Monitör Seçimi & Çalışma Alanları (Workspaces)
- **Çoklu Monitör Desteği:** Çift veya üçlü monitör kurulumlarında kenar çubuğunu Ayarlar veya Sistem Tepsisi menüsünden dilediğiniz monitöre (`1. Monitör`, `2. Monitör` vb.) sabitleyebilirsiniz.
- **Çalışma Alanları (Profiller):** Sekmelerinizi **`✦ Tümü`**, **`◈ Genel`**, **`⚡ Yapay Zeka`**, **`💼 İş`** ve **`🏠 Kişisel`** gruplarına ayırabilir; şeridin üstündeki çalışma alanı rozetine tıklayarak profiller arasında anında geçiş yapabilirsiniz.

### 7. İnce Tasarım, 3 Görünüm Modu & Hafızalı Genişlik
- **Minimum `22px` İnce Şerit (`22px` – `160px`):** Ekranın sağ veya sol kenarında minimum **`22px`** genişliğinde zarif bir şerit olarak durur; iç kenarından sürükleyerek genişletilebilir (`58px` üzerinde otomatik yatay düzene geçer, çift tıklamayla `22px`'e sıfırlanır).
- **3 Sekme Görünüm Modu (`⊞`):** *Sadece İsim*, *Sadece Simge* ve *Simge + İsim* modları arasında anında geçiş.
- **Hafızalı Sekme Genişliği:** Açılan her sekmenin genişliği ayrı ayrı hafızada tutulur.

### 8. Akıllı Masaüstü Hizalama, Boş Yere Tıklayınca Kapanma & Tam Kenar Sensörü
- **Tam Ekran Uygulamalar Altında Kalmaz:** `SHAppBarMessage` ve DWM pencere hizalayıcı sayesinde pencereleri tam ekran büyüttüğünüzde (Maximize), pencereler şeridin altında kalmaz; tam **yanına** hizalanır.
- **Mevcut Sayfaların Üstünde Açılır & Boş Yere Tıklayınca Kapanır:** Açılan sekme mevcut pencerelerinizi sıkıştırmadan üst katmanda açılır; ekranın boş bir yerine veya başka bir sayfaya tıkladığınızda otomatik kapanır (`📌` ile sabitlenebilir).
- **Tam Kenar Yaklaşma Sensörlü %100 Görünmez Otomatik Gizleme:** Otomatik gizleme aktifken ekran kenarında hiçbir çubuk, tutamaç veya gölge kalmaz (`%100` görünmez). Fareyi ekranın bulunduğu kenar boyunca herhangi bir noktaya yaklaştırdığınızda çubuk otomatik açılır, uzaklaştığınızda tamamen kaybolur (pencere kapatma `✕` köşesi ve kaydırma çubuğu sürüklemeleri akıllıca filtrelenir).

### 9. Canlı WhatsApp Bildirimleri, Otomatik Uyku Modu & Mica / iOS Cam
- **4 Katmanlı Canlı Bildirim:** WhatsApp yeni mesaj aldığında sekme başlığında `(2) Whatsapp` yazar, zümrüt yeşili parlar, simge rozeti, gizli kenar sayacı ve sistem tepsisi ikonu güncellenir.
- **Otomatik Sekme Uyku Modu (RAM Tasarrufu):** Hareketsiz arka plan sekmeleri seçilen sürede (`5/15/30/60 dk`) otomatik uyutularak RAM boşaltılır; ses çalan veya bildirim bekleyen (WhatsApp vb.) sekmeler korunur.
- **Donanım Mica & iOS Cam:** Doğrudan `dwmapi.dll` üzerinden gerçek **iOS Buzlu Cam (Acrylic)**, **Windows 11 Mica**, **Mica Alt** ve **8 özel cam renk tonu**.

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- **Windows 10** veya **Windows 11** (64-bit)
- [Node.js](https://nodejs.org/) (v18 veya üzeri — yalnızca kaynak koddan çalıştırmak için)

### Kaynak Koddan Başlatma
```powershell
git clone https://github.com/836982756578/Zen-Side.git
cd Zen-Side
npm install
npm start
```

- **Komut Penceresiz (Sessiz) Başlatma:** Klasördeki **`Zen-Side.vbs`** dosyasına çift tıklayarak siyah konsol penceresi olmadan doğrudan masaüstü kenar çubuğu olarak başlatabilirsiniz.
- **Taşınabilir `.exe` ve Kurulum Sihirbazı Üretme:**
  ```powershell
  npm run dist:portable   # dist/Zen-Side-Portable-2.0.0.exe üretir
  npm run dist            # Hem Portable hem Setup .exe üretir
  ```

### GitHub Actions ile Otomatik `.exe` Release Sistemi
Depodaki [`github-workflows/release.yml`](github-workflows/release.yml) dosyasını GitHub üzerinde `.github/workflows/release.yml` konumuna taşıdığınızda her `v*` etiketinde (ör. `v2.0.0`) veya **Actions → Run workflow** tetiklemesinde `Zen-Side-Portable-*.exe` ve `Zen-Side-Setup-*.exe` paketleri bulutta otomatik derlenerek **Releases** sekmesine yüklenir.

---

## ⌨️ Kısayollar ve Pratik Hareketler

| Kısayol / Hareket | İşlev |
| :--- | :--- |
| **`Alt + S`** *(Özelleştirilebilir)* | Zen Side'ı her yerden aç / gizle (Okunmamış bildirim varsa doğrudan o sekmeyi açar) |
| **`Alt + Shift + S`** *(Özelleştirilebilir)* | **Quick Snip (`✂️`)** — Ekrandan alan kırp ve Gemini / WhatsApp'a gönder |
| **`Alt + 0`** | **0-RAM Yerleşik Mini Araçlar (`🧰`)** panelini aç / kapat |
| **`Alt + 1` .. `Alt + 9`** | Görünür sekmeler arasında anında geçiş yap |
| **`Shift + Sekmeye Tıkla`** | Seçilen sekmeyi **Çift Sekme Bölünmüş Görünüm (Alt Bölme)** olarak aç |
| **Metin / Görsel Sürükle → Sekmeye Bırak** | Sekmeyi otomatik açıp metni çevir / ara / yapay zekaya veya WhatsApp'a yapıştır |
| **`Esc` veya Boş Sayfaya Tıkla** | Açık sekmeyi anında kapat (`📌` Sabitle açık değilken) |
| **İç Kenarı Sürükle / Çift Tıkla** | Açık panelin veya kapalı şeridin (`22px`–`160px`) genişliğini ayarla / `22px`'e sıfırla |
| **`Shift + Kapat (✕)`** | Açık sekmeyi daraltırken aynı anda uyku moduna al (RAM boşalt) |

---

## 🗂️ Proje Mimarisi

```text
Zen-Side/
├── src/
│   ├── main.js               # Electron ana süreç, çoklu monitör, tam kenar sensörü, pano & Quick Snip IPC
│   ├── win32-appbar.js       # Koffi FFI ile Win32 SHAppBarMessage, DWM Mica/Acrylic ve pencere hizalama
│   ├── adblock.js            # Ağ katmanı (webRequest) dahili reklam ve izleyici engelleyici motoru
│   ├── store.js              # Kalıcı JSON yapılandırma, çalışma alanları ve otomatik sürüm taşıma (v6)
│   ├── preload.js            # Context-isolated güvenli köprü (window.sidebarAPI)
│   ├── index.html            # Şerit, Split-View sahnesi, 0-RAM Mini Araçlar ve özelleştirme stüdyoları
│   ├── styles.css            # Mica/iOS cam temaları, Split-View, Mini Araçlar ve bildirim rozeti stilleri
│   ├── renderer.js           # Split-View, Sürükle-Bırak yönlendirici, otomatik uyku ve bildirim motoru
│   ├── tools-widget.js       # 0-RAM Yapışkan Notlar, Pano Geçmişi, Hesap/Kur Çevirici ve Pomodoro
│   ├── snip.html             # Tam ekran HiDPI ekran görüntüsü kırpma ve AI gönderim arayüzü
│   ├── snip-preload.js       # Quick Snip penceresi güvenli IPC köprüsü
│   └── icons-data.js         # Vektör ikon galerisi, iOS/Mica cam paletleri ve hazır site şablonları
├── github-workflows/
│   └── release.yml           # GitHub Actions otomatik Windows Portable & Setup .exe derleme hattı
├── Zen-Side.vbs              # Konsolsuz sessiz masaüstü başlatıcısı
├── Baslat.bat                # Hızlı başlatıcı betik
├── package.json              # Proje meta verileri ve electron-builder yapılandırması
└── LICENSE                   # MIT Lisansı
```

---

## 📄 Lisans

Bu proje **Serkan ŞENTÜRK (`sL.`)** tarafından geliştirilmiş olup [MIT Lisansı](LICENSE) altında açık kaynak olarak sunulmuştur.
