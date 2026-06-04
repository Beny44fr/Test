# ⚽ Pronos CM 2026

Outil de pronostics **premium et mobile-first** pour la Coupe du Monde 2026, pensé pour organiser une **compétition entre collègues**.

> Application 100 % statique (HTML/CSS/JS, sans build, sans backend). Déployable en 1 clic sur GitHub Pages.

## ✨ Fonctionnalités

- **Pronostics des 72 matchs de poule** (12 groupes A–L) avec saisie de score rapide (steppers tactiles).
- **Questions bonus** : vainqueur, finaliste, meilleur buteur.
- **Classement automatique** avec barème par match.
- **Mode ligue** : chaque collègue partage ses pronos via un **lien** ou un **code**, l'organisateur les ajoute et saisit les résultats réels.
- **UI/UX soignée** : thème sombre premium, icônes vectorielles, drapeaux, navigation par onglets, animations.
- **PWA installable** + **mode hors-ligne** (service worker) quand l'app est hébergée.
- **Sauvegarde locale** automatique (localStorage), aucune donnée envoyée sur un serveur.

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
js/data.js              # groupes, équipes, calendrier, barème
js/icons.js             # icônes SVG + drapeaux
js/scoring.js           # calcul des points
js/storage.js           # localStorage + encodage des codes
js/app.js               # logique & rendu de l'interface
```

## ℹ️ Données

- Groupes issus du **tirage officiel du 5 décembre 2025**.
- Les **confrontations** de poule sont exactes (round-robin déterminé par le tirage).
- ⚠️ Les **dates** des matchs sont **indicatives** et facilement modifiables dans `js/data.js` (objet `DATES`).
