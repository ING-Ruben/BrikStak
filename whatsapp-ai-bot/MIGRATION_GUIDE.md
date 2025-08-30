# Guide de Migration - Architecture 2 Agents Parallèles

## Vue d'ensemble

Ce guide détaille la migration de BrikStak vers une architecture à 2 agents spécialisés travaillant en parallèle, remplaçant le système actuel (1 agent + parsing regex).

## Architecture Avant/Après

### AVANT (Architecture v1)
```
WhatsApp Message → OpenAI (monolithique) → Regex Parser → Supabase
```

### APRÈS (Architecture v2)
```
WhatsApp Message → [Agent Conversationnel + Agent Extracteur] (parallèle) → Supabase Multi-matériaux
                    ↓                    ↓
               UX/Communication    Parsing/Structure JSON
```

## Nouveaux Composants

### 1. Agent Conversationnel (`services/conversationalAgent.ts`)
- **Rôle** : Communication naturelle et UX
- **Responsabilités** :
  - Messages amicaux avec emojis
  - Questions ciblées (une à la fois)
  - Récapitulatifs clairs
  - Demandes de confirmation
- **Prompt spécialisé** : Bruno assistant chantier sympa

### 2. Agent Extracteur (`services/extractionAgent.ts`)
- **Rôle** : Parsing et structuration des données
- **Responsabilités** :
  - Extraction JSON pure (pas de texte)
  - Support multi-matériaux
  - Validation des formats
  - Score de complétude automatique
- **Format de sortie** :
```json
{
  "chantier": "nom_chantier",
  "materiaux": [
    {"nom": "béton", "quantite": "10", "unite": "m3"},
    {"nom": "ferraille", "quantite": "500", "unite": "kg"}
  ],
  "livraison": {"date": "15/01/2024", "heure": "14:30"},
  "completude": 0.95,
  "confirmation": false
}
```

### 3. Service Supabase Étendu
- **Nouvelles méthodes** :
  - `storeMultiMaterialOrder()` : Stockage multi-matériaux
  - `convertExtractionToMultiMaterialOrder()` : Conversion des données d'extraction
- **Nouvelles tables** : `multi_commandes_{chantier}` avec JSON des matériaux
- **Compatibilité** : Anciennes méthodes maintenues

## Plan de Migration

### Phase 1 : Préparation (TERMINÉE ✅)
- [x] Création des nouveaux agents
- [x] Extension du service Supabase
- [x] Modification de la route WhatsApp
- [x] Implémentation du système de fallback
- [x] Tests unitaires et d'intégration

### Phase 2 : Déploiement Progressif

#### Étape 1 : Déploiement avec Fallback Activé
```bash
# 1. Backup de la base de données
pg_dump $SUPABASE_URL > backup_pre_migration.sql

# 2. Déployer le nouveau code
git push heroku main

# 3. Vérifier les logs en temps réel
heroku logs --tail --app your-app-name
```

#### Étape 2 : Création des Nouvelles Tables Supabase
```sql
-- Fonction pour créer tables multi-matériaux
CREATE OR REPLACE FUNCTION create_multi_material_orders_table(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id SERIAL PRIMARY KEY,
      chantier TEXT NOT NULL,
      materiaux_json TEXT NOT NULL,
      date_besoin TEXT NOT NULL,
      heure_besoin TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT ''en_attente'',
      completude DECIMAL(3,2) NOT NULL DEFAULT 0.0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )', table_name);
END;
$$ LANGUAGE plpgsql;
```

#### Étape 3 : Monitoring Initial (24-48h)
- Surveiller les métriques de performance
- Vérifier le taux de fallback
- Analyser les logs d'erreur
- Contrôler la qualité des extractions

### Phase 3 : Optimisation

#### Métriques à Surveiller
```javascript
// Métriques clés dans les logs
{
  "phoneNumber": "+33123456789",
  "processing": {
    "conversationalAgent": {
      "confidence": 0.85,
      "processingTime": 1200
    },
    "extractionAgent": {
      "completude": 0.95,
      "processingTime": 800
    }
  },
  "decision": {
    "shouldStore": true,
    "fallbackUsed": false
  }
}
```

#### Seuils de Performance Attendus
- **Temps de réponse** : < 3 secondes (vs ~5s avant)
- **Taux de fallback** : < 5%
- **Complétude moyenne** : > 0.8
- **Confiance conversationnelle** : > 0.7

## Plan de Rollback

### Déclencheurs de Rollback
- Taux de fallback > 20%
- Temps de réponse > 10 secondes
- Erreurs critiques > 5%
- Perte de données détectée

### Procédure de Rollback Rapide (< 5 minutes)

#### Option 1 : Rollback Git
```bash
# 1. Identifier le dernier commit stable
git log --oneline -10

# 2. Rollback vers la version précédente
git revert HEAD --no-edit
git push heroku main

# 3. Vérifier le déploiement
curl -X POST https://your-app.herokuapp.com/whatsapp \
  -d "Body=test&From=whatsapp:+33123456789"
```

#### Option 2 : Feature Flag (Recommandé)
```javascript
// Dans routes/whatsapp.ts - ajout d'un feature flag
const USE_DUAL_AGENTS = process.env.ENABLE_DUAL_AGENTS === 'true';

if (USE_DUAL_AGENTS) {
  // Nouvelle architecture
} else {
  // Ancienne architecture (fallback)
}
```

```bash
# Désactiver les nouveaux agents
heroku config:set ENABLE_DUAL_AGENTS=false
```

### Rollback Complet (Si nécessaire)

#### 1. Restauration Code
```bash
# Checkout de la dernière version stable
git checkout tags/v1.0-stable
git push heroku main --force
```

#### 2. Restauration Base de Données (Si corruption)
```bash
# Restaurer depuis le backup
psql $SUPABASE_URL < backup_pre_migration.sql
```

#### 3. Vérification Post-Rollback
```bash
# Tests de régression
npm test
npm run test:e2e

# Vérification manuelle
curl -X POST https://your-app.herokuapp.com/whatsapp \
  -d "Body=J'ai besoin de béton&From=whatsapp:+33123456789"
```

## Tests de Validation

### Tests Pré-Migration
```bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration

# Tests de performance
npm run test:performance
```

### Tests Post-Migration
```bash
# Validation de l'architecture dual-agent
npm run test:dual-agents

# Tests de fallback
npm run test:fallback

# Tests multi-matériaux
npm run test:multi-materials
```

### Tests Manuels Critiques

#### Test 1 : Commande Simple
```
Input: "J'ai besoin de 10m³ de béton pour le chantier Marseille le 15/01/2024 à 14h30"
Expected: Extraction correcte + réponse conversationnelle
```

#### Test 2 : Commande Multi-Matériaux
```
Input: "Pour Lyon, j'ai besoin de 5m³ de béton, 500kg de ferraille et 2 tonnes de sable pour demain 9h"
Expected: 3 matériaux extraits correctement
```

#### Test 3 : Conversation Incomplète
```
Input: "J'ai besoin de béton"
Expected: Question de clarification + extraction partielle
```

#### Test 4 : Confirmation
```
Input: "ok" (après récapitulatif)
Expected: Stockage en base + message de confirmation
```

## Monitoring Continu

### Alertes à Configurer
- Taux de fallback > 10% (WARNING)
- Taux de fallback > 20% (CRITICAL)
- Temps de réponse > 5s (WARNING)
- Erreurs agents > 5% (CRITICAL)

### Dashboards Recommandés
1. **Performance** : Temps de traitement par agent
2. **Qualité** : Scores de confiance et complétude
3. **Fiabilité** : Taux de succès/échec/fallback
4. **Usage** : Volume de messages et matériaux traités

## Retour Arrière des Fonctionnalités

### Désactivation Sélective
```bash
# Désactiver uniquement l'agent conversationnel
heroku config:set DISABLE_CONVERSATIONAL_AGENT=true

# Désactiver uniquement l'agent d'extraction
heroku config:set DISABLE_EXTRACTION_AGENT=true

# Mode debug avec logs détaillés
heroku config:set LOG_LEVEL=debug
```

### Maintenance des Anciennes Interfaces
Les interfaces publiques sont maintenues pour compatibilité :
- Route `/whatsapp` inchangée
- Format de réponse WhatsApp identique
- Variables d'environnement compatibles

## Support et Debugging

### Logs Utiles
```bash
# Logs des agents
heroku logs --tail | grep "conversational-agent\|extraction-agent"

# Logs de performance
heroku logs --tail | grep "Dual agent processing completed"

# Logs d'erreur
heroku logs --tail | grep "ERROR\|WARN"
```

### Debug en Local
```bash
# Mode développement avec logs détaillés
NODE_ENV=development LOG_LEVEL=debug npm run dev

# Tests avec données réelles
npm run test:manual
```

## Conclusion

Cette migration apporte :
- ✅ **Performance** : Traitement parallèle (~40% plus rapide)
- ✅ **Robustesse** : Double validation + fallback automatique
- ✅ **Maintenabilité** : Responsabilités séparées
- ✅ **Évolutivité** : Agents indépendants et spécialisés
- ✅ **UX** : Communication plus naturelle
- ✅ **Fonctionnalités** : Support multi-matériaux natif

Le système de fallback garantit une continuité de service même en cas de problème avec la nouvelle architecture.