/**
 * Zen Side — Dahili Ağ Katmanı Reklam ve İzleyici Engelleyici (0 Harici Bağımlılık)
 * Chromium webRequest katmanında yüksek hacimli reklam sunucularını, pop-up ağlarını ve izleyicileri
 * alt-kaynak düzeyinde (script, subFrame, image, xhr, ping) engeller; ana sayfa gezintisini ve OAuth girişlerini bozmaz.
 */

const BLOCKED_DOMAINS = new Set([
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'adservice.google.com.tr',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'pagead2.googlesyndication.com',
  'tpc.googlesyndication.com',
  'adnxs.com',
  'adsrvr.org',
  'adform.net',
  'adroll.com',
  'advertising.com',
  'amazon-adsystem.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'mgid.com',
  'revcontent.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'indexww.com',
  'smartadserver.com',
  'teads.tv',
  'yieldmo.com',
  'sharethrough.com',
  '3lift.com',
  'bidswitch.net',
  'medianet.com',
  'media.net',
  'moatads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'krxd.net',
  'bluekai.com',
  'demdex.net',
  'exelator.com',
  'eyeota.net',
  'mathtag.com',
  'rlcdn.com',
  'tapad.com',
  'turn.com',
  'zedo.com',
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'adcash.com',
  'exoclick.com',
  'juicyads.com',
  'trafficjunky.net',
  'hilltopads.net',
  'adsterra.com',
  'clickadu.com',
  'ads-twitter.com',
  'analytics.twitter.com',
  'ads.linkedin.com',
  'ads.yahoo.com',
  'gemini.yahoo.com',
  'bat.bing.com',
  'clarity.ms',
  'hotjar.com',
  'mouseflow.com',
  'fullstory.com',
  'luckyorange.com',
  'crazyegg.com',
  'mixpanel.com',
  'segment.io',
  'amplitude.com',
  'appsflyer.com',
  'adjust.com',
  'branch.io',
  'chartbeat.com',
  'newrelic.com',
  'nr-data.net',
  'bugsnag.com',
  'omtrdc.net',
  '2mdn.net',
  'serving-sys.com',
  'flashtalking.com',
  'innovid.com',
  'spotxchange.com',
  'lijit.com',
  'sovrn.com',
  'gumgum.com',
  'kargo.com',
  'undertone.com',
  'Sortable.com',
  'adcolony.com',
  'unityads.unity3d.com',
  'vungle.com',
  'applovin.com',
  'mopub.com',
  'inmobi.com',
  'smaato.net',
  'yandexadexchange.net',
  'mc.yandex.ru',
  'an.yandex.ru',
  'reklamstore.com',
  'admatic.com.tr',
  'medyanetads.com',
  'virgul.com'
]);

const SAFE_FIRST_PARTY_ALLOWLIST = new Set([
  'web.whatsapp.com',
  'whatsapp.com',
  'whatsapp.net',
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'gemini.google.com',
  'translate.google.com',
  'chatgpt.com',
  'openai.com',
  'claude.ai',
  'gstatic.com',
  'googleapis.com'
]);

const BLOCKED_PATH_REGEX =
  /\/(pagead|adserver|adservice|adsense|adframe|adbanner|banner[-_]?ads|popunder|prebid|dfp[-_]?ads|doubleclick)\//i;

function isDomainInSet(hostname, domainSet) {
  let cur = hostname;
  while (cur) {
    if (domainSet.has(cur)) return true;
    const dot = cur.indexOf('.');
    if (dot === -1) break;
    cur = cur.slice(dot + 1);
  }
  return false;
}

class ZenAdBlocker {
  constructor() {
    this.sessionBlocked = 0;
    this.attachedSessions = new WeakSet();
  }

  shouldBlockRequest(details) {
    // Ana sayfa yönlendirmelerini veya yerel dosyaları asla engelleme
    if (!details || !details.url) return false;
    const type = details.resourceType;
    if (type === 'mainFrame') return false;
    if (!/^https?:\/\//i.test(details.url)) return false;

    let parsed;
    try {
      parsed = new URL(details.url);
    } catch {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (!host) return false;

    if (isDomainInSet(host, SAFE_FIRST_PARTY_ALLOWLIST)) {
      return false;
    }

    if (isDomainInSet(host, BLOCKED_DOMAINS)) {
      return true;
    }

    // Alt-alan adı reklam önekleri (ads.example.com, adserver.example.com, telemetry.example.com)
    if (/^(ads|adserver|adservice|adclick|banners|track|tracker|telemetry|metrics|pixel)\./i.test(host)) {
      return true;
    }

    if ((type === 'script' || type === 'subFrame' || type === 'image' || type === 'ping') && BLOCKED_PATH_REGEX.test(parsed.pathname)) {
      return true;
    }

    return false;
  }

  attachToSession(sess, isEnabledFn, onBlockedFn) {
    if (!sess || this.attachedSessions.has(sess)) return;
    this.attachedSessions.add(sess);

    sess.webRequest.onBeforeRequest((details, callback) => {
      try {
        if (isEnabledFn() && this.shouldBlockRequest(details)) {
          this.sessionBlocked++;
          if (typeof onBlockedFn === 'function') {
            onBlockedFn(this.sessionBlocked, details.url);
          }
          callback({ cancel: true });
          return;
        }
      } catch {
        // Güvenli geçiş
      }
      callback({ cancel: false });
    });
  }
}

module.exports = new ZenAdBlocker();
