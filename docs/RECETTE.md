# Recette de test — Robot Arena

Cette liste sert à valider les fonctions essentielles avant une publication. Faire les tests sur la version GitHub Pages après un rechargement forcé (Ctrl + F5).

## 1. Démarrage et menu

- [ ] La page se charge sans écran gris ni erreur JavaScript dans la console.
- [ ] Le menu, les trois modes, les paramètres et le panneau Commandes s'affichent.
- [ ] Le changement de mode actualise les règles et les paramètres spécifiques.
- [ ] Le jeu fonctionne en fenêtre redimensionnée et en plein écran.

## 2. Commandes

- [ ] Avancer, tourner à gauche et tourner à droite au clavier.
- [ ] Vérifier les commandes reconfigurées dans le panneau Commandes.
- [ ] Connecter une manette et vérifier la détection, les axes, l'inversion et les valeurs en direct.
- [ ] Vérifier que relâcher les commandes arrête bien l'entrée.
- [ ] Vérifier le comportement sur écran tactile si cette plateforme est ciblée.

## 3. Modes de jeu

### Combat
- [ ] Le compte à rebours démarre correctement.
- [ ] Les deux robots se déplacent et peuvent attaquer.
- [ ] Les dégâts, barres d'intégrité et contacts évoluent correctement.
- [ ] La fin de match annonce le bon résultat et permet de revenir au menu.

### Sumo
- [ ] Les robots peuvent pousser l'adversaire.
- [ ] La sortie du dohyo attribue la manche au bon joueur.
- [ ] Le score des manches est correct et la remise en jeu fonctionne.
- [ ] Le match se termine au bon nombre de manches.

### Hockey
- [ ] Le palet reste dans la patinoire et rebondit correctement.
- [ ] Les robots entrent en collision sans traverser anormalement le palet.
- [ ] Les deux cages attribuent le but au bon camp.
- [ ] Le score, la remise en jeu et la fin de match fonctionnent.
- [ ] Les réglages de glisse et de rebond ont un effet visible.

## 4. Laboratoire physique

- [ ] Le laboratoire s'initialise sans erreur Rapier.
- [ ] Le robot reste stable à l'arrêt.
- [ ] Avancer, reculer et tourner sont possibles au clavier et à la manette.
- [ ] Le robot ne dérive pas latéralement en ligne droite.
- [ ] Les roues restent alignées avec le châssis et les contacts au sol sont cohérents.
- [ ] Les curseurs de puissance, rotation et adhérence répondent.
- [ ] La remise à plat avec R fonctionne.
- [ ] Les diagnostics FPS, PHYS, PIC et V restent cohérents pendant le déplacement.

## 5. Multijoueur privé

Prérequis : serveur Node lancé et tunnel HTTPS actif.

- [ ] Le serveur répond sur `/health`.
- [ ] L'hôte crée un lobby et reçoit un code et un mot de passe.
- [ ] Un invité rejoint avec le code et le mot de passe.
- [ ] Un troisième joueur est refusé.
- [ ] L'hôte peut lancer Combat, Sumo et Hockey à deux.
- [ ] Les commandes invité arrivent chez l'hôte.
- [ ] L'état du match, les scores et le chronomètre sont synchronisés chez l'invité.
- [ ] Quitter ou fermer un navigateur informe l'autre joueur.
- [ ] Un mauvais mot de passe et un lobby inexistant sont refusés.

## 6. Compatibilité et publication

- [ ] Tester sur Chrome ou Edge desktop.
- [ ] Tester sur Safari iPhone si le tactile et iOS sont ciblés.
- [ ] Vérifier le chargement des modules CDN et de WebGL.
- [ ] Vérifier qu'aucune erreur n'apparaît après plusieurs matchs consécutifs.
- [ ] Vérifier le numéro de version et les paramètres de cache affichés dans `index.html`.
