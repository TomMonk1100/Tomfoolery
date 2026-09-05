import { FixedClock } from './core/clock';
import { createGameState, beginDescent } from './core/session';
import { stepSimulation } from './simulation/step';
import { resolveUpgrade } from './simulation/progression';
import { createInputController } from './platform/input';
import { AudioMixer } from './platform/audio';
import { checkpointFor, loadCheckpoint, loadProfile, saveCheckpoint, saveProfile } from './platform/saves';
import { createRenderer } from './presentation/renderer';
import { updateHud } from './ui/hud';
import { crashScreen, errorScreen, hangarScreen, pauseScreen, titleScreen, trainingScreen, upgradeScreen } from './ui/screens';
import type { GameEvent } from './core/events';
import type { GameState } from './core/state';
import type { Difficulty } from './content/balance';

export async function mountLander(root: HTMLElement): Promise<{ destroy(): void }> {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-next-canvas]'); const viewport = root.querySelector<HTMLElement>('[data-next-viewport]'); const overlay = root.querySelector<HTMLElement>('[data-next-overlay]');
  if (!canvas || !viewport || !overlay) return { destroy() {} };
  const refs = { fuel: root.querySelector<HTMLElement>('[data-next-hud="fuel"]')!, altitude: root.querySelector<HTMLElement>('[data-next-hud="altitude"]')!, descent: root.querySelector<HTMLElement>('[data-next-hud="descent"]')!, drift: root.querySelector<HTMLElement>('[data-next-hud="drift"]')!, attitude: root.querySelector<HTMLElement>('[data-next-hud="attitude"]')!, landing: root.querySelector<HTMLElement>('[data-next-hud="landing"]')!, level: root.querySelector<HTMLElement>('[data-next-hud="level"]')!, score: root.querySelector<HTMLElement>('[data-next-hud="score"]')! };
  const storage = (() => { try { return window.localStorage; } catch { return null; } })(); const { profile } = loadProfile(storage); const checkpoint = loadCheckpoint(storage);
  let state: GameState = createGameState(Date.now() >>> 0, (storage?.getItem('lander-diff') as Difficulty) || 'pilot'); state.run.stardust = profile.stardust; state.selectedCosmetic = profile.cosmetics.equipped; state.reducedMotion = profile.preferences.reducedMotion;
  const clock = new FixedClock(); const input = createInputController(root); const audio = new AudioMixer(); let renderer: Awaited<ReturnType<typeof createRenderer>> | null = null; let raf = 0; let disposed = false; let events: GameEvent[] = [];
  const setOverlay = (html: string, visible = true) => { overlay.innerHTML = html; overlay.hidden = !visible; };
  const showTitle = () => { state.session = 'title'; setOverlay(titleScreen(state, Boolean(checkpoint))); };
  const persist = () => { profile.stardust = state.run.stardust; profile.cosmetics.equipped = state.selectedCosmetic; saveProfile(storage, profile); };
  const start = () => { if (checkpoint) { state = createGameState(checkpoint.seed, checkpoint.difficulty); state.run.level = checkpoint.nextLevel; state.run.upgrades = [...checkpoint.upgrades]; state.run.stardust = checkpoint.stardust; state.run.score = checkpoint.score; } beginDescent(state); setOverlay('', false); audio.cue('thrust'); };
  const pause = () => { if (state.session !== 'flying') return; state.session = 'paused'; clock.pause(); input.reset(); setOverlay(pauseScreen()); };
  const resume = () => { if (state.session !== 'paused') return; state.session = 'flying'; clock.resume(); setOverlay('', false); };
  const handleAction = (action: string) => { if (action === 'start') start(); else if (action === 'training') { state.session = 'training'; setOverlay(trainingScreen()); } else if (action === 'hangar') setOverlay(hangarScreen(state)); else if (action === 'back' || action === 'quit') showTitle(); else if (action === 'pause') pause(); else if (action === 'resume') resume(); else if (action === 'retry') { beginDescent(state); setOverlay('', false); } else if (action === 'settings') { setOverlay(`<section class="next-screen"><p class="next-kicker">FLIGHT DECK / SETTINGS</p><h2>Instrument settings</h2><label class="next-toggle"><input type="checkbox" data-next-motion ${state.reducedMotion ? 'checked' : ''}> Reduce motion</label><label class="next-toggle"><input type="checkbox" data-next-sound checked> Sound effects</label><div class="next-actions"><button data-next-action="back" class="next-primary">Done</button></div></section>`); } else if (action === 'skip' && state.session === 'upgrade') { state.run.stardust += 8; state.run.level += 1; state.session = 'ready'; persist(); saveCheckpoint(storage, checkpointFor(state)); beginDescent(state); setOverlay('', false); } };
  const click = (event: MouseEvent) => { const target = event.target as HTMLElement; const action = target.closest<HTMLElement>('[data-next-action]')?.dataset.nextAction; const upgrade = target.closest<HTMLElement>('[data-next-upgrade]')?.dataset.nextUpgrade; if (action) handleAction(action); if (upgrade && resolveUpgrade(state, upgrade as never)) { audio.cue('upgrade'); persist(); saveCheckpoint(storage, checkpointFor(state)); beginDescent(state); setOverlay('', false); } };
  root.addEventListener('click', click); const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape' || event.key.toLowerCase() === 'p') { if (state.session === 'flying') pause(); else if (state.session === 'paused') resume(); } }; window.addEventListener('keydown', keydown); window.addEventListener('blur', pause); const visibility = () => { if (document.hidden) pause(); }; document.addEventListener('visibilitychange', visibility);
  setOverlay(titleScreen(state, Boolean(checkpoint)));
  try { renderer = await createRenderer(canvas, viewport, profile.preferences.quality, (message) => { state.session = 'error'; setOverlay(errorScreen(message)); }); } catch { return { destroy() { disposed = true; input.destroy(); root.removeEventListener('click', click); window.removeEventListener('keydown', keydown); } }; }
  clock.reset();
  const frame = (now: number) => { if (disposed) return; const clockFrame = clock.advance(now, (dt) => { events = []; stepSimulation(state, input.frame(), dt, events); for (const event of events) { if (event.type === 'touchdown') audio.cue('landing'); if (event.type === 'upgrade-offer') setOverlay(upgradeScreen(state)); if (event.type === 'crash') { audio.cue('crash'); setOverlay(crashScreen(state)); } } }); updateHud(refs, state); renderer?.render(state, clockFrame.alpha); raf = requestAnimationFrame(frame); };
  raf = requestAnimationFrame(frame);
  return { destroy() { disposed = true; cancelAnimationFrame(raf); input.destroy(); audio.destroy(); renderer?.destroy(); root.removeEventListener('click', click); window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility); } };
}
