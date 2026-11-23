import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // All test files share one database, so run them one after another
        fileParallelism: false,
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            // Type-only files, one-off scripts and the process entry point
            exclude: [
                "src/types/**",
                "src/scripts/**",
                "src/db/migrationRunner.ts",
                "src/server.ts"
            ],
            reporter: [["text", { maxCols: 160 }], "html"],
            reportsDirectory: "coverage"
        }
    }
});
