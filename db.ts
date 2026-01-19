import Dexie, { Table } from 'dexie';
import { UserProfile, Document, Qcm, RevisionHistory, ChatMessage } from './types';

class SmartRecallDB extends Dexie {
  users!: Table<UserProfile>;
  documents!: Table<Document>;
  qcm!: Table<Qcm>;
  revisionHistory!: Table<RevisionHistory>;
  chatHistory!: Table<ChatMessage>;

  constructor() {
    super('SmartRecallDB');
    // Fix: Cast 'this' to any to avoid TS error "Property 'version' does not exist on type 'SmartRecallDB'"
    (this as any).version(1).stores({
      users: '++id, name',
      documents: '++id, title, createdAt',
      qcm: '++id, documentId, nextReviewDate',
      revisionHistory: '++id, qcmId, date',
      chatHistory: '++id, timestamp'
    });
  }
}

export const db = new SmartRecallDB();

// Initialize default user if not exists
export const initUser = async () => {
  const count = await db.users.count();
  if (count === 0) {
    await db.users.add({
      name: 'Student',
      totalReviews: 0,
      streakDays: 0,
      lastReviewDate: new Date().toISOString()
    });
  }
};