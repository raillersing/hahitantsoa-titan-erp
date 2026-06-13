# F130C - Operational roadmap refresh and complex task policy

## 1. Status

F130C is an operational roadmap update post:
- F129 – document instance backend foundation;
- F129S – backend test speed optimization;
- F130A – automated ERP delivery workflow;
- F130B – multi-agent delivery governance.

## 2. Current operational baseline

- `main` expected: `5318d1fb0d28f4fc39ccbdcf314be09b942fb6b3`
- quality gate backend canonique disponible: `bash scripts/ci/backend-quality`
- service test complet disponible: `docker compose --profile test run --rm backend-test`
- CI PR et CI main doivent être attendues jusqu'au résultat final explicite;
- Codex peut aller jusqu'au merge final + CI main verte si tout reste vert, mergeable et dans le scope;
- L'Agent 0 ERP Task Orchestrator pilote la séquence des tâches;
- F128 reste le snapshot stratégique initial;
- F130C ajoute un delta opérationnel et la politique des tâches complexes.

## 3. Roadmap delta since F128

- F129 a ajouté la fondation persistante `DocumentInstance`.
- F129S a stabilisé et accéléré la validation backend locale/CI.
- F130A a documenté le workflow automatisé.
- F130B a documenté la gouvernance multi-agent, l'Agent 0, l'autorisation conditionnelle de merge et la politique de roadmap continue.

## 4. Current finalization priorities

Proposer une liste ordonnée des priorités actuelles pour finaliser l'application.

La liste doit être réaliste et orientée chaîne métier complète:

1. Documents runtime phase 1:
   * génération backend d'un document commercial Titan à partir de `DocumentInstance`;
   * pas de PDF complexe si non nécessaire au premier incrément;
   * stockage/metadata contrôlés;
   * tests ciblés.

2. Document access/download/API:
   * exposer une API contrôlée de consultation/téléchargement;
   * permissions strictes;
   * pas de large refactor frontend.

3. Payment/deposit domain foundation:
   * modèle/fondation paiement ou dépôt;
   * lien avec réservation/document si justifié;
   * pas de provider externe au premier incrément.

4. Reservation lifecycle controlled exposure:
   * confirmer/annuler côté API seulement quand les prérequis document/paiement sont cohérents;
   * garder les permissions et tests stricts.

5. Frontend business chain integration:
   * intégrer progressivement réservation → document → paiement/dépôt → statut;
   * éviter une grosse refonte frontend d'un coup;
   * tests/utilisateurs réels sur micro-flux.

## 5. Complex task policy (T0–T5)

Les tâches suivantes sont autorisées sous politique T0–T5 si le scope, les fichiers autorisés et la chaîne de décision restent respectés:

- **T0** (docs-only, infra, tests, mécanique): Autorisé sous autonomie totale Codex.
- **T1** (backend business sans migration): Autorisé sous autonomie totale Codex si scope/tests/CI verts.
- **T2** (backend avec migration/model): Autorisé si migrations attendues, tests complets, CI verte, aucun doute métier restant.
- **T3** (API/RBAC/paiement/documents runtime): Autorisé sous revue indépendante (Agent B) avant merge.
- **T4** (frontend UI): Autorisé si tests/build verts; stop sur UX ou ambiguïté métier.
- **T5** (production/deploy/secrets/données sensibles): Intervention humaine obligatoire.

## 6. Post-merge roadmap update policy

L'orchestrateur doit, après chaque merge + CI main verte:
- déterminer si la roadmap doit être mise à jour;
- justifier oui/non;
- indiquer l'impact de la tâche;
*indiquer les tâches débloquées;
- recommander la prochaine tâche;
- préciser si Agent B est requis.

La roadmap update doit rester courte. Elle ne doit pas devenir un journal de logs.

## 7. Recommended next task

Sauf découverte contraire pendant la revue documentaire, recommander:
**F131 – Document runtime generation backend phase 1**

Objectif proposé:
* générer un premier document commercial Titan depuis `DocumentInstance`;
* utiliser les fondations F126BC/F129;
* rester backend-only;
* pas de frontend;
* pas de provider externe;
* pas de paiement;
* pas de lifecycle réservation;
* tests ciblés + backend-test complet + CI.

Mentionner qu'Agent B est recommandé pour F131 si la tâche touche stockage, génération runtime, accès document ou API publique.

## 8. Update to F128

Ajouter une section « Post-F130B operational roadmap delta » indiquant:
- F129/F129S/F130A/F130B sont terminés;
- le workflow automatisé est validé;
- la gouvernance multi-agent est validée;
- l'orchestrateur doit utiliser des deltas courts après merge;
- les tâches complexes sont autorisées sous politique T0–T5;
- prochaine tâche recommandée: F131 document runtime generation backend phase 1.

## 9. Update to F130B

Ajouter seulement une phrase indiquant que F130C définit:
* le delta opérationnel de roadmap;
* la politique des tâches complexes;
* les niveaux T0–T5.
