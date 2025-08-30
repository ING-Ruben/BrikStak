# Exemples de tests pour BrikStak

## Exemples de conversations qui déclenchent le stockage

### Exemple 1 : Commande de béton

```
Utilisateur: "Salut, je voudrais du béton pour le chantier Avenue des Tilleuls"

Bot: "Salut ! Quelle quantité de béton exactement ? (précise l'unité : m³, kg, etc.)"

Utilisateur: "5 m³"

Bot: "Parfait ! Pour quelle date et heure as-tu besoin de ces 5 m³ de béton ?"

Utilisateur: "Demain 14h"

Bot: "Peux-tu me donner la date exacte au format JJ/MM/AAAA et l'heure au format HH:MM ?"

Utilisateur: "15/01/2024 14:00"

Bot: "Récapitulatif :
- Chantier : Avenue des Tilleuls
- 5 m³ de béton
- Quantité + unité : 5 m³
- Besoin pour 15/01/2024 14:00

Peux-tu confirmer ce récapitulatif ?"

Utilisateur: "Oui"

Bot: "Commande prête à être transmise."
```

**→ Résultat :** Table `commandes_avenue_des_tilleuls` créée automatiquement et commande stockée.

### Exemple 2 : Commande de ciment

```
Utilisateur: "Il me faut 20 sacs de ciment pour la Rue de la Paix le 16/01/2024 à 09:00"

Bot: "Récapitulatif :
- Chantier : Rue de la Paix
- 20 sacs de ciment
- Quantité + unité : 20 sacs
- Besoin pour 16/01/2024 09:00

Peux-tu confirmer ce récapitulatif ?"

Utilisateur: "Parfait"

Bot: "Commande prête à être transmise."
```

**→ Résultat :** Table `commandes_rue_de_la_paix` créée automatiquement et commande stockée.

### Exemple 3 : Commande de gravier

```
Utilisateur: "Gravier pour Place du Marché"

Bot: "Quelle quantité de gravier exactement ? (précise l'unité : m³, kg, tonnes, etc.)"

Utilisateur: "3 tonnes"

Bot: "Pour quelle date et heure as-tu besoin de ces 3 tonnes de gravier ?"

Utilisateur: "17/01/2024 10:30"

Bot: "Récapitulatif :
- Chantier : Place du Marché
- 3 tonnes de gravier
- Quantité + unité : 3 tonnes
- Besoin pour 17/01/2024 10:30

Peux-tu confirmer ce récapitulatif ?"

Utilisateur: "Oui c'est bon"

Bot: "Commande prête à être transmise."
```

**→ Résultat :** Table `commandes_place_du_marche` créée automatiquement et commande stockée.

## Formats acceptés pour les unités

- **Volume :** m³, litres, l
- **Poids :** kg, tonnes, ton
- **Surface :** m², m2
- **Longueur :** m, cm
- **Unités :** sacs, palettes

## Formats acceptés pour les dates

- **JJ/MM/AAAA :** 15/01/2024
- **AAAA-MM-JJ :** 2024-01-15

## Formats acceptés pour les heures

- **HH:MM :** 14:00, 09:30, 16:45

## Test des API endpoints

### 1. Lister tous les chantiers
```bash
curl http://localhost:3000/api/chantiers
```

### 2. Voir les commandes d'un chantier
```bash
curl http://localhost:3000/api/orders/avenue%20des%20tilleuls
```

### 3. Créer une commande manuellement (test)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "chantier": "Test Chantier",
    "materiau": "ciment",
    "quantite": "10",
    "unite": "sacs",
    "date_besoin": "16/01/2024",
    "heure_besoin": "09:00",
    "phone_number": "+33987654321",
    "statut": "en_attente"
  }'
```

## Cas qui NE déclenchent PAS le stockage

### Commande incomplète
```
Utilisateur: "Je voudrais du béton"
Bot: "Pour quel chantier exactement ?"
```
**→ Pas de stockage car informations incomplètes**

### Commande non confirmée
```
Bot: "Récapitulatif : [...]
Peux-tu confirmer ce récapitulatif ?"

Utilisateur: "Non, je me suis trompé"
```
**→ Pas de stockage car non confirmé**

### Questions générales
```
Utilisateur: "/help"
Bot: "🤖 Assistant WhatsApp AI [...]"
```
**→ Pas de stockage car c'est une commande système**

## Vérification dans Supabase

1. Connectez-vous à votre dashboard Supabase
2. Allez dans **Table Editor**
3. Vous devriez voir les tables créées automatiquement :
   - `commandes_avenue_des_tilleuls`
   - `commandes_rue_de_la_paix`
   - `commandes_place_du_marche`
4. Cliquez sur une table pour voir les données stockées

## Surveillance des logs

Les logs vous indiqueront :
```
INFO: Order stored successfully in Supabase
WARN: Order format validation failed
ERROR: Error processing order for storage
```

Surveillez ces messages pour comprendre le comportement du système.