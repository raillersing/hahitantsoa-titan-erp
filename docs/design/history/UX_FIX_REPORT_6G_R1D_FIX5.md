# Rapport de Fix 6G-R1d-fix5 : Restauration des champs contrat Titan

## Contexte
Suite à la revue 6G-R1d-fix4, un problème critique métier a été soulevé : les champs "Type d'usage" et "Nom du lieu" ont été supprimés par erreur du parcours Titan. Ces champs sont contractuellement obligatoires pour générer le document de location.

## Objectif
Restaurer les champs "Type d'usage" et "Nom du lieu" dans le parcours Titan, tout en conservant une séparation stricte avec le domaine Hahitantsoa, et s'assurer que ces informations apparaissent dans le contrat Titan.

## Interventions Réalisées

1. **`ReservationNewPage.tsx`** :
   - Ajout d'un champ `select` pour le "Type d'usage" (Mariage, Anniversaire, Réception privée, Séminaire, Autre) dans la section "Détails Location (Titan)".
   - Ajout d'un champ `input` pour le "Type d'usage : Autre" conditionnel.
   - Ajout d'un champ `input` pour le "Nom du lieu" avec des placeholders pertinents (Ex: Espace Fitiavana, Villa privée, Salle communale, Domicile client).
   - Intégration de ces champs dans l'interface et le composant `tDetails` (TitanDetails).
   - Modification de la section de résumé Titan pour afficher correctement ces nouvelles valeurs.

2. **`DocumentPreview.tsx`** :
   - Mise à jour de l'Article 2 (Destination) pour le Contrat Titan (lorsque `isTitan` est vrai).
   - Ajout d'un bloc récapitulatif "Destination et lieu de la location" affichant clairement : Type d'usage, Nom du lieu, Adresse complète, Commune/Ville, Contact sur place, Téléphone, Coordonnées GPS, et Note d'accès.

3. **`ReservationNewPage.test.tsx`** :
   - Mise à jour du test (Test 9) pour vérifier la présence des labels "Type d'usage" et "Nom du lieu".
   - Ajout d'interactions pour simuler le remplissage de ces champs et vérification dans le résumé.

4. **`DocumentPreview.test.tsx`** :
   - Mise à jour du test `renders Titan Article 2 with correct geography, usage type and venue name` pour s'assurer que les champs "Type d'usage" (ex: Anniversaire) et "Nom du lieu" (ex: Villa Privée) s'affichent correctement dans le contrat Titan.

## Validation
- `npm run build` : Succès
- `npm run test -- --run` : Succès (319/319 tests passés)

## Clôture 6G-R1
Les exigences pour 6G-R1 étant désormais stabilisées avec les correctifs R1d-fix à R1d-fix5, la version est considérée comme validée. Le passage à 6G-R2 (Conversion Documentaire) est autorisé.
