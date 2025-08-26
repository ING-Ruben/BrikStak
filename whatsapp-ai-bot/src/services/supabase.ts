import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pino from 'pino';

const logger = pino({ name: 'supabase-service' });

export interface OrderData {
  chantier: string;
  materiau: string;
  quantite: string;
  unite: string;
  date_heure: string;
  phone_number: string;
  created_at?: string;
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private tableName: string;
  private enabled: boolean;

  constructor() {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_ANON_KEY'];
    this.tableName = process.env['SUPABASE_TABLE_NAME'] || 'commandes';
    
    // Supabase est optionnel en mode test et si les variables ne sont pas configurées
    const isTestMode = process.env['NODE_ENV'] === 'test';
    const isProductionMode = process.env['NODE_ENV'] === 'production';
    
    if (!supabaseUrl || !supabaseKey) {
      this.enabled = false;
      
      if (isTestMode) {
        logger.info('Supabase service disabled in test mode (missing env vars)');
      } else if (isProductionMode) {
        logger.warn('Supabase service disabled in production (missing SUPABASE_URL or SUPABASE_ANON_KEY)');
        logger.warn('Orders will not be saved to database. Please configure Supabase environment variables.');
      } else {
        logger.info('Supabase service disabled (missing env vars)');
      }
      return;
    }

    this.enabled = true;
    this.client = createClient(supabaseUrl, supabaseKey);
    logger.info({ tableName: this.tableName }, 'Supabase service initialized');
  }

  /**
   * Sauvegarde une commande dans Supabase
   */
  async saveOrder(orderData: OrderData): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!this.enabled || !this.client) {
      logger.warn('Supabase service is disabled, skipping order save');
      return { success: false, error: 'Supabase service not available' };
    }

    try {
      logger.info(
        { 
          chantier: orderData.chantier,
          materiau: orderData.materiau,
          phoneNumber: orderData.phone_number 
        }, 
        'Saving order to Supabase'
      );

      const dataToInsert = {
        ...orderData,
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.client
        .from(this.tableName)
        .insert([dataToInsert])
        .select('id')
        .single();

      if (error) {
        logger.error(
          { 
            error: error.message,
            code: error.code,
            phoneNumber: orderData.phone_number 
          }, 
          'Error saving order to Supabase'
        );
        return { success: false, error: error.message };
      }

      logger.info(
        { 
          id: data?.id,
          phoneNumber: orderData.phone_number 
        }, 
        'Order successfully saved to Supabase'
      );

      return { success: true, id: data?.id };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { 
          error: errorMessage,
          phoneNumber: orderData.phone_number 
        }, 
        'Unexpected error saving order to Supabase'
      );
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Récupère les commandes d'un numéro de téléphone
   */
  async getOrdersByPhone(phoneNumber: string): Promise<{ success: boolean; orders?: OrderData[]; error?: string }> {
    if (!this.enabled || !this.client) {
      logger.warn('Supabase service is disabled, skipping order fetch');
      return { success: false, error: 'Supabase service not available' };
    }

    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(
          { 
            error: error.message,
            phoneNumber 
          }, 
          'Error fetching orders from Supabase'
        );
        return { success: false, error: error.message };
      }

      return { success: true, orders: data || [] };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { 
          error: errorMessage,
          phoneNumber 
        }, 
        'Unexpected error fetching orders from Supabase'
      );
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test de connexion à Supabase
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.enabled || !this.client) {
      return { success: false, error: 'Supabase service not available' };
    }

    try {
      const { error } = await this.client
        .from(this.tableName)
        .select('count', { count: 'exact', head: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

// Instance singleton
export const supabaseService = new SupabaseService();