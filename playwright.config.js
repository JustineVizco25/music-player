import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 2,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
            : {}
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
        { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }
    ],
    webServer: {
        command: "npm start",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI
    }
});
