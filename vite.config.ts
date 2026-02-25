import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { vidyaMitraApiPlugin } from "./server/apiServer";
import { openaiProxyPlugin } from "./server/openaiProxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // VidyaMitra backend API (auth, DB, proxies)
    vidyaMitraApiPlugin(),
    // OpenAI backend proxy — key stays server-side
    openaiProxyPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
