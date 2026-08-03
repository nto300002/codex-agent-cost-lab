import { authService } from "../../../src/features/auth/infrastructure/auth-service";
import { createCustomerOwnersHandler } from "../../../src/features/customer/http/customer-handlers";
import { customerService } from "../../../src/features/customer/infrastructure/customer-service";

export const GET = createCustomerOwnersHandler(customerService, authService);
