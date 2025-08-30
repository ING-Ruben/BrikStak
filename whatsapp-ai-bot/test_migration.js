#!/usr/bin/env node

/**
 * Script de test pour valider la migration vers l'architecture 2 agents parallèles
 * Usage: node test_migration.js [--endpoint=URL] [--phone=NUMBER]
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  endpoint: process.argv.find(arg => arg.startsWith('--endpoint='))?.split('=')[1] || 'http://localhost:3000',
  phone: process.argv.find(arg => arg.startsWith('--phone='))?.split('=')[1] || '+33123456789',
  timeout: 30000
};

// Couleurs pour les logs
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Tests à exécuter
const tests = [
  {
    name: 'Test 1: Commande Simple',
    message: 'J\'ai besoin de 10m³ de béton pour le chantier Marseille le 15/01/2024 à 14h30',
    expectations: {
      responseTime: 5000,
      shouldContain: ['marseille', 'béton', '10'],
      shouldNotContain: ['erreur', 'problème technique']
    }
  },
  {
    name: 'Test 2: Commande Multi-Matériaux',
    message: 'Pour Lyon, j\'ai besoin de 5m³ de béton, 500kg de ferraille et 2 tonnes de sable pour le 20/01/2024 à 9h',
    expectations: {
      responseTime: 5000,
      shouldContain: ['lyon', 'béton', 'ferraille', 'sable'],
      shouldNotContain: ['erreur']
    }
  },
  {
    name: 'Test 3: Demande Incomplète',
    message: 'J\'ai besoin de béton',
    expectations: {
      responseTime: 3000,
      shouldContain: ['chantier', '?'],
      shouldNotContain: ['erreur']
    }
  },
  {
    name: 'Test 4: Salutation',
    message: 'Salut',
    expectations: {
      responseTime: 3000,
      shouldContain: ['bruno', 'salut', 'bonjour'],
      shouldNotContain: ['erreur']
    }
  },
  {
    name: 'Test 5: Commande Complexe',
    message: 'Chantier Toulouse, besoin urgent de 15m³ béton C30/37, 1 tonne ferraille HA12, 50 sacs ciment Portland pour demain 8h précises',
    expectations: {
      responseTime: 6000,
      shouldContain: ['toulouse', 'béton', 'ferraille', 'ciment'],
      shouldNotContain: ['erreur']
    }
  },
  {
    name: 'Test 6: Reset Session',
    message: '/reset',
    expectations: {
      responseTime: 2000,
      shouldContain: ['historique', 'effacé', 'nouvelle'],
      shouldNotContain: ['erreur']
    }
  },
  {
    name: 'Test 7: Aide',
    message: '/help',
    expectations: {
      responseTime: 2000,
      shouldContain: ['commandes', 'aide', 'assistant'],
      shouldNotContain: ['erreur']
    }
  }
];

// Fonction pour envoyer un message
async function sendMessage(message, testName) {
  const startTime = performance.now();
  
  try {
    const response = await axios.post(`${config.endpoint}/whatsapp`, {
      Body: message,
      From: `whatsapp:${config.phone}`
    }, {
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    return {
      success: true,
      responseTime,
      data: response.data,
      status: response.status
    };

  } catch (error) {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    return {
      success: false,
      responseTime,
      error: error.message,
      status: error.response?.status
    };
  }
}

// Fonction pour valider une réponse
function validateResponse(result, expectations, testName) {
  const issues = [];
  
  // Vérifier le temps de réponse
  if (result.responseTime > expectations.responseTime) {
    issues.push(`Temps de réponse trop lent: ${result.responseTime}ms > ${expectations.responseTime}ms`);
  }
  
  if (!result.success) {
    issues.push(`Requête échouée: ${result.error}`);
    return { passed: false, issues };
  }

  const responseText = result.data.toLowerCase();
  
  // Vérifier le contenu attendu
  for (const term of expectations.shouldContain) {
    if (!responseText.includes(term.toLowerCase())) {
      issues.push(`Terme manquant: "${term}"`);
    }
  }
  
  // Vérifier le contenu non souhaité
  for (const term of expectations.shouldNotContain) {
    if (responseText.includes(term.toLowerCase())) {
      issues.push(`Terme indésirable trouvé: "${term}"`);
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

// Fonction principale de test
async function runTests() {
  log('\n🚀 DÉBUT DES TESTS DE MIGRATION - ARCHITECTURE 2 AGENTS PARALLÈLES', 'bold');
  log(`📍 Endpoint: ${config.endpoint}`, 'blue');
  log(`📱 Téléphone: ${config.phone}`, 'blue');
  log('=' * 80, 'blue');

  const results = {
    total: tests.length,
    passed: 0,
    failed: 0,
    totalTime: 0,
    details: []
  };

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    log(`\n[${i + 1}/${tests.length}] ${test.name}`, 'yellow');
    log(`💬 Message: "${test.message}"`, 'blue');
    
    const result = await sendMessage(test.message, test.name);
    const validation = validateResponse(result, test.expectations, test.name);
    
    results.totalTime += result.responseTime;
    
    if (validation.passed) {
      log(`✅ SUCCÈS (${result.responseTime}ms)`, 'green');
      results.passed++;
    } else {
      log(`❌ ÉCHEC (${result.responseTime}ms)`, 'red');
      results.failed++;
      
      for (const issue of validation.issues) {
        log(`   • ${issue}`, 'red');
      }
    }
    
    results.details.push({
      name: test.name,
      passed: validation.passed,
      responseTime: result.responseTime,
      issues: validation.issues
    });
    
    // Petite pause entre les tests
    if (i < tests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Résumé final
  log('\n' + '=' * 80, 'blue');
  log('📊 RÉSUMÉ DES TESTS', 'bold');
  log('=' * 80, 'blue');
  
  log(`✅ Tests réussis: ${results.passed}/${results.total}`, 'green');
  log(`❌ Tests échoués: ${results.failed}/${results.total}`, results.failed > 0 ? 'red' : 'green');
  log(`⏱️  Temps total: ${results.totalTime}ms`, 'blue');
  log(`⚡ Temps moyen: ${Math.round(results.totalTime / results.total)}ms`, 'blue');
  
  // Détails des échecs
  if (results.failed > 0) {
    log('\n🔍 DÉTAILS DES ÉCHECS:', 'red');
    for (const detail of results.details) {
      if (!detail.passed) {
        log(`\n❌ ${detail.name} (${detail.responseTime}ms):`, 'red');
        for (const issue of detail.issues) {
          log(`   • ${issue}`, 'red');
        }
      }
    }
  }

  // Recommandations
  log('\n💡 RECOMMANDATIONS:', 'yellow');
  
  const avgResponseTime = results.totalTime / results.total;
  if (avgResponseTime > 4000) {
    log('⚠️  Temps de réponse moyen élevé - vérifier les performances', 'yellow');
  } else if (avgResponseTime < 2000) {
    log('🚀 Excellentes performances de réponse!', 'green');
  }
  
  const successRate = (results.passed / results.total) * 100;
  if (successRate < 80) {
    log('🚨 Taux de succès faible - migration à risque', 'red');
  } else if (successRate >= 95) {
    log('🎉 Taux de succès excellent - migration recommandée!', 'green');
  } else {
    log('✅ Taux de succès acceptable - migration possible avec surveillance', 'yellow');
  }

  // Code de sortie
  process.exit(results.failed > 0 ? 1 : 0);
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
  log(`❌ Erreur non gérée: ${error.message}`, 'red');
  process.exit(1);
});

process.on('SIGINT', () => {
  log('\n⏹️  Tests interrompus par l\'utilisateur', 'yellow');
  process.exit(1);
});

// Lancement des tests
if (require.main === module) {
  runTests().catch(error => {
    log(`❌ Erreur lors de l'exécution des tests: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runTests, sendMessage, validateResponse };