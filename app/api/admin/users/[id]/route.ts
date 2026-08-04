import { authService } from "../../../../../src/features/auth/infrastructure/auth-service";
import { createUserItemHandlers } from "../../../../../src/features/user/http/user-handlers";
import { userService } from "../../../../../src/features/user/infrastructure/user-service";

export const dynamic = "force-dynamic";
export const { PATCH } = createUserItemHandlers(userService, authService);
