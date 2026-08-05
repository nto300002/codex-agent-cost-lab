import { expect, test } from "./fixtures";

const adminId = "00000000-0000-4000-8000-000000000001";

test("ADMIN deletes a Customer graph and records one audit log", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("admin@example.test");
  await page.getByLabel("パスワード").fill("TraceCRM!2026");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);

  const customerResponse = await page.request.post("/api/customers", {
    data: {
      name: "E2E 削除対象",
      email: null,
      phone: null,
      status: "ACTIVE",
      ownerId: adminId,
      notes: null,
    },
  });
  expect(customerResponse.status()).toBe(201);
  const customer = (await customerResponse.json()) as {
    data: { customer: { id: string } };
  };
  const customerId = customer.data.customer.id;

  const dealResponse = await page.request.post("/api/deals", {
    data: {
      customerId,
      title: "E2E 削除対象商談",
      amountCents: 1000,
      stage: "NEW",
      ownerId: adminId,
      expectedCloseDate: null,
    },
  });
  expect(dealResponse.status()).toBe(201);
  const deal = (await dealResponse.json()) as {
    data: { deal: { id: string } };
  };

  const activityResponse = await page.request.post("/api/activities", {
    data: {
      customerId,
      dealId: deal.data.deal.id,
      type: "NOTE",
      summary: "E2E 削除対象活動",
      occurredAt: "2026-04-01T01:00:00.000Z",
    },
  });
  expect(activityResponse.status()).toBe(201);
  const activity = (await activityResponse.json()) as {
    data: { activity: { id: string } };
  };

  await page.goto(`/customers/${customerId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "顧客を削除" }).click();
  await expect(page).toHaveURL(/\/customers$/);

  const [deletedCustomer, deletedDeal, deletedActivity] = await Promise.all([
    page.request.get(`/api/customers/${customerId}`),
    page.request.get(`/api/deals/${deal.data.deal.id}`),
    page.request.get(`/api/activities/${activity.data.activity.id}`),
  ]);
  expect([
    deletedCustomer.status(),
    deletedDeal.status(),
    deletedActivity.status(),
  ]).toEqual([404, 404, 404]);

  const auditResponse = await page.request.get(
    "/api/admin/audit-logs?action=DELETE&entityType=Customer&pageSize=100",
  );
  expect(auditResponse.ok()).toBe(true);
  const audit = (await auditResponse.json()) as {
    data: { logs: Array<{ entityId: string | null }> };
  };
  expect(
    audit.data.logs.filter(({ entityId }) => entityId === customerId),
  ).toHaveLength(1);
});
