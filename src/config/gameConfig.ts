/**
 * Centralized tunable game parameters. Adjust values here to change game
 * balance/pacing without hunting through individual modules.
 */
export const GAME_CONFIG = {
  /** Response perimeter (the circle drawn around each call). */
  callArea: {
    /** Radius (m) every call starts at before any units arrive. */
    startRadiusMeters: 20,
    /** Radius growth (m) per unit that arrives on scene. */
    radiusStepMeters: 2,
    /** Fallback radius (m) used if a call has no radius set. */
    defaultRadiusMeters: 80,
  },

  /** On-scene work / auto-resolve timing. */
  resolve: {
    /** Game-time (ms) an on-scene crew works a call before it auto-resolves. */
    onSceneWorkGameMs: 180_000,
    /** How often (real ms) the resolve ticker checks for completed calls. */
    tickMs: 250,
  },

  /** Mandatory-response assignment escalation. */
  upgrade: {
    /**
     * Game-time (ms) between upgrade-probability rolls once a call's current
     * assignment is fully staffed on scene.
     */
    checkIntervalGameMs: 60_000,
  },

  /** Auto-dispatcher (simulator mode). */
  autoDispatch: {
    /** How often (real ms) to check for calls needing more units. */
    checkIntervalMs: 1_500,
  },

  /** Random call spawning. */
  spawner: {
    /** How often (real ms) the spawner evaluates whether to create a call. */
    tickMs: 1_000,
    /** Citywide, roughly one call every this many game seconds. */
    gameSecondsPerCall: 120,
  },

  /** Dispatch routing and on-scene parking. */
  dispatch: {
    /** Minimum real-ms duration for any route leg (avoids instant "arrivals"). */
    minLegMs: 1_000,
    /** Real ms a resolved call lingers on the map before it is removed. */
    resolvedLingerMs: 4_000,
    /** First-due unit's parking distance (m) from the call center. */
    parkBaseMeters: 6,
    /** Extra parking distance (m) per later arrival. */
    parkStepMeters: 5,
    /** Keep parked units this far (m) inside the perimeter edge. */
    parkEdgeMarginMeters: 3,
  },

  /**
   * Turnout time: how long a dispatched unit takes to leave quarters before it
   * starts driving. A random value (in game-time ms) is picked per dispatch
   * between these bounds.
   */
  turnout: {
    /** Minimum game-time (ms) before a dispatched unit starts driving. */
    minGameMs: 30_000,
    /** Maximum game-time (ms) before a dispatched unit starts driving. */
    maxGameMs: 90_000,
  },

  /** Map rendering. */
  map: {
    /** How often (real ms) to rebuild dispatch route line geometry. */
    routeLineUpdateIntervalMs: 120,
  },

  /** Selectable simulation-speed multipliers (1 = real time). */
  simSpeeds: [1, 2, 3, 5, 10, 20, 30, 60],

  /** NYPD patrol car simulation. */
  nypdPatrol: {
    /** Simulated "On Assignment" share of each precinct's fleet. */
    onAssignment: {
      /** Minimum fraction (0-1) of the fleet shown as on assignment. */
      minFraction: 0.05,
      /** Maximum fraction (0-1) of the fleet shown as on assignment. */
      maxFraction: 0.15,
      /** How often (real ms) the on-assignment fraction is re-rolled per precinct. */
      updateIntervalMs: 15_000,
    },
  },
} as const;

/** Picks a random turnout duration (game-ms) between the configured min/max. */
export function randomTurnoutMs(): number {
  const { minGameMs, maxGameMs } = GAME_CONFIG.turnout;
  return minGameMs + Math.random() * (maxGameMs - minGameMs);
}
