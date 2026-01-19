export interface UserProfile {
  id?: number;
  name: string;
  totalReviews: number;
  streakDays: number;
  lastReviewDate: string;
  srsSettings?: SRSSettings;
}

export interface SRSSettings {
  initialEase: number; // Default 2.5
  intervalModifier: number; // Default 1.0 (100%)
  maxInterval: number; // Days
  // New customized steps (stored in minutes)
  steps: {
    again: number; // Default 1 min
    hard: number;  // Default 6 min (or 12h user preference)
    good: number;  // Default 1 day (1440 min)
    easy: number;  // Default 4 days (5760 min)
  };
}

export interface Document {
  id?: number;
  title: string;
  content: string;
  createdAt: string;
}

export enum QcmDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

export interface Qcm {
  id?: number;
  documentId: number;
  question: string; // May contain :::IMG:base64::: prefix
  imageUrl?: string; // Legacy support
  options: string[]; // May contain :::IMG:base64::: prefix
  correctIndex: number; // 0-3
  difficulty: QcmDifficulty;
  
  // SRS Data
  easeFactor: number; // Default 2.5
  interval: number; // Days
  repetition: number;
  nextReviewDate: number; // Timestamp
  lastReviewed: number | null;
}

export interface RevisionHistory {
  id?: number;
  qcmId: number;
  date: number;
  quality: number; // 0-5
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}