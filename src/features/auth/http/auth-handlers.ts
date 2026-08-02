import { NextRequest, NextResponse } from "next/server";

import { ValidationError } from "../../../shared/errors/app-error";
import { toHttpErrorResponse } from "../../../shared/http/error-response";
import { parseInput } from "../../../shared/validation/parse-input";
import type { AuthService } from "../application/auth-service";
import { loginSchema } from "./login-schema";

export const sessionCookieName = "tracecrm_session";

type AuthOperations = Pick<AuthService, "login" | "logout" | "getCurrentUser">;

function errorResponse(error: unknown) {
  const { status, body } = toHttpErrorResponse(error);
  return NextResponse.json(body, { status });
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

export function createLoginHandler(
  auth: Pick<AuthOperations, "login">,
  secureCookie = process.env.NODE_ENV === "production",
) {
  return async function POST(request: Request) {
    try {
      const input = parseInput(loginSchema, await readRequestBody(request));
      const result = await auth.login(input);
      const response = NextResponse.json({ data: { user: result.user } });

      response.cookies.set({
        name: sessionCookieName,
        value: result.sessionToken,
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        path: "/",
        expires: result.expiresAt,
      });

      return response;
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function createLogoutHandler(auth: Pick<AuthOperations, "logout">) {
  return async function POST(request: NextRequest) {
    try {
      await auth.logout(sessionToken(request));
      const response = new NextResponse(null, { status: 204 });

      response.cookies.set({
        name: sessionCookieName,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: new Date(0),
        maxAge: 0,
      });

      return response;
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function createCurrentUserHandler(
  auth: Pick<AuthOperations, "getCurrentUser">,
) {
  return async function GET(request: NextRequest) {
    try {
      const user = await auth.getCurrentUser(sessionToken(request));
      return NextResponse.json({ data: { user } });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
