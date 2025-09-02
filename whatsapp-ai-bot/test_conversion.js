const { SupabaseService } = require('./dist/services/supabase');
require('dotenv').config();

// Simuler des données d'extraction typiques
const testCases = [
  {
    name: "Cas 1: Commande complète avec date relative",
    data: {
      chantier: "Maison Dupont",
      materiaux: [
        { nom: "béton", quantite: "10", unite: "m3" },
        { nom: "sable", quantite: "5", unite: "tonnes" },
        { nom: "ciment", quantite: "2", unite: "palettes" }
      ],
      livraison: {
        date: "25/12/2024",  // Format correct
        heure: "14:00"       // Format correct
      },
      completude: 0.9,
      confirmation: true
    }
  },
  {
    name: "Cas 2: Date et heure manquantes",
    data: {
      chantier: "Chantier ABC",
      materiaux: [
        { nom: "gravier", quantite: "15", unite: "m3" }
      ],
      livraison: {
        date: null,
        heure: null
      },
      completude: 0.5,
      confirmation: false
    }
  },
  {
    name: "Cas 3: Chantier manquant",
    data: {
      chantier: null,
      materiaux: [
        { nom: "béton", quantite: "10", unite: "m3" }
      ],
      livraison: {
        date: "26/12/2024",
        heure: "10:00"
      },
      completude: 0.6,
      confirmation: false
    }
  },
  {
    name: "Cas 4: Matériaux vides",
    data: {
      chantier: "Projet X",
      materiaux: [],
      livraison: {
        date: "27/12/2024",
        heure: "09:00"
      },
      completude: 0.3,
      confirmation: false
    }
  },
  {
    name: "Cas 5: Commande parfaite",
    data: {
      chantier: "Construction Nouvelle",
      materiaux: [
        { nom: "béton C25/30", quantite: "50", unite: "m3" },
        { nom: "acier HA12", quantite: "2000", unite: "kg" },
        { nom: "parpaing 20x20x50", quantite: "500", unite: "unités" }
      ],
      livraison: {
        date: "28/12/2024",
        heure: "08:30"
      },
      completude: 1.0,
      confirmation: true
    }
  }
];

console.log('🔍 Test de conversion des données d\'extraction vers MultiMaterialOrder\n');
console.log('=' .repeat(70));

const supabaseService = new SupabaseService();
const phoneNumber = '+33612345678';

testCases.forEach((testCase, index) => {
  console.log(`\n📋 ${testCase.name}`);
  console.log('-'.repeat(50));
  
  const result = supabaseService.convertExtractionToMultiMaterialOrder(
    testCase.data,
    phoneNumber
  );
  
  if (result) {
    console.log('✅ Conversion réussie !');
    console.log('Données converties:');
    console.log('  - Chantier:', result.chantier);
    console.log('  - Matériaux:', result.materiaux.length, 'article(s)');
    result.materiaux.forEach(m => {
      console.log(`    • ${m.nom}: ${m.quantite} ${m.unite}`);
    });
    console.log('  - Date:', result.date_besoin);
    console.log('  - Heure:', result.heure_besoin);
    console.log('  - Statut:', result.statut);
    console.log('  - Complétude:', result.completude);
  } else {
    console.log('❌ Conversion échouée');
    console.log('Raisons possibles:');
    
    if (!testCase.data.chantier) {
      console.log('  ⚠️ Chantier manquant');
    }
    if (!testCase.data.livraison.date) {
      console.log('  ⚠️ Date de livraison manquante');
    }
    if (!testCase.data.livraison.heure) {
      console.log('  ⚠️ Heure de livraison manquante');
    }
    if (testCase.data.materiaux.length === 0) {
      console.log('  ⚠️ Aucun matériau');
    }
    if (testCase.data.materiaux.length > 0 && !testCase.data.materiaux.some(m => m.nom)) {
      console.log('  ⚠️ Aucun matériau avec nom valide');
    }
  }
});

console.log('\n' + '='.repeat(70));
console.log('✨ Tests terminés\n');

// Test de la nouvelle fonctionnalité de conversion de dates
console.log('\n📅 Test des conversions de dates relatives:');
console.log('-'.repeat(50));

// Importer la classe ExtractionAgent pour tester les nouvelles méthodes
const { ExtractionAgent } = require('./dist/services/extractionAgent');

// Cette partie ne fonctionnera que si on peut instancier ExtractionAgent
// sans API key (pour tester les méthodes utilitaires)
try {
  console.log('\nNote: Les tests de conversion de dates nécessitent une API key OpenAI.');
  console.log('Pour tester complètement, configurez votre fichier .env avec OPENAI_API_KEY');
} catch (error) {
  console.log('Impossible de tester les conversions de dates sans configuration OpenAI');
}

process.exit(0);