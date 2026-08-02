import { createLoginHandler } from "../../../../src/features/auth/http/auth-handlers";
import { authService } from "../../../../src/features/auth/infrastructure/auth-service";

export const POST = createLoginHandler(authService);
