import Phaser from "phaser";
import { GameContext } from "../core/context";
import {
  cameraStep,
  nearestWrappedCoord,
  ghostOffsets,
  wrapMod,
} from "./wrapRenderSim";

const TRUE_X = "__wrapTrueX";
const TRUE_Y = "__wrapTrueY";
const FOG_TEXTURE_KEY = "wrap-fog-live";

type XY = Phaser.GameObjects.GameObject & { x: number; y: number };

/**
 * Update 3 §WS-C — seamless toroidal camera & wrap rendering.
 *
 * Owns the (unclamped) camera and, each frame AFTER game logic has run,
 * repositions every world-space display object to its wrapped copy nearest
 * the camera center. Truth positions are restored before the next logic
 * tick, so no system ever observes a shifted coordinate.
 *
 * Layers handled:
 *  - ground: screen-locked TileSprite scrolled via tilePosition (infinite)
 *  - statics (water/features/props in the worldgen container): wrapped
 *    per-child; nothing reads their positions, no restore needed
 *  - dynamics (top-level enemies, projectiles, motes, food, particles,
 *    damage numbers…): wrapped with save/restore around the logic tick
 *  - fog: world-sized RenderTexture + 3 live ghost images (2x2 coverage)
 */
export class WrapRenderSystem {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private size: number;
  private player: Phaser.GameObjects.Container;
  private worldContainer?: Phaser.GameObjects.Container;
  private ground?: Phaser.GameObjects.TileSprite;
  private fog?: Phaser.GameObjects.RenderTexture;
  private fogGhosts: Phaser.GameObjects.Image[] = [];
  private center = { x: 0, y: 0 };
  private shifted: XY[] = [];
  private excluded = new Set<Phaser.GameObjects.GameObject>();

  constructor(
    scene: Phaser.Scene,
    ctx: GameContext,
    player: Phaser.GameObjects.Container,
    size: number,
    refs: {
      worldContainer?: Phaser.GameObjects.Container;
      ground?: Phaser.GameObjects.TileSprite;
      fog?: Phaser.GameObjects.RenderTexture;
    }
  ) {
    this.scene = scene;
    this.ctx = ctx;
    this.player = player;
    this.size = size;
    this.worldContainer = refs.worldContainer;
    this.ground = refs.ground;
    this.fog = refs.fog;
    this.center = { x: player.x, y: player.y };

    this.excluded.add(player);
    if (refs.worldContainer) this.excluded.add(refs.worldContainer);
    if (refs.ground) this.excluded.add(refs.ground);
    if (refs.fog) this.excluded.add(refs.fog);

    this.setupFogGhosts();
    this.snapCamera();

    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.restoreTruth, this);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.applyWrap, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Live ghost copies of the fog texture covering the seam quadrants. */
  private setupFogGhosts(): void {
    if (!this.fog) return;
    if (this.scene.textures.exists(FOG_TEXTURE_KEY)) {
      this.scene.textures.remove(FOG_TEXTURE_KEY);
    }
    this.fog.saveTexture(FOG_TEXTURE_KEY);
    for (let i = 0; i < 3; i++) {
      const g = this.scene.add.image(0, 0, FOG_TEXTURE_KEY);
      g.setOrigin(0, 0);
      g.setDepth(this.fog.depth);
      this.excluded.add(g);
      this.fogGhosts.push(g);
    }
  }

  /** Hard-center once at construction (no lerp-in from 0,0). */
  private snapCamera(): void {
    this.center = { x: this.player.x, y: this.player.y };
    this.scene.cameras.main.centerOn(this.center.x, this.center.y);
  }

  /** PRE_UPDATE: put every shifted dynamic back to its truth position. */
  private restoreTruth(): void {
    for (const obj of this.shifted) {
      const anyObj = obj as unknown as Record<string, number>;
      if (anyObj[TRUE_X] !== undefined) {
        obj.x = anyObj[TRUE_X];
        obj.y = anyObj[TRUE_Y];
        delete anyObj[TRUE_X];
        delete anyObj[TRUE_Y];
      }
    }
    this.shifted.length = 0;
  }

  /** POST_UPDATE: move camera along the torus, then wrap all display objects. */
  private applyWrap(_time: number, deltaMs: number): void {
    if (this.ctx.isPaused()) deltaMs = 0;
    const cam = this.scene.cameras.main;
    this.center = cameraStep(
      this.center,
      { x: this.player.x, y: this.player.y },
      this.size,
      deltaMs
    );
    cam.centerOn(this.center.x, this.center.y);

    // Infinite ground: screen-locked, scrolled by camera position.
    if (this.ground) {
      this.ground.setTilePosition(cam.scrollX, cam.scrollY);
    }

    // Fog ghosts: cover whichever seam quadrant the view spills into.
    if (this.fog && this.fogGhosts.length === 3) {
      const { ox, oy } = ghostOffsets(cam.scrollX, cam.scrollY, this.size);
      this.fogGhosts[0].setPosition(ox, 0);
      this.fogGhosts[1].setPosition(0, oy);
      this.fogGhosts[2].setPosition(ox, oy);
    }

    // Statics: children of the worldgen container (positions are truth AND
    // display; nothing reads them back, safe to leave wrapped).
    if (this.worldContainer) {
      for (const child of this.worldContainer.list) {
        const c = child as XY;
        if (typeof c.x !== "number") continue;
        c.x = nearestWrappedCoord(wrapMod(c.x, this.size), this.center.x, this.size);
        c.y = nearestWrappedCoord(wrapMod(c.y, this.size), this.center.y, this.size);
      }
    }

    // Dynamics: every top-level world-space object. Save truth, display wrapped.
    for (const child of this.scene.children.list) {
      const c = child as XY & { scrollFactorX?: number };
      if (this.excluded.has(child)) continue;
      if (typeof c.x !== "number" || typeof c.y !== "number") continue;
      if (c.scrollFactorX === 0) continue; // HUD / screen-locked FX
      const wx = nearestWrappedCoord(wrapMod(c.x, this.size), this.center.x, this.size);
      const wy = nearestWrappedCoord(wrapMod(c.y, this.size), this.center.y, this.size);
      if (wx !== c.x || wy !== c.y) {
        const anyObj = c as unknown as Record<string, number>;
        anyObj[TRUE_X] = c.x;
        anyObj[TRUE_Y] = c.y;
        c.x = wx;
        c.y = wy;
        this.shifted.push(c);
      }
    }
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.restoreTruth, this);
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.applyWrap, this);
    for (const g of this.fogGhosts) g.destroy();
    this.fogGhosts = [];
  }
}
