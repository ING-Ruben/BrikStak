import { ExtractionAgent, EXTRACTION_SYSTEM_INSTRUCTIONS } from '../src/services/extractionAgent';
// import { Message } from '../src/services/session';

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

describe('ExtractionAgent', () => {
  let agent: ExtractionAgent;
  let mockOpenAIResponse: jest.Mock;

  beforeEach(() => {
    // Setup environment
    process.env['OPENAI_API_KEY'] = 'test-api-key';
    
    agent = new ExtractionAgent();
    
    // Mock OpenAI response
    const OpenAI = require('openai').default;
    const mockClient = new OpenAI();
    mockOpenAIResponse = mockClient.responses.create;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze', () => {
    it('should extract single material order correctly', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: JSON.stringify({
          chantier: "Marseille Nord",
          materiaux: [
            {
              nom: "béton C25/30",
              quantite: "10",
              unite: "m3"
            }
          ],
          livraison: {
            date: "15/01/2024",
            heure: "14:30"
          },
          completude: 1.0,
          confirmation: true
        })
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.analyze('ok', [
        { role: 'user', content: 'J\'ai besoin de 10m³ de béton C25/30 pour le chantier Marseille Nord le 15/01/2024 à 14h30' },
        { role: 'assistant', content: 'Récapitulatif confirmé' }
      ]);

      expect(result.isValid).toBe(true);
      expect(result.data.chantier).toBe("Marseille Nord");
      expect(result.data.materiaux).toHaveLength(1);
      expect(result.data.materiaux[0]?.nom).toBe("béton C25/30");
      expect(result.data.materiaux[0]?.quantite).toBe("10");
      expect(result.data.materiaux[0]?.unite).toBe("m3");
      expect(result.data.livraison.date).toBe("15/01/2024");
      expect(result.data.livraison.heure).toBe("14:30");
      expect(result.data.completude).toBe(1.0);
      expect(result.data.confirmation).toBe(true);
    });

    it('should extract multi-material order correctly', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: JSON.stringify({
          chantier: "Lyon Centre",
          materiaux: [
            {
              nom: "béton",
              quantite: "5",
              unite: "m3"
            },
            {
              nom: "ferraille",
              quantite: "500",
              unite: "kg"
            },
            {
              nom: "sable",
              quantite: "2",
              unite: "tonnes"
            }
          ],
          livraison: {
            date: "20/01/2024",
            heure: "09:00"
          },
          completude: 1.0,
          confirmation: false
        })
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.analyze('J\'ai besoin de béton, ferraille et sable');

      expect(result.isValid).toBe(true);
      expect(result.data.materiaux).toHaveLength(3);
      expect(result.data.materiaux[0]?.nom).toBe("béton");
      expect(result.data.materiaux[1]?.nom).toBe("ferraille");
      expect(result.data.materiaux[2]?.nom).toBe("sable");
      expect(result.data.confirmation).toBe(false);
    });

    it('should handle incomplete data correctly', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: JSON.stringify({
          chantier: "Toulouse",
          materiaux: [
            {
              nom: "béton",
              quantite: "",
              unite: ""
            }
          ],
          livraison: {
            date: null,
            heure: null
          },
          completude: 0.4,
          confirmation: false
        })
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.analyze('J\'ai besoin de béton pour Toulouse');

      expect(result.isValid).toBe(true);
      expect(result.data.completude).toBe(0.4);
      expect(result.data.materiaux[0]?.quantite).toBe("");
      expect(result.data.livraison.date).toBeNull();
    });

    it('should validate date formats', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: JSON.stringify({
          chantier: "Test",
          materiaux: [{ nom: "béton", quantite: "10", unite: "m3" }],
          livraison: {
            date: "invalid-date",
            heure: "14:30"
          },
          completude: 0.8,
          confirmation: false
        })
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.analyze('Test message');

      expect(result.errors).toContain('Format de date invalide: invalid-date');
      expect(result.data.livraison.date).toBeNull();
    });

    it('should validate time formats', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: JSON.stringify({
          chantier: "Test",
          materiaux: [{ nom: "béton", quantite: "10", unite: "m3" }],
          livraison: {
            date: "15/01/2024",
            heure: "25:70"
          },
          completude: 0.8,
          confirmation: false
        })
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.analyze('Test message');

      expect(result.errors).toContain('Format d\'heure invalide: 25:70');
      expect(result.data.livraison.heure).toBeNull();
    });

    it('should standardize units', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: JSON.stringify({
          chantier: "Test",
          materiaux: [
            { nom: "béton", quantite: "10", unite: "m³" },
            { nom: "sable", quantite: "1", unite: "tonne" }
          ],
          livraison: { date: "15/01/2024", heure: "14:30" },
          completude: 1.0,
          confirmation: false
        })
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.analyze('Test message');

      expect(result.data.materiaux[0]?.unite).toBe("m3");
      expect(result.data.materiaux[1]?.unite).toBe("tonnes");
    });

    it('should handle malformed JSON gracefully', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: '{ invalid json'
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.analyze('Test message');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Réponse de l\'agent d\'extraction invalide (JSON malformé)');
      expect(result.data.completude).toBe(0.0);
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAIResponse.mockRejectedValue(new Error('API Error'));

      const result = await agent.analyze('Test message');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Erreur technique lors de l\'extraction des données');
    });

    it('should calculate completeness automatically', async () => {
      const mockResponse = {
        id: 'test-id',
        output_text: JSON.stringify({
          chantier: "Test Chantier",
          materiaux: [
            { nom: "béton", quantite: "10", unite: "m3" }
          ],
          livraison: {
            date: "15/01/2024",
            heure: "14:30"
          },
          completude: 999, // Invalid value, should be recalculated
          confirmation: false
        })
      };
      
      mockOpenAIResponse.mockResolvedValue(mockResponse);

      const result = await agent.analyze('Test message');

      // Should be 1.0: chantier(0.2) + matériau(0.2) + quantité(0.2) + unité(0.2) + date(0.1) + heure(0.1)
      expect(result.data.completude).toBe(1.0);
    });
  });

  describe('system instructions', () => {
    it('should specify JSON-only output', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('UNIQUEMENT du JSON valide');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('aucun texte');
    });

    it('should support multi-materials', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('plusieurs matériaux');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('Array avec tous les matériaux');
    });

    it('should define completeness calculation', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('CALCUL DE COMPLÉTUDE');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('Score de 0.0 à 1.0');
    });
  });
});