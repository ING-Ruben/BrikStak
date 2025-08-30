const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testSupabaseConnection() {
  console.log('🔍 Test de connexion Supabase...\n');

  // 1. Vérifier les variables d'environnement
  console.log('📋 Variables d\'environnement:');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Définie' : '❌ Manquante');
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Définie' : '❌ Manquante');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log('\n❌ Variables d\'environnement manquantes!');
    console.log('Veuillez configurer SUPABASE_URL et SUPABASE_ANON_KEY dans votre fichier .env');
    return;
  }

  // 2. Tester la connexion
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    console.log('\n🔗 Tentative de connexion...');
    
    // Test simple : lister les tables
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);

    if (error) {
      console.log('❌ Erreur de connexion:', error.message);
      return;
    }

    console.log('✅ Connexion réussie!');
    console.log('📊 Tables trouvées:', data?.length || 0);
    
    // 3. Vérifier si la fonction create_orders_table existe
    console.log('\n🔧 Vérification de la fonction create_orders_table...');
    const { data: funcData, error: funcError } = await supabase
      .rpc('create_orders_table', { table_name: 'test_connection_table' });

    if (funcError) {
      console.log('❌ Fonction create_orders_table manquante ou erreur:', funcError.message);
      console.log('💡 Vous devez exécuter le script supabase_setup.sql dans votre dashboard Supabase');
    } else {
      console.log('✅ Fonction create_orders_table disponible');
      
      // Nettoyer la table de test
      try {
        await supabase.from('test_connection_table').delete().neq('id', 0);
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
    }

    // 4. Test d'insertion d'une commande
    console.log('\n📝 Test d\'insertion d\'une commande...');
    const testOrder = {
      chantier: 'Test Chantier',
      materiau: 'Test Matériau',
      quantite: '10',
      unite: 'kg',
      date_besoin: '2024-01-15',
      heure_besoin: '14:00',
      phone_number: '+33123456789',
      statut: 'confirmee',
      created_at: new Date().toISOString()
    };

    // Créer la table de test
    const { error: createError } = await supabase.rpc('create_orders_table', {
      table_name: 'commandes_test_chantier'
    });

    if (createError) {
      console.log('❌ Impossible de créer la table de test:', createError.message);
    } else {
      // Tenter l'insertion
      const { data: insertData, error: insertError } = await supabase
        .from('commandes_test_chantier')
        .insert([testOrder])
        .select();

      if (insertError) {
        console.log('❌ Erreur d\'insertion:', insertError.message);
      } else {
        console.log('✅ Insertion réussie!');
        console.log('📄 Données insérées:', insertData);
        
        // Nettoyer la table de test
        await supabase.from('commandes_test_chantier').delete().neq('id', 0);
      }
    }

  } catch (error) {
    console.log('❌ Erreur inattendue:', error.message);
  }
}

testSupabaseConnection();