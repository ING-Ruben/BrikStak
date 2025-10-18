import { ConversationalAgent, CONVERSATIONAL_SYSTEM_INSTRUCTIONS } from '../src/services/conversationalAgent';
import { Message } from '../src/services/session';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      responses: {
        create: jest.fn()
      }
    }))
  };
});

describe('ConversationalAgent', () => {
  let agent: ConversationalAgent;
  let mockOpenAIResponse: jest.Mock;

  beforeEach(() => {
    // Setup environment
    process.env['OPENAI_API_KEY'] = 'test-api-key';
    
    // Mock OpenAI response
    const OpenAI = require('openai').default;
    const mockClient = new OpenAI();
    mockOpenAIResponse = mockClient.responses.create;
    
    agent = new ConversationalAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('respond', () => {
    it('should generate a conversational response', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: '🏗️ Salut ! Je suis Bruno, ton assistant chantier. Sur quel chantier travailles-tu aujourd\'hui ?'
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.respond('Salut, j\'ai besoin de matériaux');

      expect(result).toEqual({
        message: mockResponse.output_text,
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        requiresFollowUp: true
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle conversation history', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: 'Parfait ! Combien de m³ de béton as-tu besoin ?'
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const history: Message[] = [
        { role: 'user', content: 'J\'ai besoin de béton' },
        { role: 'assistant', content: 'Sur quel chantier ?' },
        { role: 'user', content: 'Chantier Marseille' }
      ];

      const result = await agent.respond('J\'ai besoin de béton', history);

      expect(mockOpenAIResponse).toHaveBeenCalledWith({
        model: expect.any(String),
        instructions: CONVERSATIONAL_SYSTEM_INSTRUCTIONS,
        input: expect.stringContaining('Historique de la conversation')
      });

      expect(result.requiresFollowUp).toBe(true);
    });

    it('should detect confirmation requests', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: `Récapitulatif :
- Chantier : Marseille
- Béton C25/30
- Quantité : 10 m³
- Besoin pour 15/01/2024 à 14:30

Pour confirmer cette commande, réponds simplement "ok"`
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.respond('Oui c\'est correct');

      expect(result.requiresFollowUp).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect completion messages', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: '✅ Commande prête à être transmise.'
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.respond('ok');

      expect(result.requiresFollowUp).toBe(false);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAIResponse.mockRejectedValue(new Error('API Error'));

      const result = await agent.respond('Test message');

      expect(result.message).toContain('problème technique');
      expect(result.confidence).toBe(0.1);
      expect(result.requiresFollowUp).toBe(true);
    });

    it('should calculate confidence based on response quality', async () => {
      // Test high confidence response
      const highQualityResponse = {
        id: 'test-id',
        output_text: '🏗️ Récapitulatif parfait ! Pour confirmer, réponds "ok" 😊'
      };
      
      mockOpenAIResponse.mockResolvedValue(highQualityResponse);
      const highResult = await agent.respond('Test');
      
      // Test low confidence response  
      const lowQualityResponse = {
        id: 'test-id',
        output_text: 'Je ne peux pas traiter cette demande car elle est trop complexe et je suis désolé mais le système ne fonctionne pas correctement en ce moment et il faudrait que vous retentiez plus tard'
      };
      
      mockOpenAIResponse.mockResolvedValue(lowQualityResponse);
      const lowResult = await agent.respond('Test');

      expect(highResult.confidence).toBeGreaterThan(lowResult.confidence);
    });
  });

  describe('system instructions', () => {
    it('should use conversational system instructions', () => {
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('Bruno');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('communication naturelle');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('emojis');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('UNE question à la fois');
    });

    it('should specify what the agent should NOT do', () => {
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('ne t\'occupes PAS d\'extraire');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('ne fais PAS de parsing');
    });
  });
});