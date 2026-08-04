import { PrismaCustomerRepository } from "../../customer/infrastructure/prisma-customer-repository";
import { PrismaDealRepository } from "../../deal/infrastructure/prisma-deal-repository";
import { prisma } from "../../../infrastructure/database/prisma";
import { ExportService } from "../application/export-service";
import { PrismaExportAuditRepository } from "./prisma-export-audit-repository";

export const exportService = new ExportService(
  new PrismaCustomerRepository(prisma),
  new PrismaDealRepository(prisma),
  new PrismaExportAuditRepository(prisma),
);
