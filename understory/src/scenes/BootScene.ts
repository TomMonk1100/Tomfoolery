import Phaser from "phaser";
import { SCENE, REG } from "../core/types";
import { SaveManager } from "../core/SaveManager";
import { startQualityProbe } from "../core/Quality";
import { AudioManager } from "../audio/AudioManager";

/**
 * BootScene — sets up shared singletons in the registry, then hands off to the
 * Meta hub. No asset preloading: all data is statically imported JSON and all
 * art is programmer-generated at runtime.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.Boot);
  }

  create(): void {
    if (!this.registry.get(REG.saveManager)) {
      this.registry.set(REG.saveManager, new SaveManager());
    }
    if (!this.registry.get(REG.audio)) {
      this.registry.set(REG.audio, new AudioManager());
    }
    // Update 3: one-per-boot quality tier detection (MetaSave override wins).
    const sm = this.registry.get(REG.saveManager) as SaveManager;
    startQualityProbe(this.game, sm.load().quality);
    this.scene.start(SCENE.Meta);
  }
}
