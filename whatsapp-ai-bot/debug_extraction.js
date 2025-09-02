const { ExtractionAgent } = require('./dist/services/extractionAgent');
const { SupabaseService } = require('./dist/services/supabase');
require('dotenv').config();

async function testExtraction() {
  console.log('🔍 Testing extraction and conversion...\n');
  
  // Initialiser les services
  const extractionAgent = new ExtractionAgent();
  const supabaseService = new SupabaseService();
  
  // Message de test typique
  const testMessage = `Bonjour, je voudrais commander pour mon chantier Maison Dupont:
  - 10 m3 de béton
  - 5 tonnes de sable
  - 2 palettes de ciment
  Livraison demain à 14h00. Je confirme la commande.`;
  
  console.log('📝 Message de test:', testMessage);
  console.log('\n-------------------\n');
  
  try {
    // Tester l'extraction
    console.log('1️⃣ Extraction des données...');
    const extractionResult = await extractionAgent.extractOrderInfo(testMessage);
    console.log('Résultat extraction:', JSON.stringify(extractionResult, null, 2));
    console.log('\n-------------------\n');
    
    // Tester la conversion
    console.log('2️⃣ Conversion vers MultiMaterialOrder...');
    const phoneNumber = '+33612345678';
    const multiMaterialOrder = supabaseService.convertExtractionToMultiMaterialOrder(
      extractionResult.data,
      phoneNumber
    );
    
    if (multiMaterialOrder) {
      console.log('✅ Conversion réussie:', JSON.stringify(multiMaterialOrder, null, 2));
    } else {
      console.log('❌ Conversion échouée - Données manquantes:');
      console.log('- Chantier:', extractionResult.data.chantier || '❌ MANQUANT');
      console.log('- Date livraison:', extractionResult.data.livraison.date || '❌ MANQUANT');
      console.log('- Heure livraison:', extractionResult.data.livraison.heure || '❌ MANQUANT');
      console.log('- Matériaux valides:', extractionResult.data.materiaux.filter(m => m.nom && m.nom.trim()).length);
      console.log('- Matériaux:', JSON.stringify(extractionResult.data.materiaux, null, 2));
    }
    
    console.log('\n-------------------\n');
    
    // Tester le stockage si la conversion a réussi
    if (multiMaterialOrder) {
      console.log('3️⃣ Test de stockage dans Supabase...');
      const stored = await supabaseService.storeMultiMaterialOrder(multiMaterialOrder);
      
      if (stored) {
        console.log('✅ Données stockées avec succès dans Supabase!');
      } else {
        console.log('❌ Échec du stockage dans Supabase');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

// Exécuter le test
testExtraction().then(() => {
  console.log('\n✨ Test terminé');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erreur fatale:', error);
  process.exit(1);
});