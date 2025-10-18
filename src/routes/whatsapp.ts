import express from 'express';
import twilio from 'twilio';
import pino from 'pino';
import { openAIService, DEFAULT_SYSTEM_INSTRUCTIONS } from '../services/openai';
import { conversationalAgent } from '../services/conversationalAgent';
import { extractionAgent } from '../services/extractionAgent';
import { sessionManager } from '../services/session';
import { chunkText } from '../utils/chunkText';
import { supabaseService } from '../services/supabase';
import { parseOrderFromResponse } from '../utils/orderParser';
import { transcriptionService, TranscriptionService } from '../services/transcriptionService';

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
• 🎤 Envoyez un message vocal (transcription automatique)
• /reset - Efface l'historique de conversation
• /help - Affiche cette aide

*Fonctionnalités :*
• Conversation avec mémoire (2h max)
• Réponses personnalisées et contextuelles
• Support multilingue
• Transcription automatique des messages vocaux

Posez-moi vos questions par texte ou vocal ! 😊`;

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

  const twimlString = twiml.toString();
  
  logger.info({
    chunksCount: chunks.length,
    chunks: chunks,
    twimlResponse: twimlString
  }, 'Sending TwiML response to Twilio');

  res.type('text/xml');
  res.status(200);
  res.send(twimlString);
  
  logger.info({
    responseStatus: 200,
    contentType: 'text/xml',
    twimlLength: twimlString.length
  }, 'HTTP response sent to Twilio');
}

/**
 * Route principale pour les webhooks WhatsApp de Twilio
 */
// Route principale pour les webhooks WhatsApp (accepte / et /whatsapp)
router.post('/', twilioValidation, async (req, res) => {
  try {
    const body = req.body as { 
      Body?: string; 
      From?: string; 
      NumMedia?: string;
      MediaUrl0?: string;
      MediaContentType0?: string;
      [key: string]: unknown;
    };
    
    let messageBody = body.Body?.trim();
    const fromNumber = body.From;

    // Validation des paramètres requis
    if (!fromNumber) {
      logger.warn({ body }, 'Missing required parameter From');
      return res.status(400).send('Missing required parameter From');
    }

    // Extraction du numéro de téléphone (format: "whatsapp:+1234567890")
    const phoneNumber = fromNumber.replace('whatsapp:', '');

    // Debug: Log complet du body pour les médias
    if (body.NumMedia && parseInt(body.NumMedia) > 0) {
      logger.info({ 
        phoneNumber,
        fullBody: body,
        numMedia: body.NumMedia,
        mediaUrl: body.MediaUrl0,
        contentType: body.MediaContentType0
      }, 'Media message received - full debug');
    }

    // Gestion des messages vocaux
    if (TranscriptionService.isVoiceMessage(body)) {
      try {
        logger.info({ phoneNumber, mediaUrl: body.MediaUrl0, contentType: body.MediaContentType0 }, 'Voice message received');
        
        const voiceInfo = TranscriptionService.extractVoiceMessageInfo(body);
        if (!voiceInfo) {
          throw new Error('Could not extract voice message information');
        }

        // Transcrire le message vocal
        const transcriptionResult = await transcriptionService.transcribeVoiceMessage(
          voiceInfo.mediaUrl, 
          voiceInfo.contentType
        );

        messageBody = transcriptionResult.text;

        logger.info({
          phoneNumber,
          transcriptionLength: messageBody.length,
          processingTime: transcriptionResult.processingTime,
          preview: messageBody.substring(0, 50)
        }, 'Voice message transcribed successfully');

      } catch (transcriptionError) {
        logger.error({
          error: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error',
          phoneNumber
        }, 'Failed to transcribe voice message');

        // Envoyer un message d'erreur à l'utilisateur
        const errorMessage = transcriptionError instanceof Error ? 
          transcriptionError.message : 
          'Désolé, je n\'ai pas pu traiter votre message vocal. Pouvez-vous réessayer ou envoyer un message texte ?';
        
        const chunks = chunkText(errorMessage);
        return sendChunkedResponse(res, chunks);
      }
    }

    // Validation que nous avons maintenant un message (texte ou transcrit)
    if (!messageBody) {
      logger.warn({ body }, 'No text content found (neither Body nor transcribed voice)');
      const chunks = chunkText('Désolé, je n\'ai pas reçu de message. Pouvez-vous réessayer ?');
      return sendChunkedResponse(res, chunks);
    }

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

    // NOUVELLE ARCHITECTURE : Orchestration parallèle des 2 agents spécialisés
    const dualAgentStartTime = Date.now();
    let conversationResult: any;
    let extractionResult: any;
    let fallbackUsed = false;
    let shouldStore = false;

    try {
      logger.info({ phoneNumber }, 'Starting dual agent processing');

      // Lancement parallèle des 2 agents avec Promise.all() et timeout
      const AGENT_TIMEOUT = 60000; // 60 secondes timeout pour GPT-5-mini
      
      const conversationPromise = Promise.race([
        conversationalAgent.respond(messageBody, history),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Conversational agent timeout')), AGENT_TIMEOUT)
        )
      ]);

      const extractionPromise = Promise.race([
        extractionAgent.analyze(messageBody, history),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Extraction agent timeout')), AGENT_TIMEOUT)
        )
      ]);

      const [conversationResponse, extractionResponse] = await Promise.all([
        conversationPromise,
        extractionPromise
      ]);

      conversationResult = conversationResponse;
      extractionResult = extractionResponse;

      // const dualAgentProcessingTime = Date.now() - dualAgentStartTime;

      // Logs détaillés pour debugging
      logger.info({
        phoneNumber,
        processing: {
          conversationalAgent: {
            response: conversationResult.message.substring(0, 100),
            confidence: conversationResult.confidence,
            processingTime: conversationResult.processingTime
          },
          extractionAgent: {
            data: extractionResult.data,
            completude: extractionResult.data.completude,
            errors: extractionResult.errors,
            processingTime: extractionResult.processingTime
          }
        },
        decision: {
          shouldStore: extractionResult.data.completude >= 0.8,
          fallbackUsed: false
        }
      }, 'Dual agent processing completed');

      // Déterminer si on doit stocker la commande (plus strict sur la confirmation)
      const isExplicitConfirmation = messageBody.toLowerCase().trim() === 'ok' || 
                                     messageBody.toLowerCase().trim() === 'je confirme' ||
                                     messageBody.toLowerCase().trim() === 'oui' ||
                                     messageBody.toLowerCase().trim() === 'c\'est bon';
      
      shouldStore = extractionResult.data.completude >= 0.8 && 
                   extractionResult.data.confirmation && 
                   extractionResult.isValid &&
                   isExplicitConfirmation;

    } catch (error) {
      // Fallback vers l'ancien système en cas d'échec des agents
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        phoneNumber
      }, 'Dual agent processing failed, falling back to legacy system');

      fallbackUsed = true;

      try {
        const legacyResponse = await openAIService.askOpenAI(
          messageBody,
          DEFAULT_SYSTEM_INSTRUCTIONS,
          history
        );

        conversationResult = {
          message: legacyResponse,
          confidence: 0.5,
          processingTime: Date.now() - dualAgentStartTime,
          requiresFollowUp: true
        };

        // Parsing legacy pour l'extraction
        const parsedOrder = parseOrderFromResponse(legacyResponse, messageBody, history);
        extractionResult = {
          data: {
            chantier: parsedOrder.chantier || null,
            materiaux: parsedOrder.materiau ? [{
              nom: parsedOrder.materiau,
              quantite: parsedOrder.quantite || '',
              unite: parsedOrder.unite || ''
            }] : [],
            livraison: {
              date: parsedOrder.date_besoin || null,
              heure: parsedOrder.heure_besoin || null
            },
            completude: parsedOrder.is_complete ? 0.9 : 0.5,
            confirmation: parsedOrder.is_confirmed || false
          },
          processingTime: Date.now() - dualAgentStartTime,
          errors: [],
          isValid: true
        };

        shouldStore = Boolean(parsedOrder.is_complete && parsedOrder.is_confirmed);

        logger.info({
          phoneNumber,
          fallbackProcessingTime: Date.now() - dualAgentStartTime,
          legacyParsedOrder: parsedOrder
        }, 'Legacy fallback processing completed');

      } catch (fallbackError) {
        logger.error({
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          phoneNumber
        }, 'Legacy fallback also failed');

        conversationResult = {
          message: '❌ Désolé, je rencontre des difficultés techniques. Veuillez réessayer dans quelques instants.',
          confidence: 0.1,
          processingTime: Date.now() - dualAgentStartTime,
          requiresFollowUp: false
        };

        extractionResult = {
          data: {
            chantier: null,
            materiaux: [],
            livraison: { date: null, heure: null },
            completude: 0.0,
            confirmation: false
          },
          processingTime: Date.now() - dualAgentStartTime,
          errors: ['Système temporairement indisponible'],
          isValid: false
        };
      }
    }

    // Sauvegarde des messages dans l'historique
    sessionManager.addMessage(phoneNumber, { role: 'user', content: messageBody });
    sessionManager.addMessage(phoneNumber, { role: 'assistant', content: conversationResult.message });

    // Stockage de la commande si elle est prête
    if (shouldStore && extractionResult.isValid) {
      try {
        const multiMaterialOrder = supabaseService.convertExtractionToMultiMaterialOrder(
          extractionResult.data, 
          phoneNumber
        );

        if (multiMaterialOrder) {
          const stored = await supabaseService.storeMultiMaterialOrder(multiMaterialOrder);
          
          if (stored) {
            logger.info({
              phoneNumber,
              chantier: multiMaterialOrder.chantier,
              materiaux: multiMaterialOrder.materiaux.length,
              completude: multiMaterialOrder.completude
            }, '✅ Multi-material order stored successfully in Supabase');
          } else {
            logger.error({
              phoneNumber,
              multiMaterialOrder
            }, '❌ Failed to store multi-material order in Supabase');
          }
        } else {
          logger.warn({
            phoneNumber,
            extractionData: extractionResult.data
          }, '❌ Could not convert extraction data to multi-material order');
        }
      } catch (storageError) {
        logger.error({
          error: storageError instanceof Error ? storageError.message : 'Unknown error',
          phoneNumber,
          extractionData: extractionResult.data
        }, 'Error storing multi-material order');
      }
    } else if (extractionResult.data.completude >= 0.5) {
      logger.info({
        phoneNumber,
        completude: extractionResult.data.completude,
        confirmation: extractionResult.data.confirmation,
        chantier: extractionResult.data.chantier
      }, extractionResult.data.confirmation ? '⏳ Order complete but not confirmed' : '📝 Order incomplete or not ready');
    }

    // Nettoyage du message pour éviter les problèmes d'encodage TwiML
    const cleanedMessage = conversationResult.message
      .replace(/[^\x20-\x7E\u00C0-\u00FF]/g, '') // Garder seulement ASCII + Latin-1
      .replace(/&/g, '&amp;')       // Échapper les caractères XML
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\s+/g, ' ')         // Normaliser les espaces
      .trim();
    
    // Découpage du message si nécessaire
    const responseChunks = chunkText(cleanedMessage);
    
    logger.info(
      { 
        phoneNumber,
        originalMessageLength: conversationResult.message.length,
        cleanedMessageLength: cleanedMessage.length,
        chunksCount: responseChunks.length,
        activeSessionsCount: sessionManager.getActiveSessionsCount(),
        fallbackUsed,
        agentConfidence: conversationResult.confidence,
        extractionCompletude: extractionResult.data.completude,
        originalMessage: conversationResult.message.substring(0, 100),
        cleanedMessage: cleanedMessage.substring(0, 100)
      }, 
      'Sending response to WhatsApp'
    );

    // Envoi de la réponse
    sendChunkedResponse(res, responseChunks);
    
    logger.info({ phoneNumber }, 'Response sent successfully to Twilio');

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

// Route de test pour vérifier la connectivité Twilio
router.get('/test', (_req, res) => {
  logger.info('Test endpoint called');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'WhatsApp bot is running'
  });
});

// Route de test TwiML simple
router.post('/test-twiml', (req, res) => {
  logger.info({ body: req.body }, 'Test TwiML endpoint called');
  
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  twiml.message('Test message from bot - if you receive this, Twilio webhook works!');
  
  res.type('text/xml');
  res.status(200);
  res.send(twiml.toString());
  
  logger.info('Test TwiML response sent');
});

export default router;
