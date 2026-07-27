/**
 * A small, framework-free controller for a two-image raster compositor.
 *
 * The visible image is never reassigned while a replacement is loading. A
 * replacement is first loaded and decoded in the hidden slot, then the two
 * slots crossfade. Once that fade is complete, the retired slot is reused to
 * preload (and only preload) the next anticipated plate.
 *
 * The containing component owns positioning and layout. This controller owns
 * only opacity, transition timing, and `data-plate-state` diagnostics.
 */

export interface RasterPlate {
  /** Stable identity. Defaults to a value derived from the source attributes. */
  key?: string;
  /** Fallback image URL. */
  src: string;
  /** Optional responsive candidates, using normal `img[srcset]` syntax. */
  srcSet?: string;
  /** Optional responsive sizing hint. */
  sizes?: string;
}

export type RasterPlateInput = RasterPlate | string;

export interface PlateCompositorFrame {
  current: RasterPlateInput;
  next?: RasterPlateInput | null;
}

export type PlateShowStatus =
  | 'shown'
  | 'unchanged'
  | 'retained'
  | 'superseded'
  | 'destroyed';

export interface PlateShowResult {
  status: PlateShowStatus;
  /** The requested current plate identity. */
  key: string;
  /** The plate still visible after this request settles, if any. */
  activeKey: string | null;
}

export type PlateLoadPhase = 'current' | 'next';

export interface PlateLoadError {
  asset: RasterPlate;
  error: unknown;
  phase: PlateLoadPhase;
}

interface MotionPreference {
  readonly matches: boolean;
  addEventListener?: (
    type: 'change',
    listener: (event: { matches: boolean }) => void,
  ) => void;
  removeEventListener?: (
    type: 'change',
    listener: (event: { matches: boolean }) => void,
  ) => void;
  addListener?: (listener: (event: { matches: boolean }) => void) => void;
  removeListener?: (listener: (event: { matches: boolean }) => void) => void;
}

export interface PlateCompositorOptions {
  /** The back and front image elements. Exactly two slots are required. */
  slots: readonly [HTMLImageElement, HTMLImageElement];
  /** Crossfade length when motion is allowed. Defaults to 900ms. */
  crossfadeMs?: number;
  /**
   * Override the reduced-motion query. Supplying `null` disables automatic
   * preference detection, which is also useful in non-browser tests.
   */
  reducedMotion?: MotionPreference | null;
  /** Called for failed current loads and failed speculative next loads. */
  onLoadError?: (event: PlateLoadError) => void;
}

export interface PlateCompositor {
  /**
   * Reveal `current` after it has decoded, then use the other slot to preload
   * `next`. A failed current request leaves the previous image visible.
   */
  show(frame: PlateCompositorFrame): Promise<PlateShowResult>;
  /** The identity of the currently visible plate. */
  readonly activeKey: string | null;
  /** Cancel pending work and detach listeners. Safe to call repeatedly. */
  destroy(): void;
}

interface NormalizedPlate extends RasterPlate {
  key: string;
}

interface SlotState {
  image: HTMLImageElement;
  key: string | null;
  pendingKey: string | null;
  assignment: number;
  cancelLoad: (() => void) | null;
}

const CANCELLED = Symbol('plate-load-cancelled');

function normalizePlate(input: RasterPlateInput): NormalizedPlate {
  const plate = typeof input === 'string' ? { src: input } : input;
  const src = plate.src.trim();

  if (!src) {
    throw new TypeError('Raster plate src must not be empty.');
  }

  return {
    ...plate,
    src,
    key: plate.key ?? [src, plate.srcSet ?? '', plate.sizes ?? ''].join('|'),
  };
}

function browserMotionPreference(): MotionPreference | null {
  if (
    typeof window === 'undefined'
    || typeof window.matchMedia !== 'function'
  ) {
    return null;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

function clampDuration(duration: number | undefined): number {
  if (duration === undefined) return 900;
  if (!Number.isFinite(duration)) return 900;
  return Math.max(0, duration);
}

function setFetchPriority(image: HTMLImageElement, priority: 'high' | 'low') {
  image.setAttribute('fetchpriority', priority);
}

function applyPlate(image: HTMLImageElement, plate: NormalizedPlate) {
  if (plate.sizes) image.setAttribute('sizes', plate.sizes);
  else image.removeAttribute('sizes');

  if (plate.srcSet) image.setAttribute('srcset', plate.srcSet);
  else image.removeAttribute('srcset');

  image.setAttribute('src', plate.src);
}

function clearImageSource(image: HTMLImageElement) {
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
  image.removeAttribute('src');
  image.removeAttribute('fetchpriority');
}

function waitForImageLoad(image: HTMLImageElement): {
  promise: Promise<void>;
  cancel: () => void;
  dispose: () => void;
} {
  let settled = false;
  let rejectPromise: (reason: unknown) => void = () => {};
  let resolveWithoutLoad: () => void = () => {};

  const cleanup = () => {
    image.removeEventListener('load', onLoad);
    image.removeEventListener('error', onError);
  };

  const resolveIfUsable = (
    resolve: () => void,
    reject: (reason: unknown) => void,
  ) => {
    if (image.naturalWidth > 0) resolve();
    else reject(new Error('Raster plate loaded without usable image data.'));
  };

  const onLoad = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolvePromise();
  };

  const onError = () => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectPromise(new Error('Raster plate failed to load.'));
  };

  let resolvePromise: () => void = () => {};
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = () => resolveIfUsable(resolve, reject);
    resolveWithoutLoad = resolve;
    rejectPromise = reject;
    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(CANCELLED);
    },
    dispose: () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolveWithoutLoad();
    },
  };
}

async function decodeImage(image: HTMLImageElement) {
  if (typeof image.decode !== 'function') return;

  try {
    await image.decode();
  } catch (error) {
    // Safari can reject decode() for an image that has already completed.
    // A positive natural width is still a reliable loaded-image fallback.
    if (!(image.complete && image.naturalWidth > 0)) throw error;
  }
}

/**
 * Create a two-slot raster compositor.
 *
 * Typical markup:
 *
 * ```html
 * <img class="outside-plate" data-plate-slot="a" alt="" />
 * <img class="outside-plate" data-plate-slot="b" alt="" />
 * ```
 */
export function createPlateCompositor(
  options: PlateCompositorOptions,
): PlateCompositor {
  const crossfadeMs = clampDuration(options.crossfadeMs);
  const motion = options.reducedMotion === undefined
    ? browserMotionPreference()
    : options.reducedMotion;
  const slots: [SlotState, SlotState] = options.slots.map((image) => ({
    image,
    key: null,
    pendingKey: null,
    assignment: 0,
    cancelLoad: null,
  })) as [SlotState, SlotState];

  let activeIndex = -1;
  let request = 0;
  let destroyed = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let settleJob: (() => void) | null = null;

  const effectiveDuration = () => motion?.matches ? 0 : crossfadeMs;

  const applyTransitionDuration = () => {
    const duration = `${effectiveDuration()}ms`;
    for (const { image } of slots) image.style.transitionDuration = duration;
  };

  for (const [index, { image }] of slots.entries()) {
    image.decoding = 'async';
    image.draggable = false;
    image.dataset.plateState = 'idle';
    image.style.opacity = '0';
    image.style.transitionProperty = 'opacity';
    image.style.transitionTimingFunction = 'cubic-bezier(0.22, 1, 0.36, 1)';
    image.style.zIndex = String(index + 1);
  }
  applyTransitionDuration();

  const cancelSettle = () => {
    if (settleTimer !== null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    settleJob = null;
  };

  const clearSlot = (index: number) => {
    const slot = slots[index];
    slot.assignment += 1;
    slot.cancelLoad?.();
    slot.cancelLoad = null;
    slot.key = null;
    slot.pendingKey = null;
    slot.image.dataset.plateState = 'idle';
    slot.image.style.opacity = '0';
    clearImageSource(slot.image);
  };

  const loadSlot = async (
    index: number,
    plate: NormalizedPlate,
    phase: PlateLoadPhase,
  ): Promise<'loaded' | 'failed' | 'cancelled'> => {
    const slot = slots[index];

    if (slot.key === plate.key) {
      setFetchPriority(slot.image, phase === 'current' ? 'high' : 'low');
      return 'loaded';
    }

    slot.assignment += 1;
    const assignment = slot.assignment;
    slot.cancelLoad?.();
    slot.cancelLoad = null;
    slot.key = null;
    slot.pendingKey = plate.key;
    slot.image.dataset.plateState = phase === 'current'
      ? 'loading'
      : 'preloading';
    setFetchPriority(slot.image, phase === 'current' ? 'high' : 'low');

    const pending = waitForImageLoad(slot.image);
    slot.cancelLoad = pending.cancel;
    applyPlate(slot.image, plate);

    try {
      // Cached images may be complete before their load event can be observed.
      if (!(slot.image.complete && slot.image.naturalWidth > 0)) {
        await pending.promise;
      } else {
        pending.dispose();
      }

      await decodeImage(slot.image);

      if (
        destroyed
        || assignment !== slot.assignment
        || slot.pendingKey !== plate.key
      ) {
        return 'cancelled';
      }

      slot.cancelLoad = null;
      slot.pendingKey = null;
      slot.key = plate.key;
      slot.image.dataset.plateState = phase === 'current'
        ? 'ready'
        : 'prefetched';
      return 'loaded';
    } catch (error) {
      if (
        error === CANCELLED
        || destroyed
        || assignment !== slot.assignment
      ) {
        return 'cancelled';
      }

      slot.cancelLoad = null;
      slot.pendingKey = null;
      slot.key = null;
      slot.image.dataset.plateState = 'failed';
      clearImageSource(slot.image);
      options.onLoadError?.({ asset: plate, error, phase });
      return 'failed';
    }
  };

  const preloadNext = async (
    requestAtSchedule: number,
    index: number,
    current: NormalizedPlate,
    next: NormalizedPlate | null,
  ) => {
    if (
      destroyed
      || requestAtSchedule !== request
      || index === activeIndex
    ) {
      return;
    }

    if (!next || next.key === current.key) {
      clearSlot(index);
      return;
    }

    const result = await loadSlot(index, next, 'next');
    if (
      result === 'failed'
      && !destroyed
      && requestAtSchedule === request
      && index !== activeIndex
    ) {
      clearSlot(index);
    }
  };

  const scheduleNext = (
    requestAtSchedule: number,
    index: number,
    current: NormalizedPlate,
    next: NormalizedPlate | null,
    afterFade: boolean,
  ) => {
    cancelSettle();

    const run = () => {
      settleTimer = null;
      settleJob = null;
      void preloadNext(requestAtSchedule, index, current, next);
    };

    const delay = afterFade ? effectiveDuration() : 0;
    if (delay === 0) {
      run();
      return;
    }

    settleJob = run;
    settleTimer = setTimeout(run, delay);
  };

  const show = async (
    frame: PlateCompositorFrame,
  ): Promise<PlateShowResult> => {
    const current = normalizePlate(frame.current);
    const next = frame.next ? normalizePlate(frame.next) : null;
    const visibleKey = () =>
      activeIndex >= 0 ? slots[activeIndex].key : null;

    if (destroyed) {
      return {
        status: 'destroyed',
        key: current.key,
        activeKey: visibleKey(),
      };
    }

    request += 1;
    const thisRequest = request;
    cancelSettle();

    if (activeIndex >= 0 && slots[activeIndex].key === current.key) {
      setFetchPriority(slots[activeIndex].image, 'high');
      scheduleNext(
        thisRequest,
        activeIndex === 0 ? 1 : 0,
        current,
        next,
        false,
      );
      return {
        status: 'unchanged',
        key: current.key,
        activeKey: current.key,
      };
    }

    const targetIndex = activeIndex === 0 ? 1 : 0;
    const loadResult = await loadSlot(targetIndex, current, 'current');

    if (destroyed) {
      return {
        status: 'destroyed',
        key: current.key,
        activeKey: visibleKey(),
      };
    }

    if (thisRequest !== request || loadResult === 'cancelled') {
      return {
        status: 'superseded',
        key: current.key,
        activeKey: visibleKey(),
      };
    }

    if (loadResult === 'failed') {
      return {
        status: 'retained',
        key: current.key,
        activeKey: visibleKey(),
      };
    }

    const previousIndex = activeIndex;
    const target = slots[targetIndex];
    target.image.dataset.plateState = 'active';
    target.image.style.opacity = '1';
    setFetchPriority(target.image, 'high');
    activeIndex = targetIndex;

    if (previousIndex >= 0 && previousIndex !== targetIndex) {
      slots[previousIndex].image.dataset.plateState = 'retiring';
      slots[previousIndex].image.style.opacity = '0';
    }

    const retiredIndex = targetIndex === 0 ? 1 : 0;
    scheduleNext(
      thisRequest,
      retiredIndex,
      current,
      next,
      previousIndex >= 0 && previousIndex !== targetIndex,
    );

    return {
      status: 'shown',
      key: current.key,
      activeKey: current.key,
    };
  };

  const onMotionChange = () => {
    applyTransitionDuration();

    // If reduced motion is enabled during a fade, complete the bookkeeping
    // immediately instead of leaving the retired slot occupied for the old
    // animation duration.
    if (motion?.matches && settleJob) {
      const run = settleJob;
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = null;
      settleJob = null;
      run();
    }
  };

  if (motion?.addEventListener) motion.addEventListener('change', onMotionChange);
  else motion?.addListener?.(onMotionChange);

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    request += 1;
    cancelSettle();

    for (const slot of slots) {
      slot.assignment += 1;
      slot.cancelLoad?.();
      slot.cancelLoad = null;
      slot.pendingKey = null;
      slot.image.style.transitionDuration = '0ms';
    }

    if (motion?.removeEventListener) {
      motion.removeEventListener('change', onMotionChange);
    } else {
      motion?.removeListener?.(onMotionChange);
    }
  };

  return {
    show,
    destroy,
    get activeKey() {
      return activeIndex >= 0 ? slots[activeIndex].key : null;
    },
  };
}
