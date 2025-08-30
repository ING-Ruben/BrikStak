import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pino from 'pino';
import { ExtractionResult } from './extractionAgent';

const logger = pino({ name: 'supabase-service' });

// Interface pour un matériau individuel
export interface MaterialOrderInfo {
  nom: string;
  quantite: string;
  unite: string;
}

// Interface pour une commande multi-matériaux (nouvelle)
export interface MultiMaterialOrderInfo {
  phone_number: string;
  chantier: string;
  materiaux: MaterialOrderInfo[];
  date_besoin: string;
  heure_besoin: string;
  statut: 'confirmee' | 'en_attente' | 'livree';
  created_at?: string;
  completude: number;
}

// Interface legacy pour compatibilité (ancienne)
export interface OrderInfo {
  phone_number: string;
  chantier: string;
  materiau: string;
  quantite: string;
  unite: string;
  date_besoin: string;
  heure_besoin: string;
  statut: 'confirmee' | 'en_attente' | 'livree';
  created_at?: string;
}

// Schema pour table legacy (un matériau par ligne)
export interface TableSchema {
  chantier: string;
  materiau: string;
  quantite: string;
  unite: string;
  date_besoin: string;
  heure_besoin: string;
  phone_number: string;
  statut: string;
  created_at: string;
}

// Schema pour nouvelle table (multi-matériaux)
export interface MultiMaterialTableSchema {
  chantier: string;
  materiaux_json: string; // JSON stringifié des matériaux
  date_besoin: string;
  heure_besoin: string;
  phone_number: string;
  statut: string;
  completude: number;
  created_at: string;
}

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_ANON_KEY'];

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
    logger.info('Supabase service initialized');
  }

  /**
   * Génère un nom de table normalisé basé sur le nom du chantier
   */
  private normalizeTableName(chantier: string): string {
    return `commandes_${chantier
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlève les accents
      .replace(/[^a-z0-9]/g, '_') // Remplace les caractères spéciaux par _
      .replace(/_+/g, '_') // Supprime les _ multiples
      .replace(/^_|_$/g, '')}` // Enlève les _ au début/fin
      .substring(0, 63); // Limite PostgreSQL
  }

  /**
   * Vérifie si une table existe
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .maybeSingle();

      if (error) {
        logger.warn({ error: error.message, tableName }, 'Error checking table existence');
        return false;
      }

      return data !== null;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : 'Unknown error', tableName }, 'Error checking table existence');
      return false;
    }
  }

  /**
   * Crée une table pour un chantier si elle n'existe pas
   */
  private async createTableIfNotExists(tableName: string): Promise<boolean> {
    try {
      const exists = await this.tableExists(tableName);
      if (exists) {
        logger.info({ tableName }, 'Table already exists');
        return true;
      }

      // Créer la table avec RPC (appel de fonction PostgreSQL)
      const { error } = await this.client.rpc('create_orders_table', {
        table_name: tableName
      });

      if (error) {
        logger.error({ error: error.message, tableName }, 'Failed to create table');
        return false;
      }

      logger.info({ tableName }, 'Table created successfully');
      return true;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error', 
        tableName 
      }, 'Error creating table');
      return false;
    }
  }

  /**
   * Crée une table multi-matériaux pour un chantier si elle n'existe pas
   */
  private async createMultiMaterialTableIfNotExists(tableName: string): Promise<boolean> {
    try {
      const exists = await this.tableExists(tableName);
      if (exists) {
        logger.info({ tableName }, 'Multi-material table already exists');
        return true;
      }

      // Créer la table multi-matériaux avec RPC
      const { error } = await this.client.rpc('create_multi_material_orders_table', {
        table_name: tableName
      });

      if (error) {
        logger.error({ error: error.message, tableName }, 'Failed to create multi-material table');
        return false;
      }

      logger.info({ tableName }, 'Multi-material table created successfully');
      return true;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error', 
        tableName 
      }, 'Error creating multi-material table');
      return false;
    }
  }

  /**
   * Stocke une commande multi-matériaux (nouvelle méthode)
   */
  async storeMultiMaterialOrder(orderInfo: MultiMaterialOrderInfo): Promise<boolean> {
    try {
      const tableName = `multi_${this.normalizeTableName(orderInfo.chantier)}`;
      
      // Créer la table multi-matériaux si nécessaire
      const tableCreated = await this.createMultiMaterialTableIfNotExists(tableName);
      if (!tableCreated) {
        throw new Error(`Failed to create or access multi-material table: ${tableName}`);
      }

      // Préparer les données pour l'insertion
      const orderData = {
        chantier: orderInfo.chantier,
        materiaux_json: JSON.stringify(orderInfo.materiaux),
        date_besoin: orderInfo.date_besoin,
        heure_besoin: orderInfo.heure_besoin,
        phone_number: orderInfo.phone_number,
        statut: orderInfo.statut,
        completude: orderInfo.completude,
        created_at: new Date().toISOString()
      };

      // Insérer la commande
      const { error } = await this.client
        .from(tableName)
        .insert([orderData])
        .select();

      if (error) {
        logger.error({ error: error.message, tableName, orderData }, 'Failed to insert multi-material order');
        return false;
      }

      logger.info({ 
        tableName, 
        chantier: orderInfo.chantier,
        materiaux: orderInfo.materiaux.length,
        completude: orderInfo.completude,
        orderData 
      }, 'Multi-material order stored successfully');

      return true;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        orderInfo 
      }, 'Error storing multi-material order');
      return false;
    }
  }

  /**
   * Convertit les données d'extraction en commande multi-matériaux
   */
  convertExtractionToMultiMaterialOrder(
    extractionData: ExtractionResult, 
    phoneNumber: string
  ): MultiMaterialOrderInfo | null {
    // Vérifier que nous avons au minimum un chantier et une date/heure
    if (!extractionData.chantier || !extractionData.livraison.date || !extractionData.livraison.heure) {
      return null;
    }

    // Vérifier qu'il y a au moins un matériau avec nom
    if (extractionData.materiaux.length === 0 || !extractionData.materiaux.some(m => m.nom)) {
      return null;
    }

    // Filtrer les matériaux valides
    const validMaterials = extractionData.materiaux.filter(m => 
      m.nom && m.nom.trim()
    ).map(m => ({
      nom: m.nom.trim(),
      quantite: m.quantite || '',
      unite: m.unite || ''
    }));

    if (validMaterials.length === 0) {
      return null;
    }

    return {
      phone_number: phoneNumber,
      chantier: extractionData.chantier,
      materiaux: validMaterials,
      date_besoin: extractionData.livraison.date,
      heure_besoin: extractionData.livraison.heure,
      statut: extractionData.confirmation ? 'confirmee' : 'en_attente',
      completude: extractionData.completude
    };
  }

  /**
   * Stocke une commande dans la table appropriée (legacy - maintenu pour compatibilité)
   */
  async storeOrder(orderInfo: OrderInfo): Promise<boolean> {
    try {
      const tableName = this.normalizeTableName(orderInfo.chantier);
      
      // Créer la table si nécessaire
      const tableCreated = await this.createTableIfNotExists(tableName);
      if (!tableCreated) {
        throw new Error(`Failed to create or access table: ${tableName}`);
      }

      // Préparer les données pour l'insertion
      const orderData = {
        chantier: orderInfo.chantier,
        materiau: orderInfo.materiau,
        quantite: orderInfo.quantite,
        unite: orderInfo.unite,
        date_besoin: orderInfo.date_besoin,
        heure_besoin: orderInfo.heure_besoin,
        phone_number: orderInfo.phone_number,
        statut: orderInfo.statut,
        created_at: new Date().toISOString()
      };

      // Insérer la commande
      const { error } = await this.client
        .from(tableName)
        .insert([orderData])
        .select();

      if (error) {
        logger.error({ error: error.message, tableName, orderData }, 'Failed to insert order');
        return false;
      }

      logger.info({ 
        tableName, 
        chantier: orderInfo.chantier,
        materiau: orderInfo.materiau,
        orderData 
      }, 'Order stored successfully');

      return true;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        orderInfo 
      }, 'Error storing order');
      return false;
    }
  }

  /**
   * Récupère les commandes d'un chantier
   */
  async getOrdersForChantier(chantier: string): Promise<OrderInfo[]> {
    try {
      const tableName = this.normalizeTableName(chantier);
      
      const exists = await this.tableExists(tableName);
      if (!exists) {
        logger.info({ chantier, tableName }, 'Table does not exist, returning empty array');
        return [];
      }

      const { data, error } = await this.client
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error({ error: error.message, tableName }, 'Failed to fetch orders');
        return [];
      }

      logger.info({ chantier, ordersCount: data?.length || 0 }, 'Orders retrieved');
      return data || [];
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        chantier 
      }, 'Error fetching orders');
      return [];
    }
  }

  /**
   * Liste tous les chantiers (tables de commandes)
   */
  async listChantiers(): Promise<string[]> {
    try {
      const { data, error } = await this.client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .like('table_name', 'commandes_%');

      if (error) {
        logger.error({ error: error.message }, 'Failed to list chantiers');
        return [];
      }

      const chantiers = (data || []).map(table => 
        table.table_name.replace('commandes_', '').replace(/_/g, ' ')
      );

      logger.info({ chantiersCount: chantiers.length }, 'Chantiers listed');
      return chantiers;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error listing chantiers');
      return [];
    }
  }
}

// Instance singleton
export const supabaseService = new SupabaseService();