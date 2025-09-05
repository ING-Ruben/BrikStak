import OpenAI from 'openai';
import axios from 'axios';
import FormData from 'form-data';
import pino from 'pino';
import { Readable } from 'stream';

const logger = pino({ name: 'transcription-service' });

export interface TranscriptionResult {
  text: string;
  processingTime: number;
  audioFormat?: string;
  audioDuration?: number;
}

export class TranscriptionService {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey
    });

    logger.info('TranscriptionService initialized');
  }

  /**
   * Télécharge un fichier audio depuis Twilio
   */
  private async downloadAudioFromTwilio(mediaUrl: string): Promise<Buffer> {
    const accountSid = process.env['TWILIO_ACCOUNT_SID'];
    const authToken = process.env['TWILIO_AUTH_TOKEN'];

    // Debug: Log des credentials (sans révéler le token complet)
    logger.info({
      accountSid: accountSid ? `${accountSid.substring(0, 10)}...` : 'MISSING',
      authTokenPresent: !!authToken,
      authTokenLength: authToken ? authToken.length : 0,
      credentialsValid: !!(accountSid && authToken)
    }, 'Twilio credentials check');

    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required');
    }

    try {
      logger.info({ mediaUrl }, 'Downloading audio from Twilio');

      const response = await axios.get(mediaUrl, {
        auth: {
          username: accountSid,
          password: authToken
        },
        responseType: 'arraybuffer',
        timeout: 30000, // 30 secondes timeout
        headers: {
          'User-Agent': 'BrikStak-WhatsApp-Bot/1.0'
        }
      });

      logger.info({
        status: response.status,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length']
      }, 'Twilio media download response');

      const audioBuffer = Buffer.from(response.data);
      
      logger.info({ 
        audioSize: audioBuffer.length,
        contentType: response.headers['content-type']
      }, 'Audio downloaded successfully');

      return audioBuffer;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        mediaUrl
      }, 'Failed to download audio from Twilio');
      throw error;
    }
  }

  /**
   * Transcrit un fichier audio en utilisant OpenAI Whisper
   */
  private async transcribeWithWhisper(audioBuffer: Buffer, contentType: string = 'audio/ogg'): Promise<string> {
    try {
      logger.info({ 
        audioSize: audioBuffer.length,
        contentType 
      }, 'Starting transcription with Whisper');

      // Déterminer l'extension de fichier basée sur le content-type
      let fileExtension = 'ogg';
      if (contentType.includes('mpeg') || contentType.includes('mp3')) {
        fileExtension = 'mp3';
      } else if (contentType.includes('wav')) {
        fileExtension = 'wav';
      } else if (contentType.includes('m4a')) {
        fileExtension = 'm4a';
      }

      // Créer un stream à partir du buffer
      const audioStream = Readable.from(audioBuffer);
      (audioStream as any).path = `audio.${fileExtension}`;

      // Appeler l'API Whisper
      const transcription = await this.client.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        language: 'fr', // Forcer le français pour de meilleurs résultats
        response_format: 'text'
      });

      logger.info({ 
        transcriptionLength: transcription.length,
        preview: transcription.substring(0, 100)
      }, 'Transcription completed');

      return transcription.trim();

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        audioSize: audioBuffer.length
      }, 'Failed to transcribe audio with Whisper');
      throw error;
    }
  }

  /**
   * Transcrit un message vocal WhatsApp depuis son URL Twilio
   */
  async transcribeVoiceMessage(mediaUrl: string, contentType?: string): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      logger.info({ mediaUrl, contentType }, 'Starting voice message transcription');

      // 1. Télécharger l'audio depuis Twilio
      const audioBuffer = await this.downloadAudioFromTwilio(mediaUrl);

      // 2. Transcrire avec Whisper
      const transcribedText = await this.transcribeWithWhisper(audioBuffer, contentType);

      const processingTime = Date.now() - startTime;

      // 3. Validation du résultat
      if (!transcribedText || transcribedText.length < 2) {
        throw new Error('Transcription resulted in empty or too short text');
      }

      const result: TranscriptionResult = {
        text: transcribedText,
        processingTime,
        audioFormat: contentType,
        audioDuration: undefined // Pourrait être calculé si nécessaire
      };

      logger.info({
        transcriptionLength: transcribedText.length,
        processingTime,
        preview: transcribedText.substring(0, 100)
      }, 'Voice message transcription completed successfully');

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        mediaUrl,
        processingTime
      }, 'Voice message transcription failed');

      // Retourner un message d'erreur utilisateur-friendly
      throw new Error('Désolé, je n\'ai pas pu comprendre votre message vocal. Pouvez-vous réessayer ou envoyer un message texte ?');
    }
  }

  /**
   * Vérifie si un message contient un média audio
   */
  static isVoiceMessage(body: any): boolean {
    const numMedia = body.NumMedia ? parseInt(body.NumMedia) : 0;
    const contentType = body.MediaContentType0 || '';
    
    return numMedia > 0 && contentType.startsWith('audio/');
  }

  /**
   * Extrait les informations du message vocal depuis le webhook Twilio
   */
  static extractVoiceMessageInfo(body: any): { mediaUrl: string; contentType: string } | null {
    if (!this.isVoiceMessage(body)) {
      return null;
    }

    return {
      mediaUrl: body.MediaUrl0,
      contentType: body.MediaContentType0 || 'audio/ogg'
    };
  }
}

// Instance singleton
export const transcriptionService = new TranscriptionService();
