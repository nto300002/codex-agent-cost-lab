import { authService } from "../../../../src/features/auth/infrastructure/auth-service";
import { createDealItemHandlers } from "../../../../src/features/deal/http/deal-handlers";
import { dealService } from "../../../../src/features/deal/infrastructure/deal-service";
export const { GET, PATCH } = createDealItemHandlers(dealService, authService);
