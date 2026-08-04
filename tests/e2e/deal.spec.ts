import { expect, test } from "@playwright/test";

const customer1 = "10000000-0000-4000-8000-000000000001";
const deal1 = "20000000-0000-4000-8000-000000000001";
const deal3 = "20000000-0000-4000-8000-000000000003";
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("member1@example.test");
  await page.getByLabel("パスワード").fill("TraceCRM!2026");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("shows Customer deals and rejects an out-of-scope update", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/customers/${customer1}`);
  await expect(
    page.getByRole("link", { name: "商談 01", exact: true }),
  ).toBeVisible();
  await page.goto(`/deals/${deal1}`);
  await expect(page.getByRole("link", { name: "商談を編集" })).toBeVisible();
  const response = await page.request.patch(`/api/deals/${deal3}`, {
    data: { title: "Unauthorized" },
  });
  expect(response.status()).toBe(403);
});
