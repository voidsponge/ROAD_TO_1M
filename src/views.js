// Rendu HTML côté serveur. Aucune ressource externe, aucun traceur :
// le site doit lui-même obtenir une excellente note à son propre audit.
import { config, PLANS } from './config.js';
import { PILLARS } from './scanner/analyze.js';

export const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const B = config.brand;
const SEV = { critical: 'Critique', major: 'Important', minor: 'Mineur', info: 'À noter', ok: 'Conforme' };
const frDate = (iso) => new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const legalEnv = (k, d = '[à compléter]') => process.env[k] || d;

export function layout({ title, description = '', body, user = null, nonce = '', bare = false, brandColor = '', noindex = false, canonical = '' }) {
  const nav = bare ? '' : `
<header class="site-header">
  <div class="wrap bar">
    <a class="logo" href="/">${e(B)}</a>
    <nav aria-label="Navigation principale">
      <a href="/#fonctionnement">Fonctionnement</a>
      <a href="/#tarifs">Tarifs</a>
      ${user ? `<a href="/tableau-de-bord">Tableau de bord</a>
      <form method="post" action="/deconnexion" class="inline"><button class="link" type="submit">Déconnexion</button></form>`
    : `<a href="/connexion">Connexion</a><a class="btn small" href="/inscription">Essai gratuit</a>`}
    </nav>
  </div>
</header>`;
  const footer = bare ? '' : `
<footer class="site-footer">
  <div class="wrap">
    <p><strong>${e(B)}</strong> — l’audit de conformité web en marque blanche pour agences et freelances.</p>
    <nav aria-label="Liens légaux">
      <a href="/mentions-legales">Mentions légales</a>
      <a href="/confidentialite">Politique de confidentialité</a>
      <a href="/cgv">Conditions générales de vente</a>
      <a href="/accessibilite">Accessibilité : partiellement conforme</a>
      <a href="mailto:${e(config.contactEmail)}">Contact</a>
    </nav>
    <p class="muted">Ce site ne dépose aucun cookie de suivi et ne charge aucune ressource tierce.</p>
  </div>
</footer>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
${description ? `<meta name="description" content="${e(description)}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
${canonical ? `<link rel="canonical" href="${e(canonical)}">` : ''}
<link rel="stylesheet" href="/static/style.css">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
${brandColor ? `<style nonce="${e(nonce)}">:root{--brand:${e(brandColor)}}</style>` : ''}
</head>
<body${bare ? ' class="bare"' : ''}>
<a class="skip" href="#contenu">Aller au contenu</a>
${nav}
<main id="contenu">
${body}
</main>
${footer}
<script src="/static/app.js" defer></script>
</body>
</html>`;
}

const flash = (msg, kind = 'error') => (msg ? `<p class="flash ${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${e(msg)}</p>` : '');

const scanForm = (label = 'Lancer l’audit gratuit') => `
<form class="scan-form" method="post" action="/audit">
  <label for="url">Adresse du site à auditer</label>
  <div class="row">
    <input id="url" name="url" type="text" inputmode="url" autocomplete="url" placeholder="exemple.fr" required>
    <button class="btn" type="submit">${e(label)}</button>
  </div>
  <p class="muted small">Résultat en 30 secondes environ. Sans inscription.</p>
</form>`;

export function homePage({ user, error }) {
  const plan = (p, features, cta) => `
  <article class="plan${p.id === 'pro' ? ' featured' : ''}">
    <h3>${e(p.name)}</h3>
    <p class="price"><strong>${p.price} €</strong>${p.price ? ' HT / mois' : ''}</p>
    <ul>${features.map((f) => `<li>${f}</li>`).join('')}</ul>
    ${cta}
  </article>`;
  const body = `
<section class="hero">
  <div class="wrap">
    <h1>Montrez à vos prospects, en 30 secondes, ce que leur site risque.</h1>
    <p class="lead">${e(B)} audite n’importe quel site sur 4 obligations — <strong>cookies &amp; RGPD, accessibilité, mentions légales, sécurité</strong> — et génère un rapport clair, à votre logo, qui ouvre la conversation commerciale.</p>
    ${flash(error)}
    ${scanForm()}
  </div>
</section>

<section class="wrap" id="fonctionnement">
  <h2>Un rapport que vos prospects comprennent</h2>
  <div class="grid four">
    <article class="card"><h3>RGPD &amp; cookies</h3><p>Cookies de suivi déposés avant consentement, bandeau sans bouton « Refuser », services tiers, politique de confidentialité.</p></article>
    <article class="card"><h3>Accessibilité</h3><p>Tests automatiques WCAG 2.1 / RGAA : contrastes, alternatives textuelles, formulaires, structure. Obligation renforcée depuis juin 2025.</p></article>
    <article class="card"><h3>Mentions légales</h3><p>Présence et contenu des mentions légales (SIRET, hébergeur, éditeur), CGV pour les boutiques en ligne.</p></article>
    <article class="card"><h3>Sécurité</h3><p>HTTPS, en-têtes de sécurité, contenu mixte, versions logicielles exposées, cookies de session.</p></article>
  </div>
  <p class="muted">Chaque constat est accompagné de sa référence légale et de la correction à apporter. L’audit est passif : il charge la page comme le ferait un visiteur, sans rien accepter.</p>
</section>

<section class="wrap">
  <h2>Pensé pour les agences web et les freelances</h2>
  <div class="grid three">
    <article class="card"><h3>1. Prospectez avec une preuve</h3><p>Auditez le site d’un prospect, envoyez-lui le lien ou le PDF. Un constat chiffré et sourcé vaut mieux qu’un e-mail de présentation.</p></article>
    <article class="card"><h3>2. Votre marque, pas la nôtre</h3><p>Logo, couleur, nom et bouton de prise de contact : le rapport est le vôtre. Votre prospect ne voit jamais ${e(B)}.</p></article>
    <article class="card"><h3>3. Des prospects qui viennent à vous</h3><p>Installez le widget « Testez votre site » sur votre site : chaque visiteur qui lance un audit vous laisse son e-mail et son rapport.</p></article>
  </div>
  <div class="grid three">
    <article class="card"><h3>Surveillance mensuelle</h3><p>Suivez les sites de vos clients : nouvel audit chaque mois et alerte e-mail si la note baisse. Une bonne base pour un contrat de maintenance.</p></article>
    <article class="card"><h3>Honnête sur ses limites</h3><p>Un outil automatique ne remplace ni un audit RGAA manuel ni un avis juridique. Le rapport le dit clairement : vous restez crédible.</p></article>
    <article class="card"><h3>Hébergé en France</h3><p>Aucune donnée revendue, aucun traceur. Les rapports vous appartiennent.</p></article>
  </div>
</section>

<section class="wrap" id="tarifs">
  <h2>Tarifs</h2>
  <div class="grid three plans">
    ${plan(PLANS.free, [`${PLANS.free.audits} audits par mois`, 'Rapport complet en ligne', `Rapport aux couleurs de ${e(B)}`], `<a class="btn ghost" href="/inscription">Créer un compte gratuit</a>`)}
    ${plan(PLANS.pro, [`${PLANS.pro.audits} audits par mois`, '<strong>Marque blanche</strong> : logo, couleur, bouton de contact', 'Export PDF', 'Widget de capture de prospects', `${PLANS.pro.monitors} sites surveillés chaque mois`], `<a class="btn" href="/inscription?plan=pro">Choisir Pro</a>`)}
    ${plan(PLANS.agency, [`${PLANS.agency.audits} audits par mois`, 'Tout le plan Pro', `${PLANS.agency.monitors} sites surveillés chaque mois`, 'Assistance prioritaire'], `<a class="btn ghost" href="/inscription?plan=agency">Choisir Agence</a>`)}
  </div>
  <p class="muted center">Sans engagement, résiliable en un clic. Un seul client signé grâce à un rapport rembourse plusieurs années d’abonnement.</p>
</section>

<section class="wrap narrow" id="faq">
  <h2>Questions fréquentes</h2>
  <details><summary>L’audit est-il légal sur un site qui n’est pas le mien ?</summary><p>Oui. ${e(B)} charge une page publique exactement comme un navigateur, sans s’authentifier ni tester de faille. Il observe ce que le site envoie à n’importe quel visiteur.</p></details>
  <details><summary>Le rapport vaut-il attestation de conformité ?</summary><p>Non. Il s’agit d’un pré-diagnostic automatisé de la page analysée. Les tests automatiques d’accessibilité couvrent environ un tiers des critères ; la conformité RGPD dépend aussi d’éléments invisibles de l’extérieur (registre, contrats, durées de conservation).</p></details>
  <details><summary>Pourquoi le résultat diffère-t-il parfois de ce que je vois dans mon navigateur ?</summary><p>L’audit simule une première visite depuis la France, sans aucun cookie ni choix enregistré. Votre navigateur, lui, a peut-être déjà mémorisé un consentement.</p></details>
  <details><summary>Puis-je résilier à tout moment ?</summary><p>Oui, depuis votre espace, en un clic. L’abonnement reste actif jusqu’à la fin de la période payée.</p></details>
</section>`;
  return layout({
    title: `${B} — Audit de conformité web en marque blanche pour agences`,
    description: 'Auditez n’importe quel site en 30 secondes : cookies et RGPD, accessibilité, mentions légales, sécurité. Rapport à votre logo pour prospecter et fidéliser.',
    body, user, canonical: config.baseUrl + '/',
  });
}

function ring(score, g, size = 132) {
  const r = 52, c = 2 * Math.PI * r;
  return `<svg class="ring grade-${g}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Note ${score} sur 100, niveau ${g}">
  <circle cx="60" cy="60" r="${r}" class="track"/>
  <circle cx="60" cy="60" r="${r}" class="value" stroke-dasharray="${(c * score / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
  <text x="60" y="58" text-anchor="middle" class="num">${score}</text>
  <text x="60" y="78" text-anchor="middle" class="den">/ 100</text>
</svg>`;
}

function finding(f, locked) {
  return `<li class="finding sev-${f.severity}">
  <p class="f-head"><span class="badge sev-${f.severity}">${SEV[f.severity]}</span> <strong>${e(f.title)}</strong></p>
  ${locked ? '' : `<p>${e(f.detail)}</p>
  ${f.law ? `<p class="law"><span>Référence :</span> ${e(f.law)}</p>` : ''}
  ${f.fix && f.severity !== 'ok' ? `<p class="fix"><span>Correction :</span> ${e(f.fix)}</p>` : ''}`}
</li>`;
}

// owner : compte propriétaire de l'audit (ou null) — détermine la marque affichée.
export function reportPage({ audit, owner, viewer, nonce, print }) {
  const white = owner && (PLANS[owner.plan] || PLANS.free).whiteLabel;
  const brandName = white && owner.agency_name ? owner.agency_name : B;
  const brandColor = white && /^#[0-9a-f]{6}$/i.test(owner.color) ? owner.color : '';
  const head = `
<header class="report-brand">
  <div class="wrap bar">
    ${white && owner.logo ? `<img src="${e(owner.logo)}" alt="${e(brandName)}" class="brand-logo">` : `<span class="logo">${e(brandName)}</span>`}
    <span class="muted">Audit de conformité web</span>
  </div>
</header>`;
  const base = { user: viewer, nonce, bare: true, brandColor, noindex: true };

  if (audit.status === 'queued' || audit.status === 'running') {
    return layout({ ...base, title: `Audit en cours — ${audit.host}`, body: `${head}
<section class="wrap narrow center waiting" data-poll="/api/audits/${e(audit.id)}/status">
  <div class="spinner" aria-hidden="true"></div>
  <h1>Audit de ${e(audit.host)} en cours…</h1>
  <p role="status">Chargement du site comme un nouveau visiteur, relevé des cookies, tests d’accessibilité et de sécurité. Comptez 30 secondes environ.</p>
  <noscript><p><a href="">Actualiser la page</a> dans quelques instants.</p></noscript>
</section>` });
  }
  if (audit.status === 'error') {
    return layout({ ...base, title: `Audit impossible — ${audit.host}`, body: `${head}
<section class="wrap narrow center">
  <h1>Audit impossible</h1>
  ${flash(audit.error)}
  <p><a class="btn" href="${viewer ? '/tableau-de-bord' : '/'}">Essayer une autre adresse</a></p>
</section>` });
  }

  const r = audit.result;
  const locked = !audit.user_id; // audit anonyme : aperçu seulement
  const issues = r.counts.critical + r.counts.major + r.counts.minor;
  const sections = Object.values(PILLARS).map((p) => {
    const ps = r.pillars[p.id];
    const own = r.findings.filter((f) => f.pillar === p.id);
    let shown = 0;
    const items = own.map((f) => {
      const lock = locked && f.severity !== 'ok' && shown >= 2;
      if (f.severity !== 'ok') shown++;
      return finding(f, lock);
    }).join('');
    const hidden = locked ? Math.max(0, own.filter((f) => f.severity !== 'ok').length - 2) : 0;
    return `<section class="pillar" id="${p.id}">
  <div class="pillar-head">
    ${ring(ps.score, ps.grade, 72)}
    <div><h2>${e(p.name)}</h2>
    <p class="muted">${ps.counts.critical} critique(s) · ${ps.counts.major} important(s) · ${ps.counts.minor} mineur(s)</p></div>
  </div>
  <ul class="findings">${items}</ul>
  ${hidden ? `<p class="locked-note">Détail et correction de ${hidden} autre(s) constat(s) disponibles dans le rapport complet. <a href="/inscription?audit=${e(audit.id)}">Créer un compte gratuit pour le débloquer</a>.</p>` : ''}
</section>`;
  }).join('');

  const cta = white && owner.cta_url
    ? `<section class="cta"><h2>Parlons-en</h2><p>${e(brandName)} peut corriger ces points et remettre votre site en conformité.</p><p><a class="btn" href="${e(owner.cta_url)}">${e(owner.cta_label || 'Prendre rendez-vous')}</a></p></section>`
    : white ? ''
    : `<section class="cta"><h2>Vous êtes une agence ou un freelance ?</h2><p>Générez ce rapport à votre logo pour vos prospects et vos clients.</p><p><a class="btn" href="/inscription${locked ? `?audit=${e(audit.id)}` : ''}">Essayer ${e(B)} gratuitement</a></p></section>`;

  const isOwner = viewer && owner && viewer.id === owner.id;
  const tools = print ? '' : `<p class="tools">
    ${isOwner ? '<a href="/tableau-de-bord">← Tableau de bord</a>' : ''}
    ${white ? `<a href="/r/${e(audit.id)}/pdf">Télécharger le PDF</a>` : isOwner ? '<a href="/compte/abonnement">PDF et marque blanche : passer en Pro</a>' : ''}
  </p>`;

  const body = `${head}
<article class="wrap report">
  ${tools}
  <section class="summary">
    <div class="score-box">${ring(r.score, r.grade)}<p class="grade grade-${r.grade}">Niveau ${r.grade}</p></div>
    <div class="summary-text">
      <h1>Audit de conformité de <span class="host">${e(r.host)}</span></h1>
      <p class="muted">Page analysée : ${e(r.url)} · ${frDate(r.scannedAt)}</p>
      <p class="verdict">${issues === 0 ? 'Aucun point de non-conformité détecté automatiquement sur cette page.'
    : `<strong>${issues} point(s) à corriger</strong>, dont <strong>${r.counts.critical} critique(s)</strong> et ${r.counts.major} important(s).`}</p>
      <ul class="pillars-mini">
        ${Object.values(PILLARS).map((p) => `<li><a href="#${p.id}"><span class="dot grade-${r.pillars[p.id].grade}"></span>${e(p.name)} <strong>${r.pillars[p.id].score}</strong></a></li>`).join('')}
      </ul>
    </div>
    ${r.screenshot ? `<img class="shot" src="/shots/${e(r.screenshot)}" alt="Capture d’écran de la page d’accueil de ${e(r.host)}" width="320" height="199">` : ''}
  </section>
  ${sections}
  <section class="pillar">
    <h2>Données techniques relevées</h2>
    <ul class="facts">
      <li>${r.stats.requests} requêtes, dont ${r.stats.thirdPartyHosts} domaine(s) tiers contacté(s)</li>
      <li>Poids de la page : ${(r.stats.bytes / 1e6).toFixed(1).replace('.', ',')} Mo · chargement : ${(r.stats.loadMs / 1000).toFixed(1).replace('.', ',')} s</li>
      <li>Gestion du consentement : ${r.stats.cmp ? e(r.stats.cmp) : 'aucune solution reconnue'}</li>
      <li>${r.cookies.length} cookie(s) déposé(s) avant tout choix${r.cookies.length ? ` : ${e(r.cookies.slice(0, 12).map((c) => c.name).join(', '))}${r.cookies.length > 12 ? '…' : ''}` : ''}</li>
    </ul>
  </section>
  ${cta}
  <footer class="report-foot">
    <p><strong>Portée et limites.</strong> Pré-diagnostic automatisé d’une seule page, réalisé en simulant la première visite d’un internaute situé en France, sans aucune interaction. Il ne constitue ni un audit de conformité RGAA, ni un conseil juridique, ni un test d’intrusion. Les tests automatiques d’accessibilité couvrent environ un tiers des critères. Les références légales sont indicatives.</p>
    ${white ? '' : `<p class="muted">Rapport généré avec <a href="${e(config.baseUrl)}/">${e(B)}</a>.</p>`}
  </footer>
</article>`;
  return layout({ ...base, title: `Audit de conformité — ${r.host} — ${r.score}/100`, body });
}

export function authPage({ mode, error, values = {}, next = '', audit = '', plan = '' }) {
  const signup = mode === 'signup';
  const body = `
<section class="wrap narrow">
  <h1>${signup ? 'Créer un compte gratuit' : 'Connexion'}</h1>
  ${flash(error)}
  <form method="post" action="${signup ? '/inscription' : '/connexion'}" class="stack">
    <input type="hidden" name="next" value="${e(next)}">
    <input type="hidden" name="audit" value="${e(audit)}">
    <input type="hidden" name="plan" value="${e(plan)}">
    ${signup ? `<label for="agency">Nom de votre agence ou activité <span class="muted">(facultatif)</span></label>
    <input id="agency" name="agency" type="text" autocomplete="organization" maxlength="80" value="${e(values.agency)}">` : ''}
    <label for="email">Adresse e-mail</label>
    <input id="email" name="email" type="email" autocomplete="email" required value="${e(values.email)}">
    <label for="password">Mot de passe${signup ? ' <span class="muted">(10 caractères minimum)</span>' : ''}</label>
    <input id="password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="${signup ? 10 : 1}">
    ${signup ? `<p class="small muted">En créant un compte, vous acceptez les <a href="/cgv">conditions générales</a> et la <a href="/confidentialite">politique de confidentialité</a>. Vos données servent uniquement à gérer votre compte.</p>` : ''}
    <button class="btn" type="submit">${signup ? 'Créer mon compte' : 'Se connecter'}</button>
  </form>
  <p>${signup ? `Déjà inscrit ? <a href="/connexion">Se connecter</a>` : `Pas encore de compte ? <a href="/inscription">Créer un compte gratuit</a> · <a href="/mot-de-passe-oublie">Mot de passe oublié</a>`}</p>
</section>`;
  return layout({ title: `${signup ? 'Inscription' : 'Connexion'} — ${B}`, body, noindex: true });
}

export function forgotPage({ sent, error }) {
  return layout({ title: `Mot de passe oublié — ${B}`, noindex: true, body: `
<section class="wrap narrow">
  <h1>Mot de passe oublié</h1>
  ${flash(error)}${sent ? flash('Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.', 'ok') : ''}
  <form method="post" action="/mot-de-passe-oublie" class="stack">
    <label for="email">Adresse e-mail</label>
    <input id="email" name="email" type="email" autocomplete="email" required>
    <button class="btn" type="submit">Recevoir un lien</button>
  </form>
</section>` });
}

export function resetPage({ token, error }) {
  return layout({ title: `Nouveau mot de passe — ${B}`, noindex: true, body: `
<section class="wrap narrow">
  <h1>Choisir un nouveau mot de passe</h1>
  ${flash(error)}
  <form method="post" action="/reinitialiser" class="stack">
    <input type="hidden" name="token" value="${e(token)}">
    <label for="password">Nouveau mot de passe <span class="muted">(10 caractères minimum)</span></label>
    <input id="password" name="password" type="password" autocomplete="new-password" required minlength="10">
    <button class="btn" type="submit">Enregistrer</button>
  </form>
</section>` });
}

const accountNav = (active) => `
<nav class="tabs" aria-label="Espace client">
  ${[['/tableau-de-bord', 'Audits'], ['/compte/surveillance', 'Surveillance'], ['/compte/widget', 'Widget & prospects'], ['/compte/marque', 'Marque blanche'], ['/compte/abonnement', 'Abonnement']]
    .map(([h, l]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ''}>${l}</a>`).join('')}
</nav>`;

const scoreCell = (a) => a.status === 'done' ? `<strong>${a.score}</strong> / 100`
  : a.status === 'error' ? `<span class="muted" title="${e(a.error)}">Échec</span>` : '<span class="muted">En cours…</span>';

export function dashboardPage({ user, audits, used, error, ok }) {
  const plan = PLANS[user.plan] || PLANS.free;
  const body = `
<section class="wrap">
  <h1>Tableau de bord</h1>
  ${accountNav('/tableau-de-bord')}
  ${flash(error)}${flash(ok, 'ok')}
  <div class="panel">
    <form class="scan-form" method="post" action="/audit">
      <label for="url">Auditer un site</label>
      <div class="row">
        <input id="url" name="url" type="text" inputmode="url" placeholder="site-du-prospect.fr" required>
        <button class="btn" type="submit">Lancer l’audit</button>
      </div>
    </form>
    <p class="muted small">Plan ${e(plan.name)} : <strong>${used} / ${plan.audits}</strong> audits utilisés ce mois-ci.${plan.id === 'free' ? ' <a href="/compte/abonnement">Passer en Pro</a> pour la marque blanche et le PDF.' : ''}</p>
  </div>
  <h2>Vos audits</h2>
  ${audits.length ? `<div class="table-wrap"><table>
    <thead><tr><th scope="col">Site</th><th scope="col">Note</th><th scope="col">Date</th><th scope="col">Origine</th><th scope="col"><span class="sr">Actions</span></th></tr></thead>
    <tbody>${audits.map((a) => `<tr>
      <td><a href="/r/${e(a.id)}">${e(a.host || a.url)}</a></td>
      <td>${scoreCell(a)}</td>
      <td>${frDate(a.created_at)}</td>
      <td>${{ web: 'Manuel', dashboard: 'Manuel', widget: 'Widget', monitor: 'Surveillance' }[a.source] || e(a.source)}</td>
      <td><form method="post" action="/audit/${e(a.id)}/supprimer" class="inline"><button class="link danger" type="submit" aria-label="Supprimer l’audit de ${e(a.host)}">Supprimer</button></form></td>
    </tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun audit pour l’instant. Lancez le premier ci-dessus.</p>'}
</section>`;
  return layout({ title: `Tableau de bord — ${B}`, body, user, noindex: true });
}

export function monitorsPage({ user, monitors, error, ok }) {
  const plan = PLANS[user.plan] || PLANS.free;
  const body = `
<section class="wrap">
  <h1>Surveillance mensuelle</h1>
  ${accountNav('/compte/surveillance')}
  ${flash(error)}${flash(ok, 'ok')}
  <p>Chaque site suivi est ré-audité tous les 30 jours. Vous recevez un e-mail si sa note baisse de 5 points ou plus.</p>
  ${plan.monitors === 0 ? `<p class="panel">La surveillance est incluse à partir du plan Pro. <a class="btn small" href="/compte/abonnement">Voir les plans</a></p>` : `
  <div class="panel">
    <form class="scan-form" method="post" action="/compte/surveillance">
      <label for="url">Ajouter un site à surveiller</label>
      <div class="row"><input id="url" name="url" type="text" inputmode="url" placeholder="site-client.fr" required><button class="btn" type="submit">Surveiller</button></div>
    </form>
    <p class="muted small">${monitors.length} / ${plan.monitors} sites surveillés.</p>
  </div>`}
  ${monitors.length ? `<div class="table-wrap"><table>
    <thead><tr><th scope="col">Site</th><th scope="col">Dernière note</th><th scope="col">Prochain audit</th><th scope="col"><span class="sr">Actions</span></th></tr></thead>
    <tbody>${monitors.map((m) => `<tr>
      <td>${m.last_audit_id ? `<a href="/r/${e(m.last_audit_id)}">${e(m.host)}</a>` : e(m.host)}</td>
      <td>${m.last_score === null ? '<span class="muted">En attente</span>' : `<strong>${m.last_score}</strong> / 100`}</td>
      <td>${frDate(new Date(m.next_run).toISOString())}</td>
      <td><form method="post" action="/compte/surveillance/${m.id}/supprimer" class="inline"><button class="link danger" type="submit" aria-label="Ne plus surveiller ${e(m.host)}">Retirer</button></form></td>
    </tr>`).join('')}</tbody></table></div>` : ''}
</section>`;
  return layout({ title: `Surveillance — ${B}`, body, user, noindex: true });
}

export function widgetPage({ user, leads }) {
  const plan = PLANS[user.plan] || PLANS.free;
  const snippet = `<script src="${config.baseUrl}/static/widget.js" data-key="${user.widget_key}" async></script>`;
  const body = `
<section class="wrap">
  <h1>Widget &amp; prospects</h1>
  ${accountNav('/compte/widget')}
  <p>Collez ce code à l’endroit de votre site où le formulaire « Testez la conformité de votre site » doit apparaître. Chaque visiteur qui lance un audit vous laisse son e-mail ; vous êtes prévenu et le rapport s’affiche à vos couleurs.</p>
  ${plan.whiteLabel ? '' : `<p class="panel">Le widget est inclus à partir du plan Pro. <a class="btn small" href="/compte/abonnement">Voir les plans</a></p>`}
  <label for="snippet">Code à intégrer</label>
  <textarea id="snippet" class="code" rows="3" readonly>${e(snippet)}</textarea>
  <p><button class="btn small ghost" type="button" data-copy="#snippet">Copier le code</button></p>
  <p class="muted small">Options : <code>data-title</code> (titre affiché) et <code>data-button</code> (texte du bouton). Les audits du widget sont décomptés de votre quota mensuel.</p>
  <h2>Prospects reçus</h2>
  ${leads.length ? `<div class="table-wrap"><table>
    <thead><tr><th scope="col">E-mail</th><th scope="col">Site</th><th scope="col">Note</th><th scope="col">Date</th></tr></thead>
    <tbody>${leads.map((l) => `<tr><td><a href="mailto:${e(l.email)}">${e(l.email)}</a></td><td>${l.audit_id ? `<a href="/r/${e(l.audit_id)}">${e(l.host || l.url)}</a>` : e(l.url)}</td><td>${l.score === null || l.score === undefined ? '—' : `<strong>${l.score}</strong> / 100`}</td><td>${frDate(l.created_at)}</td></tr>`).join('')}</tbody></table></div>
  <p><a href="/compte/prospects.csv">Exporter en CSV</a></p>` : '<p class="muted">Aucun prospect pour l’instant.</p>'}
</section>`;
  return layout({ title: `Widget — ${B}`, body, user, noindex: true });
}

export function brandPage({ user, error, ok }) {
  const plan = PLANS[user.plan] || PLANS.free;
  const body = `
<section class="wrap narrow">
  <h1>Marque blanche</h1>
  ${accountNav('/compte/marque')}
  ${flash(error)}${flash(ok, 'ok')}
  ${plan.whiteLabel ? '' : `<p class="panel">Vous pouvez préparer votre identité dès maintenant ; elle s’appliquera aux rapports dès le passage au plan Pro. <a class="btn small" href="/compte/abonnement">Voir les plans</a></p>`}
  <form method="post" action="/compte/marque" class="stack">
    <label for="agency">Nom affiché sur les rapports</label>
    <input id="agency" name="agency" type="text" maxlength="80" value="${e(user.agency_name)}">
    <label for="color">Couleur principale</label>
    <input id="color" name="color" type="color" value="${e(user.color)}">
    <label for="logofile">Logo <span class="muted">(PNG, JPEG ou WebP, 150 Ko maximum)</span></label>
    <input id="logofile" type="file" accept="image/png,image/jpeg,image/webp" data-logo-target="#logo">
    <input id="logo" name="logo" type="hidden" value="">
    ${user.logo ? `<p><img src="${e(user.logo)}" alt="Logo actuel" class="brand-logo"> <label class="check"><input type="checkbox" name="remove_logo" value="1"> Supprimer le logo</label></p>` : ''}
    <label for="cta_label">Texte du bouton de contact</label>
    <input id="cta_label" name="cta_label" type="text" maxlength="60" placeholder="Prendre rendez-vous" value="${e(user.cta_label)}">
    <label for="cta_url">Lien du bouton <span class="muted">(page contact, Calendly, mailto:…)</span></label>
    <input id="cta_url" name="cta_url" type="text" maxlength="300" placeholder="https://votre-agence.fr/contact" value="${e(user.cta_url)}">
    <button class="btn" type="submit">Enregistrer</button>
  </form>
</section>`;
  return layout({ title: `Marque blanche — ${B}`, body, user, noindex: true });
}

export function billingPage({ user, enabled, ok, error }) {
  const plan = PLANS[user.plan] || PLANS.free;
  const choose = (p) => `<form method="post" action="/compte/abonnement/souscrire" class="inline"><input type="hidden" name="plan" value="${p.id}"><button class="btn${p.id === 'agency' ? ' ghost' : ''}" type="submit">Passer au plan ${e(p.name)} — ${p.price} € HT / mois</button></form>`;
  const body = `
<section class="wrap narrow">
  <h1>Abonnement</h1>
  ${accountNav('/compte/abonnement')}
  ${flash(error)}${ok ? flash('Merci ! Votre abonnement est en cours d’activation (quelques secondes).', 'ok') : ''}
  <p class="panel">Plan actuel : <strong>${e(plan.name)}</strong> — ${plan.audits} audits par mois${plan.whiteLabel ? ', marque blanche, PDF, widget' : ''}${plan.monitors ? `, ${plan.monitors} sites surveillés` : ''}.</p>
  ${!enabled ? '<p class="muted">Le paiement en ligne n’est pas encore activé sur cette installation.</p>'
    : user.plan === 'free' ? `<p class="actions">${choose(PLANS.pro)} ${choose(PLANS.agency)}</p><p class="muted small">Paiement sécurisé par Stripe. Sans engagement.</p>`
    : `<form method="post" action="/compte/abonnement/portail"><button class="btn" type="submit">Gérer mon abonnement, mes factures ou résilier</button></form>`}
  <h2>Compte</h2>
  <p>Connecté en tant que ${e(user.email)}.</p>
  <form method="post" action="/compte/supprimer" data-confirm="Supprimer définitivement votre compte et tous vos audits ?"><button class="link danger" type="submit">Supprimer mon compte et mes données</button></form>
</section>`;
  return layout({ title: `Abonnement — ${B}`, body, user, noindex: true });
}

export function legalPage(kind, user) {
  const name = legalEnv('LEGAL_NAME');
  const pages = {
    'mentions-legales': ['Mentions légales', `
<h2>Éditeur du site</h2>
<p>${e(name)} — ${e(legalEnv('LEGAL_STATUS', '[forme juridique à compléter]'))}<br>
Adresse : ${e(legalEnv('LEGAL_ADDRESS'))}<br>
SIRET : ${e(legalEnv('LEGAL_SIRET'))}<br>
Directeur de la publication : ${e(legalEnv('LEGAL_DIRECTOR', name))}<br>
Contact : <a href="mailto:${e(config.contactEmail)}">${e(config.contactEmail)}</a></p>
<h2>Hébergeur</h2>
<p>${e(legalEnv('LEGAL_HOST', '[nom, adresse et téléphone de l’hébergeur à compléter]'))}</p>
<h2>Propriété intellectuelle</h2>
<p>Le site, sa structure et ses contenus sont la propriété de l’éditeur. Les rapports générés appartiennent à leurs utilisateurs.</p>`],
    confidentialite: ['Politique de confidentialité', `
<p>Responsable du traitement : ${e(name)} — <a href="mailto:${e(config.contactEmail)}">${e(config.contactEmail)}</a>.</p>
<h2>Données traitées</h2>
<ul>
<li><strong>Compte</strong> : adresse e-mail, mot de passe (haché), nom d’agence, logo. Base légale : exécution du contrat. Conservation : durée du compte, suppression immédiate sur demande depuis l’espace client.</li>
<li><strong>Audits</strong> : adresse du site audité et résultat technique. Ce sont des informations publiques relatives à des sites web, non à des personnes.</li>
<li><strong>Prospects du widget</strong> : adresse e-mail et site saisis par le visiteur d’un site client. ${e(B)} agit ici comme sous-traitant de l’agence qui a installé le widget, responsable de traitement.</li>
<li><strong>Paiement</strong> : traité par Stripe ; aucune donnée bancaire ne transite par nos serveurs.</li>
<li><strong>Journaux techniques</strong> : adresse IP, conservée 30 jours au plus, pour la sécurité et la limitation des abus (intérêt légitime).</li>
</ul>
<h2>Cookies</h2>
<p>Un seul cookie, strictement nécessaire : le cookie de session après connexion. Aucun traceur, aucune mesure d’audience tierce, aucun bandeau à valider.</p>
<h2>Vos droits</h2>
<p>Accès, rectification, effacement, portabilité, opposition : écrivez à <a href="mailto:${e(config.contactEmail)}">${e(config.contactEmail)}</a>. Vous pouvez saisir la CNIL (cnil.fr).</p>
<h2>Hébergement</h2>
<p>Données hébergées dans l’Union européenne.</p>`],
    cgv: ['Conditions générales de vente et d’utilisation', `
<p>Les présentes conditions régissent l’utilisation du service ${e(B)} édité par ${e(name)}. Le service est réservé aux professionnels.</p>
<h2>1. Service</h2>
<p>${e(B)} réalise des pré-diagnostics automatisés de pages web publiques et produit des rapports. Ces rapports sont indicatifs : ils ne constituent ni un audit de conformité, ni un conseil juridique, ni un test d’intrusion. L’utilisateur reste seul responsable de l’usage qu’il en fait auprès de ses clients et prospects.</p>
<h2>2. Usage autorisé</h2>
<p>L’utilisateur s’engage à n’auditer que des pages accessibles publiquement, à ne pas tenter de surcharger des sites tiers et à respecter la réglementation applicable à la prospection commerciale.</p>
<h2>3. Abonnements et prix</h2>
<p>Les prix sont indiqués hors taxes. L’abonnement est mensuel, payable d’avance, reconduit tacitement et résiliable à tout moment depuis l’espace client ; la résiliation prend effet à la fin de la période en cours. Aucun remboursement au prorata.</p>
<h2>4. Disponibilité</h2>
<p>Le service est fourni avec une obligation de moyens. Certains sites bloquent les visites automatisées et ne peuvent pas être audités.</p>
<h2>5. Responsabilité</h2>
<p>La responsabilité de l’éditeur est limitée au montant payé par l’utilisateur au cours des douze derniers mois.</p>
<h2>6. Données</h2>
<p>Voir la <a href="/confidentialite">politique de confidentialité</a>. Pour les données de prospects collectées via le widget, l’éditeur agit en qualité de sous-traitant au sens de l’article 28 du RGPD.</p>
<h2>7. Droit applicable</h2>
<p>Droit français. Tribunaux compétents : ceux du siège de l’éditeur.</p>`],
    accessibilite: ['Déclaration d’accessibilité', `
<p>${e(name)} s’engage à rendre ce site accessible conformément au RGAA 4.1.</p>
<p><strong>État de conformité : partiellement conforme.</strong> Le site est testé automatiquement avec son propre moteur d’audit ; aucun audit manuel complet n’a encore été réalisé.</p>
<h2>Retour d’information</h2>
<p>Si vous rencontrez un défaut d’accessibilité, écrivez à <a href="mailto:${e(config.contactEmail)}">${e(config.contactEmail)}</a> : nous vous répondrons et corrigerons le problème.</p>
<h2>Voies de recours</h2>
<p>Si vous n’obtenez pas de réponse satisfaisante, vous pouvez saisir le Défenseur des droits (defenseurdesdroits.fr).</p>`],
  };
  const [title, html] = pages[kind];
  return layout({ title: `${title} — ${B}`, user, body: `<section class="wrap narrow prose"><h1>${title}</h1>${html}</section>` });
}

export function errorPage({ status, message, user }) {
  return layout({ title: `${status} — ${B}`, user, noindex: true, body: `<section class="wrap narrow center"><h1>${status === 404 ? 'Page introuvable' : 'Une erreur est survenue'}</h1><p>${e(message)}</p><p><a class="btn" href="/">Retour à l’accueil</a></p></section>` });
}
