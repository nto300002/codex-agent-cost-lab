import { authService } from "../../../src/features/auth/infrastructure/auth-service";
import { dashboardService } from "../../../src/features/dashboard/infrastructure/dashboard-service";
import { createDashboardHandler } from "../../../src/features/dashboard/http/dashboard-handler";

export const dynamic = "force-dynamic";
export const GET = createDashboardHandler(dashboardService, authService);
