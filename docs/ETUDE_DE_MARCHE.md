# Étude de marché — novembre 2026

Objectif : trouver un service qu'une personne seule peut lancer et amener à **1 000 – 2 000 € de revenu mensuel récurrent**.

> **À lire d'abord.** Aucune étude documentaire ne garantit un revenu. Cette étude repose sur une quinzaine de recherches web menées le 10 novembre 2026 ; la plupart des sources sont des sites d'éditeurs, donc intéressées. Aucun client potentiel n'a été interrogé. La seule validation qui compte est décrite dans [LANCEMENT.md](LANCEMENT.md) : obtenir 10 conversations et 3 paiements.

## 1. Méthode

Critères de choix, par ordre d'importance :

1. **Les gens paient déjà** pour ce type de produit (une concurrence existante est un bon signe, pas un mauvais).
2. **L'acheteur gagne de l'argent avec** : le prix se justifie tout seul.
3. **Le produit fabrique lui-même son argument de vente** (pas besoin d'audience préalable).
4. **Coût d'exploitation quasi nul** (pas de facture d'IA proportionnelle à l'usage).
5. **Faisable et testable entièrement par une personne**, sans agrément ni partenariat.

Repère utile : sur environ 8 700 startups suivies par un annuaire, le revenu mensuel médian est de 145 $ et seules 6 % dépassent 10 000 $ ; la tranche 1 000 – 5 000 $ y est présentée comme le premier objectif réaliste ([bigideasdb.com](https://bigideasdb.com/micro-saas-examples-2026) — échantillon d'un seul site, méthode non vérifiée).

## 2. Pistes étudiées et écartées

### La vague « facture électronique » — demande énorme, mais déjà saturée

Le contexte est porteur : réception obligatoire pour toutes les entreprises depuis le 1er septembre 2026, émission obligatoire pour les TPE/PME et micro-entreprises au **1er septembre 2027** ([Stripe](https://stripe.com/resources/more/public-invoicing-portal-france), [Keobiz](https://www.keobiz.fr/le-mag/facturation-electronique-qui-est-concerne/)). Selon une enquête OpinionWay/Tiime de mars 2026 rapportée par un site tiers, 54 % des dirigeants de moins de 20 salariés n'auraient aucun logiciel de facturation ([ma-facture-electronique.org](https://ma-facture-electronique.org/mise-en-conformite/facturer-avec-excel-ou-word/) — site promotionnel, chiffre à prendre avec recul).

Mais chaque angle accessible à un indépendant est déjà occupé :

| Angle | Concurrents trouvés | Verdict |
|---|---|---|
| API Factur-X pour développeurs | [FormatX](https://formatx.fr/api-directe-facturx) (gratuit, illimité), [facturxapi.com](https://facturxapi.com/) (39 – 499 €/mois), [FacturX.app](https://facturxapp.com/docs) (49 €/mois), [Pont-FacturX](https://www.pont-facturx.com/), [Factrix](https://www.xfacture.fr/) | Un concurrent gratuit et illimité : impossible de se différencier |
| Extension WooCommerce | [OuiFacture](https://wordpress.org/plugins/ouifacture/), [WooFacture](https://woofacture.com/), [Tropratik](https://tropratik.fr/facturez-vos-commandes-woocommerce-au-format-factur-x), [Facturio](https://twoking.fr/factur-x-for-woocommerce/), [Novair](https://wc-facturx.novair.app/), [BuildsByLuke](https://buildsbyluke.com/plugins/facture-electronique/)… | 7 extensions, dont des gratuites |
| Application Shopify | [Facturio](https://apps.shopify.com/facturio), [Facturette](https://apps.shopify.com/facturette), [InvoNorm](https://apps.shopify.com/invonorm?locale=fr), [Sufio](https://sufio.com/articles/shopify/e-invoicing/france-factur-x-einvoices/) | 5 applications |
| Connecteur Stripe → plateforme agréée | [Konformy](https://konformy.com/), [eFactureConnect](https://efactureconnect.fr/), Billit, Invopop ([comparatif](https://weinvoice.fr/blog/stripe-facturation-electronique-2026)) | 4 acteurs dont le partenaire officiel de Stripe |
| Logiciel de facturation | Pennylane, Tiime, Abby, Indy, banques… souvent gratuits | Hors de portée |

### Autres pistes

- **Alertes d'appels d'offres pour artisans** : le BOAMP et les plateformes d'acheteurs proposent des alertes gratuites ([CMA Pays de la Loire](https://www.artisanatpaysdelaloire.fr/detail-offre/repondre-a-un-appel-doffre-detecter-les-bons-marches-ndeg1/generate)) et des acteurs installés dominent le référencement.
- **Visibilité dans les IA (GEO)** : des indépendants revendent déjà leur outil complet, code source inclus, pour 99 $ ([presenc.ai](https://presenc.ai/use-cases/ai-visibility-for-indie-hackers)). Signe d'un marché encombré de clones.

## 3. Piste retenue : l'audit de conformité en marque blanche pour agences web

### Le besoin

Les agences web et les freelances cherchent des clients. Leur meilleur argument est de montrer à un prospect un problème concret sur **son** site. Un rapport d'audit à leur logo fait ce travail.

Ce modèle est éprouvé de longue date côté référencement : MySiteAuditor vend un formulaire d'audit embarquable 79 $/mois, SEOptimer une offre marque blanche à partir de 19 – 39 $/mois selon les sources, SEOcrawl 199 €/mois ([softwareadvice.com](https://www.softwareadvice.com/marketing/mysiteauditor-profile), [insites.com](https://insites.com/how-agencies-use-a-free-white-label-seo-audit-tool-to-generate-leads-on-autopilot), [seocrawl.ai](https://seocrawl.ai/white-label-seo-audit)).

### Pourquoi la conformité, pourquoi maintenant

- **Accessibilité** : les sites marchands et services en ligne sont soumis à la directive européenne sur l'accessibilité depuis juin 2025, sous le contrôle de la DGCCRF. En avril 2026, les procédures en étaient surtout au stade des mises en demeure ; l'Arcom a mis en demeure impots.gouv.fr le 24 juin 2026 ([fildactu.fr](https://www.fildactu.fr/dossier/accessibilite-numerique-obligations-rgaa), [accessio.pro](https://accessio.pro/guides/sanctions-amendes-accessibilite-numerique)). Les montants de sanction cités varient d'une source à l'autre (7 500 € à 50 000 €) : **à vérifier dans les textes avant de les citer à un prospect**.
- **Cookies** : la CNIL sanctionne régulièrement le dépôt de traceurs avant consentement et l'absence de bouton « Refuser ».
- **Mentions légales** : obligation ancienne, souvent mal respectée par les petits sites.

Un test sur de vrais sites le confirme : l'outil relève des manquements objectifs sur des sites pourtant gérés par des équipes professionnelles (cookies YouTube et requêtes publicitaires avant consentement, en-têtes de sécurité absents).

### Concurrence directe

| Acteur | Positionnement | Limite |
|---|---|---|
| [Inclusible](https://inclusible.fr/) | Audit RGAA par IA, marque blanche | Accessibilité seule |
| [Ouverta](https://ouverta.com/) | Surveillance RGAA mensuelle, marque blanche | Accessibilité seule |
| [RGAA Checker](https://rgaa-checker.com/) | Audit RGAA, export marque blanche | Accessibilité seule |
| [Leyzly](https://leyzly.com/fr/soluciones/agencias/) | Audit RGPD marque blanche + surveillance | RGPD seul |
| [ScanRGPD](https://scanrgpd.fr/) | Rapport RGPD à 490 € l'unité | Vise les PME, pas les agences |
| [mynto](https://github.com/pixelersagency/mynto) | Audit 8 axes, open source | À installer et héberger soi-même |

**Lecture honnête** : le créneau n'est pas vide. Des acteurs existent, ce qui confirme que des agences paient. La différence proposée ici :

1. **Un seul rapport pour les quatre obligations légales**, là où les concurrents hébergés sont mono-thème.
2. **Pensé pour la prospection** : lien partageable, PDF, bouton de prise de rendez-vous, et surtout **widget de capture de prospects** à poser sur le site de l'agence.
3. **Prêt à l'emploi**, sans installation, à un prix d'entrée bas (39 €).

Ce sont des différences de positionnement, pas une barrière. Si un concurrent ajoute les mêmes fonctions, l'avantage reposera sur le prix, la qualité du rapport et la relation client.

### Marché adressable (ordre de grandeur, non vérifié)

La France compte plusieurs milliers d'agences web et plusieurs dizaines de milliers de développeurs et intégrateurs indépendants. L'objectif demande **environ 35 clients**, soit une part infime de ce marché — atteignable, à condition d'aller les chercher.

### Modèle économique

| Plan | Prix | Contenu |
|---|---|---|
| Découverte | 0 € | 5 audits/mois, rapport à la marque de l'outil (sert de publicité) |
| Pro | 39 € HT/mois | 150 audits, marque blanche, PDF, widget, 10 sites surveillés |
| Agence | 89 € HT/mois | 600 audits, 50 sites surveillés |

- **Objectif 1 500 €/mois** ≈ 30 clients Pro + 4 clients Agence.
- **Coûts fixes** : un serveur (5 – 10 €/mois), un nom de domaine (≈ 10 €/an), Stripe (≈ 1,5 % + 0,25 € par paiement). Aucun coût d'IA.
- **Fidélisation** : la surveillance mensuelle des sites clients donne une raison de rester abonné au-delà de la phase de prospection.

### Risques

| Risque | Parade |
|---|---|
| Personne ne vient tout seul : sans démarchage, zéro client | Plan de prospection dans [LANCEMENT.md](LANCEMENT.md) ; l'outil fournit lui-même l'accroche |
| Faux positifs qui décrédibilisent l'agence | Formulations prudentes, limites affichées dans chaque rapport, nuance sur les cas ambigus (Google Tag Manager seul, mesure d'audience exemptée) |
| Sites qui bloquent les robots | Message d'erreur clair ; audit non décompté serait une amélioration à prévoir |
| Un concurrent copie | Avancer vite sur la relation client et les demandes des premières agences |
| Résiliation après la phase de prospection | Surveillance mensuelle, widget installé sur le site de l'agence |

## 4. Conclusion

La « meilleure idée du siècle » n'existe pas : en 2026, tout créneau où des gens paient compte déjà plusieurs acteurs. Ce qui distingue les projets qui atteignent 1 000 – 2 000 €/mois, c'est la distribution. La piste retenue est celle où **le produit sert lui-même d'outil de démarchage** — pour ses clients comme pour vous.
