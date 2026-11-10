# ROAD_TO_1M — Auditeo

**Audit de conformité de sites web en marque blanche, pour agences web et freelances.**

On saisit l'adresse d'un site ; 30 secondes plus tard, un rapport noté sur 100 détaille ce qui ne va pas sur quatre obligations — **cookies & RGPD, accessibilité, mentions légales, sécurité** — avec pour chaque point la référence légale et la correction. L'agence envoie ce rapport, à son logo, à ses prospects.

- [Étude de marché](docs/ETUDE_DE_MARCHE.md) — pourquoi ce produit, ce qui a été écarté, la concurrence, les risques
- [Mise en ligne et plan de lancement](docs/LANCEMENT.md) — ce qu'il reste à faire, étape par étape

## Fonctions

| | |
|---|---|
| Audit | Chromium charge la page comme un nouveau visiteur français, sans rien accepter. Relevé des cookies et requêtes avant consentement, détection du bandeau et du bouton « Refuser », tests axe-core (WCAG 2.1 A/AA) traduits en français, lecture de la page de mentions légales, en-têtes de sécurité. |
| Rapport | Page partageable, capture d'écran, note globale et par thème, export PDF. |
| Marque blanche | Logo, couleur, nom, bouton de prise de contact. |
| Widget | Un `<script>` à coller sur le site de l'agence : le visiteur teste son site, l'agence reçoit son e-mail et le rapport. Export CSV des prospects. |
| Surveillance | Ré-audit tous les 30 jours et alerte e-mail si la note baisse de 5 points. |
| Abonnements | Stripe Checkout, portail client, webhooks signés. Plans : Découverte (0 €), Pro (39 €), Agence (89 €). |
| Comptes | Inscription, connexion, mot de passe oublié, suppression du compte et des données. |

## Démarrer en local

Node.js 22.13 ou plus récent (la base SQLite intégrée à Node est utilisée : aucune dépendance native).

```bash
npm install
npx playwright install chromium
npm start            # http://localhost:3000
npm test
```

Sans configuration, tout fonctionne sauf le paiement (désactivé) et les e-mails (écrits dans la console). Les données sont dans `data/`.

Pour la production : `cp .env.example .env`, puis `docker compose up -d --build` (voir [LANCEMENT.md](docs/LANCEMENT.md)).

## Organisation du code

```
src/
  server.js            routes HTTP, en-têtes de sécurité
  views.js             pages HTML rendues côté serveur
  scanner/
    collect.js         pilotage de Chromium, collecte des faits
    analyze.js         faits → constats notés (fonction pure, testée)
    trackers.js        base de connaissances : traceurs, cookies, bandeaux
    ssrf.js            refus des adresses internes
  queue.js             file d'audits, surveillance mensuelle
  billing.js           Stripe
  auth.js, db.js, mailer.js, config.js
public/                style, script du site, widget embarquable
test/                  17 tests (node --test)
```

## État de vérification

Vérifié le 10 novembre 2026 :
- 17 tests automatisés au vert (analyse, garde anti-SSRF, mots de passe, logique d'abonnement, signature des webhooks).
- Parcours complet dans un vrai navigateur : audit anonyme, inscription, tableau de bord, marque blanche, PDF, surveillance, widget depuis un autre domaine, export CSV, refus des requêtes inter-sites.
- Audits réels de plusieurs sites publics.
- Image Docker construite ; audit exécuté avec succès dans le conteneur.

**Non vérifié** — à tester par vous avant d'ouvrir :
- Le paiement Stripe réel (seule la logique a été testée, avec des événements simulés ; aucun compte Stripe n'était disponible).
- L'envoi d'e-mails par SMTP.
- Le déploiement derrière Caddy sur un vrai domaine.

## Limites connues

- L'audit porte sur **une seule page** (plus la page de mentions légales).
- C'est un pré-diagnostic automatisé : il ne remplace ni un audit RGAA manuel, ni un avis juridique, ni un test d'intrusion. Chaque rapport le précise.
- Les sites protégés contre les robots ne peuvent pas être audités.
- La détection du bandeau cookies repose sur des heuristiques : des faux positifs restent possibles sur des bandeaux atypiques.
- File d'attente et limiteur de débit en mémoire : conçu pour un seul serveur.
- Le garde anti-SSRF vérifie chaque requête mais ne protège pas d'une attaque par changement de DNS en cours d'audit : ne placez pas le serveur sur un réseau donnant accès à des services internes.
