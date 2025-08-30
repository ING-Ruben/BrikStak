# WhatsApp AI Bot

Un bot WhatsApp intelligent alimenté par OpenAI et intégré via Twilio. Le bot reçoit des messages WhatsApp, les traite avec l'API OpenAI Responses, et renvoie des réponses contextuelles avec mémoire de conversation.

## 🚀 Fonctionnalités

- ✅ **Intégration WhatsApp** via Twilio avec validation de signature
- 🤖 **IA conversationnelle** utilisant l'API OpenAI Responses
- 💭 **Mémoire de conversation** (15 messages max, TTL 2h)
- 📱 **Commandes spéciales** (`/help`, `/reset`)
- 🔄 **Gestion des messages longs** (découpage automatique)
- 🛡️ **Robustesse** avec gestion d'erreurs et fallbacks
- 📊 **Logs structurés** avec Pino
- 🧪 **Tests d'intégration** avec Jest

## 📋 Prérequis

- **Node.js 20+**
- **Compte OpenAI** avec accès à l'API Responses
- **Compte Twilio** avec WhatsApp Sandbox activé
- **ngrok** (pour développement local) ou **Railway** (pour déploiement)

## 🛠️ Installation

### 1. Cloner et installer les dépendances

```bash
git clone <votre-repo>
cd whatsapp-ai-bot
npm install
# Pour un environnement de production, utilisez :
# npm install --omit=dev
```

### 2. Configuration des variables d'environnement

Copiez le fichier d'exemple et configurez vos variables :

```bash
cp .env.example .env
```

Éditez le fichier `.env` :

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-votre-clé-openai-ici
OPENAI_MODEL=gpt-4o-mini

# Twilio Configuration
TWILIO_AUTH_TOKEN=votre-token-twilio-ici

# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

### 3. Obtenir les clés d'API

#### OpenAI
1. Allez sur [platform.openai.com](https://platform.openai.com)
2. Créez une clé API dans la section "API Keys"
3. Assurez-vous d'avoir accès à l'API Responses

#### Twilio
1. Créez un compte sur [twilio.com](https://twilio.com)
2. Allez dans la Console Twilio
3. Copiez votre `Auth Token` depuis le Dashboard
4. Activez le WhatsApp Sandbox (voir section suivante)

## 📱 Configuration WhatsApp (Twilio Sandbox)

### 1. Activer le WhatsApp Sandbox

1. Dans la Console Twilio, allez à **Develop > Messaging > Try it out > Send a WhatsApp message**
2. Suivez les instructions pour rejoindre le Sandbox en envoyant un message depuis votre WhatsApp
3. Une fois connecté, notez le numéro du Sandbox (ex: `+1 415 523 8886`)

### 2. Configurer le Webhook

1. Dans la Console Twilio, allez à **Develop > Messaging > Settings > WhatsApp sandbox settings**
2. Dans le champ **"When a message comes in"**, entrez votre URL webhook :
   - **Développement local** : `https://votre-url-ngrok.ngrok.io/whatsapp`
   - **Production Railway** : `https://votre-app.up.railway.app/whatsapp`
3. Sélectionnez **HTTP POST**
4. Sauvegardez la configuration

## 🔧 Développement Local

### 1. Lancer le serveur en mode développement

```bash
npm run dev
```

Le serveur démarrera sur `http://localhost:3000`

### 2. Exposer avec ngrok

Dans un nouveau terminal :

```bash
# Installer ngrok si ce n'est pas fait
npm install -g ngrok

# Exposer le port 3000
ngrok http 3000
```

Copiez l'URL HTTPS fournie par ngrok (ex: `https://abc123.ngrok.io`) et utilisez-la pour configurer le webhook Twilio.

### 3. Tester l'installation

1. Envoyez un message WhatsApp au numéro Sandbox Twilio
2. Le bot devrait répondre avec une réponse générée par OpenAI
3. Testez les commandes `/help` et `/reset`

### Commandes disponibles

```bash
npm run dev          # Lancement en mode développement
npm run build        # Build TypeScript vers JavaScript
npm start           # Lancement du serveur compilé
npm run lint        # Vérification ESLint
npm run lint:fix    # Correction automatique ESLint
npm test           # Lancement des tests
npm run test:watch # Tests en mode watch
```

## 🚀 Déploiement sur Railway

### 1. Préparer le déploiement

1. Créez un compte sur [railway.app](https://railway.app)
2. Connectez votre repository GitHub/GitLab
3. Créez un nouveau projet Railway depuis votre repository

### 2. Configurer les variables d'environnement

Dans le dashboard Railway, allez dans l'onglet **Variables** et ajoutez :

```
OPENAI_API_KEY=sk-votre-clé-openai
OPENAI_MODEL=gpt-4o-mini
TWILIO_AUTH_TOKEN=votre-token-twilio
NODE_ENV=production
LOG_LEVEL=info
```

**⚠️ Important :** Railway définit automatiquement la variable `PORT`, ne la redéfinissez pas.

### 3. Déployer

1. Railway détecte automatiquement le `Procfile` et deploy l'application
2. Une fois déployé, copiez l'URL fournie (ex: `https://whatsapp-ai-bot-production.up.railway.app`)
3. Mettez à jour le webhook Twilio avec cette nouvelle URL : `https://votre-app.up.railway.app/whatsapp`

### 4. Vérifier le déploiement

1. Visitez `https://votre-app.up.railway.app/health` pour vérifier que l'API fonctionne
2. Testez en envoyant un message WhatsApp

## 🧪 Tests

Lancer tous les tests :

```bash
npm test
```

Les tests couvrent :
- Validation des webhooks Twilio
- Gestion des commandes spéciales
- Intégration OpenAI (mockée)
- Gestion d'erreurs
- Découpage des messages longs
- Mémoire de conversation

## 📋 Utilisation

### Commandes utilisateur

- **Message normal** : Envoyez n'importe quel texte pour obtenir une réponse IA
- **/help** : Affiche l'aide et les commandes disponibles
- **/reset** : Efface l'historique de conversation

### Fonctionnalités automatiques

- **Mémoire** : Le bot se souvient des 15 derniers messages par utilisateur (2h max)
- **Messages longs** : Les réponses > 3500 caractères sont automatiquement découpées
- **Validation** : Seules les requêtes Twilio valides sont acceptées
- **Fallback** : Messages d'erreur en cas de problème avec OpenAI

## 🔧 Personnalisation

### Instructions système

Modifiez les instructions dans `src/services/openai.ts` :

```typescript
export const DEFAULT_SYSTEM_INSTRUCTIONS = `
Votre nouveau prompt système ici...
`;
```

### Paramètres de session

Dans `src/services/session.ts` :

```typescript
private readonly TTL_MS = 2 * 60 * 60 * 1000; // Durée de vie de session
private readonly MAX_MESSAGES = 15; // Nombre max de messages
```

### Découpage de texte

Dans `src/utils/chunkText.ts` :

```typescript
export function chunkText(text: string, maxChunkSize: number = 3500)
```

## 📊 Structure du projet

```
whatsapp-ai-bot/
├── src/
│   ├── routes/
│   │   └── whatsapp.ts          # Route webhook WhatsApp
│   ├── services/
│   │   ├── openai.ts            # Service OpenAI
│   │   └── session.ts           # Gestion des sessions
│   ├── utils/
│   │   └── chunkText.ts         # Utilitaire découpage texte
│   └── server.ts                # Serveur Express principal
├── test/
│   └── whatsapp.e2e.test.ts     # Tests d'intégration
├── package.json
├── tsconfig.json
├── Procfile                     # Configuration Railway
├── .env.example
└── README.md
```

## 🚨 Sécurité

- ✅ Validation des signatures Twilio
- ✅ Variables d'environnement pour les secrets
- ✅ Pas de logs des données sensibles
- ✅ Gestion d'erreurs sans exposition d'informations internes

## 🔍 Logs et Monitoring

Les logs incluent :
- Requêtes entrantes et sorties
- Appels OpenAI avec request IDs
- Erreurs avec stack traces
- Métriques de session (nombre d'utilisateurs actifs)

Niveau de log configurable via `LOG_LEVEL` (debug, info, warn, error).

## 🛣️ Roadmap / Améliorations possibles

- **Persistance** : Remplacer la mémoire RAM par Redis/PostgreSQL
- **Médias** : Support des images et documents WhatsApp
- **Multi-tenant** : Support de plusieurs bots simultanés
- **Analytics** : Dashboard de métriques d'usage
- **Rate limiting** : Protection contre le spam
- **Webhooks entrants** : Support d'autres canaux (Telegram, Slack)

## 🆘 Résolution de problèmes

### Le bot ne répond pas

1. Vérifiez les logs du serveur
2. Testez l'endpoint `/health`
3. Vérifiez la configuration du webhook Twilio
4. Assurez-vous que l'URL est accessible publiquement

### Erreurs OpenAI

1. Vérifiez votre clé API OpenAI
2. Vérifiez votre quota/crédits OpenAI
3. Consultez les logs pour les request IDs d'erreur

### Webhook Twilio non validé

1. Vérifiez que `TWILIO_AUTH_TOKEN` est correct
2. En développement, assurez-vous que `NODE_ENV=development`
3. Vérifiez que l'URL est en HTTPS (obligatoire pour Twilio)

## 📄 Licence

MIT License - voir le fichier LICENSE pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! Merci de :

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

**Développé avec ❤️ et TypeScript**