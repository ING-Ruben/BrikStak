import OpenAI from 'openai';
import pino from 'pino';
import { Message } from './session';

const logger = pino({ name: 'extraction-agent' });

// Prompt spécialisé pour l'agent d'extraction
export const EXTRACTION_SYSTEM_INSTRUCTIONS = `Tu es un système d'extraction de données pure. Ta mission est d'analyser les conversations et extraire uniquement les données structurées.

🎯 TON RÔLE :
- Analyser la conversation pour extraire les informations de commande
- Retourner UNIQUEMENT du JSON valide, aucun texte
- Supporter plusieurs matériaux par commande
- Valider et scorer la complétude des données
- CONVERTIR LES DATES RELATIVES EN DATES ABSOLUES

📊 FORMAT DE SORTIE JSON OBLIGATOIRE :
{
  "chantier": "nom_chantier_ou_null",
  "materiaux": [
    {
      "nom": "nom_materiau",
      "quantite": "valeur_numerique",
      "unite": "unite_standardisee"
    }
  ],
  "livraison": {
    "date": "format_JJ/MM/AAAA_ou_null",
    "heure": "format_HH:MM_ou_null"
  },
  "completude": 0.95,
  "confirmation": false
}

🔍 RÈGLES D'EXTRACTION :
1. CHANTIER : Nom exact mentionné par l'utilisateur
2. MATÉRIAUX : Array avec tous les matériaux demandés
3. QUANTITÉS : Valeurs numériques uniquement (convertir "dix" → "10")
4. UNITÉS : Standardiser (m3, kg, m2, tonnes, sacs, palettes, m, cm, l)
5. DATE : TOUJOURS convertir en format JJ/MM/AAAA :
   - "demain" → date de demain en JJ/MM/AAAA
   - "après-demain" → date d'après-demain en JJ/MM/AAAA
   - "lundi prochain" → date du prochain lundi en JJ/MM/AAAA
   - "dans 3 jours" → date dans 3 jours en JJ/MM/AAAA
   - Utilise la date actuelle comme référence pour calculer
6. HEURE : TOUJOURS convertir en format HH:MM :
   - "14h" → "14:00"
   - "14h30" → "14:30"
   - "2h de l'après-midi" → "14:00"
   - "matin" → "08:00" (par défaut)
   - "après-midi" → "14:00" (par défaut)
7. COMPLÉTUDE : Score de 0.0 à 1.0 basé sur les infos présentes
8. CONFIRMATION : true si l'utilisateur confirme ("ok", "je confirme", "c'est bon", "validé")

📏 CALCUL DE COMPLÉTUDE :
- Chantier présent : +0.2
- Au moins 1 matériau avec nom : +0.2
- Toutes les quantités présentes : +0.2
- Toutes les unités présentes : +0.2
- Date présente : +0.1
- Heure présente : +0.1

✅ VALIDATION :
- Dates : JJ/MM/AAAA (01/01/2024 à 31/12/2030)
- Heures : HH:MM (00:00 à 23:59)
- Quantités : Nombres positifs uniquement
- Unités : Liste fermée d'unités valides

❌ RÈGLES STRICTES :
- Ne retourne QUE du JSON valide
- Aucun texte explicatif
- Aucun commentaire
- Si aucune info → retourne structure vide avec completude: 0.0
- Si erreur → retourne JSON d'erreur avec completude: 0.0

IMPORTANT : Tu ne communiques jamais avec l'utilisateur. Tu analyses silencieusement et retournes uniquement des données JSON structurées.`;

export interface MaterialInfo {
  nom: string;
  quantite: string;
  unite: string;
}

export interface DeliveryInfo {
  date: string | null;
  heure: string | null;
}

export interface ExtractionResult {
  chantier: string | null;
  materiaux: MaterialInfo[];
  livraison: DeliveryInfo;
  completude: number;
  confirmation: boolean;
}

export interface ExtractionResponse {
  data: ExtractionResult;
  processingTime: number;
  errors: string[];
  isValid: boolean;
}

export class ExtractionAgent {
  private client: OpenAI;
  private model: string;

  // Unités valides standardisées
  private readonly VALID_UNITS = [
    'm3', 'kg', 'm2', 'tonnes', 'sacs', 'palettes', 'm', 'cm', 'l',
    'm³', 'tonne', 'sac', 'palette', 'litre', 'litres'
  ];

  constructor() {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey
    });

    this.model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
    logger.info({ model: this.model }, 'ExtractionAgent initialized');
  }

  /**
   * Construit le contexte d'analyse à partir de l'historique
   */
  private buildAnalysisContext(userText: string, history: Message[]): string {
    let context = 'CONVERSATION À ANALYSER:\n\n';
    
    // Inclure tout l'historique pour une extraction complète
    if (history.length > 0) {
      for (const msg of history) {
        const role = msg.role === 'user' ? 'UTILISATEUR' : 'ASSISTANT';
        context += `${role}: ${msg.content}\n`;
      }
    }
    
    context += `UTILISATEUR: ${userText}\n\n`;
    context += 'EXTRAIT LES DONNÉES EN JSON UNIQUEMENT:';
    
    return context;
  }

  /**
   * Standardise les unités
   */
  private standardizeUnit(unit: string): string {
    const unitLower = unit.toLowerCase().trim();
    
    // Mapping des unités communes
    const unitMapping: { [key: string]: string } = {
      'm³': 'm3',
      'tonne': 'tonnes',
      'sac': 'sacs',
      'palette': 'palettes',
      'litre': 'l',
      'litres': 'l'
    };

    return unitMapping[unitLower] || unitLower;
  }

  /**
   * Valide le format de date (JJ/MM/AAAA)
   */
  private validateDate(date: string): boolean {
    if (!date) return false;
    const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    if (!dateRegex.test(date)) return false;

    const parts = date.split('/').map(Number);
    if (parts.length !== 3) return false;
    
    const [day, month, year] = parts;
    if (!day || !month || !year) return false;
    
    const dateObj = new Date(year, month - 1, day);
    
    return dateObj.getFullYear() === year &&
           dateObj.getMonth() === month - 1 &&
           dateObj.getDate() === day &&
           year >= 2024 && year <= 2030;
  }

  /**
   * Valide le format d'heure (HH:MM)
   */
  private validateTime(time: string): boolean {
    if (!time) return false;
    const timeRegex = /^\d{1,2}:\d{2}$/;
    if (!timeRegex.test(time)) return false;

    const parts = time.split(':').map(Number);
    if (parts.length !== 2) return false;
    
    const [hours, minutes] = parts;
    if (hours === undefined || minutes === undefined) return false;
    
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }

  /**
   * Convertit différents formats de date en JJ/MM/AAAA
   */
  private convertToDateFormat(dateStr: string): string | null {
    if (!dateStr) return null;
    
    // Si déjà au bon format, retourner tel quel
    if (this.validateDate(dateStr)) return dateStr;
    
    const today = new Date();
    const lowerDate = dateStr.toLowerCase().trim();
    
    // Gérer les dates relatives
    if (lowerDate === 'demain') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return this.formatDate(tomorrow);
    }
    
    if (lowerDate === 'après-demain' || lowerDate === 'apres-demain') {
      const afterTomorrow = new Date(today);
      afterTomorrow.setDate(today.getDate() + 2);
      return this.formatDate(afterTomorrow);
    }
    
    if (lowerDate === "aujourd'hui" || lowerDate === 'aujourd hui') {
      return this.formatDate(today);
    }
    
    // Gérer "dans X jours"
    const daysMatch = lowerDate.match(/dans\s+(\d+)\s+jours?/);
    if (daysMatch && daysMatch[1]) {
      const days = parseInt(daysMatch[1]);
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + days);
      return this.formatDate(futureDate);
    }
    
    return null;
  }

  /**
   * Convertit différents formats d'heure en HH:MM
   */
  private convertToTimeFormat(timeStr: string): string | null {
    if (!timeStr) return null;
    
    // Si déjà au bon format, retourner tel quel
    if (this.validateTime(timeStr)) return timeStr;
    
    const lowerTime = timeStr.toLowerCase().trim();
    
    // Gérer les formats comme "14h" ou "14h30"
    const hourMatch = lowerTime.match(/(\d{1,2})h(\d{0,2})/);
    if (hourMatch && hourMatch[1]) {
      const hours = hourMatch[1].padStart(2, '0');
      const minutes = hourMatch[2] || '00';
      const formatted = `${hours}:${minutes.padStart(2, '0')}`;
      if (this.validateTime(formatted)) return formatted;
    }
    
    // Gérer les mots-clés
    if (lowerTime.includes('matin')) return '08:00';
    if (lowerTime.includes('midi')) return '12:00';
    if (lowerTime.includes('après-midi') || lowerTime.includes('apres-midi')) return '14:00';
    if (lowerTime.includes('soir')) return '18:00';
    
    return null;
  }

  /**
   * Formate une date en JJ/MM/AAAA
   */
  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Valide et nettoie les données extraites
   */
  private validateAndCleanData(data: any): { result: ExtractionResult; errors: string[] } {
    const errors: string[] = [];
    
    const result: ExtractionResult = {
      chantier: null,
      materiaux: [],
      livraison: { date: null, heure: null },
      completude: 0.0,
      confirmation: false
    };

    try {
      // Valider chantier
      if (data.chantier && typeof data.chantier === 'string' && data.chantier.trim()) {
        result.chantier = data.chantier.trim();
      }

      // Valider matériaux
      if (Array.isArray(data.materiaux)) {
        for (const materiau of data.materiaux) {
          if (materiau.nom && typeof materiau.nom === 'string' && materiau.nom.trim()) {
            const cleanMaterial: MaterialInfo = {
              nom: materiau.nom.trim(),
              quantite: '',
              unite: ''
            };

            // Valider quantité
            if (materiau.quantite) {
              const quantiteStr = String(materiau.quantite).trim();
              const quantiteNum = parseFloat(quantiteStr.replace(',', '.'));
              if (!isNaN(quantiteNum) && quantiteNum > 0) {
                cleanMaterial.quantite = quantiteStr;
              } else {
                errors.push(`Quantité invalide pour ${materiau.nom}: ${materiau.quantite}`);
              }
            }

            // Valider unité
            if (materiau.unite && typeof materiau.unite === 'string') {
              const standardizedUnit = this.standardizeUnit(materiau.unite);
              if (this.VALID_UNITS.includes(standardizedUnit)) {
                cleanMaterial.unite = standardizedUnit;
              } else {
                errors.push(`Unité invalide pour ${materiau.nom}: ${materiau.unite}`);
              }
            }

            result.materiaux.push(cleanMaterial);
          }
        }
      }

      // Valider livraison
      if (data.livraison && typeof data.livraison === 'object') {
        // Essayer de convertir et valider la date
        if (data.livraison.date) {
          const convertedDate = this.convertToDateFormat(data.livraison.date);
          if (convertedDate && this.validateDate(convertedDate)) {
            result.livraison.date = convertedDate;
          } else if (this.validateDate(data.livraison.date)) {
            result.livraison.date = data.livraison.date;
          } else {
            errors.push(`Format de date invalide: ${data.livraison.date}`);
          }
        }

        // Essayer de convertir et valider l'heure
        if (data.livraison.heure) {
          const convertedTime = this.convertToTimeFormat(data.livraison.heure);
          if (convertedTime && this.validateTime(convertedTime)) {
            result.livraison.heure = convertedTime;
          } else if (this.validateTime(data.livraison.heure)) {
            result.livraison.heure = data.livraison.heure;
          } else {
            errors.push(`Format d'heure invalide: ${data.livraison.heure}`);
          }
        }
      }

      // Valider complétude
      if (typeof data.completude === 'number' && data.completude >= 0 && data.completude <= 1) {
        result.completude = Math.round(data.completude * 100) / 100; // Arrondir à 2 décimales
      } else {
        // Calculer la complétude automatiquement
        result.completude = this.calculateCompleteness(result);
      }

      // Valider confirmation
      result.confirmation = Boolean(data.confirmation);

    } catch (error) {
      errors.push(`Erreur de validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { result, errors };
  }

  /**
   * Calcule le score de complétude automatiquement
   */
  private calculateCompleteness(data: ExtractionResult): number {
    let score = 0.0;

    // Chantier présent
    if (data.chantier) score += 0.2;

    // Au moins un matériau avec nom
    if (data.materiaux.length > 0 && data.materiaux.some(m => m.nom)) score += 0.2;

    // Toutes les quantités présentes
    if (data.materiaux.length > 0 && data.materiaux.every(m => m.quantite)) score += 0.2;

    // Toutes les unités présentes
    if (data.materiaux.length > 0 && data.materiaux.every(m => m.unite)) score += 0.2;

    // Date présente
    if (data.livraison.date) score += 0.1;

    // Heure présente
    if (data.livraison.heure) score += 0.1;

    return Math.round(score * 100) / 100;
  }

  /**
   * Analyse la conversation et extrait les données structurées
   */
  async analyze(
    userText: string,
    history: Message[] = []
  ): Promise<ExtractionResponse> {
    const startTime = Date.now();
    
    try {
      const context = this.buildAnalysisContext(userText, history);
      
      logger.info({
        model: this.model,
        contextLength: context.length,
        historyLength: history.length,
        userTextLength: userText.length
      }, 'Analyzing conversation for data extraction');

      const response = await this.client.responses.create({
        model: this.model,
        instructions: EXTRACTION_SYSTEM_INSTRUCTIONS,
        input: context
      });

      const responseText = response.output_text.trim();
      const processingTime = Date.now() - startTime;

      // Parser le JSON de réponse
      let parsedData: any;
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseError) {
        logger.error({
          error: parseError instanceof Error ? parseError.message : 'JSON parse error',
          responseText: responseText.substring(0, 200)
        }, 'Failed to parse extraction response as JSON');

        return {
          data: {
            chantier: null,
            materiaux: [],
            livraison: { date: null, heure: null },
            completude: 0.0,
            confirmation: false
          },
          processingTime,
          errors: ['Réponse de l\'agent d\'extraction invalide (JSON malformé)'],
          isValid: false
        };
      }

      // Valider et nettoyer les données
      const { result, errors } = this.validateAndCleanData(parsedData);

      logger.info({
        processingTime,
        completude: result.completude,
        materiaux: result.materiaux.length,
        errors: errors.length,
        isValid: errors.length === 0,
        requestId: response.id || 'unknown'
      }, 'Data extraction completed');

      return {
        data: result,
        processingTime,
        errors,
        isValid: errors.length === 0
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        model: this.model,
        processingTime
      }, 'Error in data extraction');
      
      return {
        data: {
          chantier: null,
          materiaux: [],
          livraison: { date: null, heure: null },
          completude: 0.0,
          confirmation: false
        },
        processingTime,
        errors: ['Erreur technique lors de l\'extraction des données'],
        isValid: false
      };
    }
  }
}

// Instance singleton
export const extractionAgent = new ExtractionAgent();