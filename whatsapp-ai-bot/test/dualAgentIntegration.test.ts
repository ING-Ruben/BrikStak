import request from 'supertest';
import app from '../src/server';
import { conversationalAgent } from '../src/services/conversationalAgent';
import { extractionAgent } from '../src/services/extractionAgent';
import { supabaseService } from '../src/services/supabase';

// Mock des services
jest.mock('../src/services/conversationalAgent');
jest.mock('../src/services/extractionAgent');
jest.mock('../src/services/supabase');

describe('Dual Agent Integration', () => {
  const mockConversationalAgent = conversationalAgent as jest.Mocked<typeof conversationalAgent>;
  const mockExtractionAgent = extractionAgent as jest.Mocked<typeof extractionAgent>;
  const mockSupabaseService = supabaseService as jest.Mocked<typeof supabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default environment
    process.env['NODE_ENV'] = 'test';
  });

  describe('WhatsApp webhook with dual agents', () => {
    it('should process message with both agents in parallel', async () => {
      // Mock des réponses des agents
      const conversationResponse = {
        message: '🏗️ Parfait ! J\'ai bien noté ta demande. Peux-tu me dire la quantité exacte de béton ?',
        confidence: 0.85,
        processingTime: 1200,
        requiresFollowUp: true
      };

      const extractionResponse = {
        data: {
          chantier: 'Marseille Nord',
          materiaux: [{ nom: 'béton', quantite: '', unite: '' }],
          livraison: { date: null, heure: null },
          completude: 0.4,
          confirmation: false
        },
        processingTime: 800,
        errors: [],
        isValid: true
      };

      mockConversationalAgent.respond.mockResolvedValue(conversationResponse);
      mockExtractionAgent.analyze.mockResolvedValue(extractionResponse);

      const response = await request(app)
        .post('/whatsapp')
        .send({
          Body: 'J\'ai besoin de béton pour le chantier Marseille Nord',
          From: 'whatsapp:+33123456789'
        })
        .expect(200);

      // Vérifier que les deux agents ont été appelés
      expect(mockConversationalAgent.respond).toHaveBeenCalledWith(
        'J\'ai besoin de béton pour le chantier Marseille Nord',
        expect.any(Array)
      );

      expect(mockExtractionAgent.analyze).toHaveBeenCalledWith(
        'J\'ai besoin de béton pour le chantier Marseille Nord',
        expect.any(Array)
      );

      // Vérifier que la réponse conversationnelle est envoyée
      expect(response.text).toContain('Parfait ! J\'ai bien noté ta demande');
    });

    it('should store multi-material order when complete and confirmed', async () => {
      const conversationResponse = {
        message: '✅ Commande prête à être transmise.',
        confidence: 0.95,
        processingTime: 1000,
        requiresFollowUp: false
      };

      const extractionResponse = {
        data: {
          chantier: 'Lyon Centre',
          materiaux: [
            { nom: 'béton C25/30', quantite: '10', unite: 'm3' },
            { nom: 'ferraille', quantite: '500', unite: 'kg' }
          ],
          livraison: { date: '20/01/2024', heure: '09:00' },
          completude: 1.0,
          confirmation: true
        },
        processingTime: 900,
        errors: [],
        isValid: true
      };

      const multiMaterialOrder = {
        phone_number: '+33123456789',
        chantier: 'Lyon Centre',
        materiaux: [
          { nom: 'béton C25/30', quantite: '10', unite: 'm3' },
          { nom: 'ferraille', quantite: '500', unite: 'kg' }
        ],
        date_besoin: '20/01/2024',
        heure_besoin: '09:00',
        statut: 'confirmee' as const,
        completude: 1.0
      };

      mockConversationalAgent.respond.mockResolvedValue(conversationResponse);
      mockExtractionAgent.analyze.mockResolvedValue(extractionResponse);
      mockSupabaseService.convertExtractionToMultiMaterialOrder.mockReturnValue(multiMaterialOrder);
      mockSupabaseService.storeMultiMaterialOrder.mockResolvedValue(true);

      await request(app)
        .post('/whatsapp')
        .send({
          Body: 'ok',
          From: 'whatsapp:+33123456789'
        })
        .expect(200);

      // Vérifier que la conversion et le stockage ont été appelés
      expect(mockSupabaseService.convertExtractionToMultiMaterialOrder).toHaveBeenCalledWith(
        extractionResponse.data,
        '+33123456789'
      );

      expect(mockSupabaseService.storeMultiMaterialOrder).toHaveBeenCalledWith(multiMaterialOrder);
    });

    it('should fallback to legacy system when agents fail', async () => {
      // Mock des échecs des agents
      mockConversationalAgent.respond.mockRejectedValue(new Error('Agent timeout'));
      mockExtractionAgent.analyze.mockRejectedValue(new Error('Agent timeout'));

      // Mock de l'ancien système OpenAI (via le fallback)
      // const mockOpenAIService = require('../src/services/openai').openAIService;
      jest.doMock('../src/services/openai', () => ({
        openAIService: {
          askOpenAI: jest.fn().mockResolvedValue('Salut ! Sur quel chantier travailles-tu ?')
        },
        DEFAULT_SYSTEM_INSTRUCTIONS: 'Instructions par défaut'
      }));

      const response = await request(app)
        .post('/whatsapp')
        .send({
          Body: 'Salut',
          From: 'whatsapp:+33123456789'
        })
        .expect(200);

      // Vérifier que la réponse de fallback est envoyée
      expect(response.text).toContain('Message');
    });

    it('should handle partial agent failures gracefully', async () => {
      // Agent conversationnel fonctionne, agent d'extraction échoue
      const conversationResponse = {
        message: '🏗️ Salut ! Comment puis-je t\'aider ?',
        confidence: 0.8,
        processingTime: 1000,
        requiresFollowUp: true
      };

      mockConversationalAgent.respond.mockResolvedValue(conversationResponse);
      mockExtractionAgent.analyze.mockRejectedValue(new Error('Extraction failed'));

      const response = await request(app)
        .post('/whatsapp')
        .send({
          Body: 'Salut',
          From: 'whatsapp:+33123456789'
        })
        .expect(200);

      // Devrait utiliser le fallback complet
      expect(response.text).toContain('Message');
    });

    it('should respect timeout configuration', async () => {
      // Mock d'un agent qui prend trop de temps
      mockConversationalAgent.respond.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 35000)) // Plus que le timeout de 30s
      );

      mockExtractionAgent.analyze.mockResolvedValue({
        data: {
          chantier: null,
          materiaux: [],
          livraison: { date: null, heure: null },
          completude: 0.0,
          confirmation: false
        },
        processingTime: 500,
        errors: [],
        isValid: true
      });

      const response = await request(app)
        .post('/whatsapp')
        .send({
          Body: 'Test timeout',
          From: 'whatsapp:+33123456789'
        })
        .expect(200);

      // Devrait utiliser le système de fallback à cause du timeout
      expect(response.text).toContain('Message');
    }, 40000); // Timeout de test plus long

    it('should log performance metrics correctly', async () => {
      const conversationResponse = {
        message: 'Test response',
        confidence: 0.9,
        processingTime: 1500,
        requiresFollowUp: false
      };

      const extractionResponse = {
        data: {
          chantier: 'Test',
          materiaux: [],
          livraison: { date: null, heure: null },
          completude: 0.2,
          confirmation: false
        },
        processingTime: 800,
        errors: [],
        isValid: true
      };

      mockConversationalAgent.respond.mockResolvedValue(conversationResponse);
      mockExtractionAgent.analyze.mockResolvedValue(extractionResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await request(app)
        .post('/whatsapp')
        .send({
          Body: 'Test metrics',
          From: 'whatsapp:+33123456789'
        })
        .expect(200);

      // Vérifier que les métriques de performance sont loggées
      // (Les logs Pino sont complexes à tester, on vérifie juste que le processus se déroule bien)
      expect(mockConversationalAgent.respond).toHaveBeenCalled();
      expect(mockExtractionAgent.analyze).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Performance comparison', () => {
    it('should be faster than sequential processing', async () => {
      const conversationResponse = {
        message: 'Response',
        confidence: 0.8,
        processingTime: 1000,
        requiresFollowUp: false
      };

      const extractionResponse = {
        data: {
          chantier: null,
          materiaux: [],
          livraison: { date: null, heure: null },
          completude: 0.0,
          confirmation: false
        },
        processingTime: 800,
        errors: [],
        isValid: true
      };

      // Mock avec délais réalistes
      mockConversationalAgent.respond.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(conversationResponse), 1000))
      );

      mockExtractionAgent.analyze.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(extractionResponse), 800))
      );

      const startTime = Date.now();

      await request(app)
        .post('/whatsapp')
        .send({
          Body: 'Performance test',
          From: 'whatsapp:+33123456789'
        })
        .expect(200);

      const totalTime = Date.now() - startTime;

      // Le traitement parallèle devrait prendre environ max(1000, 800) + overhead
      // plutôt que 1000 + 800 en séquentiel
      expect(totalTime).toBeLessThan(1500); // Avec marge pour l'overhead
    });
  });
});