import { useEffect } from "react";
import { useIncidentStore } from "../stores/incidentStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { GAME_CONFIG } from "../config/gameConfig";

const { tickMs: TICK_MS, gameSecondsPerCall: GAME_SECONDS_PER_CALL } =
  GAME_CONFIG.spawner;

/** Randomly spawns calls over time while auto-spawn is enabled, scaled by sim-speed. */
export function useCallSpawner(): void {
  const autoSpawn = useIncidentStore((s) => s.autoSpawn);
  const spawnCall = useIncidentStore((s) => s.spawnCall);

  useEffect(() => {
    if (!autoSpawn) {
      return;
    }
    const id = window.setInterval(() => {
      const simSpeed = useDispatchStore.getState().simSpeed;
      const gameSeconds = (TICK_MS / 1000) * simSpeed;
      const expected = gameSeconds / GAME_SECONDS_PER_CALL;

      // Spawn the whole part, plus the fractional part as a probability.
      let count = Math.floor(expected);
      if (Math.random() < expected - count) {
        count++;
      }
      for (let i = 0; i < count; i++) {
        spawnCall();
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [autoSpawn, spawnCall]);
}
