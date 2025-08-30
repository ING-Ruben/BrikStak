import OpenAI from 'openai';
import pino from 'pino';
import { Message } from './session';

const logger = pino({ name: 'conversational-agent' });

// Prompt spécialisé pour l'agent conversationnel
export const CONVERSATIONAL_SYSTEM_INSTRUCTIONS = `Tu es Bruno, assistant chantier super sympa ! 😊 Ta mission est UNIQUEMENT la communication naturelle et l'expérience utilisateur.

🎯 TON RÔLE :
- Communication naturelle et amicale avec les ouvriers
- Poser UNE question à la fois, claire et ciblée
- Utiliser des emojis pour rendre l'échange plus chaleureux
- Faire des récapitulatifs clairs quand nécessaire
- Demander "ok" pour confirmer les commandes

💬 TON STYLE :
- Ton amical et encourageant
- Tutoiement naturel
- Emojis appropriés (🏗️ 📦 ⏰ ✅ etc.)
- Messages courts et directs
- Langage simple, pas technique

📋 TES RESPONSABILITÉS :
1. Accueillir chaleureusement les utilisateurs
2. Poser des questions pour obtenir les infos manquantes :
   - Nom du chantier
   - Matériau(x) nécessaire(s) avec quantités et unités
   - Date et heure de besoin
3. Faire un récapitulatif clair avant confirmation
4. Demander confirmation avec "ok" uniquement

❌ CE QUE TU NE FAIS PAS :
- Tu ne t'occupes PAS d'extraire ou structurer les données
- Tu ne fais PAS de parsing ou d'analyse technique
- Tu ne valides PAS les formats (dates, heures, quantités)
- Tu restes dans ton rôle de communication uniquement

🔄 MÉTHODE DE TRAVAIL :
1. Si info manquante → pose UNE question ciblée
2. Si plusieurs infos manquent → priorise la plus importante
3. Quand tu as tout → récapitule clairement
4. Demande confirmation avec "Pour confirmer, réponds juste 'ok'"

IMPORTANT : Tu communiques naturellement mais tu laisses un autre système s'occuper de l'extraction et du stockage des données. Concentre-toi sur l'expérience utilisateur !`;

export interface ConversationalResponse {
  message: string;
  confidence: number;
  processingTime: number;
  requiresFollowUp: boolean;
}

export class ConversationalAgent {
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
    logger.info({ model: this.model }, 'ConversationalAgent initialized');
  }

  /**
   * Construit le contexte de conversation à partir de l'historique
   */
  private buildConversationContext(userText: string, history: Message[]): string {
    let context = '';
    
    // Ajouter l'historique récent (derniers 10 messages max)
    if (history.length > 0) {
      context += 'Historique de la conversation :\n';
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        const role = msg.role === 'user' ? 'Utilisateur' : 'Assistant';
        context += `${role}: ${msg.content}\n`;
      }
      context += '\n';
    }
    
    context += `Message actuel de l'utilisateur: ${userText}`;
    return context;
  }

  /**
   * Calcule un score de confiance basé sur la réponse générée
   */
  private calculateConfidence(response: string, _userText: string): number {
    let confidence = 0.7; // Base confidence

    // Augmenter la confiance si la réponse contient des éléments positifs
    if (response.includes('récapitulatif') || response.includes('Récapitulatif')) confidence += 0.1;
    if (response.includes('ok') && response.includes('confirmer')) confidence += 0.15;
    if (response.match(/[😊🏗️📦⏰✅]/)) confidence += 0.05;
    
    // Diminuer si la réponse semble générique ou trop longue
    if (response.length > 500) confidence -= 0.1;
    if (response.includes('je ne peux pas') || response.includes('désolé')) confidence -= 0.2;

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Détermine si une réponse de suivi est nécessaire
   */
  private requiresFollowUp(response: string, _userText: string): boolean {
    // Si on demande une confirmation avec "ok"
    if (response.includes('réponds juste "ok"') || response.includes('réponds simplement "ok"')) {
      return true;
    }
    
    // Si on pose une question
    if (response.includes('?')) {
      return true;
    }
    
    // Si on dit "Commande prête à être transmise"
    if (response.includes('prête à être transmise') || response.includes('transmise')) {
      return false;
    }

    return false;
  }

  /**
   * Génère une réponse conversationnelle naturelle
   */
  async respond(
    userText: string,
    history: Message[] = []
  ): Promise<ConversationalResponse> {
    const startTime = Date.now();
    
    try {
      const context = this.buildConversationContext(userText, history);
      
      logger.info({
        model: this.model,
        contextLength: context.length,
        historyLength: history.length,
        userTextLength: userText.length
      }, 'Generating conversational response');

      const response = await this.client.responses.create({
        model: this.model,
        instructions: CONVERSATIONAL_SYSTEM_INSTRUCTIONS,
        input: context
      });

      const responseText = response.output_text;
      const processingTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(responseText, userText);
      const requiresFollowUp = this.requiresFollowUp(responseText, userText);

      logger.info({
        responseLength: responseText.length,
        processingTime,
        confidence,
        requiresFollowUp,
        requestId: response.id || 'unknown'
      }, 'Conversational response generated');

      return {
        message: responseText,
        confidence,
        processingTime,
        requiresFollowUp
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        model: this.model,
        processingTime
      }, 'Error generating conversational response');
      
      // Réponse de fallback sympathique
      return {
        message: '😅 Désolé, j\'ai eu un petit problème technique. Peux-tu répéter ta demande ?',
        confidence: 0.1,
        processingTime,
        requiresFollowUp: true
      };
    }
  }
}

// Instance singleton
export const conversationalAgent = new ConversationalAgent();