import { authService } from "../../../../src/features/auth/infrastructure/auth-service";
import { activityService } from "../../../../src/features/activity/infrastructure/activity-service";
import { createActivityItemHandlers } from "../../../../src/features/activity/http/activity-handlers";

export const dynamic = "force-dynamic";
export const { GET, PATCH, DELETE } = createActivityItemHandlers(
  activityService,
  authService,
);
