import { describe, expect, it, vi } from "vitest";

import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { PrismaTransactionManager } from "./prisma-transaction-manager";

describe("PrismaTransactionManager", () => {
  it("runs work with the transaction client and returns its result", async () => {
    const transaction = {} as Prisma.TransactionClient;
    const transactionHost = {
      $transaction: vi.fn(
        async <TResult>(
          operation: (client: Prisma.TransactionClient) => Promise<TResult>,
        ) => operation(transaction),
      ),
    } as unknown as Pick<PrismaClient, "$transaction">;
    const manager = new PrismaTransactionManager(transactionHost);

    await expect(
      manager.run(async (client) => client === transaction),
    ).resolves.toBe(true);
    expect(transactionHost.$transaction).toHaveBeenCalledOnce();
  });

  it("propagates transaction failures", async () => {
    const failure = new Error("rollback");
    const transactionHost = {
      $transaction: vi.fn(async () => {
        throw failure;
      }),
    } as unknown as Pick<PrismaClient, "$transaction">;
    const manager = new PrismaTransactionManager(transactionHost);

    await expect(manager.run(async () => "unused")).rejects.toBe(failure);
  });
});
