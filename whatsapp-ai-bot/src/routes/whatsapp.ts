import express from 'express';
import twilio from 'twilio';
import pino from 'pino';
import { openAIService, DEFAULT_SYSTEM_INSTRUCTIONS } from '../services/openai';
import { sessionManager } from '../services/session';
import { chunkText } from '../utils/chunkText';
import { supabaseService } from '../services/supabase';
import { parseOrderFromText, isOrderConfirmation, containsOrderSummary, isOrderReady } from '../utils/orderParser';

const logger = pino({ name: 'whatsapp-route' });
const router = express.Router();

// Middleware de validation Twilio (désactivé en mode test)
const { NODE_ENV, PUBLIC_HOSTNAME } = process.env as {
  NODE_ENV?: string;
  PUBLIC_HOSTNAME?: string;
};
const isProd = NODE_ENV === 'production';

const twilioValidation = isProd
  ? twilio.webhook({
      validate: true,
      protocol: 'https',
      // n'inclus 'host' que s'il existe :
      ...(PUBLIC_HOSTNAME ? { host: PUBLIC_HOSTNAME } : {}),
      // si tu veux, pareil pour le token :
      // ...(process.env.TWILIO_AUTH_TOKEN ? { authToken: process.env.TWILIO_AUTH_TOKEN } : {}),
    })
  : twilio.webhook({ validate: false });


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

    // Vérification si l'utilisateur confirme une commande
    const isConfirmation = isOrderConfirmation(messageBody);
    
    if (isConfirmation) {
      // Récupérer le dernier message de l'assistant pour chercher le récapitulatif
      const lastAssistantMessage = history.length > 0 ? 
        history[history.length - 1] : null;
      
      if (lastAssistantMessage && 
          lastAssistantMessage.role === 'assistant' && 
          containsOrderSummary(lastAssistantMessage.content)) {
        
        // Extraire les données de commande du récapitulatif
        const orderData = parseOrderFromText(lastAssistantMessage.content, phoneNumber);
        
        if (orderData) {
          logger.info(
            { 
              phoneNumber,
              chantier: orderData.chantier,
              materiau: orderData.materiau 
            }, 
            'Attempting to save confirmed order to Supabase'
          );
          
          // Sauvegarder dans Supabase
          const saveResult = await supabaseService.saveOrder(orderData);
          
          if (saveResult.success) {
            logger.info(
              { 
                phoneNumber,
                orderId: saveResult.id 
              }, 
              'Order successfully saved to Supabase'
            );
            
            // Modifier la réponse de l'IA pour confirmer la sauvegarde
            if (isOrderReady(aiResponse)) {
              aiResponse = `✅ Commande prête à être transmise et sauvegardée avec succès !\n\n📝 Référence : ${saveResult.id || 'N/A'}\n\nTa commande a été enregistrée et sera traitée dans les plus brefs délais.`;
            }
          } else {
            logger.error(
              { 
                phoneNumber,
                error: saveResult.error 
              }, 
              'Failed to save order to Supabase'
            );
            
            // Informer l'utilisateur en cas d'échec
            aiResponse += `\n\n⚠️ Note : Il y a eu un problème technique lors de l'enregistrement. Ton responsable chantier sera informé directement.`;
          }
        } else {
          logger.warn(
            { 
              phoneNumber 
            }, 
            'Could not parse order data from summary'
          );
        }
      }
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
