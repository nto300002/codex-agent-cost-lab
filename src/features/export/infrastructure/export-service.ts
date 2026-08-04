import { PrismaCustomerRepository } from "../../customer/infrastructure/prisma-customer-repository";
import { PrismaDealRepository } from "../../deal/infrastructure/prisma-deal-repository";
import { auditLogService } from "../../audit/infrastructure/audit-log-service";
import { prisma } from "../../../infrastructure/database/prisma";
import { ExportService } from "../application/export-service";

export const exportService = new ExportService(
  new PrismaCustomerRepository(prisma),
  new PrismaDealRepository(prisma),
  auditLogService,
);
