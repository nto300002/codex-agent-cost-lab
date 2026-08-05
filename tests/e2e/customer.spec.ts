import { expect, test, type Page } from "./fixtures";

const password = "TraceCRM!2026";
const member1Id = "00000000-0000-4000-8000-000000000003";
const member2Id = "00000000-0000-4000-8000-000000000004";
const customer1Id = "10000000-0000-4000-8000-000000000001";
const customer2Id = "10000000-0000-4000-8000-000000000002";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("customer UI", () => {
  test("restores search and filters from the URL", async ({ page }) => {
    await login(page, "manager@example.test");
    await page.goto(
      `/customers?name=${encodeURIComponent("サンプル顧客 02")}&status=ACTIVE&ownerId=${member2Id}`,
    );

    await expect(page.getByLabel("顧客名")).toHaveValue("サンプル顧客 02");
    await expect(page.getByLabel("ステータス")).toHaveValue("ACTIVE");
    await expect(page.getByLabel("担当者")).toHaveValue(member2Id);
    await expect(
      page.getByRole("link", { name: "サンプル顧客 02" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "サンプル顧客 01" }),
    ).toHaveCount(0);

    await page.reload();
    await expect(page.getByLabel("顧客名")).toHaveValue("サンプル顧客 02");
    await expect(page.getByLabel("ステータス")).toHaveValue("ACTIVE");
    await expect(page.getByLabel("担当者")).toHaveValue(member2Id);
  });

  test("creates a customer with empty optional fields using the keyboard", async ({
    page,
  }) => {
    await login(page, "admin@example.test");
    await page.goto("/customers/new");
    await page.getByLabel("顧客名（必須）").fill("E2E キーボード顧客");
    await page.getByLabel("ステータス（必須）").selectOption("ACTIVE");
    await page.getByLabel("担当者（必須）").selectOption(member1Id);
    await page.getByRole("button", { name: "顧客を登録" }).focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/customers\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: "E2E キーボード顧客" }),
    ).toBeVisible();
    await expect(page.getByText("未登録", { exact: true })).toHaveCount(3);

    const customerId = page.url().split("/").at(-1);
    const response = await page.request.get(`/api/customers/${customerId}`);
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      data: { customer: { email: string | null; phone: string | null } };
    };
    expect(body.data.customer.email).toBeNull();
    expect(body.data.customer.phone).toBeNull();
  });

  test("hides unauthorized actions and the API still rejects them", async ({
    page,
  }) => {
    await login(page, "member1@example.test");
    await page.goto(`/customers/${customer1Id}`);

    await expect(page.getByRole("link", { name: "顧客を編集" })).toBeVisible();
    await expect(page.getByRole("button", { name: "顧客を削除" })).toHaveCount(
      0,
    );

    const deleteResponse = await page.request.delete(
      `/api/customers/${customer2Id}`,
    );
    expect(deleteResponse.status()).toBe(403);

    await page.goto(`/customers/${customer2Id}`);
    await expect(
      page.getByText("この操作を実行する権限がありません", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "顧客を編集" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "顧客を削除" })).toHaveCount(
      0,
    );
  });

  test("MEMBER edits an owned customer", async ({ page }) => {
    await login(page, "member1@example.test");
    await page.goto(`/customers/${customer1Id}/edit`);
    await page.getByLabel("顧客名（必須）").fill("E2E 更新顧客");
    await page.getByLabel("メモ").fill("担当者による更新");
    await page.getByRole("button", { name: "変更を保存" }).click();

    await expect(page).toHaveURL(new RegExp(`/customers/${customer1Id}$`));
    await expect(
      page.getByRole("heading", { name: "E2E 更新顧客" }),
    ).toBeVisible();
    await expect(page.getByText("担当者による更新")).toBeVisible();
  });
});
