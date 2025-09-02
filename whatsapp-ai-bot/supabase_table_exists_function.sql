-- Fonction pour vérifier l'existence d'une table
-- Cette fonction est optionnelle mais améliore la fiabilité de la vérification

CREATE OR REPLACE FUNCTION table_exists(table_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = $1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION table_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION table_exists(text) TO authenticated;