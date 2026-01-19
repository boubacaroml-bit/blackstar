import { Qcm, SRSSettings } from '../types';

/**
 * SuperMemo-2 (SM-2) Algorithm Implementation with Custom Steps
 */

export const calculateNextReview = (
  currentQcm: Qcm,
  quality: number,
  settings?: SRSSettings
): Partial<Qcm> => {
  let { easeFactor, repetition, interval } = currentQcm;
  
  // Defaults
  const intervalMod = (settings?.intervalModifier || 100) / 100;
  const maxInterval = settings?.maxInterval || 36500;
  const minEase = 1.3;

  // Custom Steps (defaults if not present)
  // Store intervals in DAYS for the algorithm, but settings might give minutes for short steps
  const getStepInDays = (val: number | undefined, defaultMin: number) => {
    return (val ?? defaultMin) / 1440; // Convert minutes to days
  };

  const steps = settings?.steps || {
    again: 1,    // 1 min
    hard: 10,    // 10 min
    good: 1440,  // 1 day
    easy: 5760   // 4 days
  };

  if (quality >= 3) {
    // Correct response logic
    if (repetition === 0) {
      // First successful review: Use the "Good" or "Easy" step based on quality
      // Standard Anki behavior: 
      // If user hit Easy on new card -> Jump to Easy interval immediately
      // If user hit Good on new card -> Jump to Good interval
      if (quality === 3) interval = steps.good / 1440; 
      else if (quality === 4) interval = steps.good / 1440; // Treat 'Hard' success as Good for first pass or handle separately
      else if (quality === 5) interval = steps.easy / 1440;
      
      // Fallback if calculated interval is 0 (shouldn't happen with defaults)
      if (interval <= 0) interval = 1;
    } else {
      // Subsequent reviews: Apply SM-2 multiplier
      // If previous was < 1 day (learning phase), we might want to graduate to 1 day, 
      // but here we stick to simple SM-2 expansion
      if (interval < 0.01) interval = 1; // Graduate from minutes to day
      interval = interval * easeFactor * intervalMod;
    }
    repetition += 1;
  } else {
    // Incorrect (Again) or Hard (if treated as fail/reset in strict modes, but usually Hard just repeats sooner)
    // Here we map "Again" (quality 0) to reset
    if (quality === 0) {
        repetition = 0;
        interval = steps.again / 1440; // Go back to "Again" step
    } 
    // Note: Quality 3 (Hard) is handled in the success block above but normally updates EF downwards.
  }

  // Calculate Hard separately if it was pressed? 
  // In typical UI: Again(0), Hard(3), Good(4), Easy(5).
  // Our UI sends 0, 3, 4, 5.
  // We need to ensure logic aligns with UI buttons.
  
  // Re-evaluating logic based on specific button press passed as 'quality'
  // 0 = Again, 3 = Hard, 4 = Good, 5 = Easy
  
  if (quality === 0) {
      repetition = 0;
      interval = steps.again / 1440;
  } else if (quality === 3) {
      // Hard: typically 1.2x interval or fixed step if new
      if (repetition === 0) interval = steps.hard / 1440;
      else interval = Math.max(steps.hard/1440, interval * 1.2 * intervalMod);
      easeFactor -= 0.15; // Hard penalty
  } else if (quality === 4) {
      // Good
      if (repetition === 0) interval = steps.good / 1440;
      else interval = Math.round(interval * easeFactor * intervalMod * 100) / 100;
  } else if (quality === 5) {
      // Easy
      if (repetition === 0) interval = steps.easy / 1440;
      else {
          interval = Math.round(interval * easeFactor * intervalMod * 1.3 * 100) / 100; // Easy bonus
          easeFactor += 0.15;
      }
  }

  if (repetition > 0 && quality >= 3) {
      // SM-2 EF update for non-fail
      // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
      // Only apply full formula for Good/Easy to refine
      // We already adjusted manually above, but let's standardise
      if (quality === 4) {
           // Standard SM2 calculation
           // q=4 -> 0.1 - (1)*(0.1) = 0 -> EF stays
      }
  }

  // Cap interval
  if (interval > maxInterval) interval = maxInterval;
  
  // Floor check
  if (interval < (1/1440)) interval = 1/1440; // Minimum 1 min

  // EF cannot go below 1.3
  if (easeFactor < minEase) easeFactor = minEase;

  // Calculate next date
  // We add interval (days) to Now
  const nextDateVal = Date.now() + (interval * 24 * 60 * 60 * 1000);

  return {
    easeFactor,
    repetition: quality === 0 ? 0 : repetition + 1,
    interval,
    nextReviewDate: nextDateVal,
    lastReviewed: Date.now()
  };
};

export const getCardsDue = (qcmList: Qcm[]): Qcm[] => {
  const now = Date.now();
  return qcmList.filter(q => q.nextReviewDate <= now);
};

// Helper to format interval for UI
export const formatInterval = (min: number): string => {
    if (min < 60) return `${Math.round(min)}m`;
    if (min < 1440) return `${Math.round(min/60)}h`;
    return `${Math.round(min/1440)}d`;
}