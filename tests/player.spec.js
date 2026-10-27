import { test as base, expect } from "@playwright/test";

// Unexpected script errors fail every scenario, including rapid track changes.
const test = base.extend({
    page: async ({ page }, use) => {
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await use(page);
        expect(errors).toEqual([]);
    }
});

test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => { document.getElementById("audio").muted = true; });
});

async function ready(page) {
    await expect(page.getByRole("slider")).toBeEnabled();
    await expect(page.locator("#total-duration")).not.toHaveText("0:00");
}

test("loads track metadata and artwork without autoplay", async ({ page }) => {
    await ready(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Underneath the Tree");
    await expect(page.getByRole("img")).toHaveAttribute("alt", "Underneath the Tree by Kelly Clarkson");
    expect(await page.getByRole("img").evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    expect(await page.locator("#audio").evaluate(audio => audio.paused)).toBe(true);
    await expect(page.getByRole("status")).toBeEmpty();
});

test("plays, updates elapsed time, and pauses", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect.poll(() => page.locator("#audio").evaluate(audio => audio.currentTime)).toBeGreaterThan(0.1);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    expect(await page.locator("#audio").evaluate(audio => audio.paused)).toBe(true);
    await expect(page.locator("#play-symbol")).toBeVisible();
    await expect(page.locator("#pause-symbol")).toBeHidden();
});

test("seeks while paused and updates the timeline immediately", async ({ page }) => {
    await ready(page);
    await page.getByRole("slider").evaluate(slider => {
        slider.value = "60";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(page.locator("#current-time")).toHaveText("1:00");
    await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", /^1:00 of /);
    expect(await page.locator("#audio").evaluate(audio => audio.currentTime)).toBeCloseTo(60, 0);
    expect(await page.locator("#audio").evaluate(audio => audio.paused)).toBe(true);
});

test("wraps navigation and loads all five tracks while staying paused", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Previous track" }).click();
    await expect(page.getByRole("heading")).toHaveText("Kampana ng Simbahan");
    await ready(page);
    for (const title of ["Underneath the Tree", "All I Want For Christmas is You", "Snowman", "Happy SM Mallidays", "Kampana ng Simbahan", "Underneath the Tree"]) {
        await page.getByRole("button", { name: "Next track" }).click();
        await expect(page.getByRole("heading")).toHaveText(title);
        await ready(page);
        await expect.poll(() => page.getByRole("img").evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
        expect(await page.locator("#audio").evaluate(audio => audio.paused)).toBe(true);
    }
});

test("keeps playing when navigating tracks", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next track" }).click();
    await expect(page.getByRole("heading")).toHaveText("All I Want For Christmas is You");
    await ready(page);
    await expect.poll(() => page.locator("#audio").evaluate(audio => !audio.paused && audio.currentTime > 0)).toBe(true);
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("shuffle avoids the current track and Previous follows history", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => { Math.random = () => 0.99; });
    const shuffle = page.getByRole("button", { name: "Shuffle" });
    await shuffle.click();
    await expect(shuffle).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Next track" }).click();
    await expect(page.getByRole("heading")).toHaveText("Kampana ng Simbahan");
    await page.getByRole("button", { name: "Next track" }).click();
    await expect(page.getByRole("heading")).toHaveText("Happy SM Mallidays");
    await page.getByRole("button", { name: "Previous track" }).click();
    await expect(page.getByRole("heading")).toHaveText("Kampana ng Simbahan");
    await page.getByRole("button", { name: "Previous track" }).click();
    await expect(page.getByRole("heading")).toHaveText("Underneath the Tree");
    await shuffle.click();
    await expect(shuffle).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Next track" }).click();
    await expect(page.getByRole("heading")).toHaveText("All I Want For Christmas is You");
});

test("repeats the current track after a real ended event", async ({ page }) => {
    await ready(page);
    const repeat = page.getByRole("button", { name: "Repeat track" });
    await repeat.click();
    await expect(repeat).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.locator("#audio").evaluate(audio => { audio.currentTime = audio.duration - 0.15; });
    await expect.poll(() => page.locator("#audio").evaluate(audio => audio.currentTime)).toBeLessThan(2);
    await expect(page.getByRole("heading")).toHaveText("Underneath the Tree");
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await repeat.click();
    await expect(repeat).toHaveAttribute("aria-pressed", "false");
});

test("automatically advances when a track finishes", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.locator("#audio").evaluate(audio => { audio.currentTime = audio.duration - 0.15; });
    await expect(page.getByRole("heading")).toHaveText("All I Want For Christmas is You");
    await ready(page);
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("resets the timeline before the next track finishes loading", async ({ page }) => {
    await ready(page);
    await page.getByRole("slider").evaluate(slider => {
        slider.value = "60";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/all-i-want-for-christmas-is-you.mp3", async route => {
        await gate;
        await route.continue();
    });
    try {
        await page.getByRole("button", { name: "Next track" }).click();
        await expect(page.locator("#current-time")).toHaveText("0:00");
        await expect(page.locator("#total-duration")).toHaveText("0:00");
        await expect(page.getByRole("slider")).toHaveValue("0");
        await expect(page.getByRole("slider")).toBeDisabled();
    } finally {
        release();
    }
    await ready(page);
});

test("shows a missing-track error and recovers on the next track", async ({ page }) => {
    await ready(page);
    await page.route("**/all-i-want-for-christmas-is-you.mp3", route => route.fulfill({ status: 404, body: "" }));
    await page.getByRole("button", { name: "Next track" }).click();
    await expect(page.getByRole("status")).toHaveText("This track couldn't be loaded. Try another track.");
    await expect(page.getByRole("slider")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("This track couldn't be loaded. Try another track.");
    await page.getByRole("button", { name: "Next track" }).click();
    await expect(page.getByRole("heading")).toHaveText("Snowman");
    await ready(page);
    await expect(page.getByRole("status")).toBeEmpty();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("handles rejected playback without showing a false pause state", async ({ page }) => {
    await ready(page);
    await page.locator("#audio").evaluate(audio => {
        audio.play = () => Promise.reject(new DOMException("Blocked for regression test", "NotAllowedError"));
    });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Playback couldn't start. Press Play to try again.");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await page.locator("#audio").evaluate(audio => { delete audio.play; });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toBeEmpty();
});

test("ignores stale playback failures after switching tracks", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => {
        document.getElementById("audio").play = () => new Promise((resolve, reject) => {
            window.rejectOldPlay = reject;
        });
    });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "Next track" }).click();
    await ready(page);
    await page.evaluate(() => {
        delete document.getElementById("audio").play;
        window.rejectOldPlay(new DOMException("Old request", "NotAllowedError"));
    });
    await expect(page.getByRole("status")).toBeEmpty();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("controls work with a keyboard and the range announces time", async ({ page }) => {
    await ready(page);
    const shuffle = page.getByRole("button", { name: "Shuffle" });
    await shuffle.focus();
    await page.keyboard.press("Space");
    await expect(shuffle).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Previous track" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeFocused();
    const slider = page.getByRole("slider");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    expect(Number(await slider.inputValue())).toBeGreaterThan(0);
    await expect(slider).toHaveAttribute("aria-valuetext", /^\d+:\d{2} of \d+:\d{2}$/);
});

test("fits a 320px screen and scrolls in a short landscape viewport", async ({ page }) => {
    await ready(page);
    await page.setViewportSize({ width: 320, height: 568 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await page.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({ width: 667, height: 320 });
    await page.getByRole("button", { name: "Repeat track" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Repeat track" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
