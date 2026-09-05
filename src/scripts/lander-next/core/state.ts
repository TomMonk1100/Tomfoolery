import type { Difficulty } from '../content/balance';
import type { UpgradeId } from '../content/upgrades';
import type { RngStreams } from './rng';

export type SessionState = 'boot' | 'title' | 'training' | 'ready' | 'flying' | 'paused' | 'landed' | 'upgrade' | 'crashed' | 'hangar' | 'settings' | 'error';
export type LayoutProfile = 'portrait' | 'landscape';
export type LandingStatus = 'approach' | 'good' | 'great' | 'danger' | 'crash';
export interface InputFrame { rotate: -1 | 0 | 1; leftHeld: boolean; rightHeld: boolean; thrust: boolean; abilityPressed: boolean; bothTurnHeld: boolean; kickLeftPressed: boolean; kickRightPressed: boolean; }
export interface Point { x: number; y: number; }
export interface TerrainState { points: Point[]; pad: { xStart: number; xEnd: number; y: number; vx: number; baseX: number; range: number }; }
export interface ShipState { x: number; y: number; vx: number; vy: number; angle: number; angularVelocity: number; throttle: number; fuel: number; alive: boolean; thrusting: boolean; }
export interface HazardState { id: number; x: number; y: number; vx: number; vy: number; radius: number; alive: boolean; }
export interface RunStats { landings: number; crashes: number; stardustEarned: number; bestLanding: 'soft' | 'great' | 'perfect' | null; }
export interface RunState { seed: number; rulesetVersion: string; difficulty: Difficulty; profile: LayoutProfile; level: number; upgrades: UpgradeId[]; score: number; stardust: number; stats: RunStats; rng: RngStreams; }
export interface WorldState { width: number; height: number; terrain: TerrainState; ship: ShipState; hazards: HazardState[]; time: number; wind: number; gravity: number; landing: LandingStatus; message: string; }
export interface GameState { session: SessionState; run: RunState; world: WorldState; previousShip: ShipState; offer: UpgradeId[]; selectedCosmetic: { paint: string; trail: string; sky: string }; reducedMotion: boolean; }

export function cloneShip(ship: ShipState): ShipState { return { ...ship }; }
