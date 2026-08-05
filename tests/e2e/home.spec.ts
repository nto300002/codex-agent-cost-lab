import { expect, test } from "./fixtures";

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

test("rejects invalid credentials without creating a session", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("member1@example.test");
  await page.getByLabel("パスワード").fill("wrong-password");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(
    page.getByText("メールアドレスまたはパスワードが正しくありません"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await page.context().cookies()).some(
      ({ name }) => name === "tracecrm_session",
    ),
  ).toBe(false);
});

for (const user of seedUsers) {
  test(`${user.role} can log in and log out`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(user.email);
    await page.getByLabel("パスワード").fill("TraceCRM!2026");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "CRMダッシュボード" }),
    ).toBeVisible();
    await expect(page.getByText(user.role, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "ログアウト" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
}
