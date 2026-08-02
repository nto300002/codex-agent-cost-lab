import { prisma } from "../../../infrastructure/database/prisma";
import { SystemClock } from "../../../shared/time/clock";
import { AuthService } from "../application/auth-service";
import { PrismaAuthRepository } from "./prisma-auth-repository";

export const authService = new AuthService(
  new PrismaAuthRepository(prisma),
  new SystemClock(),
);
