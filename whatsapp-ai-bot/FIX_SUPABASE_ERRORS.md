# Guide de Résolution des Erreurs Supabase

## Problèmes Identifiés

1. **"Error checking table existence"** - La vérification d'existence de table échoue
2. **"Failed to create multi-material table"** - La création de table multi-matériaux échoue

## Causes Probables

### 1. Fonctions RPC non créées dans Supabase
Les fonctions `create_orders_table` et `create_multi_material_orders_table` n'existent pas dans votre base de données Supabase.

### 2. Problème d'accès à information_schema
Supabase peut restreindre l'accès direct à `information_schema.tables` pour des raisons de sécurité.

### 3. Variables d'environnement manquantes
Les variables `SUPABASE_URL` et `SUPABASE_ANON_KEY` ne sont pas configurées.

## Solutions

### Étape 1: Vérifier la Configuration

1. Créez un fichier `.env` à la racine du projet si il n'existe pas :
```bash
cd /workspace/whatsapp-ai-bot
touch .env
```

2. Ajoutez vos identifiants Supabase :
```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre-clé-anon-publique
```

### Étape 2: Exécuter les Scripts SQL dans Supabase

1. Connectez-vous à votre [Dashboard Supabase](https://app.supabase.com)
2. Allez dans **SQL Editor**
3. Exécutez les scripts suivants dans l'ordre :

#### Script 1: Fonctions de base (supabase_setup.sql)
```sql
-- Copiez et exécutez le contenu de supabase_setup.sql
```

#### Script 2: Fonctions multi-matériaux (supabase_multi_material_setup.sql)
```sql
-- Copiez et exécutez le contenu de supabase_multi_material_setup.sql
```

#### Script 3: Fonction de vérification de table (optionnel mais recommandé)
```sql
-- Copiez et exécutez le contenu de supabase_table_exists_function.sql
```

### Étape 3: Tester la Connexion

Exécutez le script de diagnostic :
```bash
cd /workspace/whatsapp-ai-bot
node test_supabase_connection.js
```

### Étape 4: Vérifier les Permissions RLS

Si Row Level Security (RLS) est activé sur vos tables :

1. Dans Supabase Dashboard, allez dans **Authentication > Policies**
2. Assurez-vous que les politiques permettent les opérations nécessaires
3. Ou désactivez temporairement RLS pour tester :
```sql
ALTER TABLE votre_table DISABLE ROW LEVEL SECURITY;
```

### Étape 5: Modifications du Code (Déjà Appliquées)

✅ La méthode `tableExists` a été modifiée pour utiliser une approche plus fiable :
- Au lieu d'interroger `information_schema`, elle tente directement une requête SELECT sur la table
- Elle reconnaît les codes d'erreur spécifiques indiquant qu'une table n'existe pas
- Elle a une méthode de fallback utilisant une fonction RPC si disponible

## Vérification Finale

Après avoir suivi ces étapes, testez votre bot :

1. Redémarrez le serveur :
```bash
npm run dev
```

2. Envoyez un message test au bot WhatsApp

3. Vérifiez les logs pour confirmer que :
   - Les tables sont créées correctement
   - Les commandes sont enregistrées dans Supabase

## Checklist de Dépannage

- [ ] Variables d'environnement configurées dans `.env`
- [ ] Script `supabase_setup.sql` exécuté
- [ ] Script `supabase_multi_material_setup.sql` exécuté  
- [ ] Script `supabase_table_exists_function.sql` exécuté (optionnel)
- [ ] Test de connexion réussi avec `test_supabase_connection.js`
- [ ] Permissions RLS vérifiées/ajustées
- [ ] Code mis à jour avec la nouvelle méthode `tableExists`

## Support

Si les problèmes persistent après avoir suivi ce guide :

1. Vérifiez les logs détaillés du serveur
2. Consultez les logs Supabase dans Dashboard > Logs
3. Assurez-vous que votre projet Supabase n'est pas en pause (gratuit tier)
4. Vérifiez les quotas et limites de votre plan Supabase