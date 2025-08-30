// Configuration Jest pour les tests
// Variables d'environnement pour les tests

process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-supabase-key';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent'; // Désactiver les logs pendant les tests