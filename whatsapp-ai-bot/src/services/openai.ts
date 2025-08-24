import OpenAI from 'openai';
import pino from 'pino';
import { Message } from './session';

const logger = pino({ name: 'openai-service' });

// Instructions système par défaut (facilement modifiable)
export const DEFAULT_SYSTEM_INSTRUCTIONS = `Tu es un assistant WhatsApp concis et utile. Réponds en français clair, avec des messages courts adaptés à WhatsApp. Si la question concerne des sujets sensibles, propose des ressources neutres. S'il y a ambiguïté, pose une question ciblée avant d'agir.`;

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