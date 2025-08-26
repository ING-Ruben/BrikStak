# 🚂 Déploiement sur Railway

## 📋 Guide de configuration des variables d'environnement

### 🔧 Variables d'environnement requises sur Railway

Dans votre projet Railway, allez dans **Settings** > **Environment** et ajoutez ces variables :

#### Variables obligatoires
```
OPENAI_API_KEY=sk-votre-clé-openai-ici
TWILIO_AUTH_TOKEN=votre-token-twilio-ici
NODE_ENV=production
```

#### Variables optionnelles (mais recommandées)
```
OPENAI_MODEL=gpt-4o-mini
LOG_LEVEL=info
PORT=3000
```

#### Variables Supabase (optionnelles)
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_TABLE_NAME=commandes
```

## ⚠️ Important : Gestion de Supabase

**Le bot fonctionne parfaitement SANS Supabase configuré !**

- ✅ Si Supabase n'est PAS configuré : Le bot fonctionne normalement, les commandes ne sont simplement pas sauvegardées
- ✅ Si Supabase EST configuré : Les commandes validées sont automatiquement sauvegardées

### Comportement sans Supabase :
- Le bot collecte et traite les commandes normalement
- Les ouvriers reçoivent le message "✅ Commande prête à être transmise."
- Aucune sauvegarde en base de données
- Les logs indiquent que Supabase n'est pas configuré

### Comportement avec Supabase :
- Le bot collecte et traite les commandes normalement
- Les commandes validées sont sauvegardées automatiquement
- Les ouvriers reçoivent un ID de référence
- Les logs confirment la sauvegarde

## 🚀 Déploiement étape par étape

### 1. Préparer le code
```bash
# Vérifier que le build fonctionne
npm run build

# Vérifier que les tests passent
npm test
```

### 2. Déployer sur Railway
1. Connectez votre repo GitHub à Railway
2. Railway détecte automatiquement le `Procfile`
3. Le déploiement se lance automatiquement

### 3. Configurer les variables d'environnement
1. Dans Railway, allez dans votre service
2. Cliquez sur **Settings** > **Environment**
3. Ajoutez au minimum :
   - `OPENAI_API_KEY`
   - `TWILIO_AUTH_TOKEN`
   - `NODE_ENV=production`

### 4. Obtenir l'URL de déploiement
1. Dans Railway, allez dans **Settings** > **Domains**
2. Copiez l'URL générée (ex: `https://votre-app-name.up.railway.app`)

### 5. Configurer le webhook Twilio
1. Dans la Console Twilio
2. Allez dans **Messaging** > **Settings** > **WhatsApp sandbox settings**
3. Dans **Webhook URL for incoming messages**, entrez :
   ```
   https://votre-app-name.up.railway.app/whatsapp
   ```

## 🔍 Dépannage

### ❌ "App crashed because can't find Supabase keys"
**Solution** : Ce n'est plus le cas avec la nouvelle version ! Le bot démarre maintenant sans Supabase.

### ❌ Variables d'environnement non trouvées
1. Vérifiez que les variables sont bien définies dans Railway
2. Redéployez l'application après avoir ajouté les variables
3. Vérifiez les logs Railway pour voir les erreurs

### ❌ Webhook Twilio ne fonctionne pas
1. Vérifiez que l'URL du webhook est correcte
2. Testez l'endpoint `/health` : `https://votre-app.up.railway.app/health`
3. Vérifiez les logs Railway

### 🔍 Vérifier les logs
Dans Railway :
1. Allez dans votre service
2. Cliquez sur **Logs**
3. Vérifiez les messages de démarrage :
   - `✅ "WhatsApp AI Bot server started"`
   - `⚠️ "Supabase service disabled"` (normal si pas configuré)

## 📊 Monitoring

### Logs à surveiller :
- `WhatsApp AI Bot server started` → App démarrée ✅
- `Supabase service initialized` → Base de données connectée ✅
- `Supabase service disabled` → Pas de base de données (normal) ⚠️
- `Incoming request` → Messages WhatsApp reçus 📱
- `Order successfully saved` → Commandes sauvegardées (si Supabase) 💾

### Endpoint de santé :
```
GET https://votre-app.up.railway.app/health
```
Doit retourner :
```json
{
  "status": "ok",
  "timestamp": "2024-12-24T10:30:00.000Z",
  "uptime": 123.456
}
```

## 🎯 Configuration optimale

### Pour démarrer rapidement (sans BDD) :
```env
OPENAI_API_KEY=sk-...
TWILIO_AUTH_TOKEN=...
NODE_ENV=production
```

### Pour une configuration complète (avec BDD) :
```env
OPENAI_API_KEY=sk-...
TWILIO_AUTH_TOKEN=...
NODE_ENV=production
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_TABLE_NAME=commandes
OPENAI_MODEL=gpt-4o-mini
LOG_LEVEL=info
```

Votre bot fonctionne parfaitement dans les deux cas ! 🚀