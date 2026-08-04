import { authService } from "../../../../src/features/auth/infrastructure/auth-service";
import { createDealExportHandler } from "../../../../src/features/export/http/export-handlers";
import { exportService } from "../../../../src/features/export/infrastructure/export-service";

export const GET = createDealExportHandler(exportService, authService);
