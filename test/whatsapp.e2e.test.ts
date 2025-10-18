import request from 'supertest';
import app from '../src/server';

// Mock du service OpenAI pour les tests
jest.mock('../src/services/openai', () => ({
  openAIService: {
    askOpenAI: jest.fn().mockResolvedValue('Bonjour ! Comment puis-je vous aider ?')
  },
  DEFAULT_SYSTEM_INSTRUCTIONS: 'Test instructions'
}));

describe('WhatsApp Webhook E2E Tests', () => {
  const mockTwilioRequest = {
    Body: 'hello',
    From: 'whatsapp:+1234567890'
  };

  beforeAll(() => {
    // S'assurer qu'on est en mode test pour désactiver la validation Twilio
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    // Nettoyer les mocks entre les tests
    jest.clearAllMocks();
  });

  describe('POST /whatsapp', () => {
    it('should respond with TwiML for a valid message', async () => {
      const response = await request(app)
        .post('/whatsapp')
        .type('form')
        .send(mockTwilioRequest)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/xml');
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Message>');
      expect(response.text).toContain('Bonjour ! Comment puis-je vous aider ?');
    });

    it('should handle /help command', async () => {
      const response = await request(app)
        .post('/whatsapp')
        .type('form')
        .send({
          ...mockTwilioRequest,
          Body: '/help'
        })
        .expect(200);

      expect(response.text).toContain('Assistant WhatsApp AI');
      expect(response.text).toContain('/reset');
      expect(response.text).toContain('/help');
    });

    it('should handle /reset command', async () => {
      const response = await request(app)
        .post('/whatsapp')
        .type('form')
        .send({
          ...mockTwilioRequest,
          Body: '/reset'
        })
        .expect(200);

      expect(response.text).toContain('Historique de conversation effacé');
    });

    it('should return 400 for missing Body parameter', async () => {
      const response = await request(app)
        .post('/whatsapp')
        .type('form')
        .send({
          From: 'whatsapp:+1234567890'
        })
        .expect(400);

      expect(response.text).toContain('Missing required parameters');
    });

    it('should return 400 for missing From parameter', async () => {
      const response = await request(app)
        .post('/whatsapp')
        .type('form')
        .send({
          Body: 'hello'
        })
        .expect(400);

      expect(response.text).toContain('Missing required parameters');
    });

    it('should handle OpenAI service errors gracefully', async () => {
      // Mock d'une erreur OpenAI
      const { openAIService } = require('../src/services/openai');
      openAIService.askOpenAI.mockRejectedValueOnce(new Error('OpenAI API Error'));

      const response = await request(app)
        .post('/whatsapp')
        .type('form')
        .send(mockTwilioRequest)
        .expect(200);

      expect(response.text).toContain('difficultés techniques');
    });

    it('should handle long messages by chunking them', async () => {
      // Mock d'une réponse très longue
      const longResponse = 'Lorem ipsum '.repeat(500); // > 3500 caractères
      const { openAIService } = require('../src/services/openai');
      openAIService.askOpenAI.mockResolvedValueOnce(longResponse);

      const response = await request(app)
        .post('/whatsapp')
        .type('form')
        .send(mockTwilioRequest)
        .expect(200);

      // Vérifier qu'il y a plusieurs messages dans la réponse TwiML
      const messageCount = (response.text.match(/<Message>/g) || []).length;
      expect(messageCount).toBeGreaterThan(1);
    });

    it('should maintain conversation history', async () => {
      const { openAIService } = require('../src/services/openai');
      
      // Premier message
      await request(app)
        .post('/whatsapp')
        .type('form')
        .send({
          ...mockTwilioRequest,
          Body: 'Premier message'
        })
        .expect(200);

      // Deuxième message - vérifier que l'historique est passé
      await request(app)
        .post('/whatsapp')
        .type('form')
        .send({
          ...mockTwilioRequest,
          Body: 'Deuxième message'
        })
        .expect(200);

      // Vérifier que askOpenAI a été appelé avec l'historique
      const lastCall = openAIService.askOpenAI.mock.calls[openAIService.askOpenAI.mock.calls.length - 1];
      const history = lastCall[2]; // Troisième paramètre
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('404 Routes', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });
});