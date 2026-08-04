import { expect, test } from "@playwright/test";

test("ADMIN filters audit logs and opens a detail", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("admin@example.test");
  await page.getByLabel("パスワード").fill("TraceCRM!2026");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/admin/audit-logs");
  await expect(page.getByRole("heading", { name: "監査ログ" })).toBeVisible();
  await page.getByLabel("Actor").fill("管理者");
  await page.getByLabel("Action").selectOption("LOGIN");
  await page.getByRole("button", { name: "絞り込む" }).click();

  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText("管理者");
  await expect(rows.first()).toContainText("ログイン");
  await rows.first().getByRole("link", { name: "表示" }).click();
  await expect(
    page.getByRole("heading", { name: "監査ログ詳細" }),
  ).toBeVisible();
  await expect(page.getByText("ログイン", { exact: true })).toBeVisible();
});
