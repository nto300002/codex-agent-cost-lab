import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import type { TransactionManager } from "../../shared/database/transaction-manager";

type PrismaTransactionHost = Pick<PrismaClient, "$transaction">;

export class PrismaTransactionManager implements TransactionManager<Prisma.TransactionClient> {
  constructor(private readonly prisma: PrismaTransactionHost) {}

  run<TResult>(
    operation: (transaction: Prisma.TransactionClient) => Promise<TResult>,
  ) {
    return this.prisma.$transaction(operation);
  }
}
