import express from 'express';
import bodyParser from 'body-parser';
import pino from 'pino';
import whatsappRouter from './routes/whatsapp';

// Configuration du logger
const logLevel = (process.env['LOG_LEVEL'] || 'info') as pino.Level;
const logger = pino({ 
  name: 'whatsapp-ai-bot',
  level: logLevel
});

// Configuration du serveur
const app = express();
const PORT = parseInt(process.env['PORT'] || '3000', 10);

// Middleware pour parsing des données form-encoded (requis par Twilio)
app.use(bodyParser.urlencoded({ extended: false }));

// Middleware de logging des requêtes
app.use((req, _res, next) => {
  logger.info(
    {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    },
    'Incoming request'
  );
  next();
});

// Route de santé
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route de diagnostic (pour debug Railway)
app.get('/debug', (_req, res) => {
  res.json({
    status: 'debug',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env['NODE_ENV'],
      PORT: process.env['PORT'],
      hasOpenAIKey: !!process.env['OPENAI_API_KEY'],
      hasTwilioToken: !!process.env['TWILIO_AUTH_TOKEN'],
      openaiModel: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
      logLevel: process.env['LOG_LEVEL'] || 'info'
    },
    webhookUrl: '/whatsapp',
    endpoints: ['/health', '/debug', '/whatsapp']
  });
});

// Route principale WhatsApp
app.use('/', whatsappRouter);

// Gestion des erreurs globales
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(
    {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    },
    'Unhandled error'
  );

  res.status(500).json({
    error: 'Internal Server Error'
  });
});

// Route 404
app.use('*', (req, res) => {
  logger.warn({ url: req.url, method: req.method }, 'Route not found');
  res.status(404).json({
    error: 'Route not found'
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  logger.info(
    { 
      port: PORT, 
      env: process.env['NODE_ENV'] || 'development',
      nodeVersion: process.version
    }, 
    'WhatsApp AI Bot server started'
  );
});

export default app;