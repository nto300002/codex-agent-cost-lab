import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthService } from "../../auth/application/auth-service";
import { sessionCookieName } from "../../auth/http/auth-handlers";
import { ValidationError } from "../../../shared/errors/app-error";
import { toHttpErrorResponse } from "../../../shared/http/error-response";
import { parseInput } from "../../../shared/validation/parse-input";
import type { UserService } from "../application/user-service";
import { createUserSchema, updateUserSchema } from "./user-schema";

type UserOperations = Pick<UserService<unknown>, "list" | "create" | "update">;
type AuthOperations = Pick<AuthService, "getCurrentUser">;
type RouteContext = { params: Promise<{ id: string }> };
const userIdSchema = z.string().trim().min(1, "ユーザーIDを指定してください");

function sessionToken(request: NextRequest) {
  return request.cookies.get(sessionCookieName)?.value;
}

async function requestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError({ body: ["有効なJSONを指定してください"] });
  }
}

function errorResponse(error: unknown) {
  const { status, body } = toHttpErrorResponse(error);
  return NextResponse.json(body, { status });
}

export function createUserCollectionHandlers(
  users: UserOperations,
  auth: AuthOperations,
) {
  return {
    GET: async (request: NextRequest) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        return NextResponse.json({ data: { users: await users.list(actor) } });
      } catch (error) {
        return errorResponse(error);
      }
    },
    POST: async (request: NextRequest) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const input = parseInput(createUserSchema, await requestBody(request));
        const user = await users.create(actor, input);
        return NextResponse.json({ data: { user } }, { status: 201 });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

export function createUserItemHandlers(
  users: UserOperations,
  auth: AuthOperations,
) {
  return {
    PATCH: async (request: NextRequest, context: RouteContext) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const id = parseInput(userIdSchema, (await context.params).id);
        const input = parseInput(updateUserSchema, await requestBody(request));
        const user = await users.update(actor, id, input);
        return NextResponse.json({ data: { user } });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
