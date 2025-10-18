export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Session {
  messages: Message[];
  lastUpdated: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private readonly TTL_MS = 2 * 60 * 60 * 1000; // 2 heures en millisecondes
  private readonly MAX_MESSAGES = 15;

  /**
   * Nettoie les sessions expirées
   */
  private cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [phoneNumber, session] of this.sessions.entries()) {
      if (now - session.lastUpdated > this.TTL_MS) {
        this.sessions.delete(phoneNumber);
      }
    }
  }

  /**
   * Récupère l'historique des messages pour un numéro de téléphone
   */
  getHistory(phoneNumber: string): Message[] {
    this.cleanExpiredSessions();
    
    const session = this.sessions.get(phoneNumber);
    if (!session) {
      return [];
    }

    return [...session.messages]; // Retourne une copie
  }

  /**
   * Ajoute un nouveau message à la session
   */
  addMessage(phoneNumber: string, message: Message): void {
    this.cleanExpiredSessions();
    
    let session = this.sessions.get(phoneNumber);
    if (!session) {
      session = {
        messages: [],
        lastUpdated: Date.now()
      };
      this.sessions.set(phoneNumber, session);
    }

    session.messages.push(message);
    session.lastUpdated = Date.now();

    // Limiter le nombre de messages
    if (session.messages.length > this.MAX_MESSAGES) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES);
    }
  }

  /**
   * Remet à zéro l'historique pour un numéro de téléphone
   */
  resetHistory(phoneNumber: string): void {
    this.sessions.delete(phoneNumber);
  }

  /**
   * Retourne le nombre de sessions actives
   */
  getActiveSessionsCount(): number {
    this.cleanExpiredSessions();
    return this.sessions.size;
  }
}

// Instance singleton
export const sessionManager = new SessionManager();