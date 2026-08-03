import { authService } from "../../../../src/features/auth/infrastructure/auth-service";
import { createCustomerItemHandlers } from "../../../../src/features/customer/http/customer-handlers";
import { customerService } from "../../../../src/features/customer/infrastructure/customer-service";

export const { GET, PATCH, DELETE } = createCustomerItemHandlers(
  customerService,
  authService,
);
