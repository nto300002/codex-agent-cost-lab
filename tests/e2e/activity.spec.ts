import { expect, test, type Page } from "./fixtures";

const customer1 = "10000000-0000-4000-8000-000000000001";
const activity5 = "30000000-0000-4000-8000-000000000005";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("member1@example.test");
  await page.getByLabel("パスワード").fill("TraceCRM!2026");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("manages Customer activities in newest-first order", async ({ page }) => {
  await login(page);
  await page.goto(`/customers/${customer1}`);

  const timelineItems = page.locator("ol li");
  await expect(timelineItems).toHaveCount(4);
  const initialTimeline = await timelineItems.allTextContents();
  expect(initialTimeline[0]).toContain("固定Seed活動 4");
  expect(initialTimeline[3]).toContain("固定Seed活動 1");

  await page.getByRole("button", { name: "活動を記録" }).click();
  await page.getByLabel("種類（必須）").selectOption("EMAIL");
  await page
    .getByLabel("活動日時（Asia/Tokyo・必須）")
    .fill("2026-08-04T12:34");
  await page.getByLabel("活動内容（必須）").fill("E2E活動作成");
  await page.getByRole("button", { name: "活動を登録" }).click();
  await expect(page.getByText("E2E活動作成", { exact: true })).toBeVisible();

  const createdCard = page.locator("ol li").filter({ hasText: "E2E活動作成" });
  await createdCard.getByRole("button", { name: "編集" }).click();
  await page.getByLabel("活動内容（必須）").fill("E2E活動更新");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByText("E2E活動更新", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  const updatedCard = page.locator("ol li").filter({ hasText: "E2E活動更新" });
  await updatedCard.getByRole("button", { name: "削除" }).click();
  await expect(page.getByText("E2E活動更新", { exact: true })).toHaveCount(0);

  const unauthorized = await page.request.delete(
    `/api/activities/${activity5}`,
  );
  expect(unauthorized.status()).toBe(403);
});
