// CSS Houdini Paint Worklet — progressive enhancement only.
// Registered from Layout.astro via CSS.paintWorklet.addModule(), and only
// takes effect where `background-image: paint(organicGrain)` is applied
// (gated behind .houdini-supported on <html>, set via JS feature detection).
// Draws a few soft warm blotches for an organic, hand-textured surface —
// purely decorative, never load-bearing for content or layout.
class OrganicGrainPainter {
  static get inputProperties() {
    return [];
  }

  paint(ctx, geom) {
    const { width, height } = geom;
    const blobs = 5;
    const colors = [
      'rgba(201, 123, 61, 0.05)',
      'rgba(124, 143, 92, 0.045)',
      'rgba(217, 164, 65, 0.04)',
    ];

    for (let i = 0; i < blobs; i++) {
      const seed = (i * 137.5) % 360;
      const x = (Math.sin(seed) * 0.5 + 0.5) * width;
      const y = (Math.cos(seed * 1.3) * 0.5 + 0.5) * height;
      const r = Math.max(width, height) * (0.25 + (i % 3) * 0.12);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, colors[i % colors.length]);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  }
}

registerPaint('organicGrain', OrganicGrainPainter);
