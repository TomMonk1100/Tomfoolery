/**
 * SpriteComposer — builds small programmer-art textures per sprite slot and
 * composites them onto the player container based on active cards.
 *
 * Wired as `new SpriteComposer(scene, ctx, playerContainer)` per the System
 * contract. Rebuilds whenever ctx.events emits EV.spriteDirty.
 *
 * MVP scope: only "head" and "back" slots are actually rendered as child
 * images on the player container (per assignment spec). The remaining
 * slots (tail, paws, aura, trail) are still computed — conflict-resolved
 * and stack-scaled — and logged via console.log under import.meta.env.DEV
 * so the resolution logic is exercised and easy to verify, but they render
 * nothing yet (future agent/pass can add child images for them using the
 * same anchors).
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import { EV, SPRITE_SLOTS, SpriteSlot, RARITY_RANK, CardData } from "../core/types";
import cardsJson from "../data/cards.json";

const cardsData = cardsJson as CardData[];

/** Texture keys baked once at construction time. */
const TEX = {
  head: "sprite_slot_head",
  back: "sprite_slot_back",
  tail: "sprite_slot_tail",
  paws: "sprite_slot_paws",
  aura: "sprite_slot_aura",
  trail: "sprite_slot_trail",
} as const;

/** Resolved winner for a slot after conflict resolution. */
interface SlotResolution {
  slot: SpriteSlot;
  card: CardData;
  stacks: number;
}

export class SpriteComposer implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private playerContainer: Phaser.GameObjects.Container;

  private cardsById: Map<string, CardData>;

  /** Currently-rendered child images, keyed by slot (only head/back used). */
  private renderedImages: Partial<Record<SpriteSlot, Phaser.GameObjects.Image>> =
    {};

  /** Slow pulse phase for optional aura/trail animation (radians). */
  private pulsePhase = 0;

  constructor(
    scene: Phaser.Scene,
    ctx: GameContext,
    playerContainer: Phaser.GameObjects.Container
  ) {
    this.scene = scene;
    this.ctx = ctx;
    this.playerContainer = playerContainer;
    this.cardsById = new Map(cardsData.map((c) => [c.id, c]));

    this.bakeTextures();

    this.ctx.events.on(EV.spriteDirty, this.rebuild, this);

    // Initial build so the base body silhouette (no cards yet) is correct.
    this.rebuild();
  }

  update(_dt: number): void {
    this.pulsePhase += _dt / 1000;

    const aura = this.renderedImages.aura;
    if (aura) {
      const pulse = 1 + 0.08 * Math.sin(this.pulsePhase * 2);
      aura.setScale(pulse);
    }
    const trail = this.renderedImages.trail;
    if (trail) {
      const pulse = 0.7 + 0.3 * Math.abs(Math.sin(this.pulsePhase * 3));
      trail.setAlpha(pulse);
    }
  }

  destroy(): void {
    this.ctx.events.off(EV.spriteDirty, this.rebuild, this);
    for (const img of Object.values(this.renderedImages)) {
      img?.destroy();
    }
    this.renderedImages = {};
  }

  // --------------------------------------------------------------------
  // Texture baking — one small colored primitive per slot.
  // --------------------------------------------------------------------

  private bakeTextures(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

    // head: triangle, warm amber
    g.clear();
    g.fillStyle(0xe0a458, 1);
    g.beginPath();
    g.moveTo(8, 0);
    g.lineTo(16, 16);
    g.lineTo(0, 16);
    g.closePath();
    g.fillPath();
    g.generateTexture(TEX.head, 16, 16);

    // back: rounded rect, moss green
    g.clear();
    g.fillStyle(0x6b8f5a, 1);
    g.fillRoundedRect(0, 0, 22, 12, 4);
    g.generateTexture(TEX.back, 22, 12);

    // tail: small rect, warm brown
    g.clear();
    g.fillStyle(0x8a6b4a, 1);
    g.fillRect(0, 0, 6, 14);
    g.generateTexture(TEX.tail, 6, 14);

    // paws: circle, dusty rose
    g.clear();
    g.fillStyle(0xc98a8a, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture(TEX.paws, 12, 12);

    // aura: ring (stroked circle), firefly gold
    g.clear();
    g.lineStyle(2, 0xf2d675, 0.9);
    g.strokeCircle(12, 12, 10);
    g.generateTexture(TEX.aura, 24, 24);

    // trail: thin line, pale grass
    g.clear();
    g.fillStyle(0xd8e8c8, 0.85);
    g.fillRect(0, 0, 20, 3);
    g.generateTexture(TEX.trail, 20, 3);

    g.destroy();
  }

  // --------------------------------------------------------------------
  // Rebuild — group active cards by slot, resolve conflicts, render.
  // --------------------------------------------------------------------

  private rebuild = (): void => {
    const bySlot = new Map<SpriteSlot, SlotResolution>();

    for (const active of this.ctx.player.activeCards) {
      const card = this.cardsById.get(active.cardId);
      if (!card) continue;
      if (card.spriteSlot === "none") continue;

      const slot = card.spriteSlot as SpriteSlot;
      const existing = bySlot.get(slot);

      if (!existing) {
        bySlot.set(slot, { slot, card, stacks: active.stacks });
        continue;
      }

      const winner = this.resolveConflict(existing, {
        slot,
        card,
        stacks: active.stacks,
      });
      bySlot.set(slot, winner);
    }

    for (const slot of SPRITE_SLOTS) {
      const resolution = bySlot.get(slot);
      if (slot === "head" || slot === "back") {
        this.renderSlot(slot, resolution);
      } else if (import.meta.env.DEV) {
        if (resolution) {
          // eslint-disable-next-line no-console
          console.log(
            `[SpriteComposer] slot "${slot}" -> ${resolution.card.name} ` +
              `(x${resolution.stacks}) [not rendered in MVP]`
          );
        }
      }
    }
  };

  /**
   * Conflict resolution: highest RARITY_RANK wins; exact-rarity tie ->
   * earliest draftOrder wins. `a` is the currently-held winner, `b` is the
   * challenger card being folded in for the same slot.
   */
  private resolveConflict(
    a: SlotResolution,
    b: SlotResolution
  ): SlotResolution {
    const rankA = RARITY_RANK[a.card.rarity];
    const rankB = RARITY_RANK[b.card.rarity];

    if (rankB > rankA) return b;
    if (rankB < rankA) return a;

    // Exact-rarity tie: earliest draftOrder wins. We don't carry draftOrder
    // on SlotResolution directly, so look it up from the player's
    // activeCards list for both candidates.
    const orderA = this.draftOrderOf(a.card.id);
    const orderB = this.draftOrderOf(b.card.id);
    return orderB < orderA ? b : a;
  }

  private draftOrderOf(cardId: string): number {
    const entry = this.ctx.player.activeCards.find(
      (c) => c.cardId === cardId
    );
    return entry?.draftOrder ?? Number.POSITIVE_INFINITY;
  }

  /** Render (or clear) a single rendered slot (head/back only in MVP). */
  private renderSlot(
    slot: "head" | "back",
    resolution: SlotResolution | undefined
  ): void {
    const anchor = this.ctx.animal.spriteAnchors[slot];
    const existing = this.renderedImages[slot];

    if (!resolution) {
      existing?.destroy();
      delete this.renderedImages[slot];
      return;
    }

    const textureKey = TEX[slot];
    let img = existing;
    if (!img) {
      img = this.scene.add.image(anchor.x, anchor.y, textureKey);
      this.playerContainer.add(img);
      this.renderedImages[slot] = img;
    } else {
      img.setPosition(anchor.x, anchor.y);
      img.setTexture(textureKey);
    }

    // Scale/intensify with stack count: bigger + brighter per stack,
    // capped so it never grows unreasonably large.
    const stacks = Math.max(1, resolution.stacks);
    const scale = Math.min(1 + 0.15 * (stacks - 1), 2.2);
    img.setScale(scale);

    const brightness = Math.min(1, 0.75 + 0.08 * (stacks - 1));
    img.setAlpha(brightness);
  }
}
