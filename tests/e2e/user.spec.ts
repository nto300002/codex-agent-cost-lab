import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("TraceCRM!2026");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);
}

for (const email of ["manager@example.test", "member1@example.test"]) {
  test(`${email} receives 403 from every user API`, async ({ page }) => {
    await login(page, email);
    const list = await page.request.get("/api/admin/users");
    const create = await page.request.post("/api/admin/users", {
      data: {
        name: "Blocked",
        email: "blocked@example.test",
        password: "BlockedPass!1",
        role: "MEMBER",
      },
    });
    const update = await page.request.patch(
      "/api/admin/users/00000000-0000-4000-8000-000000000004",
      { data: { role: "MANAGER" } },
    );
    expect([list.status(), create.status(), update.status()]).toEqual([
      403, 403, 403,
    ]);
  });
}

test("ADMIN creates, changes role and disables a user", async ({ page }) => {
  await login(page, "admin@example.test");
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "ユーザー管理" }),
  ).toBeVisible();

  const createForm = page.getByRole("form", { name: "ユーザー追加" });
  await createForm.getByLabel("名前").fill("追加ユーザー");
  await createForm.getByLabel("メールアドレス").fill("issue13@example.test");
  await createForm.getByLabel("初期パスワード").fill("Issue13Pass!1");
  await createForm.getByRole("button", { name: "ユーザーを追加" }).click();

  let card = page.getByRole("article", { name: "追加ユーザーの設定" });
  await expect(card).toBeVisible();
  await card.getByLabel("ロール").selectOption("MANAGER");
  await card.getByRole("button", { name: "変更を保存" }).click();
  card = page.getByRole("article", { name: "追加ユーザーの設定" });
  await expect(card.getByLabel("ロール")).toHaveValue("MANAGER");
  await card.getByRole("button", { name: "無効にする" }).click();
  card = page.getByRole("article", { name: "追加ユーザーの設定" });
  await expect(card.getByText("無効", { exact: true })).toBeVisible();
});
