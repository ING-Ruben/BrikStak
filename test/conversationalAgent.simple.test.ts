import { CONVERSATIONAL_SYSTEM_INSTRUCTIONS } from '../src/services/conversationalAgent';

describe('ConversationalAgent Configuration', () => {
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

    it('should define the agent role clearly', () => {
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('TON RÔLE');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('TES RESPONSABILITÉS');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('CE QUE TU NE FAIS PAS');
    });

    it('should include emoji guidelines', () => {
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('🏗️');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('📦');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('⏰');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('✅');
    });

    it('should specify confirmation process', () => {
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('Pour confirmer, réponds juste \'ok\'');
      expect(CONVERSATIONAL_SYSTEM_INSTRUCTIONS).toContain('récapitulatif');
    });
  });
});