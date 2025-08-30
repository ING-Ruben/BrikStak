-- Script SQL pour la migration vers l'architecture multi-matériaux
-- À exécuter dans Supabase SQL Editor

-- 1. Fonction pour créer des tables multi-matériaux
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
      statut TEXT NOT NULL DEFAULT ''en_attente'' CHECK (statut IN (''confirmee'', ''en_attente'', ''livree'')),
      completude DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (completude >= 0.0 AND completude <= 1.0),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )', table_name);
    
  -- Ajouter des index pour les performances
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_chantier ON %I(chantier)', table_name, table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_phone ON %I(phone_number)', table_name, table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_statut ON %I(statut)', table_name, table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_date ON %I(date_besoin)', table_name, table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_created ON %I(created_at DESC)', table_name, table_name);
  
  -- Trigger pour updated_at
  EXECUTE format('
    CREATE OR REPLACE FUNCTION update_%I_updated_at()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
    
    DROP TRIGGER IF EXISTS trigger_update_%I_updated_at ON %I;
    CREATE TRIGGER trigger_update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_%I_updated_at();
  ', table_name, table_name, table_name, table_name, table_name, table_name);
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fonction pour migrer des données legacy vers multi-matériaux
CREATE OR REPLACE FUNCTION migrate_legacy_to_multi_material(legacy_table_name text, multi_table_name text)
RETURNS INTEGER AS $$
DECLARE
  migrated_count INTEGER := 0;
  legacy_record RECORD;
BEGIN
  -- Vérifier que la table legacy existe
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = legacy_table_name
  ) THEN
    RAISE NOTICE 'Table legacy % n''existe pas', legacy_table_name;
    RETURN 0;
  END IF;
  
  -- Créer la table multi-matériaux si elle n'existe pas
  PERFORM create_multi_material_orders_table(multi_table_name);
  
  -- Migrer les données
  FOR legacy_record IN 
    EXECUTE format('SELECT * FROM %I ORDER BY created_at', legacy_table_name)
  LOOP
    -- Construire le JSON des matériaux
    EXECUTE format('
      INSERT INTO %I (chantier, materiaux_json, date_besoin, heure_besoin, phone_number, statut, completude, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
    ', multi_table_name)
    USING 
      legacy_record.chantier,
      format('[{"nom": "%s", "quantite": "%s", "unite": "%s"}]', 
        legacy_record.materiau, 
        legacy_record.quantite, 
        legacy_record.unite
      ),
      legacy_record.date_besoin,
      legacy_record.heure_besoin,
      legacy_record.phone_number,
      legacy_record.statut,
      CASE WHEN legacy_record.statut = 'confirmee' THEN 1.0 ELSE 0.8 END,
      legacy_record.created_at;
    
    migrated_count := migrated_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Migration terminée: % enregistrements migrés de % vers %', 
    migrated_count, legacy_table_name, multi_table_name;
  
  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fonction pour obtenir des statistiques sur les commandes multi-matériaux
CREATE OR REPLACE FUNCTION get_multi_material_stats(table_name text)
RETURNS TABLE(
  total_orders BIGINT,
  confirmed_orders BIGINT,
  pending_orders BIGINT,
  avg_completude DECIMAL,
  avg_materials_per_order DECIMAL,
  most_common_material TEXT
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    WITH material_stats AS (
      SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE statut = ''confirmee'') as confirmed_orders,
        COUNT(*) FILTER (WHERE statut = ''en_attente'') as pending_orders,
        AVG(completude) as avg_completude,
        AVG(json_array_length(materiaux_json::json)) as avg_materials_per_order
      FROM %I
    ),
    material_frequency AS (
      SELECT 
        json_array_elements(materiaux_json::json)->''nom'' as material_name,
        COUNT(*) as frequency
      FROM %I
      GROUP BY material_name
      ORDER BY frequency DESC
      LIMIT 1
    )
    SELECT 
      ms.total_orders,
      ms.confirmed_orders,
      ms.pending_orders,
      ROUND(ms.avg_completude, 3) as avg_completude,
      ROUND(ms.avg_materials_per_order, 2) as avg_materials_per_order,
      COALESCE(mf.material_name::text, ''N/A'') as most_common_material
    FROM material_stats ms
    LEFT JOIN material_frequency mf ON true
  ', table_name, table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Vue pour analyser les performances des agents
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour_bucket,
  COUNT(*) as total_orders,
  AVG(completude) as avg_completude,
  COUNT(*) FILTER (WHERE completude >= 0.8) as high_quality_extractions,
  COUNT(*) FILTER (WHERE statut = 'confirmee') as confirmed_orders,
  ROUND(
    COUNT(*) FILTER (WHERE completude >= 0.8) * 100.0 / COUNT(*), 2
  ) as quality_percentage
FROM (
  -- Union de toutes les tables multi-matériaux
  SELECT chantier, completude, statut, created_at
  FROM information_schema.tables t
  CROSS JOIN LATERAL (
    EXECUTE format('SELECT chantier, completude, statut, created_at FROM %I', t.table_name)
  ) AS orders
  WHERE t.table_schema = 'public' 
    AND t.table_name LIKE 'multi_commandes_%'
) all_orders
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour_bucket DESC;

-- 5. Fonction de nettoyage pour les anciennes données (à utiliser avec précaution)
CREATE OR REPLACE FUNCTION cleanup_old_orders(days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(table_name TEXT, deleted_count BIGINT) AS $$
DECLARE
  table_record RECORD;
  deleted_rows BIGINT;
BEGIN
  FOR table_record IN 
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
      AND (t.table_name LIKE 'commandes_%' OR t.table_name LIKE 'multi_commandes_%')
  LOOP
    EXECUTE format('
      DELETE FROM %I 
      WHERE created_at < NOW() - INTERVAL ''%s days''
        AND statut = ''livree''
    ', table_record.table_name, days_to_keep);
    
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    
    RETURN QUERY SELECT table_record.table_name, deleted_rows;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Politique de sécurité RLS (Row Level Security) - Optionnel
-- Décommenter si vous souhaitez activer RLS

/*
-- Activer RLS sur toutes les tables de commandes
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN 
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND (table_name LIKE 'commandes_%' OR table_name LIKE 'multi_commandes_%')
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_record.table_name);
    
    -- Politique : les utilisateurs ne peuvent voir que leurs propres commandes
    EXECUTE format('
      CREATE POLICY IF NOT EXISTS %I_policy ON %I
      FOR ALL USING (phone_number = current_setting(''app.current_phone'', true))
    ', table_record.table_name, table_record.table_name);
  END LOOP;
END $$;
*/

-- 7. Instructions d'utilisation

-- Exemple d'utilisation des nouvelles fonctions :

-- Créer une table multi-matériaux pour un nouveau chantier
-- SELECT create_multi_material_orders_table('multi_commandes_paris_nord');

-- Migrer des données legacy vers multi-matériaux
-- SELECT migrate_legacy_to_multi_material('commandes_paris_nord', 'multi_commandes_paris_nord');

-- Obtenir des statistiques
-- SELECT * FROM get_multi_material_stats('multi_commandes_paris_nord');

-- Voir les performances des agents
-- SELECT * FROM agent_performance_summary WHERE hour_bucket >= NOW() - INTERVAL '24 hours';

-- Nettoyer les anciennes données (commandes livrées de plus de 90 jours)
-- SELECT * FROM cleanup_old_orders(90);

-- Fin du script de migration