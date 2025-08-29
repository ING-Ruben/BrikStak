import express from 'express';
import pino from 'pino';
import { supabaseService } from '../services/supabase';

const logger = pino({ name: 'orders-route' });
const router = express.Router();

/**
 * Route pour obtenir les commandes d'un chantier spécifique
 * GET /orders/:chantier
 */
router.get('/orders/:chantier', async (req, res) => {
  try {
    const { chantier } = req.params;
    
    if (!chantier || chantier.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nom du chantier requis'
      });
    }

    const orders = await supabaseService.getOrdersForChantier(chantier);
    
    logger.info({
      chantier,
      ordersCount: orders.length
    }, 'Orders retrieved for chantier');

    res.json({
      success: true,
      chantier,
      orders,
      count: orders.length
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      chantier: req.params.chantier
    }, 'Error retrieving orders');

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des commandes'
    });
  }
});

/**
 * Route pour lister tous les chantiers
 * GET /chantiers
 */
router.get('/chantiers', async (req, res) => {
  try {
    const chantiers = await supabaseService.listChantiers();
    
    logger.info({
      chantiersCount: chantiers.length
    }, 'Chantiers listed');

    res.json({
      success: true,
      chantiers,
      count: chantiers.length
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Error listing chantiers');

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des chantiers'
    });
  }
});

/**
 * Route pour créer manuellement une commande (pour les tests)
 * POST /orders
 */
router.post('/orders', async (req, res) => {
  try {
    const orderInfo = req.body;
    
    // Validation basique
    const requiredFields = ['chantier', 'materiau', 'quantite', 'unite', 'date_besoin', 'heure_besoin', 'phone_number'];
    const missingFields = requiredFields.filter(field => !orderInfo[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Champs requis manquants: ${missingFields.join(', ')}`
      });
    }

    // Ajouter le statut par défaut si non fourni
    if (!orderInfo.statut) {
      orderInfo.statut = 'en_attente';
    }

    const stored = await supabaseService.storeOrder(orderInfo);
    
    if (stored) {
      logger.info({
        chantier: orderInfo.chantier,
        materiau: orderInfo.materiau,
        phoneNumber: orderInfo.phone_number
      }, 'Manual order created');

      res.json({
        success: true,
        message: 'Commande créée avec succès',
        order: orderInfo
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création de la commande'
      });
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body
    }, 'Error creating manual order');

    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la commande'
    });
  }
});

export default router;