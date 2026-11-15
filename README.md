# Robot Arena — Combat de robots

Jeu web 3D construit avec Three.js et Rapier. Le dépôt contient le client du jeu et le serveur WebSocket nécessaire aux parties privées à deux.

## Modes de jeu

- **Combat** : duel en arène, dégâts, attaques et élimination.
- **Sumo** : pousser l'adversaire hors du dohyo ; manches et score.
- **Hockey** : pousser le palet dans le but adverse ; score et remises en jeu.
- **Laboratoire physique** : prototype séparé pour tester le châssis, les roues, les forces et les commandes.

Les règles sont des adaptations ludiques inspirées des compétitions de robots, pas des reproductions officielles de règlements.

## Lancer le jeu en local

Le client est un site statique. Il doit être servi en HTTP(S), pas ouvert directement avec `file://`.

1. Publie le dépôt avec GitHub Pages, ou démarre un serveur statique à la racine du projet.
2. Ouvre l'adresse HTTP(S) dans un navigateur récent compatible WebGL.
3. Les dépendances Three.js et Rapier sont chargées depuis des CDN ; une connexion Internet est nécessaire.

## Commandes

- **Z / W / ↑** : avancer.
- **Q / A / ←** : tourner à gauche.
- **D / →** : tourner à droite.
- **E** : action / attaque selon le mode.
- **Espace** : boost selon le mode.
- Le panneau **Commandes** permet de remapper les touches et de calibrer une manette ou un contrôleur FPV.
- Les axes de manette peuvent être inversés séparément.

## Parties privées à deux joueurs

Le client GitHub Pages ne peut pas héberger lui-même les connexions WebSocket. Le serveur de ce dépôt doit tourner sur une machine accessible, puis être exposé en HTTPS/WSS.

### Démarrer le serveur

Prérequis : Node.js 20 ou supérieur.

```bash
cd server
npm install
npm start
```

Le serveur écoute par défaut sur le port **8787**. Vérifie son état sur `http://localhost:8787/health`.

### Exposer le serveur avec Cloudflare Tunnel

Dans un second terminal, avec `cloudflared` installé :

```bash
cloudflared tunnel --url http://localhost:8787
```

Cloudflare affiche une URL temporaire `https://....trycloudflare.com`. Saisis cette URL (sans `/ws`) dans le champ **Adresse du serveur Cloudflare** du jeu. Le client utilise automatiquement le chemin WebSocket `/ws`.

Pour une utilisation régulière, préfère un tunnel Cloudflare nommé avec un nom de domaine stable. L'URL temporaire change à chaque lancement.

### Créer une partie

1. L'hôte démarre le serveur et le tunnel, puis saisit l'URL dans le jeu.
2. Il clique sur **Créer un lobby** et partage le code ainsi que le mot de passe par un canal séparé.
3. L'invité saisit la même URL, le code et le mot de passe, puis clique sur **Rejoindre le lobby**.
4. L'hôte lance la partie lorsque les deux joueurs sont connectés.

Le serveur relaie les commandes de l'invité vers l'hôte et l'état de la partie de l'hôte vers l'invité. La simulation de match est pilotée par l'hôte.

### Sécurité et limites

- Les lobbies sont privés par code et mot de passe aléatoires.
- Un lobby accepte un hôte et un invité.
- Les messages WebSocket sont limités en taille et en fréquence.
- Le serveur est un relais de partie : il ne valide pas les collisions ou les résultats côté serveur. L'hôte reste donc l'autorité de simulation.
- Le serveur doit rester lancé pendant toute la partie. Ne partage pas le mot de passe publiquement.

## Vérifications avant publication

Consulte [la recette de test](docs/RECETTE.md) pour vérifier les trois modes, les commandes, le laboratoire et le multijoueur après une modification.
