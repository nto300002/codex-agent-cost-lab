import { prisma } from "../../../infrastructure/database/prisma";
import { PrismaTransactionManager } from "../../../infrastructure/database/prisma-transaction-manager";
import { UserService } from "../application/user-service";
import { PrismaUserRepository } from "./prisma-user-repository";

export const userService = new UserService(
  new PrismaUserRepository(prisma),
  new PrismaTransactionManager(prisma),
);
