import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { GameState } from '../core/state';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../content/balance';
import type { QualityTier } from './quality';
import { qualitySettings } from './quality';

const C = { night: 0x101724, cream: 0xf4ebda, copper: 0xc97b3d, moss: 0x7c8f5c, slate: 0x45515b, signal: 0xd4eef1, danger: 0xf08b67 };
export interface Renderer { render(state: GameState, alpha: number): void; resize(): void; destroy(): void; }

export async function createRenderer(canvas: HTMLCanvasElement, viewport: HTMLElement, quality: QualityTier, onFailure: (message: string) => void): Promise<Renderer> {
  const app = new Application();
  try {
    await app.init({ canvas, width: WORLD_WIDTH, height: WORLD_HEIGHT, preference: 'webgl', autoStart: false, antialias: true, resolution: qualitySettings(quality).pixelRatio, background: C.night, clearBeforeRender: true });
  } catch (error) { onFailure(`WebGL could not initialize. ${error instanceof Error ? error.message : 'Try reloading the flight deck.'}`); throw error; }
  const root = new Container(); const backdrop = new Container(); const terrainLayer = new Graphics(); const objectsLayer = new Container(); const fxLayer = new Graphics(); root.addChild(backdrop, terrainLayer, objectsLayer, fxLayer); app.stage.addChild(root);
  let background: Sprite | null = null;
  try { const texture = await Assets.load<Texture>('/game/lander/first-light-basin.png'); background = new Sprite(texture); background.anchor.set(0.5); backdrop.addChild(background); } catch { /* the vector composition remains usable when optional art is unavailable */ }
  const terrain = terrainLayer; const ship = new Graphics(); const pad = new Graphics(); const hazardGraphics = new Graphics(); objectsLayer.addChild(pad, hazardGraphics, ship);
  let scale = 1; let offsetX = 0; let offsetY = 0; let worldWidth = WORLD_WIDTH; let worldHeight = WORLD_HEIGHT; let sizedWidth = 0; let sizedHeight = 0;
  const resize = () => { const rect = viewport.getBoundingClientRect(); scale = Math.min(rect.width / worldWidth, rect.height / worldHeight); offsetX = (rect.width - worldWidth * scale) / 2; offsetY = (rect.height - worldHeight * scale) / 2; app.renderer.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height))); root.scale.set(scale); root.position.set(offsetX, offsetY); sizedWidth = worldWidth; sizedHeight = worldHeight; if (background) { const cover = Math.max(worldWidth / background.texture.width, worldHeight / background.texture.height); background.width = background.texture.width * cover; background.height = background.texture.height * cover; background.position.set(worldWidth / 2, worldHeight / 2); } };
  const worldPoint = (x: number, y: number) => ({ x, y });
  const render = (state: GameState, alpha: number) => {
    worldWidth = state.world.width; worldHeight = state.world.height; if (sizedWidth !== worldWidth || sizedHeight !== worldHeight) resize(); const current = state.world.ship; const previous = state.previousShip; const x = previous.x + (current.x - previous.x) * alpha; const y = previous.y + (current.y - previous.y) * alpha; const angle = previous.angle + (current.angle - previous.angle) * alpha;
    terrain.clear().moveTo(0, worldHeight).lineTo(0, state.world.terrain.points[0].y); state.world.terrain.points.forEach((point) => terrain.lineTo(point.x, point.y)); terrain.lineTo(worldWidth, worldHeight).closePath().fill({ color: 0x2d3440, alpha: 0.92 }).stroke({ color: C.slate, width: 3, alpha: 0.9 });
    state.world.terrain.points.filter((_, index) => index % 2 === 0).forEach((point) => terrain.moveTo(point.x, point.y + 5).lineTo(point.x + 15, point.y + 18).stroke({ color: C.copper, width: 2, alpha: 0.33 }));
    pad.clear().roundRect(state.world.terrain.pad.xStart, state.world.terrain.pad.y - 8, state.world.terrain.pad.xEnd - state.world.terrain.pad.xStart, 8, 3).fill(C.copper).stroke({ color: C.cream, width: 2 }); pad.moveTo(state.world.terrain.pad.xStart + 12, state.world.terrain.pad.y - 11).lineTo(state.world.terrain.pad.xStart + 12, state.world.terrain.pad.y - 28).stroke({ color: C.signal, width: 2 }); pad.circle(state.world.terrain.pad.xStart + 12, state.world.terrain.pad.y - 30, 4).fill(C.signal);
    hazardGraphics.clear(); state.world.hazards.forEach((hazard) => { if (!hazard.alive) return; hazardGraphics.circle(hazard.x, hazard.y, hazard.radius).fill(0x59626d).stroke({ color: C.copper, width: 2 }); hazardGraphics.moveTo(hazard.x - hazard.radius * 0.6, hazard.y - 2).lineTo(hazard.x + hazard.radius * 0.5, hazard.y + hazard.radius * 0.35).stroke({ color: C.cream, width: 1, alpha: 0.5 }); });
    ship.clear(); ship.position.set(x, y); ship.rotation = angle; ship.roundRect(-21, -17, 42, 32, 10).fill(C.cream).stroke({ color: C.copper, width: 2.5 }); ship.roundRect(-10, -11, 20, 13, 5).fill(0x6e9ca4).stroke({ color: C.night, width: 2 }); ship.moveTo(-15, 13).lineTo(-21, 27).lineTo(-8, 27).stroke({ color: C.copper, width: 4 }); ship.moveTo(15, 13).lineTo(21, 27).lineTo(8, 27).stroke({ color: C.copper, width: 4 }); ship.circle(0, -5, 2).fill(C.danger);
    if (current.thrusting) { fxLayer.clear().position.set(x, y); fxLayer.rotation = angle; fxLayer.ellipse(0, 38, 10 + Math.sin(state.world.time * 42) * 2, 20).fill({ color: 0xffbe57, alpha: 0.88 }).ellipse(0, 41, 4, 13).fill({ color: C.signal, alpha: 0.95 }); } else fxLayer.clear();
    app.renderer.render(app.stage);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(viewport);
  return { render, resize, destroy() { resizeObserver.disconnect(); root.destroy({ children: true }); app.destroy(false); } };
}
