# Guide de Configuration - Imprimante Thermique

## Spécifications de votre imprimante
- **Modèle**: Imprimante thermique 72mm
- **Vitesse**: 260 mm/s
- **Largeur**: 72 mm / 512 points par ligne
- **Connecteurs**: USB, RJ45, RS232
- **Massicot**: Coupe totale ou partielle
- **Buzzer**: Intégré

## Configuration du système

### 1. Connexion USB (Recommandée)
1. Connectez l'imprimante via USB à votre ordinateur
2. Installez les pilotes si nécessaire (généralement automatique)
3. Le système détectera automatiquement l'imprimante

### 2. Configuration réseau (RJ45)
Si vous utilisez la connexion réseau :
1. Connectez l'imprimante au réseau via RJ45
2. Notez l'adresse IP de l'imprimante
3. Configurez le port dans les paramètres système

### 3. Configuration série (RS232)
Pour la connexion série :
1. Connectez via RS232
2. Notez le port COM utilisé
3. Configurez la vitesse de communication (généralement 9600 bauds)

## Format des tickets

Le système génère automatiquement des tickets au format :
- **Largeur**: 72mm (optimisé pour votre imprimante)
- **Contenu**: 
  - En-tête du centre médical
  - Numéro de ticket en grand format
  - Date et heure
  - Instructions pour le patient
  - Code-barres (si supporté)

## Commandes ESC/POS utilisées

Le système utilise les commandes ESC/POS standard :
- `ESC @` : Initialisation
- `ESC a 1` : Alignement centré
- `ESC ! n` : Taille de police
- `ESC b` : Code-barres
- `ESC i` : Coupe du papier

## Dépannage

### L'imprimante n'est pas détectée
1. Vérifiez la connexion USB
2. Redémarrez l'imprimante
3. Vérifiez les pilotes dans le gestionnaire de périphériques
4. Le système passera automatiquement en mode simulation

### Problèmes d'impression
1. Vérifiez le niveau de papier
2. Nettoyez la tête d'impression
3. Vérifiez la température de la tête
4. Redémarrez l'imprimante

### Mode simulation
Si l'imprimante n'est pas connectée, le système :
- Affiche les tickets dans la console
- Montre des notifications visuelles
- Permet de tester le système sans imprimante

## Paramètres avancés

### Dans la page admin
- **Numéro de départ**: Configure le premier numéro de ticket
- **Son d'appel**: Active/désactive le buzzer de l'imprimante
- **Mode debug**: Affiche les commandes ESC/POS dans la console

### Personnalisation
Vous pouvez modifier le format des tickets en éditant :
- `assets/js/thermal-printer.js` : Format et commandes
- `assets/css/styles.css` : Styles des notifications

## Support technique

En cas de problème :
1. Vérifiez les logs dans la console du navigateur
2. Consultez la page admin pour les logs système
3. Testez en mode simulation d'abord
4. Vérifiez la compatibilité WebUSB de votre navigateur

## Compatibilité navigateur

- **Chrome/Edge**: Support complet WebUSB
- **Firefox**: Support partiel (peut nécessiter des permissions)
- **Safari**: Mode simulation uniquement

## Sécurité

- L'imprimante ne stocke aucune donnée personnelle
- Les tickets ne contiennent que le numéro et l'heure
- Aucune information médicale n'est imprimée
- Le système fonctionne hors ligne si nécessaire
