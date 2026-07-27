#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  lstat,
  readFile,
  readdir,
  realpath,
  stat,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const CONDITIONS = ['clear', 'scattered', 'overcast', 'storm'];
const MOMENTS = [
  'night',
  'predawn',
  'sunrise',
  'morning',
  'noon',
  'golden',
  'sunset',
  'blue-hour',
];
const VARIANTS = ['desktop', 'mobile', 'narrow'];
const FORMATS = ['avif', 'webp'];
const DIMENSIONS = {
  desktop: { width: 1983, height: 793 },
  mobile: { width: 960, height: 768 },
  narrow: { width: 720, height: 960 },
};
const EXPECTED_FRAME_COUNT = CONDITIONS.length * MOMENTS.length;
const EXPECTED_DELIVERY_COUNT = EXPECTED_FRAME_COUNT
  * VARIANTS.length
  * FORMATS.length;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const PUBLIC_ROOT = resolve(PROJECT_ROOT, 'public');
const OUTPUT_ROOT = resolve(PUBLIC_ROOT, 'images/outside/plates');
const MANIFEST_PATH = resolve(OUTPUT_ROOT, 'manifest.json');

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function arraysEqual(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function isPathInside(root, candidate) {
  const offset = relative(root, candidate);
  return offset === ''
    || (!isAbsolute(offset) && offset !== '..' && !offset.startsWith(`..${sep}`));
}

function expectedPublicPath(condition, moment, variant, format) {
  return `/images/outside/plates/${condition}/${moment}-${variant}.${format}`;
}

function deliveryPath(publicPath) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/')) {
    return null;
  }

  const diskPath = resolve(PUBLIC_ROOT, publicPath.slice(1));
  return isPathInside(OUTPUT_ROOT, diskPath) ? diskPath : null;
}

async function sha256(path) {
  const buffer = await readFile(path);
  return createHash('sha256').update(buffer).digest('hex');
}

async function listOutputFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listOutputFiles(path));
    } else if (path !== MANIFEST_PATH) {
      files.push(path);
    }
  }

  return files;
}

function validPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function totalFor(totals, variant, format) {
  return totals[variant][format];
}

async function main() {
  const startedAt = performance.now();
  const failures = [];
  const fail = (message) => failures.push(message);

  let manifest;
  try {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read production sky manifest: ${detail}`);
  }

  if (!isRecord(manifest)) {
    throw new Error('Production sky manifest must contain a JSON object.');
  }
  const canonicalOutputRoot = await realpath(OUTPUT_ROOT);
  if (!arraysEqual(manifest.conditions, CONDITIONS)) {
    fail(`manifest.conditions must equal ${JSON.stringify(CONDITIONS)}`);
  }
  if (!arraysEqual(manifest.solarMoments, MOMENTS)) {
    fail(`manifest.solarMoments must equal ${JSON.stringify(MOMENTS)}`);
  }

  for (const variant of VARIANTS) {
    const declared = manifest.variants?.[variant];
    const expected = DIMENSIONS[variant];
    if (
      !isRecord(declared)
      || declared.width !== expected.width
      || declared.height !== expected.height
    ) {
      fail(
        `manifest.variants.${variant} must declare `
        + `${expected.width}x${expected.height}`,
      );
    }
  }

  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (!Array.isArray(manifest.assets)) {
    fail('manifest.assets must be an array');
  }
  if (assets.length !== EXPECTED_FRAME_COUNT) {
    fail(
      `manifest.assets must contain exactly ${EXPECTED_FRAME_COUNT} frames; `
      + `found ${assets.length}`,
    );
  }

  const expectedFrames = new Set(
    CONDITIONS.flatMap((condition) =>
      MOMENTS.map((moment) => `${condition}:${moment}`)),
  );
  const seenFrames = new Set();
  const expectedFiles = new Set();
  const checks = [];
  const computedTotals = {
    desktop: { avif: 0, webp: 0 },
    mobile: { avif: 0, webp: 0 },
    narrow: { avif: 0, webp: 0 },
  };

  let deliveryEntries = 0;
  for (const [assetIndex, asset] of assets.entries()) {
    if (!isRecord(asset)) {
      fail(`manifest.assets[${assetIndex}] must be an object`);
      continue;
    }

    const frame = `${asset.condition}:${asset.moment}`;
    if (!expectedFrames.has(frame)) {
      fail(`manifest.assets[${assetIndex}] has unexpected frame ${frame}`);
    } else if (seenFrames.has(frame)) {
      fail(`manifest contains duplicate frame ${frame}`);
    } else {
      seenFrames.add(frame);
    }

    for (const variant of VARIANTS) {
      for (const format of FORMATS) {
        deliveryEntries += 1;
        const label = `${frame} ${variant}.${format}`;
        const entry = asset[variant]?.[format];
        if (!isRecord(entry)) {
          fail(`${label} is missing from the manifest`);
          continue;
        }

        const expectedUrl = expectedPublicPath(
          asset.condition,
          asset.moment,
          variant,
          format,
        );
        if (entry.path !== expectedUrl) {
          fail(`${label} path must be ${expectedUrl}; found ${String(entry.path)}`);
        }

        const path = deliveryPath(entry.path);
        if (!path) {
          fail(`${label} path escapes public/images/outside/plates`);
          continue;
        }
        if (expectedFiles.has(path)) {
          fail(`${label} reuses delivery path ${entry.path}`);
          continue;
        }
        expectedFiles.add(path);

        const expectedDimensions = DIMENSIONS[variant];
        if (
          entry.width !== expectedDimensions.width
          || entry.height !== expectedDimensions.height
        ) {
          fail(
            `${label} manifest dimensions must be `
            + `${expectedDimensions.width}x${expectedDimensions.height}`,
          );
        }
        if (!validPositiveInteger(entry.bytes)) {
          fail(`${label} must record a positive integer byte size`);
        }
        if (
          typeof entry.sha256 !== 'string'
          || !/^[a-f0-9]{64}$/.test(entry.sha256)
        ) {
          fail(`${label} must record a lowercase SHA-256 digest`);
        }

        checks.push((async () => {
          let fileStat;
          try {
            const linkStat = await lstat(path);
            if (linkStat.isSymbolicLink()) {
              fail(`${label} must not be a symbolic link`);
              return;
            }
            fileStat = await stat(path);
          } catch (error) {
            const code = isRecord(error) ? error.code : undefined;
            fail(
              code === 'ENOENT'
                ? `${label} is missing at ${entry.path}`
                : `${label} could not be inspected: ${String(error)}`,
            );
            return;
          }

          if (!fileStat.isFile()) {
            fail(`${label} is not a regular file`);
            return;
          }

          try {
            const canonicalPath = await realpath(path);
            if (!isPathInside(canonicalOutputRoot, canonicalPath)) {
              fail(`${label} resolves outside public/images/outside/plates`);
              return;
            }
          } catch (error) {
            fail(`${label} canonical path check failed: ${String(error)}`);
            return;
          }

          computedTotals[variant][format] += fileStat.size;
          if (validPositiveInteger(entry.bytes)) {
            if (fileStat.size !== entry.bytes) {
              fail(
                `${label} byte size is ${fileStat.size}; manifest records `
                + `${entry.bytes}`,
              );
            }
          }

          if (
            typeof entry.sha256 === 'string'
            && /^[a-f0-9]{64}$/.test(entry.sha256)
          ) {
            const actualDigest = await sha256(path);
            if (actualDigest !== entry.sha256) {
              fail(`${label} SHA-256 does not match the manifest`);
            }
          }

          let metadata;
          try {
            metadata = await sharp(path, { failOn: 'error' }).metadata();
          } catch (error) {
            fail(`${label} is not a readable image: ${String(error)}`);
            return;
          }

          const validFormat = format === 'avif'
            ? metadata.format === 'heif'
            : metadata.format === format;
          if (!validFormat) {
            fail(`${label} decoded as ${metadata.format ?? 'unknown'} format`);
          }
          if (
            metadata.width !== expectedDimensions.width
            || metadata.height !== expectedDimensions.height
          ) {
            fail(
              `${label} image is ${metadata.width ?? '?'}x${metadata.height ?? '?'}; `
              + `expected ${expectedDimensions.width}x${expectedDimensions.height}`,
            );
          }
        })());
      }
    }
  }

  for (const frame of expectedFrames) {
    if (!seenFrames.has(frame)) fail(`manifest is missing frame ${frame}`);
  }
  if (deliveryEntries !== EXPECTED_DELIVERY_COUNT) {
    fail(
      `manifest must contain exactly ${EXPECTED_DELIVERY_COUNT} delivery entries; `
      + `found ${deliveryEntries}`,
    );
  }
  if (expectedFiles.size !== EXPECTED_DELIVERY_COUNT) {
    fail(
      `manifest must reference ${EXPECTED_DELIVERY_COUNT} unique delivery paths; `
      + `found ${expectedFiles.size}`,
    );
  }

  await Promise.all(checks);

  let actualImages = [];
  try {
    actualImages = await listOutputFiles(OUTPUT_ROOT);
  } catch (error) {
    fail(`could not enumerate delivery directory: ${String(error)}`);
  }
  const actualFiles = new Set(actualImages.map((path) => resolve(path)));
  for (const path of expectedFiles) {
    if (!actualFiles.has(path)) {
      fail(`manifest delivery image is absent from the output tree: ${relative(OUTPUT_ROOT, path)}`);
    }
  }
  for (const path of actualFiles) {
    if (!expectedFiles.has(path)) {
      fail(`extra delivery image is not in the manifest: ${relative(OUTPUT_ROOT, path)}`);
    }
  }
  if (actualFiles.size !== EXPECTED_DELIVERY_COUNT) {
    fail(
      `delivery directory must contain exactly ${EXPECTED_DELIVERY_COUNT} images; `
      + `found ${actualFiles.size}`,
    );
  }

  const perFileBudgets = manifest.budgets?.perFileBytes;
  const totalBudget = manifest.budgets?.totalBytes;
  if (!isRecord(perFileBudgets) || !validPositiveInteger(totalBudget)) {
    fail('manifest must contain positive per-file and total byte budgets');
  }

  for (const asset of assets) {
    if (!isRecord(asset)) continue;
    for (const variant of VARIANTS) {
      for (const format of FORMATS) {
        const entry = asset[variant]?.[format];
        const budget = perFileBudgets?.[variant]?.[format];
        const label = `${asset.condition}:${asset.moment} ${variant}.${format}`;
        if (!validPositiveInteger(budget)) {
          fail(`${label} has no valid per-file budget`);
        } else if (validPositiveInteger(entry?.bytes) && entry.bytes > budget) {
          fail(
            `${label} exceeds budget: ${formatBytes(entry.bytes)} > `
            + formatBytes(budget),
          );
        }
      }
    }
  }

  const computedTotal = VARIANTS
    .flatMap((variant) =>
      FORMATS.map((format) => totalFor(computedTotals, variant, format)))
    .reduce((sum, bytes) => sum + bytes, 0);

  if (validPositiveInteger(totalBudget) && computedTotal > totalBudget) {
    fail(
      `delivery total exceeds budget: ${formatBytes(computedTotal)} > `
      + formatBytes(totalBudget),
    );
  }

  if (manifest.totals?.fileCount !== EXPECTED_DELIVERY_COUNT) {
    fail(
      `manifest.totals.fileCount must be ${EXPECTED_DELIVERY_COUNT}; `
      + `found ${String(manifest.totals?.fileCount)}`,
    );
  }
  if (manifest.totals?.bytes !== computedTotal) {
    fail(
      `manifest.totals.bytes is ${String(manifest.totals?.bytes)}; `
      + `computed ${computedTotal}`,
    );
  }
  for (const variant of VARIANTS) {
    for (const format of FORMATS) {
      const recorded = manifest.totals?.byVariantAndFormat?.[variant]?.[format];
      const computed = totalFor(computedTotals, variant, format);
      if (recorded !== computed) {
        fail(
          `manifest total for ${variant}.${format} is ${String(recorded)}; `
          + `computed ${computed}`,
        );
      }
    }
  }

  const elapsed = performance.now() - startedAt;
  if (failures.length) {
    console.error(`Sky plate release gate failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(`Checked in ${elapsed.toFixed(0)} ms.`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Sky plate release gate passed: ${EXPECTED_FRAME_COUNT} frames, `
    + `${EXPECTED_DELIVERY_COUNT} images, `
    + `${formatBytes(computedTotal)} / ${formatBytes(totalBudget)} budget.`,
  );
  console.log(`Checked in ${elapsed.toFixed(0)} ms.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
