import { prisma } from "../../../infrastructure/database/prisma";
import { DealService } from "../application/deal-service";
import { PrismaDealRepository } from "./prisma-deal-repository";

export const dealService = new DealService(new PrismaDealRepository(prisma));
