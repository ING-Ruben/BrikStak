import pino from 'pino';
import { OrderInfo } from '../services/supabase';

const logger = pino({ name: 'order-parser' });

export interface ParsedOrder {
  chantier?: string;
  materiau?: string;
  quantite?: string;
  unite?: string;
  date_besoin?: string;
  heure_besoin?: string;
  is_confirmed?: boolean;
  is_complete?: boolean;
}

/**
 * Parse une réponse de l'assistant pour extraire les informations de commande
 */
export function parseOrderFromResponse(response: string): ParsedOrder {
  const result: ParsedOrder = {};

  // Patterns pour extraire les informations
  const patterns = {
    // Récapitulatif structuré
    chantier: /(?:chantier\s*:?\s*)(.*?)(?:\n|$)/i,
    materiau: /(?:-\s*)(.*?)(?:\n.*?quantité|$)/i,
    quantite: /(?:quantité.*?:?\s*)([\d,.\s]+)/i,
    unite: /(?:quantité.*?:?\s*[\d,.\s]+\s*)(m³|kg|m²|tonnes?|sacs?|palettes?|m|cm|litres?|l)/i,
    date_besoin: /(?:besoin pour.*?:?\s*)((?:\d{1,2}\/\d{1,2}\/\d{4})|(?:\d{4}-\d{2}-\d{2}))/i,
    heure_besoin: /(?:besoin pour.*?(?:\d{1,2}\/\d{1,2}\/\d{4}||\d{4}-\d{2}-\d{2}).*?)(\d{1,2}:\d{2})/i,
  };

  // Alternative patterns si le format récapitulatif n'est pas trouvé
  const alternativePatterns = {
    chantier: /(?:chantier|site|lieu)(?:\s*:?\s*|\s+)([^\n.]+)/i,
    materiau: /(?:matériau|matériel|produit)(?:\s*:?\s*|\s+)([^\n.]+)/i,
    quantite: /([\d,.\s]+)(?:\s*)(m³|kg|m²|tonnes?|sacs?|palettes?|m|cm|litres?|l)/i,
    date: /(?:date|pour le|besoin le)(?:\s*:?\s*)((?:\d{1,2}\/\d{1,2}\/\d{4})|(?:\d{4}-\d{2}-\d{2}))/i,
    heure: /(?:heure|à)(?:\s*:?\s*)(\d{1,2}:\d{2})/i,
  };

  try {
    // Nettoyer la réponse
    const cleanResponse = response
      .replace(/\*\*/g, '') // Enlever le markdown bold
      .replace(/\*/g, '')   // Enlever les autres markdown
      .trim();

    // Essayer d'extraire avec les patterns principaux
    const chantierMatch = cleanResponse.match(patterns.chantier);
    if (chantierMatch) {
      result.chantier = chantierMatch[1].trim();
    }

    const materiauMatch = cleanResponse.match(patterns.materiau);
    if (materiauMatch) {
      result.materiau = materiauMatch[1].replace(/^-\s*/, '').trim();
    }

    const quantiteMatch = cleanResponse.match(patterns.quantite);
    if (quantiteMatch) {
      result.quantite = quantiteMatch[1].trim();
    }

    const uniteMatch = cleanResponse.match(patterns.unite);
    if (uniteMatch) {
      result.unite = uniteMatch[1].toLowerCase();
    }

    const dateMatch = cleanResponse.match(patterns.date_besoin);
    if (dateMatch) {
      result.date_besoin = dateMatch[1];
    }

    const heureMatch = cleanResponse.match(patterns.heure_besoin);
    if (heureMatch) {
      result.heure_besoin = heureMatch[1];
    }

    // Si les patterns principaux n'ont pas fonctionné, essayer les alternatifs
    if (!result.chantier) {
      const altChantierMatch = cleanResponse.match(alternativePatterns.chantier);
      if (altChantierMatch) {
        result.chantier = altChantierMatch[1].trim();
      }
    }

    if (!result.materiau) {
      const altMateriauMatch = cleanResponse.match(alternativePatterns.materiau);
      if (altMateriauMatch) {
        result.materiau = altMateriauMatch[1].trim();
      }
    }

    if (!result.quantite || !result.unite) {
      const altQuantiteMatch = cleanResponse.match(alternativePatterns.quantite);
      if (altQuantiteMatch) {
        result.quantite = altQuantiteMatch[1].trim();
        result.unite = altQuantiteMatch[2].toLowerCase();
      }
    }

    if (!result.date_besoin) {
      const altDateMatch = cleanResponse.match(alternativePatterns.date);
      if (altDateMatch) {
        result.date_besoin = altDateMatch[1];
      }
    }

    if (!result.heure_besoin) {
      const altHeureMatch = cleanResponse.match(alternativePatterns.heure);
      if (altHeureMatch) {
        result.heure_besoin = altHeureMatch[1];
      }
    }

    // Vérifier si la commande est confirmée
    result.is_confirmed = /commande prête à être transmise/i.test(cleanResponse) ||
                         /commande confirmée/i.test(cleanResponse) ||
                         /parfait|ok|c'est bon|validé|confirmé/i.test(cleanResponse);

    // Vérifier si toutes les informations sont présentes
    result.is_complete = !!(result.chantier && result.materiau && result.quantite && 
                           result.unite && result.date_besoin && result.heure_besoin);

    logger.info({
      parsed: result,
      responseLength: response.length
    }, 'Order parsed from AI response');

    return result;

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      response: response.substring(0, 200)
    }, 'Error parsing order from response');

    return {};
  }
}

/**
 * Convertit une commande parsée en OrderInfo pour Supabase
 */
export function convertToOrderInfo(
  parsedOrder: ParsedOrder, 
  phoneNumber: string
): OrderInfo | null {
  if (!parsedOrder.is_complete) {
    return null;
  }

  try {
    return {
      phone_number: phoneNumber,
      chantier: parsedOrder.chantier!,
      materiau: parsedOrder.materiau!,
      quantite: parsedOrder.quantite!,
      unite: parsedOrder.unite!,
      date_besoin: parsedOrder.date_besoin!,
      heure_besoin: parsedOrder.heure_besoin!,
      statut: parsedOrder.is_confirmed ? 'confirmee' : 'en_attente'
    };
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      parsedOrder
    }, 'Error converting parsed order to OrderInfo');
    return null;
  }
}

/**
 * Valide les formats de date et heure
 */
export function validateOrderFormats(orderInfo: OrderInfo): boolean {
  // Valider le format de date (JJ/MM/AAAA ou AAAA-MM-JJ)
  const dateRegex = /^(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})$/;
  if (!dateRegex.test(orderInfo.date_besoin)) {
    logger.warn({ date: orderInfo.date_besoin }, 'Invalid date format');
    return false;
  }

  // Valider le format d'heure (HH:MM)
  const heureRegex = /^\d{1,2}:\d{2}$/;
  if (!heureRegex.test(orderInfo.heure_besoin)) {
    logger.warn({ heure: orderInfo.heure_besoin }, 'Invalid time format');
    return false;
  }

  // Valider que la quantité est numérique
  const quantiteNum = parseFloat(orderInfo.quantite.replace(',', '.'));
  if (isNaN(quantiteNum) || quantiteNum <= 0) {
    logger.warn({ quantite: orderInfo.quantite }, 'Invalid quantity');
    return false;
  }

  return true;
}