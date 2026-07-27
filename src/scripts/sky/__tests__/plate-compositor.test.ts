import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPlateCompositor,
  type PlateCompositor,
  type PlateLoadError,
} from '../plate-compositor';

type ImageEvent = 'load' | 'error';

class FakeImage {
  complete = false;
  naturalWidth = 0;
  decoding = '';
  draggable = true;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};

  private attributes = new Map<string, string>();
  private listeners = new Map<ImageEvent, Set<() => void>>();
  private decodePromise: Promise<void> = Promise.resolve();
  private resolveDecode: () => void = () => {};
  private rejectDecode: (reason?: unknown) => void = () => {};

  addEventListener(type: ImageEvent, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: ImageEvent, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name !== 'src') return;

    this.complete = false;
    this.naturalWidth = 0;
    this.decodePromise = new Promise<void>((resolve, reject) => {
      this.resolveDecode = resolve;
      this.rejectDecode = reject;
    });
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  decode() {
    return this.decodePromise;
  }

  finishLoad() {
    this.complete = true;
    this.naturalWidth = 1983;
    this.emit('load');
  }

  finishDecode() {
    this.resolveDecode();
  }

  failLoad() {
    this.complete = true;
    this.naturalWidth = 0;
    this.emit('error');
  }

  failDecode(error = new Error('decode failed')) {
    this.rejectDecode(error);
  }

  private emit(type: ImageEvent) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
}

class FakeMotionPreference {
  matches: boolean;
  addCount = 0;
  removeCount = 0;
  private listeners = new Set<(event: { matches: boolean }) => void>();

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(
    _type: 'change',
    listener: (event: { matches: boolean }) => void,
  ) {
    this.addCount += 1;
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: 'change',
    listener: (event: { matches: boolean }) => void,
  ) {
    this.removeCount += 1;
    this.listeners.delete(listener);
  }

  set(matches: boolean) {
    this.matches = matches;
    for (const listener of this.listeners) listener({ matches });
  }
}

function setup(options: {
  crossfadeMs?: number;
  reducedMotion?: FakeMotionPreference | null;
  onLoadError?: (event: PlateLoadError) => void;
} = {}) {
  const first = new FakeImage();
  const second = new FakeImage();
  const controller = createPlateCompositor({
    slots: [
      first as unknown as HTMLImageElement,
      second as unknown as HTMLImageElement,
    ],
    ...options,
  });

  return { controller, first, second };
}

async function loadAndDecode(image: FakeImage) {
  image.finishLoad();
  await Promise.resolve();
  image.finishDecode();
  await Promise.resolve();
}

async function showFirst(
  controller: PlateCompositor,
  image: FakeImage,
  src = '/clear/noon.webp',
) {
  const pending = controller.show({ current: src });
  await loadAndDecode(image);
  return pending;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('plate compositor', () => {
  it('does not reveal a plate until it has loaded and decoded', async () => {
    const { controller, first, second } = setup();
    const pending = controller.show({
      current: '/clear/noon.webp',
      next: '/clear/golden.webp',
    });

    expect(first.getAttribute('src')).toBe('/clear/noon.webp');
    expect(first.style.opacity).toBe('0');

    first.finishLoad();
    await Promise.resolve();
    expect(first.style.opacity).toBe('0');

    first.finishDecode();
    await expect(pending).resolves.toMatchObject({
      status: 'shown',
      activeKey: '/clear/noon.webp||',
    });

    expect(first.style.opacity).toBe('1');
    expect(first.dataset.plateState).toBe('active');
    expect(second.getAttribute('src')).toBe('/clear/golden.webp');
    expect(second.dataset.plateState).toBe('preloading');
    controller.destroy();
  });

  it('keeps the visible plate when a replacement fails', async () => {
    const onLoadError = vi.fn();
    const { controller, first, second } = setup({ onLoadError });
    await showFirst(controller, first);

    const pending = controller.show({ current: '/storm/noon.webp' });
    second.failLoad();

    await expect(pending).resolves.toMatchObject({
      status: 'retained',
      activeKey: '/clear/noon.webp||',
    });
    expect(first.style.opacity).toBe('1');
    expect(second.style.opacity).toBe('0');
    expect(onLoadError).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'current',
      asset: expect.objectContaining({ src: '/storm/noon.webp' }),
    }));
    controller.destroy();
  });

  it('lets the newest request win an in-flight load race', async () => {
    const { controller, first, second } = setup();
    await showFirst(controller, first);

    const stale = controller.show({ current: '/scattered/noon.webp' });
    const current = controller.show({ current: '/overcast/noon.webp' });
    await loadAndDecode(second);

    await expect(stale).resolves.toMatchObject({ status: 'superseded' });
    await expect(current).resolves.toMatchObject({
      status: 'shown',
      activeKey: '/overcast/noon.webp||',
    });
    expect(controller.activeKey).toBe('/overcast/noon.webp||');
    expect(second.getAttribute('src')).toBe('/overcast/noon.webp');
    controller.destroy();
  });

  it('waits for the fade before reusing the retired slot for the next plate', async () => {
    vi.useFakeTimers();
    const { controller, first, second } = setup({ crossfadeMs: 900 });

    const firstShow = controller.show({
      current: '/clear/noon.webp',
      next: '/clear/golden.webp',
    });
    await loadAndDecode(first);
    await firstShow;
    await loadAndDecode(second);

    await controller.show({
      current: '/clear/golden.webp',
      next: '/clear/sunset.webp',
    });

    expect(first.getAttribute('src')).toBe('/clear/noon.webp');
    expect(first.dataset.plateState).toBe('retiring');
    await vi.advanceTimersByTimeAsync(899);
    expect(first.getAttribute('src')).toBe('/clear/noon.webp');
    await vi.advanceTimersByTimeAsync(1);
    expect(first.getAttribute('src')).toBe('/clear/sunset.webp');
    expect(first.dataset.plateState).toBe('preloading');
    controller.destroy();
  });

  it('swaps immediately and preloads next when reduced motion is requested', async () => {
    const motion = new FakeMotionPreference(true);
    const { controller, first, second } = setup({
      crossfadeMs: 900,
      reducedMotion: motion,
    });
    await showFirst(controller, first, '/clear/noon.webp');

    const next = controller.show({
      current: '/storm/noon.webp',
      next: '/storm/golden.webp',
    });
    await loadAndDecode(second);
    await next;

    expect(first.style.transitionDuration).toBe('0ms');
    expect(first.getAttribute('src')).toBe('/storm/golden.webp');
    expect(second.style.opacity).toBe('1');
    expect(first.style.opacity).toBe('0');
    controller.destroy();
  });

  it('cancels pending work and removes listeners exactly once on destroy', async () => {
    const motion = new FakeMotionPreference(false);
    const { controller, first } = setup({ reducedMotion: motion });
    const pending = controller.show({ current: '/clear/night.webp' });

    controller.destroy();
    controller.destroy();
    first.finishLoad();
    first.finishDecode();

    await expect(pending).resolves.toMatchObject({ status: 'destroyed' });
    expect(controller.activeKey).toBeNull();
    expect(motion.addCount).toBe(1);
    expect(motion.removeCount).toBe(1);
  });
});
