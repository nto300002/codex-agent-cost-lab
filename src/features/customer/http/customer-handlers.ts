import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { AuthService } from "../../auth/application/auth-service";
import { sessionCookieName } from "../../auth/http/auth-handlers";
import { ValidationError } from "../../../shared/errors/app-error";
import { toHttpErrorResponse } from "../../../shared/http/error-response";
import { parseInput } from "../../../shared/validation/parse-input";
import type { CustomerService } from "../application/customer-service";
import {
  createCustomerSchema,
  customerSearchSchema,
  updateCustomerSchema,
} from "./customer-schema";

type CustomerOperations = Pick<
  CustomerService<unknown>,
  "list" | "listOwners" | "get" | "create" | "update" | "delete"
>;
type AuthOperations = Pick<AuthService, "getCurrentUser">;
type RouteContext = { params: Promise<{ id: string }> };

const customerIdSchema = z.string().trim().min(1, "顧客IDを指定してください");

function errorResponse(error: unknown) {
  const { status, body } = toHttpErrorResponse(error);
  return NextResponse.json(body, { status });
}

export function createCustomerOwnersHandler(
  customers: Pick<CustomerOperations, "listOwners">,
  auth: AuthOperations,
) {
  return async function GET(request: NextRequest) {
    try {
      const actor = await auth.getCurrentUser(sessionToken(request));
      const owners = await customers.listOwners(actor);
      return NextResponse.json({ data: { owners } });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

async function readRequestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError({ body: ["有効なJSONを指定してください"] });
  }
}

function sessionToken(request: NextRequest) {
  return request.cookies.get(sessionCookieName)?.value;
}

async function customerId(context: RouteContext) {
  return parseInput(customerIdSchema, (await context.params).id);
}

export function createCustomerCollectionHandlers(
  customers: CustomerOperations,
  auth: AuthOperations,
) {
  return {
    GET: async (request: NextRequest) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const search = parseInput(
          customerSearchSchema,
          Object.fromEntries(request.nextUrl.searchParams),
        );
        const result = await customers.list(actor, search);
        return NextResponse.json({ data: result });
      } catch (error) {
        return errorResponse(error);
      }
    },
    POST: async (request: NextRequest) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const input = parseInput(
          createCustomerSchema,
          await readRequestBody(request),
        );
        const customer = await customers.create(actor, input);
        return NextResponse.json({ data: { customer } }, { status: 201 });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

export function createCustomerItemHandlers(
  customers: CustomerOperations,
  auth: AuthOperations,
) {
  return {
    GET: async (request: NextRequest, context: RouteContext) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const customer = await customers.get(actor, await customerId(context));
        return NextResponse.json({ data: { customer } });
      } catch (error) {
        return errorResponse(error);
      }
    },
    PATCH: async (request: NextRequest, context: RouteContext) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const input = parseInput(
          updateCustomerSchema,
          await readRequestBody(request),
        );
        const customer = await customers.update(
          actor,
          await customerId(context),
          input,
        );
        return NextResponse.json({ data: { customer } });
      } catch (error) {
        return errorResponse(error);
      }
    },
    DELETE: async (request: NextRequest, context: RouteContext) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        await customers.delete(actor, await customerId(context));
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
