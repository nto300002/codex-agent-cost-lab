import { expect, test as base } from "@playwright/test";

const allowedHosts = new Set(["127.0.0.1", "localhost"]);

export const test = base.extend<{ blockExternalRequests: void }>({
  blockExternalRequests: [
    async ({ context }, use) => {
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (allowedHosts.has(url.hostname)) {
          await route.continue();
          return;
        }
        await route.abort("blockedbyclient");
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from "@playwright/test";
