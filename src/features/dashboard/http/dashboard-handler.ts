import { NextRequest, NextResponse } from "next/server";
import type { AuthService } from "../../auth/application/auth-service";
import { sessionCookieName } from "../../auth/http/auth-handlers";
import { toHttpErrorResponse } from "../../../shared/http/error-response";
import type { DashboardService } from "../application/dashboard-service";

type DashboardOperations = Pick<DashboardService, "get">;
type AuthOperations = Pick<AuthService, "getCurrentUser">;

export function createDashboardHandler(
  dashboard: DashboardOperations,
  auth: AuthOperations,
) {
  return async function GET(request: NextRequest) {
    try {
      const token = request.cookies.get(sessionCookieName)?.value;
      const actor = await auth.getCurrentUser(token);
      return NextResponse.json({
        data: { summary: await dashboard.get(actor) },
      });
    } catch (error) {
      const { status, body } = toHttpErrorResponse(error);
      return NextResponse.json(body, { status });
    }
  };
}
