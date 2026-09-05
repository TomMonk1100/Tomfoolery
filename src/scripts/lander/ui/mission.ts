/** Small, pure screen fragments for the flight flow. Kept outside the game
 * controller so the copy and failure guidance are testable. */

export type LandingFailure = 'off-pad' | 'too-fast' | 'tilted' | 'hazard';

export function crashAdvice(reason: LandingFailure): { title: string; detail: string; next: string } {
  switch (reason) {
    case 'off-pad': return { title: 'Missed the landing station', detail: 'The skids touched open rock instead of the illuminated pad.', next: 'Line up with the chevrons before the final descent.' };
    case 'too-fast': return { title: 'Descent was too fast', detail: 'The landing gear can only absorb a gentle arrival.', next: 'Hold thrust in short bursts until the descent gauge turns green.' };
    case 'tilted': return { title: 'The lander was tilted', detail: 'The pad caught a skid before the hull was level.', next: 'Use a quick counter-rotation just before touchdown.' };
    default: return { title: 'A hazard ended the descent', detail: 'The hull took a hit before it reached the station.', next: 'Watch for the amber threat signal and keep a little room to maneuver.' };
  }
}

export function flightLessonHtml(touch: boolean): string {
  const controls = touch ? 'Hold ▲ to slow down. Use ⟲ and ⟳ to level the ship.' : 'Hold Space or ↑ to slow down. Use ← and → to level the ship.';
  return `<div class="mission-lesson"><p class="mission-kicker">flight lesson · optional</p><h2>Read the instruments, then fly.</h2><ol><li><b>Slow the descent.</b> ${controls}</li><li><b>Follow the approach.</b> The station chevrons mark the safe pad.</li><li><b>Land level.</b> Both descent and attitude turn green when it is safe.</li></ol><button data-action="back-to-menu" class="mission-link">back to mission select</button></div>`;
}
