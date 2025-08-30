# Configuration Supabase pour BrikStak

Ce guide vous explique comment configurer Supabase pour votre projet BrikStak.

## 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte et un nouveau projet
3. Notez votre **URL du projet** et votre **clé anonyme**

## 2. Configuration des variables d'environnement

Ajoutez ces variables à votre fichier `.env` :

```env
# Supabase Configuration
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre-clé-anonyme-supabase
```

## 3. Exécuter le script SQL de configuration

1. Dans votre dashboard Supabase, allez dans **SQL Editor**
2. Copiez-collez le contenu du fichier `supabase_setup.sql`
3. Exécutez le script

Ceci va créer :
- Une fonction `create_orders_table()` pour créer automatiquement les tables
- Une fonction `update_updated_at_column()` pour les timestamps
- Une table `brikstik_logs` pour le logging (optionnel)
- Des vues et fonctions pour les statistiques

## 4. Comment ça fonctionne

### Création automatique de tables

Quand une commande est confirmée pour un nouveau chantier :

1. Le système génère un nom de table normalisé : `commandes_nom_du_chantier`
2. La fonction SQL `create_orders_table()` créé automatiquement la table avec :
   - **id** : Identifiant unique
   - **chantier** : Nom du chantier
   - **materiau** : Type de matériau demandé
   - **quantite** : Quantité numérique
   - **unite** : Unité de mesure (m³, kg, etc.)
   - **date_besoin** : Date nécessaire
   - **heure_besoin** : Heure nécessaire
   - **phone_number** : Numéro WhatsApp de l'utilisateur
   - **statut** : 'en_attente', 'confirmee', ou 'livree'
   - **created_at** / **updated_at** : Timestamps automatiques

### Exemple de flux

```
Utilisateur WhatsApp: "Je voudrais 5 m³ de béton pour le chantier Rue de la Paix, pour demain 14h"

Bot: "Récapitulatif:
- Chantier: Rue de la Paix
- 5 m³ de béton
- Quantité + unité: 5 m³
- Besoin pour 15/01/2024 14:00

Peux-tu confirmer ce récapitulatif ?"

Utilisateur: "Oui"

Bot: "Commande prête à être transmise."

→ Création automatique de la table `commandes_rue_de_la_paix`
→ Insertion de la commande avec toutes les informations
```

## 5. API Endpoints disponibles

### GET /api/chantiers
Liste tous les chantiers avec des commandes :
```json
{
  "success": true,
  "chantiers": ["rue de la paix", "avenue des tilleuls"],
  "count": 2
}
```

### GET /api/orders/:chantier
Récupère toutes les commandes d'un chantier :
```json
{
  "success": true,
  "chantier": "rue de la paix",
  "orders": [
    {
      "id": 1,
      "chantier": "Rue de la Paix",
      "materiau": "béton",
      "quantite": "5",
      "unite": "m³",
      "date_besoin": "15/01/2024",
      "heure_besoin": "14:00",
      "phone_number": "+33123456789",
      "statut": "confirmee",
      "created_at": "2024-01-14T10:30:00Z"
    }
  ],
  "count": 1
}
```

### POST /api/orders
Créer une commande manuellement (pour les tests) :
```json
{
  "chantier": "Test Chantier",
  "materiau": "ciment",
  "quantite": "10",
  "unite": "sacs",
  "date_besoin": "16/01/2024",
  "heure_besoin": "09:00",
  "phone_number": "+33987654321",
  "statut": "en_attente"
}
```

## 6. Sécurité et permissions

Le script configure des permissions basiques. Pour la production, vous devriez :

1. **Activer RLS (Row Level Security)** sur vos tables
2. **Créer des policies** pour limiter l'accès aux données
3. **Utiliser une clé service** pour les opérations sensibles

## 7. Monitoring et logs

Le système log automatiquement :
- Création de nouvelles tables
- Insertion de commandes
- Erreurs de parsing ou de validation

Consultez les logs dans votre application pour surveiller l'activité.

## 8. Dépannage

### Erreur "Table does not exist"
- Vérifiez que le script SQL a été exécuté
- Vérifiez vos permissions Supabase

### Erreur de connexion Supabase
- Vérifiez vos variables d'environnement `SUPABASE_URL` et `SUPABASE_ANON_KEY`
- Vérifiez que votre projet Supabase est actif

### Commandes non stockées
- Vérifiez les logs de l'application
- Assurez-vous que l'IA génère bien les récapitulatifs dans le bon format

## 9. Développement et tests

Pour tester localement :

1. Installez les dépendances : `npm install`
2. Configurez votre `.env` avec vos clés Supabase
3. Démarrez : `npm run dev`
4. Testez avec l'API : `curl http://localhost:3000/api/chantiers`

## 10. Déploiement

N'oubliez pas d'ajouter vos variables Supabase dans votre environnement de production (Railway, Heroku, etc.).