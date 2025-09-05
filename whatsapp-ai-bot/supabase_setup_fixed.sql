-- Script SQL pour la migration vers l'architecture multi-matériaux (CORRIGÉ)
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

-- 4. Fonction pour obtenir les statistiques globales (remplace la vue problématique)
CREATE OR REPLACE FUNCTION get_agent_performance_summary(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
  hour_bucket TIMESTAMP WITH TIME ZONE,
  total_orders BIGINT,
  avg_completude DECIMAL,
  high_quality_extractions BIGINT,
  confirmed_orders BIGINT,
  quality_percentage DECIMAL
) AS $$
DECLARE
  table_record RECORD;
  query_text TEXT := '';
BEGIN
  -- Construire la requête union pour toutes les tables multi-matériaux
  FOR table_record IN 
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
      AND t.table_name LIKE 'multi_commandes_%'
  LOOP
    IF query_text != '' THEN
      query_text := query_text || ' UNION ALL ';
    END IF;
    
    query_text := query_text || format('SELECT chantier, completude, statut, created_at FROM %I', table_record.table_name);
  END LOOP;
  
  -- Si aucune table trouvée, retourner vide
  IF query_text = '' THEN
    RETURN;
  END IF;
  
  -- Exécuter la requête finale
  RETURN QUERY EXECUTE format('
    SELECT 
      DATE_TRUNC(''hour'', created_at) as hour_bucket,
      COUNT(*) as total_orders,
      ROUND(AVG(completude), 3) as avg_completude,
      COUNT(*) FILTER (WHERE completude >= 0.8) as high_quality_extractions,
      COUNT(*) FILTER (WHERE statut = ''confirmee'') as confirmed_orders,
      ROUND(
        COUNT(*) FILTER (WHERE completude >= 0.8) * 100.0 / COUNT(*), 2
      ) as quality_percentage
    FROM (%s) all_orders
    WHERE created_at >= NOW() - INTERVAL ''%s hours''
    GROUP BY DATE_TRUNC(''hour'', created_at)
    ORDER BY hour_bucket DESC
  ', query_text, hours_back);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction de nettoyage pour les anciennes données
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

-- 6. Fonction pour lister toutes les tables de commandes
CREATE OR REPLACE FUNCTION get_all_order_tables()
RETURNS TABLE(table_name TEXT, table_type TEXT, estimated_rows BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    CASE 
      WHEN t.table_name LIKE 'multi_commandes_%' THEN 'multi_material'
      WHEN t.table_name LIKE 'commandes_%' THEN 'legacy'
      ELSE 'unknown'
    END as table_type,
    COALESCE(s.n_tup_ins - s.n_tup_del, 0) as estimated_rows
  FROM information_schema.tables t
  LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
  WHERE t.table_schema = 'public' 
    AND (t.table_name LIKE 'commandes_%' OR t.table_name LIKE 'multi_commandes_%')
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Instructions d'utilisation :

-- 1. Créer une table multi-matériaux pour un nouveau chantier
-- SELECT create_multi_material_orders_table('multi_commandes_test_chantier');

-- 2. Obtenir des statistiques d'une table
-- SELECT * FROM get_multi_material_stats('multi_commandes_test_chantier');

-- 3. Voir les performances des agents (dernières 24h)
-- SELECT * FROM get_agent_performance_summary(24);

-- 4. Lister toutes les tables de commandes
-- SELECT * FROM get_all_order_tables();

-- 5. Nettoyer les anciennes données
-- SELECT * FROM cleanup_old_orders(90);

-- Script prêt à utiliser !
