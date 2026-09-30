# GA — Gestion des consommables

Frontend Angular de l’application Spring Boot située dans `../gestion-stock`.

## Démarrer

Depuis ce dossier : `npm ci`, puis `npm start`. Ouvrir http://localhost:4200.
Le proxy de développement transmet `/api/**` à http://localhost:8080 ; ajuster `proxy.conf.json` si nécessaire.
Démarrer aussi le backend avec ses paramètres locaux de base de données, AD et SMTP. Aucun secret AD ou SMTP ne doit être ajouté au frontend.

## Fonctionnalités

- Connexion avec le compte entreprise ; navigation et accès adaptés au rôle.
- Catalogue, création et annulation de demandes, consultation des réponses, historique personnel.
- Administration : indicateurs, articles, seuils, archivage/réactivation, entrées/sorties, export CSV filtré, historique filtré, alertes et acquittement.
- Traitement des demandes avec réponse obligatoire et explication du débit immédiat de stock lors de l’approbation.
- Comptes AD : consultation et activation/désactivation. Nom et rôle proviennent de l’annuaire. Création de comptes et changement de mot de passe réservés au mode local.
- Surveillance des notifications non envoyées et relance. L’envoi de mail est assuré par le backend ; une mise en file ne garantit pas encore la livraison.
- Pagination, affichage mobile, formulaires, états de chargement/erreur et protection contre les doubles clics.

Les sorties manuelles peuvent utiliser l’ID bénéficiaire visible dans Utilisateurs pour alimenter son historique personnel. Un bénéficiaire saisi uniquement en texte libre n’est pas lié à un compte.

## Session

Le jeton reste en mémoire et n’est jamais enregistré dans le stockage du navigateur. Un rechargement de page demande une nouvelle connexion. Une réponse 401 ferme la session. Le backend reste l’autorité pour chaque permission ; les gardes Angular servent à la navigation.

## Vérifications

`npm run build` compile la version de production.
`npm test -- --watch=false` exécute les tests de parcours avec serveur simulé (droits, expiration, demandes, conflits, pagination, utilisateurs AD, notifications).
Les vrais identifiants AD et le serveur SMTP doivent être vérifiés dans l’environnement de l’entreprise.

## Déploiement

Servir `dist/frontend/browser` par HTTPS avec repli des routes Angular vers `index.html`. Configurer un reverse proxy de même origine pour `/api/` vers Spring Boot. Le proxy de `npm start` n’est pas utilisé en production. Les pages sont rendues côté client, sans rendu serveur de données privées. Ne pas ouvrir l’application directement avec `file://`.
