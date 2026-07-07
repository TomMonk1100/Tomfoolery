import { describe, it, expect } from "vitest";
import {
  wrapMod,
  nearestWrappedCoord,
  nearestWrappedPos,
  cameraStep,
  ghostOffsets,
} from "../src/systems/wrapRenderSim";

const SIZE = 1536;

describe("wrapRenderSim (Update 3 WS-C)", () => {
  describe("wrapMod", () => {
    it("canonicalizes into [0, size)", () => {
      expect(wrapMod(0, SIZE)).toBe(0);
      expect(wrapMod(1536, SIZE)).toBe(0);
      expect(wrapMod(-4, SIZE)).toBe(1532);
      expect(wrapMod(3080, SIZE)).toBe(8);
    });
  });

  describe("nearestWrappedCoord", () => {
    it("returns the copy nearest the reference across the seam", () => {
      // entity just left of seam, camera just right of it → negative copy
      expect(nearestWrappedCoord(1530, 10, SIZE)).toBe(1530 - SIZE);
      // entity just right of seam, camera left of it → positive overflow copy
      expect(nearestWrappedCoord(6, 1520, SIZE)).toBe(6 + SIZE);
      // no wrap needed when already nearest
      expect(nearestWrappedCoord(700, 768, SIZE)).toBe(700);
    });

    it("9-case grid: center, 4 edges, 4 corners all map within half-world", () => {
      const refs = [
        { x: 768, y: 768 }, // center
        { x: 0, y: 768 },
        { x: 1535, y: 768 }, // x edges
        { x: 768, y: 0 },
        { x: 768, y: 1535 }, // y edges
        { x: 0, y: 0 },
        { x: 0, y: 1535 }, // corners
        { x: 1535, y: 0 },
        { x: 1535, y: 1535 },
      ];
      const entity = { x: 1500, y: 20 };
      for (const ref of refs) {
        const p = nearestWrappedPos(entity, ref, SIZE);
        expect(Math.abs(p.x - ref.x)).toBeLessThanOrEqual(SIZE / 2);
        expect(Math.abs(p.y - ref.y)).toBeLessThanOrEqual(SIZE / 2);
        // every copy is congruent to the truth position
        expect(wrapMod(p.x, SIZE)).toBe(entity.x);
        expect(wrapMod(p.y, SIZE)).toBe(entity.y);
      }
    });
  });

  describe("cameraStep", () => {
    it("moves toward the player and stays wrapped", () => {
      const next = cameraStep({ x: 700, y: 768 }, { x: 800, y: 768 }, SIZE, 16.7);
      expect(next.x).toBeGreaterThan(700);
      expect(next.x).toBeLessThan(800);
      expect(next.y).toBe(768);
    });

    it("takes the short way across the seam (no full-world lurch)", () => {
      // camera at x=10, player wrapped to x=1530 → correct move is LEFT (−),
      // ending up either slightly negative-wrapped or just below 10.
      const next = cameraStep({ x: 10, y: 768 }, { x: 1530, y: 768 }, SIZE, 16.7);
      const delta = next.x - 10;
      // wrapped delta must be small — never ~1520px of travel in one frame
      const shortest = ((1530 - 10 + SIZE / 2) % SIZE) - SIZE / 2 + SIZE;
      void shortest;
      expect(Math.abs(delta) < 100 || Math.abs(delta - SIZE) < 100).toBe(true);
    });

    it("converges: repeated steps settle on the player (seam crossing)", () => {
      let c = { x: 10, y: 10 };
      const target = { x: 1500, y: 1500 };
      for (let i = 0; i < 300; i++) c = cameraStep(c, target, SIZE, 16.7);
      expect(Math.abs(c.x - target.x)).toBeLessThan(1);
      expect(Math.abs(c.y - target.y)).toBeLessThan(1);
    });

    it("is a no-op when centered on the player", () => {
      const c = cameraStep({ x: 768, y: 768 }, { x: 768, y: 768 }, SIZE, 16.7);
      expect(c).toEqual({ x: 768, y: 768 });
    });
  });

  describe("ghostOffsets", () => {
    it("covers the negative spill", () => {
      expect(ghostOffsets(-200, -100, SIZE)).toEqual({ ox: -SIZE, oy: -SIZE });
    });
    it("covers the positive spill", () => {
      expect(ghostOffsets(1200, 900, SIZE)).toEqual({ ox: SIZE, oy: SIZE });
    });
  });
});
