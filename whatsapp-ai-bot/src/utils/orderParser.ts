import { OrderData } from '../services/supabase';

/**
 * Extrait les données de commande à partir d'un texte de récapitulatif
 */
export function parseOrderFromText(text: string, phoneNumber: string): OrderData | null {
  // Patterns pour extraire les informations du récapitulatif
  const patterns = {
    chantier: /(?:Chantier\s*:?\s*)(.*?)(?:\n|$)/i,
    materiau: /(?:-\s*)(.*?)(?:\n.*?Quantité|$)/i,
    quantite: /(?:Quantité\s*\+?\s*unité\s*:?\s*)(.*?)(?:\n|$)/i,
    dateHeure: /(?:Besoin pour\s*[:\(]?\s*)(.*?)(?:\s*[:\)]?\s*$|\n|$)/i
  };

  const chantierMatch = text.match(patterns.chantier);
  const materiauMatch = text.match(patterns.materiau);
  const quantiteMatch = text.match(patterns.quantite);
  const dateHeureMatch = text.match(patterns.dateHeure);

  // Vérifier que toutes les informations nécessaires sont présentes
  if (!chantierMatch || !materiauMatch || !quantiteMatch || !dateHeureMatch) {
    return null;
  }

  const chantier = chantierMatch[1]?.trim();
  const materiau = materiauMatch[1]?.trim();
  const quantiteComplete = quantiteMatch[1]?.trim();
  const dateHeure = dateHeureMatch[1]?.trim();

  // Séparer quantité et unité
  const quantiteUnitMatch = quantiteComplete?.match(/^([\d\s,\.]+)\s*([a-zA-Z³²\/]+)$/);
  
  if (!quantiteUnitMatch) {
    return null;
  }

  const quantite = quantiteUnitMatch[1]?.trim().replace(/\s/g, '');
  const unite = quantiteUnitMatch[2]?.trim();

  // Validation des données
  if (!chantier || !materiau || !quantite || !unite || !dateHeure) {
    return null;
  }

  return {
    chantier,
    materiau,
    quantite,
    unite,
    date_heure: dateHeure,
    phone_number: phoneNumber
  };
}

/**
 * Détecte si un message contient une confirmation de commande
 */
export function isOrderConfirmation(text: string): boolean {
  const confirmationPatterns = [
    /oui/i,
    /ok/i,
    /d'accord/i,
    /confirme/i,
    /valide/i,
    /correct/i,
    /parfait/i,
    /exactement/i,
    /c'est bon/i,
    /c'est ca/i,
    /c'est ça/i,
    /tout est bon/i
  ];

  return confirmationPatterns.some(pattern => pattern.test(text.trim()));
}

/**
 * Détecte si un message de l'assistant contient un récapitulatif de commande
 */
export function containsOrderSummary(text: string): boolean {
  const summaryIndicators = [
    /récapitulatif/i,
    /chantier\s*:/i,
    /quantité.*unité\s*:/i,
    /besoin pour/i
  ];

  // Doit contenir au moins 3 des 4 indicateurs pour être considéré comme un récapitulatif
  const matchCount = summaryIndicators.filter(pattern => pattern.test(text)).length;
  return matchCount >= 3;
}

/**
 * Détecte si un message de l'assistant indique qu'une commande est prête
 */
export function isOrderReady(text: string): boolean {
  const readyPatterns = [
    /commande prête à être transmise/i,
    /commande validée/i,
    /commande enregistrée/i,
    /commande confirmée/i
  ];

  return readyPatterns.some(pattern => pattern.test(text));
}