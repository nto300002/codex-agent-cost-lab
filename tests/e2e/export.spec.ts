import { expect, test } from "./fixtures";

test("MANAGER downloads the filtered Customer CSV", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("manager@example.test");
  await page.getByLabel("パスワード").fill("TraceCRM!2026");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/customers?status=ACTIVE");
  const exportLink = page.getByRole("link", { name: "CSV出力" });
  await expect(exportLink).toHaveAttribute(
    "href",
    "/api/exports/customers.csv?status=ACTIVE",
  );
  const downloadPromise = page.waitForEvent("download");
  await exportLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("customers.csv");
});
