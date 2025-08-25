#!/usr/bin/env node

/**
 * Script de vérification de configuration pour Railway
 * Vérifie que toutes les variables d'environnement requises sont présentes
 */

console.log('🔍 Vérification de la configuration BrikStak...\n');

const requiredVars = [
  { name: 'OPENAI_API_KEY', pattern: /^sk-/ },
  { name: 'TWILIO_AUTH_TOKEN', pattern: /^[a-f0-9]{32}$/ },
  { name: 'NODE_ENV', expected: 'production' },
  { name: 'PORT', optional: true, note: 'Auto-défini par Railway' }
];

const optionalVars = [
  { name: 'OPENAI_MODEL', default: 'gpt-4o-mini' },
  { name: 'LOG_LEVEL', default: 'info' }
];

let hasErrors = false;

console.log('📋 Variables requises:');
requiredVars.forEach(({ name, pattern, expected, optional, note }) => {
  const value = process.env[name];
  
  if (!value && !optional) {
    console.log(`❌ ${name}: MANQUANT`);
    hasErrors = true;
  } else if (!value && optional) {
    console.log(`⚠️  ${name}: Non défini ${note ? `(${note})` : ''}`);
  } else if (expected && value !== expected) {
    console.log(`⚠️  ${name}: "${value}" (attendu: "${expected}")`);
  } else if (pattern && !pattern.test(value)) {
    console.log(`❌ ${name}: Format invalide`);
    hasErrors = true;
  } else {
    const displayValue = name.includes('KEY') || name.includes('TOKEN') 
      ? value.substring(0, 8) + '...' 
      : value;
    console.log(`✅ ${name}: ${displayValue}`);
  }
});

console.log('\n📋 Variables optionnelles:');
optionalVars.forEach(({ name, default: defaultVal }) => {
  const value = process.env[name] || defaultVal;
  console.log(`✅ ${name}: ${value}`);
});

console.log('\n🔗 URLs importantes:');
const appUrl = process.env.RAILWAY_STATIC_URL || 'https://votre-app.up.railway.app';
console.log(`📍 Health Check: ${appUrl}/health`);
console.log(`📍 Webhook URL: ${appUrl}/whatsapp`);

console.log('\n🧪 Tests recommandés:');
console.log(`curl ${appUrl}/health`);
console.log('Vérifier les logs Railway pour les erreurs');
console.log('Tester un message WhatsApp depuis le sandbox Twilio');

if (hasErrors) {
  console.log('\n❌ Configuration incomplète ! Corrigez les erreurs ci-dessus.');
  process.exit(1);
} else {
  console.log('\n✅ Configuration OK !');
}