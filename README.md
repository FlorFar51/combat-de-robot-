# Robot Clash — Prototype d'arène 3D

Premier prototype jouable du jeu de combat de robots.

## Lancer le jeu
Le dépôt est prévu pour être publié avec **GitHub Pages** :
1. Ouvrir les paramètres du dépôt → **Pages**.
2. Choisir **Deploy from a branch**.
3. Sélectionner la branche `prototype/arena-3d` et le dossier `/ (root)` (ou fusionner cette branche dans `main` après validation).
4. Ouvrir l'URL GitHub Pages fournie.

Le prototype utilise Three.js chargé depuis jsDelivr : une connexion Internet est nécessaire.

## Commandes
- Joueur 1 : WASD pour se déplacer, Espace pour attaquer.
- Joueur 2 : flèches directionnelles, Entrée pour attaquer.
- Sur écran tactile : commandes affichées sous l'arène.

## Contenu actuel
- Arène 3D rectangulaire, sol quadrillé et barrières métalliques.
- Deux robots 3D provisoires avec armes rotatives.
- Déplacements sur le plan X/Z, collisions, poussée, attaques, dégâts et K.-O.
- Barres de vie et redémarrage de match.

## Prochaines étapes
1. Importer des robots personnalisés au format GLB/GLTF.
2. Ajouter une vraie simulation physique (Rapier), pièces et armes distinctes.
3. Ajouter menus de création/configuration des robots.
4. Mettre en place le multijoueur en ligne via un serveur temps réel (par exemple Cloudflare Workers + Durable Objects).

Le multijoueur en ligne n'est pas encore implémenté : ce prototype est un combat local à deux joueurs sur le même appareil.
