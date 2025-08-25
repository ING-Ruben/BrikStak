import OpenAI from 'openai';
import pino from 'pino';
import { Message } from './session';

const logger = pino({ name: 'openai-service' });

// Instructions système par défaut (facilement modifiable)
export const DEFAULT_SYSTEM_INSTRUCTIONS = `Tu es Bruno, assistant chantier. Ta mission est de réceptionner et structurer les commandes de matériaux des ouvriers — et uniquement cela.

Pour chaque commande, tu dois absolument obtenir 3 informations :
1) Nom du chantier
2) Quantité précise + unité (m³, kg, m², etc.)
3) Date et heure auxquelles le matériau est nécessaire

Méthode :
- Tant qu’il manque une de ces informations ou qu’elle est ambiguë, pose des questions courtes et ciblées, une à la fois, jusqu’à les avoir toutes.
- Utilise un ton simple, direct, en tutoyant.
- Reste strictement dans ce périmètre. Si l’utilisateur parle d’autre chose, réponds : « Je suis là uniquement pour t’aider sur la commande de matériaux » et redirige vers les informations manquantes.

Validation de fin :
- Quand tu as les 3 informations, récapitule et demande confirmation :

Récapitulatif :
- Chantier :
- (Matériau tel que demandé par l’ouvrier)
- Quantité + unité :
- Besoin pour (date/heure) :

« Peux-tu confirmer ce récapitulatif ? »
- Si c’est confirmé : « Commande prête à être transmise. »
- Sinon : demande les corrections nécessaires.

Règles de clarification :
- Si l’unité est absente/inadaptée, demande l’unité attendue.
- Si la date/heure est vague (« rapidement », « demain »), demande une date JJ/MM/AAAA et une heure HH:MM.
- Si la quantité est floue (« un camion », « quelques sacs »), demande une valeur chiffrée.
`;

export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey
    });

    this.model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
    logger.info({ model: this.model }, 'OpenAI service initialized');
  }

  /**
   * Construit le prompt d'input basé sur l'historique et le message courant
   */
  private buildInputFromHistory(userText: string, history: Message[]): string {
    let input = '';
    
    // Ajouter l'historique si présent
    if (history.length > 0) {
      input += 'Historique de la conversation :\n';
      for (const msg of history) {
        const role = msg.role === 'user' ? 'Utilisateur' : 'Assistant';
        input += `${role}: ${msg.content}\n`;
      }
      input += '\n';
    }
    
    input += `Message actuel de l'utilisateur: ${userText}`;
    return input;
  }

  /**
   * Appelle l'API OpenAI Responses pour obtenir une réponse
   */
  async askOpenAI(
    userText: string, 
    systemInstructions: string = DEFAULT_SYSTEM_INSTRUCTIONS,
    history: Message[] = []
  ): Promise<string> {
    try {
      const input = this.buildInputFromHistory(userText, history);
      
      logger.info(
        { 
          model: this.model,
          inputLength: input.length,
          historyLength: history.length 
        }, 
        'Calling OpenAI Responses API'
      );

      const response = await this.client.responses.create({
        model: this.model,
        instructions: systemInstructions,
        input: input
      });

      const responseText = response.output_text;
      
      logger.info(
        { 
          responseLength: responseText.length,
          requestId: response.id || 'unknown'
        }, 
        'OpenAI response received'
      );

      return responseText;

    } catch (error) {
      logger.error(
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          model: this.model
        }, 
        'Error calling OpenAI API'
      );
      
      throw error;
    }
  }
}

// Instance singleton
export const openAIService = new OpenAIService();
