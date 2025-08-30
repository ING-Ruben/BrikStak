-- Script SQL pour configurer Supabase pour BrikStak
-- Ce script doit être exécuté dans l'éditeur SQL de Supabase

-- 1. Fonction pour créer automatiquement des tables de commandes
CREATE OR REPLACE FUNCTION create_orders_table(table_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que le nom de table est valide
  IF table_name !~ '^[a-zA-Z][a-zA-Z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;

  -- Créer la table dynamiquement
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id BIGSERIAL PRIMARY KEY,
      chantier TEXT NOT NULL,
      materiau TEXT NOT NULL,
      quantite TEXT NOT NULL,
      unite TEXT NOT NULL,
      date_besoin TEXT NOT NULL,
      heure_besoin TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      statut TEXT DEFAULT ''en_attente'' CHECK (statut IN (''en_attente'', ''confirmee'', ''livree'')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )', table_name);

  -- Créer un index sur created_at pour les performances
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS %I ON %I (created_at DESC)',
    'idx_' || table_name || '_created_at',
    table_name
  );

  -- Créer un index sur phone_number pour filtrer par utilisateur
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS %I ON %I (phone_number)',
    'idx_' || table_name || '_phone',
    table_name
  );

  -- Créer un trigger pour updated_at
  EXECUTE format('
    CREATE TRIGGER %I
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()',
    'trigger_' || table_name || '_updated_at',
    table_name
  );

  -- Créer les politiques RLS pour cette table
  PERFORM create_rls_policies(table_name);

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating table %: %', table_name, SQLERRM;
    RETURN FALSE;
END;
$$;

-- 2. Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Politique de sécurité RLS (Row Level Security)
-- Note: Les politiques RLS seront créées dynamiquement pour chaque table de commandes
-- Voici un exemple de fonction pour créer des politiques RLS sur les tables dynamiques:

CREATE OR REPLACE FUNCTION create_rls_policies(table_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Activer RLS sur la table
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- Créer une politique permettant toutes les opérations
  -- (vous pouvez restreindre selon vos besoins de sécurité)
  EXECUTE format('
    CREATE POLICY IF NOT EXISTS %I 
    ON %I FOR ALL 
    USING (true)',
    'policy_' || table_name || '_all_operations',
    table_name
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating RLS policies for table %: %', table_name, SQLERRM;
    RETURN FALSE;
END;
$$;

-- 4. Table de logs pour tracer les actions (optionnel)
CREATE TABLE IF NOT EXISTS brikstik_logs (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT,
  action TEXT,
  phone_number TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index sur les logs
CREATE INDEX IF NOT EXISTS idx_brikstik_logs_created_at ON brikstik_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brikstik_logs_phone ON brikstik_logs (phone_number);
CREATE INDEX IF NOT EXISTS idx_brikstik_logs_table ON brikstik_logs (table_name);

-- Activer RLS et créer des politiques pour la table de logs
ALTER TABLE brikstik_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Enable all operations for all users on logs" 
ON brikstik_logs FOR ALL 
USING (true);

-- 5. Fonction pour logger les actions (optionnel)
CREATE OR REPLACE FUNCTION log_brikstik_action(
  p_table_name TEXT,
  p_action TEXT,
  p_phone_number TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO brikstik_logs (table_name, action, phone_number, details)
  VALUES (p_table_name, p_action, p_phone_number, p_details);
EXCEPTION
  WHEN OTHERS THEN
    -- Log silencieusement les erreurs pour ne pas interrompre le flux principal
    RAISE LOG 'Error logging action: %', SQLERRM;
END;
$$;

-- 6. Vue pour obtenir un résumé de tous les chantiers
CREATE OR REPLACE VIEW brikstik_chantiers_summary AS
SELECT 
  table_name,
  REPLACE(REPLACE(table_name, 'commandes_', ''), '_', ' ') as chantier_name,
  schemaname
FROM pg_tables 
WHERE tablename LIKE 'commandes_%' 
AND schemaname = 'public';

-- 7. Fonction pour obtenir des statistiques (optionnel)
CREATE OR REPLACE FUNCTION get_chantier_stats(chantier_table TEXT)
RETURNS TABLE(
  total_commandes BIGINT,
  commandes_confirmees BIGINT,
  commandes_livrees BIGINT,
  derniere_commande TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT 
      COUNT(*)::BIGINT as total_commandes,
      COUNT(CASE WHEN statut = ''confirmee'' THEN 1 END)::BIGINT as commandes_confirmees,
      COUNT(CASE WHEN statut = ''livree'' THEN 1 END)::BIGINT as commandes_livrees,
      MAX(created_at) as derniere_commande
    FROM %I', chantier_table);
EXCEPTION
  WHEN OTHERS THEN
    -- Retourner des valeurs par défaut en cas d'erreur
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::BIGINT, NULL::TIMESTAMPTZ;
END;
$$;

-- Instructions d'utilisation:
/*
1. Exécutez ce script dans l'éditeur SQL de Supabase
2. Configurez vos variables d'environnement dans votre application:
   - SUPABASE_URL=https://votre-projet.supabase.co
   - SUPABASE_ANON_KEY=votre-clé-anonyme
3. Les tables seront créées automatiquement lors de la première commande pour chaque chantier
4. Optionnel: Activez RLS (Row Level Security) pour plus de sécurité
*/