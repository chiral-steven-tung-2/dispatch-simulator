/** Game-time an on-scene crew works a call before it auto-resolves (ms). */
export const ON_SCENE_WORK_GAME_MS = 180_000; // 3:00 of game time

/**
 * Remaining game-time (ms) before a call resolves, given when on-scene work
 * began (real timestamp) and the current sim-speed. Clamped at 0.
 */
export function remainingResolveMs(
  resolveStartedAt: number,
  simSpeed: number,
  now: number = performance.now()
): number {
  const elapsedGame = (now - resolveStartedAt) * simSpeed;
  return Math.max(0, ON_SCENE_WORK_GAME_MS - elapsedGame);
}

/** Formats a game-time duration in ms as M:SS. */
export function formatGameDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
