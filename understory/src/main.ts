import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./core/types";
import { BootScene } from "./scenes/BootScene";
import { MetaHubScene } from "./scenes/MetaHubScene";
import { WorldScene } from "./scenes/WorldScene";
import { DraftScene } from "./scenes/DraftScene";
import { LifeStoryScene } from "./scenes/LifeStoryScene";

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
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [BootScene, MetaHubScene, WorldScene, DraftScene, LifeStoryScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
