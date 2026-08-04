import { prisma } from "../../../infrastructure/database/prisma";
import { SystemClock } from "../../../shared/time/clock";
import { DashboardService } from "../application/dashboard-service";
import { PrismaDashboardRepository } from "./prisma-dashboard-repository";

export const dashboardService = new DashboardService(
  new PrismaDashboardRepository(prisma),
  new SystemClock(),
);
