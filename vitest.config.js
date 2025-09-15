import { defineConfig } from "vitest/config";
import { vitestSetupFilePath, getClarinetVitestsArgv } from "@hirosystems/clarinet-sdk/vitest";

export default defineConfig({
  test: {
    environment: "clarinet", // Use the custom clarinet environment
    singleThread: true, // Use single thread to avoid conflicts
    setupFiles: [vitestSetupFilePath],
    ...getClarinetVitestsArgv(),
  },
});
