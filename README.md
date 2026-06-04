# ⚽ Pronos CM 2026

Outil de pronostics **premium et mobile-first** pour la Coupe du Monde 2026, pensé pour organiser une **compétition entre collègues**.

> Application 100 % statique (HTML/CSS/JS, sans build, sans backend). Déployable en 1 clic sur GitHub Pages.

## ✨ Fonctionnalités

- **Pronostics des 72 matchs de poule** (12 groupes A–L), **pré-remplis à 0-0** : on n'ajuste que ce qu'on veut.
- **Écran de saisie triable** : **par groupe** ou **par date** (ordre chronologique).
- **Tableau final automatique** : 16es → finale + **petite finale (3e place)**. Les 16es sont **alimentés automatiquement** par le classement déduit des pronos de groupes (1ers, 2es + 8 meilleurs 3es) ; il suffit de faire avancer les équipes.
- **Synchronisation des résultats via API** (TheSportsDB par défaut) : scores, dates et villes mis à jour automatiquement, classement recalculé.
- **Question bonus** : meilleur buteur (liste de 20 candidats + « Autre »).
- **Classement automatique** détaillé (groupes · tableau · bonus).
- **Mode ligue** : chaque collègue partage ses pronos via un **lien** ou un **code**.
- **UI/UX soignée** : thème sombre premium, icônes vectorielles, drapeaux, navigation par onglets.
- **PWA installable** + **mode hors-ligne** (service worker) quand l'app est hébergée.
- **Sauvegarde locale** automatique (localStorage).

## 🔌 Synchronisation API des résultats

Onglet **Résultats → Synchroniser**. Par défaut : **TheSportsDB** (gratuit, compatible navigateur, clé `123`). Configurable dans **Réglages API** : fournisseur, clé, identifiant de compétition (`idLeague`), saison.

- L'app associe les matchs par **nom d'équipe** (FR/EN + alias) et met à jour **scores, dates et villes**.
- ⚠️ L'`idLeague` et la saison par défaut (Coupe du Monde / `2026`) doivent être **vérifiés/ajustés** via le bouton « Tester la connexion » selon la disponibilité des données chez le fournisseur.
- En l'absence d'API, l'organisateur peut toujours saisir les résultats à la main (et les vainqueurs du tableau final).

## 🏆 Barème

| Pronostic | Points |
|---|---|
| Score exact | **5** |
| Bon vainqueur + bonne différence de buts | **3** |
| Bon résultat (vainqueur/nul) seulement | **1** |
| Bonus (vainqueur CM) | **+15** |
| Bonus (finaliste) | **+10** |
| Bonus (meilleur buteur) | **+10** |

## 👥 Jouer entre collègues

1. Chaque participant remplit ses pronos puis clique **Partager** → copie son lien/code.
2. L'**organisateur** colle chaque code dans l'onglet **Ligue**.
3. Au fil de la compétition, l'organisateur saisit les **résultats réels** (onglet *Résultats*).
4. Le **classement** se met à jour tout seul.

> Astuce : ouvrir un lien `…/#p=<code>` propose automatiquement d'ajouter ce joueur à la ligue.

## 🚀 Lancer / déployer

**En local :**
```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

**Sur GitHub Pages :** activer Pages sur la branche, dossier racine `/`. L'app est alors installable sur mobile (« Ajouter à l'écran d'accueil »).

## 📁 Structure

```
index.html              # page + chargement des scripts
manifest.webmanifest    # métadonnées PWA
sw.js                   # service worker (offline)
icon.svg                # icône de l'app
css/styles.css          # design system
js/data.js              # groupes, équipes, calendrier, barème, buteurs
js/icons.js             # icônes SVG + drapeaux
js/scoring.js           # points, classement de groupes, qualifiés
js/storage.js           # localStorage + encodage des codes
js/api.js               # synchronisation des résultats (TheSportsDB)
js/app.js               # logique & rendu de l'interface
```

## ℹ️ Données

- Groupes issus du **tirage officiel du 5 décembre 2025**.
- Les **confrontations** de poule sont exactes (round-robin déterminé par le tirage).
- ⚠️ Les **dates** des matchs sont **indicatives** et facilement modifiables dans `js/data.js` (objet `DATES`).
