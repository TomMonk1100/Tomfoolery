import { UPGRADES } from '../../lander/upgrades';
import type { UpgradeDef, UpgradeId } from '../../lander/types';

export type { UpgradeDef, UpgradeId };
export const UPGRADE_CATALOG: readonly UpgradeDef[] = UPGRADES;
export const UPGRADE_IDS: readonly UpgradeId[] = UPGRADE_CATALOG.map((upgrade) => upgrade.id);

export function upgradeById(id: UpgradeId): UpgradeDef {
  const result = UPGRADE_CATALOG.find((upgrade) => upgrade.id === id);
  if (!result) throw new Error(`Unknown upgrade: ${id}`);
  return result;
}
