# 🗄️ Configuration Supabase pour WhatsApp AI Bot

## 📋 Aperçu

Cette documentation explique comment configurer Supabase pour sauvegarder automatiquement les commandes de matériaux validées par les ouvriers via WhatsApp.

## 🚀 Configuration Supabase

### 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte ou connectez-vous
3. Cliquez sur "New Project"
4. Remplissez les informations du projet
5. Attendez que l'infrastructure soit provisionnée

### 2. Créer la table `commandes`

Dans l'éditeur SQL de Supabase, exécutez la requête suivante :

```sql
CREATE TABLE commandes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier TEXT NOT NULL,
  materiau TEXT NOT NULL,
  quantite TEXT NOT NULL,
  unite TEXT NOT NULL,
  date_heure TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances des recherches par téléphone
CREATE INDEX idx_commandes_phone ON commandes(phone_number);

-- Index pour améliorer les performances des recherches par date
CREATE INDEX idx_commandes_created_at ON commandes(created_at);
```

### 3. Configurer les politiques RLS (optionnel mais recommandé)

```sql
-- Activer RLS sur la table
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre l'insertion (pour le bot)
CREATE POLICY "Enable insert for service role" ON commandes
  FOR INSERT WITH CHECK (true);

-- Politique pour permettre la lecture (pour le bot)
CREATE POLICY "Enable read for service role" ON commandes
  FOR SELECT USING (true);
```

### 4. Récupérer les clés d'API

1. Dans votre projet Supabase, allez dans **Settings > API**
2. Copiez les valeurs suivantes :
   - **URL** : Votre URL de projet
   - **anon public** : Clé publique anonyme
   - **service_role** : Clé de service (recommandée pour plus de sécurité)

## 🔧 Variables d'environnement

Ajoutez ces variables à votre fichier `.env` ou dans votre plateforme de déploiement :

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_TABLE_NAME=commandes
```

## 📊 Structure des données

Chaque commande sauvegardée contient :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique auto-généré |
| `chantier` | TEXT | Nom du chantier |
| `materiau` | TEXT | Type de matériau demandé |
| `quantite` | TEXT | Quantité numérique |
| `unite` | TEXT | Unité de mesure (m³, kg, etc.) |
| `date_heure` | TEXT | Date et heure de besoin |
| `phone_number` | TEXT | Numéro WhatsApp de l'ouvrier |
| `created_at` | TIMESTAMPTZ | Horodatage de création |

## 🔄 Flux de sauvegarde

1. **L'ouvrier discute avec le bot** pour définir sa commande
2. **Le bot collecte** les 3 informations requises :
   - Nom du chantier
   - Quantité + unité du matériau
   - Date et heure de besoin
3. **Le bot présente un récapitulatif** et demande confirmation
4. **L'ouvrier confirme** avec des mots comme "oui", "ok", "confirme"
5. **Le bot détecte la confirmation** et extrait les données du récapitulatif
6. **Les données sont sauvegardées** automatiquement dans Supabase
7. **L'ouvrier reçoit une confirmation** avec l'ID de référence

## 📝 Exemple de données sauvegardées

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "chantier": "Résidence Les Jardins",
  "materiau": "Béton C25/30",
  "quantite": "15",
  "unite": "m³",
  "date_heure": "25/12/2024 à 08:00",
  "phone_number": "+33123456789",
  "created_at": "2024-12-24T10:30:00Z"
}
```

## 🛠️ Requêtes utiles

### Récupérer toutes les commandes d'aujourd'hui
```sql
SELECT * FROM commandes 
WHERE DATE(created_at) = CURRENT_DATE 
ORDER BY created_at DESC;
```

### Compter les commandes par chantier
```sql
SELECT chantier, COUNT(*) as total_commandes 
FROM commandes 
GROUP BY chantier 
ORDER BY total_commandes DESC;
```

### Rechercher les commandes d'un ouvrier
```sql
SELECT * FROM commandes 
WHERE phone_number = '+33123456789' 
ORDER BY created_at DESC;
```

## 🚨 Dépannage

### Erreur de connexion
- Vérifiez que `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont correctement configurées
- Assurez-vous que l'URL ne contient pas d'espace ou de caractère spécial

### Erreur d'insertion
- Vérifiez que la table `commandes` existe
- Vérifiez que les politiques RLS permettent l'insertion
- Consultez les logs du bot pour plus de détails

### Données non parsées
- Le bot recherche un format spécifique dans le récapitulatif
- Assurez-vous que le système d'instructions d'OpenAI n'a pas été modifié
- Vérifiez les logs pour voir si le parsing échoue

## 📈 Monitoring

Le bot log toutes les opérations Supabase :
- Tentatives de sauvegarde
- Succès avec ID de référence
- Échecs avec messages d'erreur
- Statistiques de parsing

Surveillez ces logs pour détecter d'éventuels problèmes.