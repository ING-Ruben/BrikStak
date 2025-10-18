# BrikStak - WhatsApp Bot pour la Gestion de Chantier

Bot WhatsApp intelligent pour la gestion des commandes de matériaux de chantier. Le système utilise deux agents IA spécialisés travaillant en parallèle : un agent conversationnel pour l'expérience utilisateur et un agent d'extraction pour le parsing structuré des données.

## 🚀 Fonctionnalités

- **Dual Agent Architecture** - Traitement parallèle pour performance optimale
- **Agent Conversationnel** - Communication naturelle et sympathique avec emojis
- **Agent d'Extraction** - Parsing JSON structuré avec support multi-matériaux
- **Intégration WhatsApp** - Via Twilio avec validation de signature
- **Base de données Supabase** - Stockage centralisé des commandes
- **Transcription Audio** - Support des messages vocaux via OpenAI Whisper
- **Mémoire de conversation** - Historique contextuel par utilisateur
- **Tests complets** - Suite de tests Jest avec couverture complète

## 📋 Prérequis

- Node.js 20+
- Compte OpenAI avec accès à l'API
- Compte Twilio avec WhatsApp Sandbox
- Projet Supabase configuré
- ngrok (développement local) ou Railway (production)

## 🛠️ Installation

### 1. Cloner et installer

```bash
git clone <your-repo>
cd BrikStak
npm install
```

### 2. Configuration des variables d'environnement

Copiez le fichier d'exemple et configurez vos clés :

```bash
cp .env.example .env
```

Éditez `.env` avec vos clés API :

```env
# OpenAI
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini

# Twilio
TWILIO_AUTH_TOKEN=your-token-here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Configuration Supabase

Exécutez le script SQL dans votre projet Supabase :

```bash
# Dans Supabase Dashboard > SQL Editor
# Copiez et exécutez le contenu de supabase_setup_fixed.sql
```

Ceci créera :
- La table `commandes_centrales` pour stocker les commandes multi-matériaux
- Les fonctions RPC nécessaires pour la gestion des tables
- Les triggers pour les timestamps automatiques

### 4. Configuration WhatsApp (Twilio)

1. Dans la Console Twilio, activez le WhatsApp Sandbox
2. Configurez le webhook : `https://your-domain/whatsapp` (POST)
3. Testez en envoyant un message au numéro Sandbox

## 🔧 Développement Local

### Lancer le serveur

```bash
npm run dev
```

### Exposer avec ngrok

```bash
ngrok http 3000
# Utilisez l'URL HTTPS fournie dans Twilio webhook
```

### Tester

```bash
npm test              # Tous les tests
npm run test:watch    # Mode watch
npm run lint          # Vérification du code
npm run lint:fix      # Correction automatique
```

## 🚀 Déploiement Railway

### Configuration

1. Créez un compte sur [railway.app](https://railway.app)
2. Connectez votre repository GitHub
3. Ajoutez les variables d'environnement dans Railway Dashboard
4. Railway détecte automatiquement le `Procfile` et déploie

### Variables d'environnement Railway

```
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
TWILIO_AUTH_TOKEN=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
NODE_ENV=production
LOG_LEVEL=info
```

Note : Railway définit automatiquement `PORT`, ne le redéfinissez pas.

## 📱 Utilisation

### Commandes utilisateur

- **Message normal** - Commandez des matériaux naturellement
- **Message vocal** - Support de la transcription audio
- `/help` - Affiche l'aide
- `/reset` - Efface l'historique de conversation

### Exemple de conversation

```
Utilisateur: "J'ai besoin de 10m³ de béton pour le chantier Marseille demain à 14h"

Bot: "🏗️ Parfait ! J'ai bien noté :
- Chantier : Marseille
- 10 m³ de béton
- Livraison : 19/10/2025 à 14h00

Peux-tu confirmer ?"

Utilisateur: "Oui"

Bot: "✅ Commande enregistrée ! Elle sera transmise à l'équipe."
```

## 🏗️ Architecture

```
src/
├── server.ts                      # Point d'entrée Express
├── routes/
│   ├── whatsapp.ts               # Route webhook WhatsApp
│   └── orders.ts                 # API REST pour les commandes
├── services/
│   ├── conversationalAgent.ts    # Agent de communication
│   ├── extractionAgent.ts        # Agent de parsing JSON
│   ├── openai.ts                 # Client OpenAI
│   ├── supabase.ts               # Client Supabase
│   ├── transcriptionService.ts   # Transcription audio
│   └── session.ts                # Gestion des sessions
└── utils/
    ├── chunkText.ts              # Découpage messages longs
    └── orderParser.ts            # Parser de commandes

test/
├── *.test.ts                     # Tests unitaires et d'intégration
└── *.simple.test.ts              # Tests de configuration
```

## 📊 Structure du Projet

```
BrikStak/
├── .env.example                  # Template variables d'environnement
├── .gitignore                    # Fichiers à ignorer
├── LICENSE                       # Licence MIT
├── README.md                     # Ce fichier
├── Procfile                      # Configuration Railway
├── package.json                  # Dépendances et scripts
├── tsconfig.json                 # Configuration TypeScript
├── jest.config.js                # Configuration Jest
├── .eslintrc.js                  # Configuration ESLint
├── supabase_setup_fixed.sql      # Script SQL Supabase
├── src/                          # Code source TypeScript
└── test/                         # Tests
```

## 🔐 Sécurité

- Validation des signatures Twilio
- Variables d'environnement pour secrets
- Pas de logs de données sensibles
- Gestion d'erreurs sans exposition d'informations internes
- TypeScript strict mode pour la sécurité du typage

## 🧪 Tests

Le projet inclut une suite de tests complète :

- Tests unitaires pour chaque service
- Tests d'intégration pour le flux complet
- Tests E2E pour l'API WhatsApp
- Mocks OpenAI pour isolation des tests

```bash
npm test                          # Tous les tests
npm run test:watch                # Mode watch pour développement
```

## 📝 Scripts NPM

```bash
npm run dev          # Serveur de développement avec hot reload
npm run build        # Compilation TypeScript vers JavaScript
npm start           # Lancement du serveur compilé
npm test            # Exécution des tests
npm run lint        # Vérification ESLint
npm run lint:fix    # Correction automatique ESLint
```

## 🤝 Contribution

Les contributions sont les bienvenues ! Merci de :

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🆘 Support

En cas de problème :

1. Vérifiez les logs du serveur
2. Testez l'endpoint `/health`
3. Vérifiez la configuration Twilio webhook
4. Consultez les variables d'environnement
5. Vérifiez la connexion Supabase

---

**Développé avec TypeScript et Express**
