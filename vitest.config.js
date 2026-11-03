// Test-only configuration. Uses the sample-data stand-in instead of the live Supabase library.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://test.supabase.co"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-anon-key"),
  },
  envDir: "test",
  resolve: {
    alias: { "@supabase/supabase-js": fileURLToPath(new URL("./test/mock-supabase.js", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.jsx"],
    testTimeout: 12000,
  },
});
