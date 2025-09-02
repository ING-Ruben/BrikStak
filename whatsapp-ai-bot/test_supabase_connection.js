#!/usr/bin/env node

/**
 * Script de diagnostic pour tester la connexion Supabase et les fonctions RPC
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnection() {
  console.log('🔍 Test de connexion Supabase\n');
  console.log('='.repeat(50));

  // Vérifier les variables d'environnement
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  console.log('\n1. Variables d\'environnement:');
  console.log('   SUPABASE_URL:', supabaseUrl ? '✅ Définie' : '❌ Non définie');
  console.log('   SUPABASE_ANON_KEY:', supabaseKey ? '✅ Définie' : '❌ Non définie');

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Les variables SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies dans le fichier .env');
    process.exit(1);
  }

  // Créer le client Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('\n2. Client Supabase créé avec succès ✅');

  // Test 1: Vérifier la connexion basique
  console.log('\n3. Test de connexion basique:');
  try {
    const { data, error } = await supabase
      .from('_dummy_test_')
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table n'existe pas, ce qui est normal pour _dummy_test_
      console.log('   ❌ Erreur de connexion:', error.message);
    } else {
      console.log('   ✅ Connexion à Supabase établie');
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  // Test 2: Vérifier l'accès à information_schema
  console.log('\n4. Test d\'accès à information_schema:');
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);
    
    if (error) {
      console.log('   ❌ Erreur d\'accès à information_schema:', error.message);
      console.log('   💡 Solution: Utiliser une approche différente pour vérifier l\'existence des tables');
    } else {
      console.log('   ✅ Accès à information_schema réussi');
      if (data && data.length > 0) {
        console.log('   Tables trouvées:', data.map(t => t.table_name).join(', '));
      }
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  // Test 3: Méthode alternative pour vérifier l'existence d'une table
  console.log('\n5. Test alternatif de vérification de table:');
  const testTableName = 'commandes_test_' + Date.now();
  try {
    const { data, error } = await supabase
      .from(testTableName)
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log('   ✅ La table n\'existe pas (comportement attendu)');
      } else {
        console.log('   ⚠️ Erreur inattendue:', error.message);
      }
    } else {
      console.log('   ℹ️ La table existe déjà');
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  // Test 4: Vérifier l'existence de la fonction RPC create_orders_table
  console.log('\n6. Test de la fonction RPC create_orders_table:');
  try {
    const testTableName = 'test_orders_' + Date.now();
    const { data, error } = await supabase.rpc('create_orders_table', {
      table_name: testTableName
    });
    
    if (error) {
      console.log('   ❌ Erreur RPC create_orders_table:', error.message);
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('   💡 La fonction n\'existe pas dans la base de données');
        console.log('   💡 Exécutez le script supabase_setup.sql dans Supabase SQL Editor');
      }
    } else {
      console.log('   ✅ Fonction create_orders_table exécutée avec succès');
      console.log('   Table créée:', testTableName);
      
      // Nettoyer la table de test
      try {
        await supabase.rpc('drop_table_if_exists', { table_name: testTableName });
      } catch (e) {
        // Ignorer l'erreur de nettoyage
      }
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  // Test 5: Vérifier l'existence de la fonction RPC create_multi_material_orders_table
  console.log('\n7. Test de la fonction RPC create_multi_material_orders_table:');
  try {
    const testTableName = 'test_multi_' + Date.now();
    const { data, error } = await supabase.rpc('create_multi_material_orders_table', {
      table_name: testTableName
    });
    
    if (error) {
      console.log('   ❌ Erreur RPC create_multi_material_orders_table:', error.message);
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('   💡 La fonction n\'existe pas dans la base de données');
        console.log('   💡 Exécutez le script supabase_multi_material_setup.sql dans Supabase SQL Editor');
      }
    } else {
      console.log('   ✅ Fonction create_multi_material_orders_table exécutée avec succès');
      console.log('   Table créée:', testTableName);
      
      // Nettoyer la table de test
      try {
        await supabase.rpc('drop_table_if_exists', { table_name: testTableName });
      } catch (e) {
        // Ignorer l'erreur de nettoyage
      }
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  // Test 6: Lister les fonctions RPC disponibles
  console.log('\n8. Vérification des fonctions RPC disponibles:');
  try {
    const { data, error } = await supabase
      .rpc('pg_get_functiondef', { funcoid: 0 })
      .limit(1);
    
    console.log('   ℹ️ Note: La liste des fonctions RPC n\'est pas directement accessible');
    console.log('   💡 Vérifiez manuellement dans Supabase Dashboard > Database > Functions');
  } catch (err) {
    // Erreur attendue
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n📋 RÉSUMÉ DES ACTIONS RECOMMANDÉES:\n');
  console.log('1. Assurez-vous que les variables SUPABASE_URL et SUPABASE_ANON_KEY sont définies dans .env');
  console.log('2. Exécutez les scripts SQL dans Supabase SQL Editor:');
  console.log('   - supabase_setup.sql (pour create_orders_table)');
  console.log('   - supabase_multi_material_setup.sql (pour create_multi_material_orders_table)');
  console.log('3. Vérifiez les permissions RLS (Row Level Security) si activées');
  console.log('4. Modifiez le code pour utiliser une méthode alternative de vérification d\'existence de table');
  console.log('\n' + '='.repeat(50));
}

// Exécuter les tests
testSupabaseConnection().catch(console.error);