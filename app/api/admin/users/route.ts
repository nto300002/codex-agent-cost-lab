import { authService } from "../../../../src/features/auth/infrastructure/auth-service";
import { createUserCollectionHandlers } from "../../../../src/features/user/http/user-handlers";
import { userService } from "../../../../src/features/user/infrastructure/user-service";

export const dynamic = "force-dynamic";
export const { GET, POST } = createUserCollectionHandlers(
  userService,
  authService,
);
