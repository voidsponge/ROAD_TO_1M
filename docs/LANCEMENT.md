# Mise en ligne et plan de lancement

Ce document liste **ce qu'il vous reste à faire** : tout ce qui demande votre identité, votre carte bancaire ou votre voix.

## Partie 1 — Mettre en ligne (une demi-journée)

### 1. Statut juridique
Pour encaisser des abonnements il faut un numéro SIRET. La micro-entreprise suffit (création gratuite sur le guichet unique de l'INPI). En franchise en base de TVA, remplacez « HT » par la mention « TVA non applicable, art. 293 B du CGI » dans `src/views.js` et `src/config.js`.

### 2. Nom et domaine
« Auditeo » est un nom de travail : **je n'ai vérifié ni la disponibilité du domaine ni l'existence d'une marque déposée**. Vérifiez sur un registrar et sur la base de marques de l'INPI. Le nom se change avec la variable `BRAND_NAME`, sans toucher au code.

### 3. Serveur
Un VPS avec 2 cœurs et 4 Go de mémoire (Chromium est gourmand), Docker installé.

> **Le serveur doit être situé en France.** Beaucoup de sites n'affichent leur bandeau cookies qu'aux visiteurs européens : depuis un serveur hors d'Europe, les audits seraient faux.

```bash
git clone git@github.com:voidsponge/ROAD_TO_1M.git && cd ROAD_TO_1M
cp .env.example .env      # puis remplir
docker compose up -d --build
```
Pointez l'enregistrement DNS `A` du domaine vers le serveur ; Caddy obtient le certificat HTTPS tout seul.

### 4. Stripe
1. Créer un compte Stripe et l'activer.
2. Créer deux produits à abonnement mensuel : **Pro 39 €** et **Agence 89 €**. Copier leurs identifiants de prix (`price_…`) dans `STRIPE_PRICE_PRO` et `STRIPE_PRICE_AGENCY`.
3. Copier la clé secrète dans `STRIPE_SECRET_KEY`.
4. Ajouter un point de terminaison de webhook vers `https://votre-domaine/stripe/webhook` avec les événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`.
5. Activer le portail client dans les réglages Stripe (résiliation, factures).
6. `docker compose up -d` pour relancer, puis **faire un achat réel de bout en bout en mode test** avant d'ouvrir.

### 5. E-mails
Renseigner un service SMTP (Brevo, Scaleway, OVH…) dans `.env`. Sans cela, les e-mails (mot de passe oublié, nouveau prospect, alerte de note) sont seulement écrits dans les journaux.

### 6. Mentions légales
Remplir les variables `LEGAL_*`. Relire les pages `/cgv` et `/confidentialite` : ce sont des modèles raisonnables, **pas un travail d'avocat**.

### 7. Vérification finale
Auditez votre propre site avec l'outil. En local, il obtient 100 en RGPD et en accessibilité ; les seuls points restants étaient l'absence de HTTPS et de SIRET, que la mise en ligne règle.

## Partie 2 — Valider avant d'investir du temps (2 semaines)

L'étude de marché est documentaire. Avant tout effort de communication, vérifiez sur le terrain :

1. Listez **50 agences web et freelances** (annuaires comme Malt, Codeur, Sortlist, recherche « agence web + ville »).
2. Auditez **le site d'un de leurs clients** (visible dans leur portfolio) ou leur propre site.
3. Envoyez un message personnel, court, avec le lien du rapport.
4. **Critère de réussite : 10 réponses et 3 abonnements payants.** En dessous, ne persistez pas à l'identique : changez de cible (par exemple les délégués à la protection des données externes ou les prestataires informatiques de TPE), de message ou de prix.

### Message type
> Objet : 4 cookies déposés avant consentement sur [site-client.fr]
>
> Bonjour [prénom],
>
> J'ai vu que vous aviez réalisé le site de [client]. En le testant, j'ai relevé 4 cookies publicitaires déposés avant le bandeau et 3 erreurs d'accessibilité — le rapport complet est ici : [lien].
>
> Je développe l'outil qui produit ce rapport. Il le génère à votre logo en 30 secondes, pour vos prospects comme pour vos clients en maintenance. Cinq audits gratuits par mois : [lien].
>
> Cela vous serait-il utile ? Je suis preneur de votre avis, même critique.
>
> [Votre nom]

Règles à respecter : la prospection par e-mail entre professionnels est admise en France si le message est en rapport avec l'activité du destinataire, qu'il identifie l'expéditeur et propose de ne plus être contacté. Envoyez à la main, par petits volumes, depuis une vraie adresse. Pas d'envoi de masse.

## Partie 3 — Atteindre 1 500 €/mois

Cible : **30 clients Pro + 4 clients Agence**.

Hypothèse de travail (à mesurer, pas à croire) : sur 100 messages personnalisés, 5 à 10 essais et 1 à 2 clients payants. Il faudrait alors **2 000 à 3 000 prises de contact**, soit 4 à 9 mois à raison de 15 à 20 messages par jour ouvré — moins si d'autres canaux prennent le relais.

| Canal | Action | Pourquoi |
|---|---|---|
| Démarchage direct | 15 – 20 messages personnalisés par jour avec un rapport réel | Seul canal qui produit des clients dès la première semaine |
| Effet d'entraînement | Chaque rapport gratuit porte la mention de l'outil | Les prospects des agences découvrent le produit |
| Communautés | Partager des constats chiffrés (« sur 100 sites d'artisans audités, x % déposent des cookies avant consentement ») sur LinkedIn et dans les groupes de freelances | Contenu original que personne d'autre ne possède |
| Référencement | Pages « audit RGPD gratuit », « tester l'accessibilité de son site » | Lent (3 à 6 mois) mais gratuit et durable |
| Partenaires | Formateurs WordPress, communautés d'intégrateurs, écoles du web | Un relais touche des dizaines de freelances d'un coup |

### Chaque semaine
- Nouveaux essais, passages au payant, résiliations (et leur raison : demandez-la).
- Les 3 demandes les plus fréquentes des utilisateurs → priorités de développement.

### Améliorations à prévoir selon les retours
- Audit de plusieurs pages par site.
- Envoi automatique du rapport au prospect par e-mail.
- Audit par lot à partir d'une liste d'adresses (prospection en volume).
- Rapport comparatif avant / après correction.
- Sauvegarde automatique de la base (`/data/app.db`) : **à mettre en place dès le premier client payant**.
