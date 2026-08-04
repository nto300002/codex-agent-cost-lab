import { NextRequest, NextResponse } from "next/server";

import { toHttpErrorResponse } from "../../../shared/http/error-response";
import { parseInput } from "../../../shared/validation/parse-input";
import type { AuthService } from "../../auth/application/auth-service";
import { sessionCookieName } from "../../auth/http/auth-handlers";
import { customerExportSearchSchema } from "../../customer/http/customer-schema";
import { dealExportSearchSchema } from "../../deal/http/deal-schema";
import type { ExportService } from "../application/export-service";

type Auth = Pick<AuthService, "getCurrentUser">;
type Exports = Pick<ExportService, "customersCsv" | "dealsCsv">;

function token(request: NextRequest) {
  return request.cookies.get(sessionCookieName)?.value;
}

function errorResponse(error: unknown) {
  const { status, body } = toHttpErrorResponse(error);
  return NextResponse.json(body, { status });
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export function createCustomerExportHandler(exports: Exports, auth: Auth) {
  return async function GET(request: NextRequest) {
    try {
      const actor = await auth.getCurrentUser(token(request));
      const search = parseInput(
        customerExportSearchSchema,
        Object.fromEntries(request.nextUrl.searchParams),
      );
      return csvResponse(
        await exports.customersCsv(actor, search),
        "customers.csv",
      );
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function createDealExportHandler(exports: Exports, auth: Auth) {
  return async function GET(request: NextRequest) {
    try {
      const actor = await auth.getCurrentUser(token(request));
      const search = parseInput(
        dealExportSearchSchema,
        Object.fromEntries(request.nextUrl.searchParams),
      );
      return csvResponse(await exports.dealsCsv(actor, search), "deals.csv");
    } catch (error) {
      return errorResponse(error);
    }
  };
}
