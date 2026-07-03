# Audit et Gouvernance des Templates PDF (R1)

## 1. Objectif
Définir une gouvernance claire pour la gestion, l'anonymisation et le versionnement des documents métier de référence (PDF) utilisés pour le développement du module de génération documentaire (6G-R2 et ultérieurs). 

## 2. Contexte post-6G-R1
La phase 6G-R1 s'est achevée avec succès. La branche `main` est au vert (commit HEAD : `c15b564`). Cependant, un ensemble de 40 fichiers de référence (principalement des PDF contenant des données réelles) demeure non suivi par Git dans le répertoire `docs/references/source/templates/**`. Pour des raisons de confidentialité et de sécurité, ces fichiers ne doivent pas être versionnés en l'état.

## 3. Inventaire synthétique anonymisé

*Total de fichiers détectés : 40*

### Hahitantsoa (19 fichiers)
| Type de document | Année | Client masqué |
| :--- | :--- | :--- |
| Avenant | 2024 | Client A |
| Avenant | 2024 | Client B |
| Avenant | 2024 | Client C |
| Bon de livraison | 2024 | Client D |
| Bon de livraison | 2024 | Client E |
| Bon de livraison | 2024 | Client F |
| Casse | 2024 | Client G |
| Casse | 2024 | Client H |
| Casse | 2024 | Client I |
| Contrat | 2024 | Client J |
| Contrat | 2024 | Client K |
| Contrat | 2024 | Client L |
| Facture | 2024 | Client M |
| Facture | 2024 | Client N |
| Facture | 2024 | Client O |
| Proforma | 2024 | Client P |
| Proforma | 2024 | Client Q |
| Proforma | 2024 | Client R |
| Plan de masse | N/A | *Image d'évacuation (.png)* |

### Titan (15 fichiers)
| Type de document | Année | Client masqué |
| :--- | :--- | :--- |
| Bon de livraison | 2024 | Client S |
| Bon de livraison | 2024 | Client T |
| Bon de livraison | 2024 | Client U |
| Casse | 2022 | Client V |
| Casse | 2022 | Client W |
| Casse | 2023 | Client X |
| Casse | 2023 | Client Y |
| Contrat | 2024 | Client Z |
| Contrat | 2024 | Client AA |
| Facture | 2024 | Client AB |
| Facture | 2024 | Client AC |
| Facture | 2024 | Client AD |
| Proforma | 2024 | Client AE |
| Proforma | 2024 | Client AF |
| Proforma | 2024 | Client AG |

### Gabarits déjà anonymisés (6 fichiers)
- `Template_AVENANT_Hahitantsoa_vierge_style_fidele_v1.pdf`
- `Template_BL_Hahitantsoa_vierge_style_fidele_v1.pdf`
- `Template_BL_Titan_vierge_style_fidele_v1.pdf`
- `Template_FACTURE_Titan_vierge_style_fidele_v1.pdf`
- `Template_Facture_Casse_Remise_Etat_style_fidele_v5.pdf`
- `Template_PROFORMA_Titan_vierge_style_fidele_v1.pdf`

## 4. Nombre de fichiers par volet
- **Hahitantsoa** : 19 fichiers
- **Titan** : 15 fichiers
- **Templates racine (gabarits vierges)** : 6 fichiers

## 5. Nombre de fichiers par type de document
- **Avenant** : 3
- **Bon de livraison** : 6
- **Casse** : 7
- **Contrat** : 5
- **Facture** : 6
- **Proforma** : 6
- **Autre** : 7 (dont 1 image PNG et 6 templates vierges)

## 6. Fichiers `Zone.Identifier` détectés
**0 fichier** détecté. (Le nettoyage effectué lors d'une mission précédente s'est maintenu).

## 7. Classification A/B/C/D/E

- **A. Templates utiles à conserver comme références métier** : Les 6 templates vierges à la racine.
- **B. Fichiers à anonymiser avant intégration** : Un échantillon des 34 fichiers clients réels afin d'avoir une référence fidèle pour chaque format (Proforma, Contrat, BL, Casse, Facture) par volet (Hahitantsoa/Titan).
- **C. Fichiers à garder localement seulement** : Les 34 PDF clients réels. Ils ne doivent en aucun cas être commités.
- **D. Fichiers techniques à supprimer/ignorer** : Tout potentiel futur fichier `*:Zone.Identifier`.
- **E. Fichiers à transformer en gabarits propres** : Les versions nettoyées des échantillons sélectionnés en B, à déposer dans un futur répertoire `docs/references/templates-anonymized/`.

## 8. Risques identifiés
- **Données personnelles** : Présence de noms, prénoms et adresses de clients réels.
- **Signatures** : Certains fichiers comportent la mention "signé" dans leur titre et contiennent potentiellement des signatures.
- **Contacts** : Numéros de téléphone et emails potentiellement présents.
- **Montants** : Informations financières réelles des contrats.
- **Documents réels client** : Tout ajout de ces documents dans le dépôt constituerait une violation de confidentialité.

## 9. Recommandations de gouvernance
1. **Garder localement** : Les originaux dans `docs/references/source/templates/` doivent rester sur votre machine locale non trackés.
2. **Anonymiser** : Sélectionner au moins un représentant de chaque type par volet pour en extraire une structure anonymisée (Client John Doe, adresse fictive, montants factices).
3. **Ne pas committer les originaux** : Une interdiction absolue s'applique.
4. **Créer templates anonymisés** : Ces fichiers expurgés devront être enregistrés dans un nouveau dossier `docs/references/templates-anonymized/` (qui lui pourra être versionné).
5. **Règles .gitignore proposées** :
   ```gitignore
   # Fichiers sensibles non-anonymisés
   docs/references/source/templates/**/*.pdf
   docs/references/source/templates/**/*.png
   docs/references/source/templates/**/*:Zone.Identifier
   ```
   *(Note : Cette règle ne doit être appliquée que sur accord explicite pour éviter de bloquer des templates vierges déjà présents à la racine de ce dossier.)*

## 10. Décision attendue du propriétaire
Veuillez confirmer si vous souhaitez :
1. Déclencher une mission dédiée à la création et l'intégration de **versions anonymisées** (dossier `templates-anonymized/`).
2. Confirmer l'ajout des **règles .gitignore** proposées pour bloquer définitivement les originaux locaux.
3. Si la gouvernance est validée telle quelle, donner l'autorisation de passer à la préparation de la phase **6G-R2**.
