// Base de connaissances : traceurs, cookies et bandeaux de consentement (CMP).
// consent: true  -> soumis au consentement préalable (art. 82 loi Informatique et Libertés)
// consent: 'maybe' -> exemptable sous conditions de configuration (ex. mesure d'audience CNIL)

export const TRACKER_DOMAINS = [
  { name: 'Google Analytics', cat: 'Mesure d’audience', consent: true, re: /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/ },
  { name: 'Google Ads / DoubleClick', cat: 'Publicité', consent: true, re: /(^|\.)doubleclick\.net$|(^|\.)googleadservices\.com$|(^|\.)googlesyndication\.com$|(^|\.)adservice\.google\.[a-z.]+$/ },
  { name: 'Meta (Facebook) Pixel', cat: 'Publicité', consent: true, re: /(^|\.)connect\.facebook\.net$|^www\.facebook\.com$/, path: /\/tr\b|fbevents|\/signals\// },
  { name: 'TikTok Pixel', cat: 'Publicité', consent: true, re: /(^|\.)analytics\.tiktok\.com$/ },
  { name: 'LinkedIn Insight', cat: 'Publicité', consent: true, re: /(^|\.)snap\.licdn\.com$|^px\.ads\.linkedin\.com$/ },
  { name: 'Microsoft Clarity', cat: 'Analyse comportementale', consent: true, re: /(^|\.)clarity\.ms$/ },
  { name: 'Microsoft Ads (Bing UET)', cat: 'Publicité', consent: true, re: /^bat\.bing\.com$/ },
  { name: 'Hotjar', cat: 'Analyse comportementale', consent: true, re: /(^|\.)hotjar\.(com|io)$/ },
  { name: 'Pinterest Tag', cat: 'Publicité', consent: true, re: /^ct\.pinterest\.com$|^s\.pinimg\.com$/, path: /\/ct\/|\/v3\/|\/user\// },
  { name: 'Snapchat Pixel', cat: 'Publicité', consent: true, re: /^tr\.snapchat\.com$|^sc-static\.net$/ },
  { name: 'X (Twitter) Pixel', cat: 'Publicité', consent: true, re: /^static\.ads-twitter\.com$|^analytics\.twitter\.com$|^t\.co$/ },
  { name: 'Criteo', cat: 'Publicité', consent: true, re: /(^|\.)criteo\.(com|net)$/ },
  { name: 'Taboola', cat: 'Publicité', consent: true, re: /(^|\.)taboola\.com$/ },
  { name: 'Outbrain', cat: 'Publicité', consent: true, re: /(^|\.)outbrain\.com$/ },
  { name: 'HubSpot', cat: 'Marketing', consent: true, re: /(^|\.)hs-analytics\.net$|(^|\.)hs-scripts\.com$|(^|\.)hsadspixel\.net$|(^|\.)hubspot\.com$/, path: /analytics|__ptq|\/\d+\.js/ },
  { name: 'Yandex Metrica', cat: 'Mesure d’audience', consent: true, re: /^mc\.yandex\.(ru|com)$/ },
  { name: 'Mixpanel', cat: 'Mesure d’audience', consent: true, re: /(^|\.)mixpanel\.com$|(^|\.)mxpnl\.com$/ },
  { name: 'Segment', cat: 'Mesure d’audience', consent: true, re: /^(cdn|api)\.segment\.(com|io)$/ },
  { name: 'Amplitude', cat: 'Mesure d’audience', consent: true, re: /(^|\.)amplitude\.com$/ },
  { name: 'AddThis / ShareThis', cat: 'Réseaux sociaux', consent: true, re: /(^|\.)addthis\.com$|(^|\.)sharethis\.com$/ },
  { name: 'Matomo Cloud', cat: 'Mesure d’audience', consent: 'maybe', re: /(^|\.)matomo\.cloud$/ },
];

// Services tiers qui transfèrent l'adresse IP du visiteur dès le chargement.
export const THIRD_PARTY_SERVICES = [
  { id: 'gfonts', name: 'Google Fonts (polices chargées depuis Google)', re: /^fonts\.(googleapis|gstatic)\.com$/ },
  { id: 'youtube', name: 'Vidéo YouTube intégrée', re: /(^|\.)youtube\.com$|(^|\.)ytimg\.com$/ },
  { id: 'gmaps', name: 'Google Maps intégré', re: /^maps\.(googleapis|google)\.com$|^maps\.gstatic\.com$/, alt: /google\.[a-z.]+\/maps/ },
  { id: 'recaptcha', name: 'Google reCAPTCHA', re: /^www\.(google|gstatic)\.com$/, path: /recaptcha/ },
  { id: 'vimeo', name: 'Vidéo Vimeo intégrée', re: /^player\.vimeo\.com$/ },
  { id: 'gtm', name: 'Google Tag Manager', re: /(^|\.)googletagmanager\.com$/ },
];

export const COOKIE_RULES = [
  // Soumis à consentement
  { re: /^_ga($|_)|^_gid$|^_gat($|_)|^__utm[a-z]$/, name: 'Google Analytics', consent: true },
  { re: /^_gcl_|^IDE$|^test_cookie$|^DSID$|^__gads$|^__gpi$|^NID$/, name: 'Google Ads', consent: true },
  { re: /^_fbp$|^_fbc$|^fr$/, name: 'Meta (Facebook)', consent: true },
  { re: /^_tt_|^_ttp$|^tt_/, name: 'TikTok', consent: true },
  { re: /^li_|^bcookie$|^lidc$|^UserMatchHistory$|^AnalyticsSyncHistory$|^bscookie$/, name: 'LinkedIn', consent: true },
  { re: /^_clck$|^_clsk$|^CLID$|^MUID$|^_uet(sid|vid)$|^MR$|^ANONCHK$|^SM$/, name: 'Microsoft (Clarity / Ads)', consent: true },
  { re: /^_hj/, name: 'Hotjar', consent: true },
  { re: /^_pin_|^_pinterest_/, name: 'Pinterest', consent: true },
  { re: /^_scid|^sc_at$/, name: 'Snapchat', consent: true },
  { re: /^hubspotutk$|^__hs(tc|src|sc)$/, name: 'HubSpot', consent: true },
  { re: /^_ym_|^yandexuid$/, name: 'Yandex Metrica', consent: true },
  { re: /^mp_.*_mixpanel$|^ajs_(user|anonymous)_id$|^amplitude_id|^AMP_/, name: 'Outil d’analyse produit', consent: true },
  { re: /^cto_|^uid$|^t_gid$|^obuid$/, name: 'Régie publicitaire', consent: true },
  { re: /^VISITOR_INFO1_LIVE$|^YSC$|^VISITOR_PRIVACY_METADATA$|^__Secure-ROLLOUT_TOKEN$/, name: 'YouTube', consent: true },
  { re: /^vuid$/, name: 'Vimeo', consent: true },
  // Exemptables sous conditions
  { re: /^_pk_(id|ses|ref)|^MATOMO_SESSID$/, name: 'Matomo', consent: 'maybe' },
  { re: /^atid$|^atidx$|^atuserid$|^atauthority$|^pa_(vid|user|privacy)$|^_pcid$|^_pctx$|^_pprv$/, name: 'Piano Analytics (AT Internet)', consent: 'maybe' },
  // Nécessaires / exemptés
  { re: /^PHPSESSID$|^JSESSIONID$|^ASP\.NET_SessionId$|sess(ion)?(id)?$|^connect\.sid$|^laravel_session$|^symfony$/i, name: 'Session', consent: false },
  { re: /csrf|xsrf|^__Host-|^__RequestVerificationToken/i, name: 'Sécurité', consent: false },
  { re: /^__cf_bm$|^cf_clearance$|^_cfuvid$|^__cfruid$|^AWSALB|^AWSELB|^SERVERID$|^SRVNAME$|^BIGipServer|^ROUTEID$|^incap_ses|^visid_incap|^datadome$|^_GRECAPTCHA$|^__stripe_(mid|sid)$|^m$/, name: 'Sécurité / anti-fraude', consent: false },
  { re: /^wordpress_|^wp-settings|^wp_lang$|^wp-wpml|^pll_language$|^woocommerce_|^wc_|^wp_woocommerce_|^cart|^_shopify_(y|s|sa_)|^secure_customer_sig$|^localization$|^cart_currency$|^PrestaShop-|^frontend(_cid)?$|^keep_alive$/i, name: 'Fonctionnement du site', consent: false },
  { re: /consent|cookie[-_]?(notice|law|banner|yes|script)|^axeptio_|^didomi_token$|^euconsent|^tarteaucitron$|^OptanonAlertBoxClosed$|^cmplz_|^CookieControl$|^cc_cookie$|^cookielawinfo|^moove_gdpr|^borlabs-cookie$|^hasConsent$|^tac$|^klaro$|^cookiefirst|^usercentrics|^_iub_cs|^complianz/i, name: 'Mémorisation du choix de consentement', consent: false },
  { re: /^lang(uage)?$|^locale$|^currency$|^i18n|^NEXT_LOCALE$|^django_language$/i, name: 'Préférence d’affichage', consent: false },
];

export const CMPS = [
  { name: 'Axeptio', re: /axept\.io|axeptio/i },
  { name: 'Didomi', re: /didomi/i },
  { name: 'tarteaucitron', re: /tarteaucitron/i },
  { name: 'Cookiebot', re: /cookiebot|consent\.cookiebot/i },
  { name: 'OneTrust', re: /onetrust|cookielaw\.org|optanon/i },
  { name: 'CookieYes', re: /cookieyes|cookie-law-info/i },
  { name: 'Complianz', re: /complianz|cmplz/i },
  { name: 'Usercentrics', re: /usercentrics/i },
  { name: 'iubenda', re: /iubenda/i },
  { name: 'Sirdata', re: /sirdata|sddan/i },
  { name: 'Quantcast Choice', re: /quantcast|quantserve/i },
  { name: 'Osano / Cookie Consent', re: /osano|cookieconsent/i },
  { name: 'Borlabs Cookie', re: /borlabs/i },
  { name: 'Klaro', re: /klaro/i },
  { name: 'Cookie Notice', re: /cookie-notice/i },
  { name: 'GDPR Cookie Compliance (Moove)', re: /moove[-_]gdpr/i },
  { name: 'CookieFirst', re: /cookiefirst/i },
  { name: 'Shopify (bandeau natif)', re: /shopify-pc__banner|privacy-banner/i },
  { name: 'Hubspot (bandeau)', re: /hs-banner|hs-eu-cookie/i },
  { name: 'Orejime', re: /orejime/i },
];

export function classifyCookie(name) {
  for (const r of COOKIE_RULES) if (r.re.test(name)) return { vendor: r.name, consent: r.consent };
  return { vendor: null, consent: null };
}

export function matchTracker(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  for (const t of TRACKER_DOMAINS) {
    if (t.re.test(u.hostname) && (!t.path || t.path.test(u.pathname + u.search))) return t;
  }
  return null;
}

export function matchService(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  for (const s of THIRD_PARTY_SERVICES) {
    if ((s.re.test(u.hostname) && (!s.path || s.path.test(u.pathname))) || (s.alt && s.alt.test(u.hostname + u.pathname))) return s;
  }
  return null;
}
