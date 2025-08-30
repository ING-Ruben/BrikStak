import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pino from 'pino';

const logger = pino({ name: 'supabase-service' });

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
   * Stocke une commande dans la table appropriée
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