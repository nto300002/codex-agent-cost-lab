import { expect, test } from "@playwright/test";

const seedUsers = [
  { email: "admin@example.test", role: "ADMIN" },
  { email: "manager@example.test", role: "MANAGER" },
  { email: "member1@example.test", role: "MEMBER" },
];

test("redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

for (const user of seedUsers) {
  test(`${user.role} can log in and log out`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(user.email);
    await page.getByLabel("パスワード").fill("TraceCRM!2026");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "TraceCRM" })).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByText(user.role, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "ログアウト" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
}
