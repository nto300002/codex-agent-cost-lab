import { expect, test } from "@playwright/test";

test("shows the TraceCRM home page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "TraceCRM" })).toBeVisible();
  await expect(
    page.getByText("プロンプトの情報量とAIエージェントの実装コスト"),
  ).toBeVisible();
});
