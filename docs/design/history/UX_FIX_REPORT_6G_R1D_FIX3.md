# Mission 6G-R1d-fix3 : Proforma prospect réelle, calendrier cohérent et correction console quote

## Résumé des travaux réalisés

Cette mission visait à corriger les derniers points de l'assistant de création et la gestion des prospects. Toutes les exigences ont été remplies :

1. **Parcours "Proforma demandée" prospect réel (Point 2 et 7)** :
   - Le parcours prospect "Proforma demandée" dans l'assistant client (`CustomersPage.tsx`) est désormais redirigé vers le "vrai" parcours de nouvelle réservation (`ReservationNewPage.tsx`) avec un paramètre spécial `prospect-proforma-[h|t]/[id]`.
   - L'étape du wizard de réservation limite automatiquement les étapes : aucune étape Paiement ou Contrat n'est affichée.
   - À l'étape 7 (Proforma), l'aperçu du document réel est affiché avec la mention "Proforma prospect - non confirmée".
   - Un bouton unique "Terminer et lier au prospect" permet de valider ce brouillon, qui crée une mock reservation `Reservation` de statut `Proforma` et la lie automatiquement au prospect tout en retournant sur sa fiche.

2. **Indécis (Point 8)** :
   - Lors de la sélection "Demande commerciale : Proforma demandée", le champ Volet d'intérêt a été conditionné pour exclure la valeur "Indécis", le rendant obligatoire sur Titan ou Hahitantsoa.

3. **Calendrier de disponibilité prospect (Point 3, 4 et 9)** :
   - Le calendrier des disponibilités prospect (`MockAvailabilityCalendar.tsx`) possède désormais des dates "Occupé" et "Option" distribuées de façon déterministe en fonction du hash de la date entière, évitant ainsi la répétition redondante chaque mois.
   - Les dates taguées "Occupé" ne sont plus cliquables et présentent le style approprié (cursor-not-allowed).

4. **Correction Console/Vite Reload `#reservation-new/quote/CUST-001` (Point 10)** :
   - La route `quote/` résiduelle dans `ReservationNewPage.tsx` déclenchait potentiellement des problèmes de reload/infinit-loop en raison de conflits avec la gestion des drafts et les `useEffect` d'initialisation.
   - La route a été parfaitement neutralisée en l'interceptant au tout début du `useEffect` initial. Les clients ayant ce `param` obsolète dans l'URL (qui devrait être recréé via la proforma) sont redirigés instantanément sur `#customer/[id]` sans même afficher la page. 

5. **Affichage de la proforma depuis la fiche Prospect** :
   - Le bouton "Voir proforma mock" de la section "Proforma liée" de la fiche prospect (`CustomerDetailPage.tsx`) redirige désormais vers `#reservation-detail/[id]`, permettant de visualiser en bonne et due forme le document proforma fraîchement créé dans l'historique global de l'application.

## Non-Régressions (Smoke test validé)
- Typescript (`npx tsc --noEmit`) pass avec 0 erreur.
- Tests unitaires (`npm run test`) pass avec succès.
- Aucune erreur de syntaxe ni d'état React.
- L'architecture `Frontend-only` et `Mock-only` est strictement respectée sans aucun impact backend.
