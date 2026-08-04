import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthService } from "../../auth/application/auth-service";
import { sessionCookieName } from "../../auth/http/auth-handlers";
import type { DealService } from "../application/deal-service";
import { ValidationError } from "../../../shared/errors/app-error";
import { toHttpErrorResponse } from "../../../shared/http/error-response";
import { parseInput } from "../../../shared/validation/parse-input";
import {
  createDealSchema,
  dealSearchSchema,
  updateDealSchema,
} from "./deal-schema";

type Operations = Pick<DealService, "list" | "get" | "create" | "update">;
type Auth = Pick<AuthService, "getCurrentUser">;
type Context = { params: Promise<{ id: string }> };
const idSchema = z.string().trim().min(1);
const errorResponse = (error: unknown) => {
  const { status, body } = toHttpErrorResponse(error);
  return NextResponse.json(body, { status });
};
async function body(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError({ body: ["有効なJSONを指定してください"] });
  }
}
const token = (request: NextRequest) =>
  request.cookies.get(sessionCookieName)?.value;

export function createDealCollectionHandlers(deals: Operations, auth: Auth) {
  return {
    GET: async (request: NextRequest) => {
      try {
        const actor = await auth.getCurrentUser(token(request));
        const search = parseInput(
          dealSearchSchema,
          Object.fromEntries(request.nextUrl.searchParams),
        );
        return NextResponse.json({ data: await deals.list(actor, search) });
      } catch (error) {
        return errorResponse(error);
      }
    },
    POST: async (request: NextRequest) => {
      try {
        const actor = await auth.getCurrentUser(token(request));
        const input = parseInput(createDealSchema, await body(request));
        return NextResponse.json(
          { data: { deal: await deals.create(actor, input) } },
          { status: 201 },
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

export function createDealItemHandlers(deals: Operations, auth: Auth) {
  return {
    GET: async (request: NextRequest, context: Context) => {
      try {
        const actor = await auth.getCurrentUser(token(request));
        const id = parseInput(idSchema, (await context.params).id);
        return NextResponse.json({
          data: { deal: await deals.get(actor, id) },
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
    PATCH: async (request: NextRequest, context: Context) => {
      try {
        const actor = await auth.getCurrentUser(token(request));
        const id = parseInput(idSchema, (await context.params).id);
        const input = parseInput(updateDealSchema, await body(request));
        return NextResponse.json({
          data: { deal: await deals.update(actor, id, input) },
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
