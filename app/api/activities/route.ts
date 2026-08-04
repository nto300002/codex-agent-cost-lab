import { authService } from "../../../src/features/auth/infrastructure/auth-service";
import { activityService } from "../../../src/features/activity/infrastructure/activity-service";
import { createActivityCollectionHandlers } from "../../../src/features/activity/http/activity-handlers";

export const dynamic = "force-dynamic";
export const { GET, POST } = createActivityCollectionHandlers(
  activityService,
  authService,
);
