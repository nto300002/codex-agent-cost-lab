import { expect, test, type Page } from "./fixtures";

const customer1 = "10000000-0000-4000-8000-000000000001";
const deal1 = "20000000-0000-4000-8000-000000000001";
const deal3 = "20000000-0000-4000-8000-000000000003";
async function login(page: Page) {
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

test("MEMBER creates and updates an owned deal and invalid transitions fail", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/deals/new?customerId=${customer1}`);
  await page.getByLabel("タイトル（必須）").fill("E2E 商談フロー");
  await page.getByLabel("金額（円・必須）").fill("250000");
  await page.getByRole("button", { name: "商談を登録" }).click();

  await expect(page).toHaveURL(/\/deals\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: "E2E 商談フロー" }),
  ).toBeVisible();
  const dealId = page.url().split("/").at(-1);
  expect(dealId).toBeTruthy();

  const invalid = await page.request.patch(`/api/deals/${dealId}`, {
    data: { stage: "WON" },
  });
  expect(invalid.status()).toBe(400);

  await page.goto(`/deals/${dealId}/edit`);
  await page.getByLabel("ステージ（必須）").selectOption("QUALIFIED");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/deals/${dealId}$`));
  await expect(page.getByText("見込み確認", { exact: true })).toBeVisible();
});
