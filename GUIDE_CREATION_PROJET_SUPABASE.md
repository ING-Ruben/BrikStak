# Guide Complet : Création d'un Projet Supabase et Exécution du Code SQL

## 📋 Vue d'ensemble

Ce guide vous explique étape par étape comment créer un nouveau projet dans Supabase et où exécuter votre code SQL pour configurer votre base de données.

## 🚀 Étape 1 : Créer un compte Supabase

1. **Rendez-vous sur** [supabase.com](https://supabase.com)
2. **Cliquez sur** "Start your project" ou "Sign up"
3. **Créez un compte** avec :
   - Votre email
   - Ou connectez-vous avec GitHub (recommandé)
   - Ou connectez-vous avec Google

## 📦 Étape 2 : Créer un nouveau projet Supabase

### 2.1 Dans le Dashboard Supabase

1. **Cliquez sur** "New Project" (Nouveau Projet)
2. **Remplissez les informations** :
   - **Project name** : Nom de votre projet (ex: "brikstik-whatsapp")
   - **Database Password** : Créez un mot de passe fort (NOTEZ-LE BIEN!)
   - **Region** : Choisissez la région la plus proche (ex: "West EU (Ireland)" pour la France)
   - **Pricing Plan** : Free tier pour commencer

3. **Cliquez sur** "Create new project"
4. **Attendez** quelques minutes que le projet soit créé (environ 2-3 minutes)

### 2.2 Récupérer vos clés d'API

Une fois le projet créé :

1. **Allez dans** Settings (icône engrenage) → API
2. **Notez** :
   - **Project URL** : `https://votre-projet.supabase.co`
   - **anon public key** : Une longue clé commençant par `eyJ...`
   - **service_role key** : (gardez-la secrète, pour usage serveur uniquement)

## 🗄️ Étape 3 : Exécuter votre Code SQL dans SQL Editor

### 3.1 Accéder au SQL Editor

1. **Dans le menu de gauche**, cliquez sur **SQL Editor** (icône de terminal)
2. Vous verrez un éditeur de code SQL vide

### 3.2 Exécuter votre code SQL

#### Option A : Exécution directe

1. **Copiez** le contenu de votre fichier `supabase_setup.sql`
2. **Collez-le** dans le SQL Editor
3. **Cliquez sur** "Run" (ou appuyez sur Ctrl+Enter / Cmd+Enter)
4. **Vérifiez** les résultats dans la partie inférieure

#### Option B : Utilisation des Queries sauvegardées

1. **Cliquez sur** "New query" dans le SQL Editor
2. **Donnez un nom** à votre query (ex: "Initial Setup")
3. **Collez** votre code SQL
4. **Cliquez sur** "Save"
5. **Puis cliquez sur** "Run"

### 3.3 Ordre d'exécution des fichiers SQL

Pour votre projet WhatsApp AI Bot, exécutez les fichiers dans cet ordre :

1. **D'abord** : `supabase_table_exists_function.sql`
   - Crée une fonction utilitaire pour vérifier l'existence des tables

2. **Ensuite** : `supabase_setup.sql`
   - Crée les fonctions principales
   - Configure les tables de base
   - Met en place les triggers

3. **Optionnel** : `supabase_multi_material_setup.sql`
   - Si vous avez besoin de gérer plusieurs matériaux

## 🔍 Étape 4 : Vérifier que tout fonctionne

### 4.1 Vérifier les tables créées

1. **Allez dans** "Table Editor" dans le menu de gauche
2. **Vérifiez** que vous voyez :
   - La table `brikstik_logs` (si créée)
   - Les fonctions dans l'onglet "Functions"

### 4.2 Tester une fonction

Dans le SQL Editor, exécutez :

```sql
-- Tester la création d'une table de commandes
SELECT create_orders_table('commandes_test');

-- Vérifier que la table existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'commandes_test';
```

## 📝 Étape 5 : Configuration dans votre application

### 5.1 Créer le fichier .env

Dans votre projet local, créez un fichier `.env` :

```env
# Supabase Configuration
SUPABASE_URL=https://votre-projet-id.supabase.co
SUPABASE_ANON_KEY=eyJ...votre-clé-anonyme...
```

### 5.2 Ne jamais commiter le .env

Assurez-vous que `.env` est dans votre `.gitignore` !

## ⚠️ Points Importants à Retenir

### Où exécuter le SQL ?

- **TOUJOURS** dans le **SQL Editor** de Supabase (pas en local)
- Le SQL s'exécute directement sur la base de données hébergée
- Les modifications sont immédiates

### Quand le projet est-il créé ?

- Le **projet Supabase** est créé via l'interface web (étape 2)
- Les **tables et fonctions** sont créées quand vous exécutez le SQL (étape 3)
- Votre **application** se connecte ensuite au projet existant

### Erreurs courantes

1. **"Permission denied"** : Vérifiez que vous êtes bien connecté
2. **"Function already exists"** : Normal si vous ré-exécutez le script
3. **"Syntax error"** : Vérifiez que vous avez copié tout le code

## 🎯 Résumé Rapide

1. **Créez le projet** sur supabase.com (interface web)
2. **Récupérez** vos clés API
3. **Allez dans SQL Editor** dans votre projet Supabase
4. **Collez et exécutez** votre code SQL
5. **Configurez** votre application avec les clés

## 💡 Conseils Pro

- **Sauvegardez** vos queries SQL importantes dans Supabase
- **Testez** d'abord sur un projet de développement
- **Activez** Row Level Security (RLS) pour la production
- **Utilisez** les logs Supabase pour déboguer

## 🔗 Ressources Utiles

- [Documentation Supabase](https://supabase.com/docs)
- [SQL Editor Guide](https://supabase.com/docs/guides/database/sql-editor)
- [Best Practices](https://supabase.com/docs/guides/database/best-practices)

---

**Note** : Le code SQL ne crée PAS le projet Supabase lui-même. Il configure seulement la base de données à l'intérieur d'un projet existant. Le projet doit être créé manuellement via l'interface web de Supabase.