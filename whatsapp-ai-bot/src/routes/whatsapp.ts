import express from 'express';
import twilio from 'twilio';
import pino from 'pino';
import { openAIService, DEFAULT_SYSTEM_INSTRUCTIONS } from '../services/openai';
import { sessionManager } from '../services/session';
import { chunkText } from '../utils/chunkText';

const logger = pino({ name: 'whatsapp-route' });
const router = express.Router();

// Middleware de validation Twilio (désactivé en mode test)
const twilioValidation = twilio.webhook({ 
  validate: process.env['NODE_ENV'] !== 'test' 
});

/**
 * Gère les commandes spéciales (/help, /reset)
 */
function handleSpecialCommands(command: string, phoneNumber: string): string | null {
  switch (command.toLowerCase()) {
    case '/help':
      return `🤖 *Assistant WhatsApp AI*

*Commandes disponibles :*
• Envoyez simplement votre message pour obtenir une réponse
• /reset - Efface l'historique de conversation
• /help - Affiche cette aide

*Fonctionnalités :*
• Conversation avec mémoire (2h max)
• Réponses personnalisées et contextuelles
• Support multilingue

Posez-moi vos questions ! 😊`;

    case '/reset':
      sessionManager.resetHistory(phoneNumber);
      return `✅ Historique de conversation effacé. Nouvelle conversation démarrée !`;

    default:
      return null;
  }
}

/**
 * Envoie plusieurs messages TwiML pour les textes longs
 */
function sendChunkedResponse(res: express.Response, chunks: string[]): void {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();

  chunks.forEach(chunk => {
    twiml.message(chunk);
  });

  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * Route principale pour les webhooks WhatsApp de Twilio
 */
router.post('/whatsapp', twilioValidation, async (req, res) => {
  try {
    const body = req.body as { Body?: string; From?: string; [key: string]: unknown };
    const messageBody = body.Body?.trim();
    const fromNumber = body.From;

    // Validation des paramètres requis
    if (!messageBody || !fromNumber) {
      logger.warn({ body }, 'Missing required parameters Body or From');
      return res.status(400).send('Missing required parameters');
    }

    // Extraction du numéro de téléphone (format: "whatsapp:+1234567890")
    const phoneNumber = fromNumber.replace('whatsapp:', '');
    
    logger.info(
      { 
        phoneNumber, 
        messageLength: messageBody.length,
        messagePreview: messageBody.substring(0, 50)
      }, 
      'Received WhatsApp message'
    );

    // Gestion des commandes spéciales
    if (messageBody.startsWith('/')) {
      const commandResponse = handleSpecialCommands(messageBody, phoneNumber);
      if (commandResponse) {
        const chunks = chunkText(commandResponse);
        logger.info({ phoneNumber, command: messageBody }, 'Special command processed');
        return sendChunkedResponse(res, chunks);
      }
    }

    // Récupération de l'historique de conversation
    const history = sessionManager.getHistory(phoneNumber);
    
    logger.info(
      { 
        phoneNumber, 
        historyLength: history.length 
      }, 
      'Retrieved conversation history'
    );

    // Appel à OpenAI
    let aiResponse: string;
    try {
      aiResponse = await openAIService.askOpenAI(
        messageBody,
        DEFAULT_SYSTEM_INSTRUCTIONS,
        history
      );
    } catch (error) {
      logger.error(
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          phoneNumber 
        }, 
        'OpenAI API call failed'
      );
      
      aiResponse = '❌ Désolé, je rencontre des difficultés techniques. Veuillez réessayer dans quelques instants.';
    }

    // Sauvegarde des messages dans l'historique
    sessionManager.addMessage(phoneNumber, { role: 'user', content: messageBody });
    sessionManager.addMessage(phoneNumber, { role: 'assistant', content: aiResponse });

    // Découpage du message si nécessaire
    const responseChunks = chunkText(aiResponse);
    
    logger.info(
      { 
        phoneNumber,
        responseLength: aiResponse.length,
        chunksCount: responseChunks.length,
        activeSessionsCount: sessionManager.getActiveSessionsCount()
      }, 
      'Sending response to WhatsApp'
    );

    // Envoi de la réponse
    sendChunkedResponse(res, responseChunks);

  } catch (error) {
    logger.error(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 
      'Error in WhatsApp webhook handler'
    );

    // Réponse d'erreur générique
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message('❌ Une erreur inattendue s\'est produite. Veuillez réessayer.');
    
    res.type('text/xml');
    res.status(500).send(twiml.toString());
  }
});

export default router;