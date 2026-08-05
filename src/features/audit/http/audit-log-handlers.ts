import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toHttpErrorResponse } from "../../../shared/http/error-response";
import { parseInput } from "../../../shared/validation/parse-input";
import type { AuthService } from "../../auth/application/auth-service";
import { sessionCookieName } from "../../auth/http/auth-handlers";
import type { AuditLogService } from "../application/audit-log-service";
import { auditLogSearchSchema } from "./audit-log-schema";

type AuditOperations = Pick<AuditLogService, "list" | "get">;
type AuthOperations = Pick<AuthService, "getCurrentUser">;
type Context = { params: Promise<{ id: string }> };
const idSchema = z.string().trim().min(1);

function token(request: NextRequest) {
  return request.cookies.get(sessionCookieName)?.value;
}

function errorResponse(error: unknown) {
  const { status, body } = toHttpErrorResponse(error);
  return NextResponse.json(body, { status });
}

export function createAuditLogCollectionHandler(
  auditLogs: AuditOperations,
  auth: AuthOperations,
) {
  return async function GET(request: NextRequest) {
    try {
      const actor = await auth.getCurrentUser(token(request));
      const search = parseInput(
        auditLogSearchSchema,
        Object.fromEntries(request.nextUrl.searchParams),
      );
      return NextResponse.json({ data: await auditLogs.list(actor, search) });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function createAuditLogItemHandler(
  auditLogs: AuditOperations,
  auth: AuthOperations,
) {
  return async function GET(request: NextRequest, context: Context) {
    try {
      const actor = await auth.getCurrentUser(token(request));
      const id = parseInput(idSchema, (await context.params).id);
      return NextResponse.json({
        data: { log: await auditLogs.get(actor, id) },
      });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
