import { describe, expect, it } from 'vitest';
import { createGameState } from '../core/session';
import { stepFlight } from '../simulation/flight';
import { checkpointFor, loadCheckpoint, loadProfile, saveCheckpoint, saveProfile } from '../platform/saves';
import type { InputFrame, WorldState } from '../core/state';

const input = (overrides: Partial<InputFrame> = {}): InputFrame => ({ rotate: 0, leftHeld: false, rightHeld: false, thrust: false, abilityPressed: false, bothTurnHeld: false, kickLeftPressed: false, kickRightPressed: false, ...overrides });

function flightWorld(): WorldState {
  const state = createGameState(7);
  state.world.terrain = { points: [{ x: 0, y: 600 }, { x: 1000, y: 600 }], pad: { xStart: 700, xEnd: 850, y: 600, vx: 0, baseX: 775, range: 0 } };
  state.world.ship.y = 100;
  return state.world;
}

describe('lander-next recovery gates', () => {
  it('uses named portrait geometry and freezes it in the run state', () => {
    const state = createGameState(42, 'pilot', 'portrait');
    expect(state.run.profile).toBe('portrait');
    expect(state.world.width).toBe(420);
    expect(state.world.height).toBe(640);
  });

  it('matches the legacy steering response and settles quickly on release', () => {
    const world = flightWorld();
    for (let i = 0; i < 60; i += 1) stepFlight(world, input({ rotate: 1, rightHeld: true }), 1 / 120, 'pilot');
    const heldAngle = world.ship.angle;
    for (let i = 0; i < 120; i += 1) stepFlight(world, input(), 1 / 120, 'pilot');
    const coastAngle = world.ship.angle;
    expect(heldAngle * 180 / Math.PI).toBeGreaterThan(55);
    expect(heldAngle * 180 / Math.PI).toBeLessThan(75);
    expect((coastAngle - heldAngle) * 180 / Math.PI).toBeGreaterThan(3);
    expect((coastAngle - heldAngle) * 180 / Math.PI).toBeLessThan(9);
  });

  it('round-trips a profile and checkpoint without changing identity', () => {
    const storage = new Map<string, string>();
    const fakeStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } } as unknown as Storage;
    const profile = loadProfile(fakeStorage).profile;
    profile.stardust = 17;
    profile.cosmetics.equipped.paint = 'paint_gold';
    saveProfile(fakeStorage, profile);
    const restored = loadProfile(fakeStorage).profile;
    expect(restored.stardust).toBe(17);
    expect(restored.cosmetics.equipped.paint).toBe('paint_gold');
    const state = createGameState(99, 'ace', 'portrait');
    state.run.level = 4;
    expect(saveCheckpoint(fakeStorage, checkpointFor(state))).toBe(true);
    expect(loadCheckpoint(fakeStorage)).toMatchObject({ seed: 99, difficulty: 'ace', profile: 'portrait', nextLevel: 4 });
  });
});
