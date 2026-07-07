import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./core/types";
import { BootScene } from "./scenes/BootScene";
import { MetaHubScene } from "./scenes/MetaHubScene";
import { WorldScene } from "./scenes/WorldScene";
import { DraftScene } from "./scenes/DraftScene";
import { LifeStoryScene } from "./scenes/LifeStoryScene";
import { CodexScene } from "./scenes/CodexScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#14261a",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Chunky pixel-art rendering: nearest-neighbor everywhere, no smoothing.
  pixelArt: true,
  scene: [BootScene, MetaHubScene, WorldScene, DraftScene, LifeStoryScene, CodexScene],
};

const game = new Phaser.Game(config);
// Exposed for debugging/automated playtests.
(window as unknown as { __understory?: Phaser.Game }).__understory = game;
