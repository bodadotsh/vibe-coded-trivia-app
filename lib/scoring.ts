/**
 * Calculate score for a correct answer using linear time-decay.
 *
 * Score = 100 * (1 - timeTaken / timeLimit)
 *
 * Returns 0 for incorrect answers or if timeTaken >= timeLimit.
 * Result is rounded to the nearest integer.
 */
export function calculateScore(timeTaken: number, timeLimit: number, isCorrect: boolean): number {
  if (!isCorrect || timeTaken < 0 || timeLimit <= 0) return 0;
  const score = Math.max(0, 100 * (1 - timeTaken / timeLimit));
  return Math.round(score);
}
