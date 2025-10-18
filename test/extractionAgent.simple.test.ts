import { EXTRACTION_SYSTEM_INSTRUCTIONS } from '../src/services/extractionAgent';

describe('ExtractionAgent Configuration', () => {
  describe('system instructions', () => {
    it('should specify JSON-only output', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('UNIQUEMENT du JSON valide');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('aucun texte');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('Ne retourne QUE du JSON valide');
    });

    it('should support multi-materials', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('plusieurs matériaux');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('Array avec tous les matériaux');
    });

    it('should define completeness calculation', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('CALCUL DE COMPLÉTUDE');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('Score de 0.0 à 1.0');
    });

    it('should specify output format', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('FORMAT DE SORTIE JSON OBLIGATOIRE');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('chantier');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('materiaux');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('livraison');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('completude');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('confirmation');
    });

    it('should include validation rules', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('VALIDATION');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('JJ/MM/AAAA');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('HH:MM');
    });

    it('should define unit standardization', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('UNITÉS : Standardiser');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('m3, kg, m2');
    });

    it('should specify strict rules', () => {
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('RÈGLES STRICTES');
      expect(EXTRACTION_SYSTEM_INSTRUCTIONS).toContain('ne communiques jamais avec l\'utilisateur');
    });
  });
});