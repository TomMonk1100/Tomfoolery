import type { InputFrame } from '../core/state';
export interface InputController { frame(): InputFrame; destroy(): void; reset(): void; }

export function createInputController(root: HTMLElement): InputController {
  const held = new Set<string>(); let rotate: -1 | 0 | 1 = 0; let abilityPressed = false;
  const keydown = (event: KeyboardEvent) => { if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'A', 'd', 'D'].includes(event.key)) event.preventDefault(); held.add(event.key); if (event.key === 'q' || event.key === 'Q') abilityPressed = true; };
  const keyup = (event: KeyboardEvent) => held.delete(event.key);
  const pointer = (event: PointerEvent) => { const target = (event.target as HTMLElement).closest<HTMLElement>('[data-next-input]'); if (!target) return; target.setPointerCapture?.(event.pointerId); held.add(target.dataset.nextInput || ''); };
  const pointerup = (event: PointerEvent) => { const target = event.target as HTMLElement; held.delete(target.closest<HTMLElement>('[data-next-input]')?.dataset.nextInput || ''); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); root.addEventListener('pointerdown', pointer); root.addEventListener('pointerup', pointerup); root.addEventListener('pointercancel', pointerup);
  return { frame() { rotate = held.has('ArrowLeft') || held.has('left') || held.has('a') || held.has('A') ? -1 : held.has('ArrowRight') || held.has('right') || held.has('d') || held.has('D') ? 1 : 0; const frame = { rotate, thrust: held.has(' ') || held.has('thrust'), abilityPressed, bothTurnHeld: (held.has('ArrowLeft') || held.has('left')) && (held.has('ArrowRight') || held.has('right')), kickLeftPressed: false, kickRightPressed: false }; abilityPressed = false; return frame; }, reset() { held.clear(); abilityPressed = false; }, destroy() { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); root.removeEventListener('pointerdown', pointer); root.removeEventListener('pointerup', pointerup); root.removeEventListener('pointercancel', pointerup); } };
}
