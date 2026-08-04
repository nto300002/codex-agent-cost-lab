import { authService } from "../../../../src/features/auth/infrastructure/auth-service";
import { createCustomerExportHandler } from "../../../../src/features/export/http/export-handlers";
import { exportService } from "../../../../src/features/export/infrastructure/export-service";

export const GET = createCustomerExportHandler(exportService, authService);
