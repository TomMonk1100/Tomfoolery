// vite.config.ts
import { defineConfig } from "file:///sessions/friendly-charming-meitner/mnt/TomSite/understory/node_modules/vite/dist/node/index.js";
import { VitePWA } from "file:///sessions/friendly-charming-meitner/mnt/TomSite/understory/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Understory",
        short_name: "Understory",
        description: "Live one small life well \u2014 a one-handed nature roguelite.",
        theme_color: "#2f5d3a",
        background_color: "#14261a",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ],
  build: {
    target: "es2020",
    sourcemap: false
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZnJpZW5kbHktY2hhcm1pbmctbWVpdG5lci9tbnQvVG9tU2l0ZS91bmRlcnN0b3J5XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvc2Vzc2lvbnMvZnJpZW5kbHktY2hhcm1pbmctbWVpdG5lci9tbnQvVG9tU2l0ZS91bmRlcnN0b3J5L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9zZXNzaW9ucy9mcmllbmRseS1jaGFybWluZy1tZWl0bmVyL21udC9Ub21TaXRlL3VuZGVyc3Rvcnkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgYmFzZTogXCIuL1wiLFxuICBwbHVnaW5zOiBbXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgaW5jbHVkZUFzc2V0czogW1wiaWNvbnMvaWNvbi0xOTIucG5nXCIsIFwiaWNvbnMvaWNvbi01MTIucG5nXCJdLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogXCJVbmRlcnN0b3J5XCIsXG4gICAgICAgIHNob3J0X25hbWU6IFwiVW5kZXJzdG9yeVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJMaXZlIG9uZSBzbWFsbCBsaWZlIHdlbGwgXHUyMDE0IGEgb25lLWhhbmRlZCBuYXR1cmUgcm9ndWVsaXRlLlwiLFxuICAgICAgICB0aGVtZV9jb2xvcjogXCIjMmY1ZDNhXCIsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzE0MjYxYVwiLFxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcbiAgICAgICAgb3JpZW50YXRpb246IFwicG9ydHJhaXRcIixcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7IHNyYzogXCJpY29ucy9pY29uLTE5Mi5wbmdcIiwgc2l6ZXM6IFwiMTkyeDE5MlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiIH0sXG4gICAgICAgICAgeyBzcmM6IFwiaWNvbnMvaWNvbi01MTIucG5nXCIsIHNpemVzOiBcIjUxMng1MTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6IFwiZXMyMDIwXCIsXG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnVyxTQUFTLG9CQUFvQjtBQUM3WCxTQUFTLGVBQWU7QUFFeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBLEVBQ04sU0FBUztBQUFBLElBQ1AsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLHNCQUFzQixvQkFBb0I7QUFBQSxNQUMxRCxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsUUFDYixPQUFPO0FBQUEsVUFDTCxFQUFFLEtBQUssc0JBQXNCLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxVQUNqRSxFQUFFLEtBQUssc0JBQXNCLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxRQUNuRTtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsRUFDYjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
