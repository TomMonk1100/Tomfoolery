#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const SOURCE = {
  width: 1983,
  height: 793,
};

const DESKTOP = {
  width: SOURCE.width,
  height: SOURCE.height,
};

const MOBILE = {
  width: 960,
  height: 768,
  sourceCropWidth: Math.round(SOURCE.height * (960 / 768)),
  sourceCropHeight: SOURCE.height,
};

const NARROW = {
  width: 720,
  height: 960,
  sourceCropWidth: Math.round(SOURCE.height * (720 / 960)),
  sourceCropHeight: SOURCE.height,
};

// The four weather families place their strongest visual mass differently.
// These fixed crops retain the stable horizon while favoring open atmosphere
// for clear/scattered states and the rain core for the storm state.
const MOBILE_CROP_LEFT = {
  clear: 675,
  scattered: 620,
  overcast: 650,
  storm: 760,
};

// Center a portrait crop inside each existing condition-aware mobile crop.
// This avoids relying on object-fit to crop the 5:4 asset a second time on
// 320–420px phone screens.
const NARROW_CROP_LEFT = Object.fromEntries(
  CONDITIONS.map((condition) => [
    condition,
    MOBILE_CROP_LEFT[condition]
      + Math.round((MOBILE.sourceCropWidth - NARROW.sourceCropWidth) / 2),
  ]),
);

const VARIANTS = {
  desktop: DESKTOP,
  mobile: MOBILE,
  narrow: NARROW,
};

const ENCODERS = {
  desktop: {
    avif: {
      quality: 58,
      effort: 6,
      chromaSubsampling: '4:2:0',
      bitdepth: 8,
    },
    webp: {
      quality: 76,
      effort: 6,
      smartSubsample: true,
      preset: 'photo',
    },
  },
  mobile: {
    avif: {
      quality: 57,
      effort: 6,
      chromaSubsampling: '4:2:0',
      bitdepth: 8,
    },
    webp: {
      quality: 74,
      effort: 6,
      smartSubsample: true,
      preset: 'photo',
    },
  },
  narrow: {
    avif: {
      quality: 57,
      effort: 6,
      chromaSubsampling: '4:2:0',
      bitdepth: 8,
    },
    webp: {
      quality: 74,
      effort: 6,
      smartSubsample: true,
      preset: 'photo',
    },
  },
};

const BUDGETS = {
  perFileBytes: {
    desktop: {
      avif: 160 * 1024,
      webp: 180 * 1024,
    },
    mobile: {
      avif: 90 * 1024,
      webp: 120 * 1024,
    },
    narrow: {
      avif: 90 * 1024,
      webp: 120 * 1024,
    },
  },
  totalBytes: 8 * 1024 * 1024,
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = resolve(
  PROJECT_ROOT,
  'assets/sources/outside/plates',
);
const OUTPUT_ROOT = resolve(
  PROJECT_ROOT,
  'public/images/outside/plates',
);
const MANIFEST_PATH = resolve(OUTPUT_ROOT, 'manifest.json');

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function publicPath(condition, filename) {
  return `/images/outside/plates/${condition}/${filename}`;
}

async function loadSharp() {
  try {
    const module = await import('sharp');
    return module.default;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Sharp is required to build sky plates but could not be imported: ${detail}`,
    );
  }
}

async function writeIfChanged(path, content) {
  try {
    const existing = await readFile(path);
    if (existing.equals(content)) return false;
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
      throw error;
    }
  }

  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, content);
  await rename(temporary, path);
  return true;
}

async function assertSource(sharp, path, condition, moment) {
  const metadata = await sharp(path, { failOn: 'error' }).metadata();
  if (
    metadata.format !== 'png'
    || metadata.width !== SOURCE.width
    || metadata.height !== SOURCE.height
  ) {
    throw new Error(
      `${condition}/${moment}.png must be a ${SOURCE.width}x${SOURCE.height} PNG; `
      + `received ${metadata.format ?? 'unknown'} `
      + `${metadata.width ?? '?'}x${metadata.height ?? '?'}`,
    );
  }
}

function pipelineFor(sharp, sourcePath, variant, condition) {
  let pipeline = sharp(sourcePath, {
    failOn: 'error',
    sequentialRead: true,
  })
    .rotate()
    .toColourspace('srgb')
    .removeAlpha();

  if (variant !== 'desktop') {
    const dimensions = VARIANTS[variant];
    const cropLeft = variant === 'mobile'
      ? MOBILE_CROP_LEFT
      : NARROW_CROP_LEFT;
    const left = cropLeft[condition];
    const maxLeft = SOURCE.width - dimensions.sourceCropWidth;
    if (!Number.isInteger(left) || left < 0 || left > maxLeft) {
      throw new Error(
        `Invalid ${variant} crop for ${condition}: ${left}; expected 0-${maxLeft}`,
      );
    }

    pipeline = pipeline
      .extract({
        left,
        top: 0,
        width: dimensions.sourceCropWidth,
        height: dimensions.sourceCropHeight,
      })
      .resize(dimensions.width, dimensions.height, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      });
  }

  return pipeline;
}

async function encode(sharp, sourcePath, variant, condition, format) {
  const pipeline = pipelineFor(sharp, sourcePath, variant, condition);
  const options = ENCODERS[variant][format];

  const buffer = format === 'avif'
    ? await pipeline.avif(options).toBuffer()
    : await pipeline.webp(options).toBuffer();

  const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
  const expected = VARIANTS[variant];
  // libvips reports an AVIF file through its HEIF container decoder.
  const validFormat = format === 'avif'
    ? metadata.format === 'heif'
    : metadata.format === format;
  if (
    !validFormat
    || metadata.width !== expected.width
    || metadata.height !== expected.height
  ) {
    throw new Error(
      `Encoder produced invalid ${variant} ${format}: `
      + `${metadata.format ?? 'unknown'} `
      + `${metadata.width ?? '?'}x${metadata.height ?? '?'}`,
    );
  }

  if (
    metadata.hasAlpha
    || metadata.icc
    || metadata.exif
    || metadata.iptc
    || metadata.xmp
  ) {
    throw new Error(
      `Encoder retained alpha or metadata in ${variant} ${format} output`,
    );
  }

  return buffer;
}

function budgetReport(manifest) {
  const failures = [];
  const totals = {
    desktop: { avif: 0, webp: 0 },
    mobile: { avif: 0, webp: 0 },
    narrow: { avif: 0, webp: 0 },
  };

  for (const asset of manifest.assets) {
    for (const variant of Object.keys(VARIANTS)) {
      for (const format of ['avif', 'webp']) {
        const bytes = asset[variant][format].bytes;
        const budget = BUDGETS.perFileBytes[variant][format];
        totals[variant][format] += bytes;
        if (bytes > budget) {
          failures.push(
            `${asset.condition}/${asset.moment} ${variant}.${format} `
            + `${formatBytes(bytes)} > ${formatBytes(budget)}`,
          );
        }
      }
    }
  }

  const totalBytes = Object.values(totals)
    .flatMap((variant) => Object.values(variant))
    .reduce((sum, bytes) => sum + bytes, 0);
  if (totalBytes > BUDGETS.totalBytes) {
    failures.push(
      `total ${formatBytes(totalBytes)} > ${formatBytes(BUDGETS.totalBytes)}`,
    );
  }

  return { totals, totalBytes, failures };
}

async function main() {
  const sharp = await loadSharp();
  sharp.cache(false);
  sharp.concurrency(1);

  const assets = [];
  let written = 0;
  let unchanged = 0;

  for (const condition of CONDITIONS) {
    for (const moment of MOMENTS) {
      const sourcePath = resolve(SOURCE_ROOT, condition, `${moment}.png`);
      await assertSource(sharp, sourcePath, condition, moment);

      const sourceBuffer = await readFile(sourcePath);
      const sourceStat = await stat(sourcePath);
      const asset = {
        condition,
        moment,
        source: {
          path: `assets/sources/outside/plates/${condition}/${moment}.png`,
          width: SOURCE.width,
          height: SOURCE.height,
          bytes: sourceStat.size,
          sha256: digest(sourceBuffer),
        },
      };

      for (const variant of Object.keys(VARIANTS)) {
        asset[variant] = {};
        if (variant !== 'desktop') {
          const dimensions = VARIANTS[variant];
          const cropLeft = variant === 'mobile'
            ? MOBILE_CROP_LEFT
            : NARROW_CROP_LEFT;
          asset[variant].crop = {
            left: cropLeft[condition],
            top: 0,
            width: dimensions.sourceCropWidth,
            height: dimensions.sourceCropHeight,
          };
        }

        for (const format of ['avif', 'webp']) {
          const filename = `${moment}-${variant}.${format}`;
          const outputPath = resolve(OUTPUT_ROOT, condition, filename);
          const buffer = await encode(
            sharp,
            sourcePath,
            variant,
            condition,
            format,
          );
          const changed = await writeIfChanged(outputPath, buffer);
          if (changed) written += 1;
          else unchanged += 1;

          const dimensions = VARIANTS[variant];
          asset[variant][format] = {
            path: publicPath(condition, filename),
            width: dimensions.width,
            height: dimensions.height,
            bytes: buffer.byteLength,
            sha256: digest(buffer),
          };
        }
      }

      assets.push(asset);
    }
  }

  const manifest = {
    version: 1,
    location: {
      name: 'Breckenridge, TX',
      latitude: 32.7557,
      longitude: -98.9023,
      timeZone: 'America/Chicago',
    },
    conditions: CONDITIONS,
    solarMoments: MOMENTS,
    variants: {
      desktop: {
        width: DESKTOP.width,
        height: DESKTOP.height,
        crop: 'none',
      },
      mobile: {
        width: MOBILE.width,
        height: MOBILE.height,
        crop: {
          sourceWidth: MOBILE.sourceCropWidth,
          sourceHeight: MOBILE.sourceCropHeight,
          leftByCondition: MOBILE_CROP_LEFT,
        },
      },
      narrow: {
        width: NARROW.width,
        height: NARROW.height,
        crop: {
          sourceWidth: NARROW.sourceCropWidth,
          sourceHeight: NARROW.sourceCropHeight,
          leftByCondition: NARROW_CROP_LEFT,
        },
      },
    },
    encoders: ENCODERS,
    budgets: BUDGETS,
    assets,
  };

  const report = budgetReport(manifest);
  manifest.totals = {
    fileCount: CONDITIONS.length
      * MOMENTS.length
      * Object.keys(VARIANTS).length
      * 2,
    bytes: report.totalBytes,
    byVariantAndFormat: report.totals,
  };

  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestChanged = await writeIfChanged(MANIFEST_PATH, manifestBuffer);
  if (manifestChanged) written += 1;
  else unchanged += 1;

  console.log(
    `Built ${assets.length} source plates into ${manifest.totals.fileCount} delivery assets.`,
  );
  console.log(
    `${written} files written; ${unchanged} already byte-identical.`,
  );
  console.log(`Total delivery footprint: ${formatBytes(report.totalBytes)}`);
  for (const variant of Object.keys(VARIANTS)) {
    console.log(
      `${variant}: AVIF ${formatBytes(report.totals[variant].avif)}, `
      + `WebP ${formatBytes(report.totals[variant].webp)}`,
    );
  }

  if (report.failures.length) {
    console.error('Budget failures:');
    for (const failure of report.failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log('All per-file and total budgets passed.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
