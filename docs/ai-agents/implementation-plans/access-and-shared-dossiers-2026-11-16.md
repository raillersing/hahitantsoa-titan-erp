# Accès utilisateurs et dossiers partagés — plan d’implémentation

Date : 16 novembre 2026. Plan approuvé par le client dans la conversation, puis demande explicite d’enregistrement détaillé. Statut d’exécution : NON COMMENCÉ. Baseline auditée : `c0aa4ea7200e1a73cf18e2159a95aeb470608e05`. Profil documentaire : codex-native-wsl-mutating. Responsable : orchestrateur Codex.

## 1. Résultat attendu

Plusieurs collaborateurs travaillent sur les mêmes dossiers d’entreprise avec leurs droits propres. Le créateur est une attribution d’audit ; il ne possède pas exclusivement le dossier. Chaque fonction distingue consultation, modification, exécution, validation, configuration et suppression. Les pages et API appliquent une politique cohérente et compréhensible.

Ce document autorise la préparation des lots décrits selon la demande client. Il ne constitue pas une autorisation de réaffecter les comptes réels, de migrer les données de production ou de déployer. Commit, push, PR et fusion suivent les autorisations de la session d’exécution et le workflow officiel ; ne pas les déduire du statut « plan approuvé ».

## 2. Sources et priorité

Lire AGENTS.md, docs/ai-agents/AI_ORCHESTRATION_INDEX.md, agent-command-runbook.md, agent-profiles.md, orchestrator-task-queue.md et les contrats d’orchestration pertinents.

Autorités métier : décisions acceptées de docs/decisions/, ADR acceptés, sources approuvées, règles métier, architecture, périmètre. En particulier :

- docs/adr/ADR-011-rbac-policy.md, amendement accepté du 6 novembre, lignes68–112 à la baseline ; il remplace les passages contradictoires de l’ancien modèle à deux rôles.
- docs/decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md.
- docs/decisions/DEC-009-reservation-contract-sequencing-and-access-rules.md.
- docs/audits/USER_ACCESS_IMPLEMENTATION_2026_11_06.md.
- docs/ai-agents/macro-goals/prototype-to-production-roadmap.md, approbation accès et limites de réception.
- docs/design/DESIGN.md, CLIENT_APPROVED_UI_REFERENCE.md et contrats UI/thème pour les lots frontend.

L’audit local du 16 novembre est dans reports/audit-acces-partage-2026-11-16.md du dépôt canonique. Ce chemin est une preuve temporaire non versionnée ; tous les constats nécessaires sont reproduits ci-dessous. Les numéros de ligne sont indicatifs à la baseline ; retrouver les symboles avant modification.

## 3. Décisions à préserver absolument

R01. Partage des dossiers commerciaux et opérationnels ; aucune réintroduction d’un filtre créateur global.
R02. Consultation et édition ordinaires authentifiées des brouillons maintenues, conformément à l’amendement. Ne pas transformer toute modification en opération sensible.
R03. Confirmation, signature, encaissement et autres transitions sensibles : droits explicites + prérequis métier + attribution + audit + protections transactionnelles.
R04. Gérant métier différent de staff/superuser. Ne jamais accorder staff pour résoudre un refus fonctionnel.
R05. Stock/logistique différent de finance et confirmation contractuelle.
R06. Caisse individuelle, notifications privées, jobs d’import personnels et sessions temporaires de l’assistant restent dans leurs périmètres actuels.
R07. Les droits cumulés proviennent des affectations actives et groupes historiques supportés ; un intitulé personnalisé n’accorde rien.
R08. Comptes inactifs sans capacité ; révocation/suspension et protections des comptes plus privilégiés conservées.
R09. Documents privés protégés côté serveur, avec règle cohérente HTML/PDF et contrôle du type documentaire.
R10. Titan exclusivement matériel/article/pack ; aucune correction d’accès ne doit y introduire lieu ou service.
R11. Aucun changement des exigences de signature, validité contractuelle, versement, disponibilité, annulation ou clôture pour faciliter une permission.
R12. Préserver tous les écrans commerciaux validés. Une API incomplète ne justifie ni faux contenu métier ni suppression d’une fonction.

## 4. Vocabulaire commun

| Action | Définition | Ne confère pas automatiquement |
|---|---|---|
| Consulter | Lister, ouvrir, rechercher, lire | Export, accès aux pièces privées, modification |
| Modifier | Changer des informations autorisées | Confirmation ou écriture financière |
| Exécuter | Enregistrer une opération précise | Validation/supervision de sa propre opération |
| Valider | Approuver une transition explicite | Administration technique |
| Configurer | Modifier un paramètre métier autorisé | Réécriture des documents historiques |
| Supprimer | Suppression autorisée et tracée | Nettoyage général ou suppression définitive |

Visibilité des montants et pouvoir d’encaissement sont deux axes distincts. Un export et un téléchargement sont des actions d’accès à traiter explicitement.

## 5. Organisation cible et limites

| Profil existant | Responsabilité à préserver | Restrictions |
|---|---|---|
| owner_manager | Commercial, stock, finance, logistique, collaborateurs, supervision caisse et dérogations | Pas staff, pas takeover plateforme, pas nettoyage technique |
| manager | Commercial, inventaire, finance et capacités opérationnelles déjà approuvées | Pas identité, pas supervision caisse implicite |
| storekeeper / logistics_manager | Articles, ensembles, rangements, opérations physiques, retours | Pas encaissement, confirmation contractuelle, règlement financier casse |
| accountant | Finance et consultation/activation de paie déjà prévues | Pas confirmation réservation ni édition RH implicite |
| hr_manager | Consultation et préparation RH/paie | Pas activation financière implicite ni accès général finance |
| cashbox_operator | Opérations de sa caisse | Pas autres caisses ni validation superviseur |
| cashbox_supervisor | Supervision et opérations autorisées de caisse | Pas rôle commercial global implicite |
| identity_admin | Administration déléguée autorisée | Pas comptes supérieurs ni capacités réservées par simple nom |
| staff / superuser | Administration plateforme selon protections existantes | Ne pas utiliser comme profil métier ordinaire |

Pas d’organigramme nominatif approuvé identifié. Ne créer aucun employé, supérieur hiérarchique ou cumul de rôles à partir d’hypothèses. Chargé d’affaires, lecture seule et achats nécessitent une correspondance explicite avant création d’un nouveau rôle.

## 6. Lot A0 — matrice normative avant code

Type : documentation et contrat. Branche docs dédiée. Fichiers autorisés : docs/decisions/ si nouvelle décision nécessaire, ADR-011 via amendement, docs/audits/, docs/ai-agents/. Aucun code produit.

Étapes obligatoires :
1. Refaire baseline live sans modifier un worktree sale ; comparer avec le SHA de ce plan.
2. Consulter la cartographie propriétaire et Graphify courant, puis confirmer le code avec rg.
3. Construire un CSV/Markdown action par action pour tous domaines du §7. Colonnes : domaine, route/écran, action, méthode HTTP, classe de vue, service, données visibles, état dossier, capacité, profils, portée objet, audit, test, source de décision, verdict.
4. Pour chaque entrée, préciser autorisé/refusé/hors périmètre/à arbitrer. Une case vide n’est pas un accord.
5. Séparer politique de consultation existante et droits sensibles ; consigner explicitement l’étendue actuelle des lectures financières authentifiées.
6. Documenter les points d’arbitrage du §8. Faire approuver uniquement les nouvelles décisions non couvertes ; poursuivre les constats indépendants.
7. Finaliser le contrat des capacités renvoyées par session/utilisateur/rôle et catégories de rapports. Aucun nom nouveau avant ce contrat.

Sortie : matrice approuvée, clauses sources, contrat API figé, lots autorisés et liste exacte de fichiers. Aucun agent backend/frontend ne doit choisir seul la portée d’un nouveau droit.

## 7. Couverture minimale de la matrice

| Domaine | Opérations à inventorier | Portée à conserver |
|---|---|---|
| Clients/prospects | Lecture, création, modification, conversion, suivi, suppression, pièces | Dossiers partagés, pièces contrôlées |
| Titan/Hahitantsoa | Brouillon CRUD, disponibilité, signature, versement, confirmation, annulation, avenant, clôture | Partagé, état métier respecté |
| Assistant | Sessions, fichiers temporaires, reprise, promotion pièces | Session personnelle ; dossier final partagé |
| Inventaire | Actifs/inactifs, article CRUD, emplacement, mouvements, alertes | Partagé |
| Ensembles/services/lieux | Lecture, composition, modification, suppression | Selon domaine Titan/Hahitantsoa |
| Logistique | Calendrier, préparation, sortie, livraison, signatures, retours | Partagé, droits opérationnels |
| Casse/caution | Constat, validation, exécution, excédent, remboursement | Opération physique distincte finance |
| Paiements | Lecture, création, confirmation, annulation, rapprochement, remboursement, gateway | Dossier partagé, contrôles financiers |
| Facturation | Facture, échéance, allocation, correction, avoir, remboursement | Selon action, sans élargissement implicite |
| Documents | Métadonnées, pièces, HTML/PDF, génération, conversion, version/activation | Privé par catégorie autorisée |
| Caisse | Ouvrir, mouvement, comptage, soumettre, valider, rouvrir, export | Propriétaire/superviseur |
| Finance/achats | Banque, journal, transfert, contrepassation, commande, dépense | Selon droits financiers précis |
| Rapports/audit | Catégorie, agrégat, détail, CSV et autres exports | Catégories autorisées, audit distinct |
| RH/paie | Employé, congé, avance, bulletin, règles, simulation, activation | Données sensibles selon rôle |
| Visites/liste attente/blacklist | Lecture, responsable, création, transition, édition/suppression | Responsable métier éligible |
| Support/notifications/imports | Signalement, vue globale, statut, notification, job/mapping/validation | Exceptions personnelles conservées |
| Identité/sessions | Liste, création, rôle, révocation, suspension, reset, sessions appareils | Comptes supérieurs protégés |
| Paramètres/numérotation | Consultation, modification, activation, aperçu séquence | Historique et droits dédiés |
| Tutoriels | Visibilité modules, contexte et reprise | Mêmes capacités, aucune écriture métier |

## 8. Arbitrages obligatoires, recommandations proposées

D01 Finance comptable : définir séparément lecture banques, enregistrement paiement vérifié, confirmation, rapprochement, remboursement, avoir et règlement facture. Recommandation : droits financiers précis ; aucune attribution globale de canSensitiveWrite. Les remboursements/avoirs doivent conserver validations et attribution applicables. L’approbation générale du plan ne fixe ni plafond ni règle de double validation absents des décisions.
D02 Réglages gérant : recommandation approuvée au niveau plan = réglages métier autorisés au gérant, sans technique. Énumérer paramètres de conditions commerciales, banque et numérotation avant ouverture ; protéger historique/document signé.
D03 Support : décider si traitement réservé plateforme ou délégué au support métier. Ne pas déduire de canManageIdentity.
D04 Visites : liste des fonctions éligibles à recevoir une visite ; recommandation inclut gérant et responsables métier désignés, sans rendre tous comptes sélectionnables.
D05 Lecture financière : conserver le comportement existant jusqu’à décision contraire ; si une restriction est souhaitée, préciser montants/champs/documents/exports par profil. Ne pas inventer une confidentialité universelle après coup.
D06 Nouveaux rôles : définir mandat et slug seulement si profils existants insuffisants ; décrire cumuls, séparation de tâches et plafonds si requis.

Pour chaque arbitrage : décision écrite, auteur/approbation, actions concernées, cas autorisés/refusés et absence d’effet rétroactif inattendu. Si non décidé, marquer le sous-lot bloqué ; ne pas contourner avec staff ou capacité trop large.

## 9. Lots backend, séquentiels et séparés du frontend

### A1 — finance et banque

Entrées : A0 + D01. Sources : identity/roles.py, identity/authorization.py, identity/permissions.py ; finance/views.py et services.py ; payments/views.py/services.py ; billing/views.py/services.py. Chemins relatifs backend/apps/.

Constat : accountant possède canManageFinance mais les portes exigent souvent canSensitiveWrite ; achats F fonctionne alors que banque et opérations financières S échouent.

Procédure : lister chaque méthode et service → associer l’action approuvée → réutiliser capacité adéquate ou contrat A0 → contrôler dans vue ET service sensible → conserver transactions, idempotence, rapprochement, reçu et restrictions dossier signé/clos → tester autorisé/refusé. Ne pas remplacer mécaniquement toutes occurrences de S par F. Ne pas modifier le séquencement des contrats ni autoriser une confirmation commerciale au comptable.

BD : pas de migration présumée. Si ajout de rôle/capacité statique, pas de données réaffectées. Si un besoin persisté apparaît, lot migration distinct et approuvé.

### A2 — documents privés

Dépendance : A1 et règles documentaires A0. Sources : documents/views.py, services.py, selectors.py et tests ; routes documentaires des dossiers à examiner sans élargissement.

Constat : HTML/PDF exigent logistique au niveau vue avant règle de catégorie ; comptable bloqué même sur document financier.

Définir une politique unique acteur/type/dossier/action. Réutiliser require_private_document_actor ou son extension minimale. Appliquer à HTML, PDF, téléchargement, pièce jointe et génération selon actions distinctes. Logistique conserve seulement documents opérationnels autorisés ; finance seulement catégories décidées ; métadonnées et contenu privé restent distincts. Contrôler que réponses et erreurs ne divulguent pas chemin privé ou URL permanente. Tester dossier d’un collègue, types permis/interdits, accès direct et génération éventuelle d’artefact sur GET.

### A3 — inventaire et défense caisse

Sous-lots séparés si fichiers/tests ou enjeux distincts.

Inventaire : inventory/views.py classe emplacement et services concernés. Créer/modifier un rangement selon capacité inventaire approuvée ; ne pas donner paiement/confirmation au magasinier. Tester article + emplacement + ensemble + mouvement + refus règlement financier.

Caisse : cashbox/services.py submit_cashbox_count et record_cashbox_movement. Vérifier tous appelants, puis porter si nécessaire le contrôle opérateur/superviseur dans le service avant écriture sous verrou. Ne pas retirer filtre des vues. Tester acteur tiers refusé même via service, auteur propre autorisé, superviseur selon action, rollback et audit. Pas de nouvelle séparation de tâches inventée.

### A4 — visites et support

Dépendances D03/D04. Visites : visits/views.py et serializers.py ; créer/réutiliser un sélecteur métier commun aux choix et à la validation responsible_id. Exclure inactifs et non-éligibles ; ne pas remplacer simplement staff par tous utilisateurs.

Support : notifications vues/services de signalements et identité capacités selon contrat. Harmoniser vue globale, édition de statut et frontend futur. Notifications personnelles inchangées. Tester lecture de ticket propre/autrui, transitions, capacité retirée et audit.

### A5 — rapports et réglages

Rapports : common/reports.py et views_reporting.py + contrat session/capacités approuvé. Exposer la liste des catégories autorisées ou capacité explicitement décidée, appliquer même règle aux exports et détails. Ne pas donner audit ou commercial pour accéder aux rapports.

Réglages : hahitantsoa vues de conditions, finance banque et common numérotation selon D02. Autoriser seulement paramètres métier approuvés, audit durable ; pas réécriture rétroactive des contrats émis. Tester gérant sans staff et refus des réglages techniques.

## 10. Lots frontend

B1 Contrat capacités : étendre types session et FrontendCapabilities aux capacités réellement exposées, sans dupliquer la matrice des rôles. Valeurs explicites false respectées ; pas de fallback qui réaccorde après refus serveur. Lire roles/capacités du serveur, pas noms conviviaux. Tests session incomplète, inactive, changement rôle.

B2 Pages et actions : App.tsx, AppShell, inventaire, packs, services, préparation, finance, documents, rapports et support. Afficher consultation lorsque permise ; masquer/désactiver écritures interdites avec raison compréhensible. Distinguer absence de données/chargement/refus. Réponse403 reste gérée même si bouton caché. Ne pas supprimer écrans validés ; vérifier avant/après.

B3 Administration utilisateurs : AdminPage et composants réels. Choix de profil métier, résumé « Peut… / Ne peut pas… », droits effectifs et origine, cumuls, compte suspendu. Séparer gérant et administration technique. Montrer les actions réellement disponibles ; aucune affectation automatique des comptes existants. Révocation retire sources supportées ; suspension sessions démontrée. Réutiliser contrats existants.

B4 Tutoriel et aide : mettre à jour contenus et filtrage avec mêmes capacités ; pas d’association rapports=auditeur ou gérant=staff. Versions des modules mises à jour si contenu change ; aucune écriture métier par guide.

Design commun : français simple, labels visibles, tableau de consultation lisible sur mobile, clavier/focus, clair/sombre, pas de secret ni détails Django/DRF dans les libellés utilisateur. Les termes techniques restent dans l’aide d’administration avancée si utile.

## 11. Tests obligatoires par lot

Comptes de test distincts, données isolées et explicites ; jamais mots de passe du client. Profils : gérant non staff, manager, magasinier, logistique, comptable, RH, caisse opérateur/superviseur, identité déléguée, sans rôle, inactif et plateforme.

Pour chaque action modifiée :
1. Cas autorisé sous profil précis, dossier créé par collègue.
2. Cas refusé sous profil voisin sans capacité ; contrôler code403 et aucune écriture/audit de succès.
3. Appel API direct sans passer par bouton ; queryset et objet d’autrui.
4. Révocation/changement de rôle en session, compte inactif ; réactualisation UI et refus backend.
5. Transactions : rollback, replay/idempotence et concurrence uniquement pour les opérations touchées.
6. Documents et exports : contrôle même en accès direct, catégories privées interdites, pas fuite de montants/champs si décision les interdit.
7. Caisse/import/notifications/assistant : frontière personnelle conservée.
8. Vérifier l’attribution de l’acteur intervenant sans écraser le créateur.

Backend : tests ciblés, Django check, migration drift, Ruff format/check et gates officiels. Frontend : TypeScript, build, tests composants/contrats, clavier/UX et scope guard. Tous : diff --check et revue indépendante. Pas de migration vide ni de modification de test pour autoriser un accès interdit.

## 12. Recette intégrée et serveur

Après lots fusionnés et CI main exact-SHA verte : une recette intégrée de phase. Deux utilisateurs différents ouvrent le même dossier ; chacun poursuit sa partie autorisée. Tester au moins création client → brouillon → signature → versement → confirmation → préparation → livraison → retour → règlement → clôture avec profils appropriés et serveur isolé.

Preuves : requête, réponse persistée, action visible, rechargement navigateur et auteur. Tests UI simulés ne prouvent pas les droits backend réels. Une CI verte ne prouve ni déploiement Raspberry ni affectations réelles.

Avant serveur réel : inventaire non sensible des rôles actuels et plan explicite de changement utilisateur par utilisateur, approuvé. Sauvegarde et retour arrière opérationnel. Aucune réaffectation globale silencieuse. Tester après déploiement comptes représentatifs sur deux terminaux et consigner version active.

## 13. Protocole d’agent et livrables

Un agent = un worktree = une branche = un scope. Backend, frontend, documents et tooling séparés. Reviewer lecture seule. Rôles : backend A implémente, B revue ; C stratégie tests, D frontière, E migration seulement si pertinente. Frontend FE-A et reviewers pertinents UX/contrat/test/scope. Ne pas créer un deuxième worktree d’implémentation de retry.

Avant délégation : profil, baseline live, branche, worktree, objectif, fichiers autorisés/interdits, sources, tests, revue et autorisations commit/push/PR/fusion. Task-start dans erp-logged-run avant édition. Dirty inattendu = préserver et identifier propriétaire. Wrapper scope, CI et finaliseur officiel selon runbook. Aucun secret/.env ; aucun reset, nettoyage volume ou modification d’un autre worktree.

Rapport par lot : problème concret, droits avant/après, fichiers, décisions, schéma/migrations ou absence justifiée, tests et limites, reviewers et constats résolus, PR/SHA/CI si disponibles. Mise à jour roadmap seulement après preuve de fusion et CI main, jamais sur simple statut local.

## 14. Consigne prête à transmettre

> Exécute le lot [ID] de ce plan. Profil [profil], rôle [implémentation/revue], baseline [SHA main vérifié], branche [nom], worktree [chemin], fichiers autorisés [liste]. Lis AGENTS.md, runbook, queue et contrat d’orchestration applicable. Respecte R01–R12 et les décisions A0 ; aucune permission nouvelle hors contrat. Livrable [résultat], tests [cas autorisés/refusés et commandes], revue [rôles]. Interdits : secrets, autres scopes, attribution staff par facilité, données production, modification du cycle métier. Commit [oui/non], push [oui/non], PR [oui/non], fusion [autorisation explicite]. Si arbitrage manquant, documente et suspend seulement le sous-lot dépendant ; continue les tâches indépendantes autorisées. Ne déclare jamais la réception serveur à partir de mocks ou CI.

## 15. Critères de clôture du programme

- Matrice exhaustive validée, toutes cases renseignées et décisions référencées.
- Chaque écart du §9–10 corrigé ou explicitement arbitré, sans contournement de privilèges.
- Dossiers interaccessibles selon politique ; données personnelles et pièces privées toujours protégées.
- UI, API et services sensibles cohérents, traces acteur/créateur correctes.
- Tests par rôle et recette réelle documentés ; aucun refus connu caché derrière un bouton disponible.
- Administration compréhensible, tutoriels alignés, docs mises à jour.
- PR et CI exact-SHA connues ; déploiement/affectations serveur séparément qualifiés.

Aucune de ces cases n’est déclarée réalisée par le seul enregistrement du présent plan.
