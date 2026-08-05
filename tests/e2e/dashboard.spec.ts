import { expect, test, type Page } from "./fixtures";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("member1@example.test");
  await page.getByLabel("パスワード").fill("TraceCRM!2026");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("shows only the MEMBER dashboard scope", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "CRMダッシュボード" }),
  ).toBeVisible();
  await expect(
    page.getByText("自分の担当範囲の状況を表示しています。"),
  ).toBeVisible();

  const customers = page.getByRole("article", {
    name: "担当顧客数",
    exact: true,
  });
  const deals = page.getByRole("article", { name: "商談数", exact: true });
  const activeDeals = page.getByRole("article", {
    name: "進行中商談数",
    exact: true,
  });
  await expect(customers.locator("strong")).toHaveText(/^\d+$/);
  await expect(deals.locator("strong")).toHaveText(/^\d+$/);
  await expect(activeDeals.locator("strong")).toHaveText(/^\d+$/);

  const response = await page.request.get("/api/dashboard");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    data: {
      summary: {
        customerCount: number;
        dealCount: number;
        dealStageCounts: Record<string, number>;
        recentActivities: Array<{ customer: { ownerId: string } }>;
      };
    };
  };
  expect(body.data.summary.customerCount).toBeGreaterThanOrEqual(20);
  expect(body.data.summary.dealCount).toBe(40);
  expect(body.data.summary.dealStageCounts).toEqual({
    NEW: 8,
    QUALIFIED: 8,
    PROPOSAL: 8,
    WON: 8,
    LOST: 8,
  });
  expect(
    body.data.summary.recentActivities.every(
      ({ customer }) =>
        customer.ownerId === "00000000-0000-4000-8000-000000000003",
    ),
  ).toBe(true);
});
