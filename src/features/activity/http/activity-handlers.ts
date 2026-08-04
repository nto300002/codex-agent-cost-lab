import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthService } from "../../auth/application/auth-service";
import { sessionCookieName } from "../../auth/http/auth-handlers";
import { ValidationError } from "../../../shared/errors/app-error";
import { toHttpErrorResponse } from "../../../shared/http/error-response";
import { parseInput } from "../../../shared/validation/parse-input";
import type { ActivityService } from "../application/activity-service";
import {
  activitySearchSchema,
  createActivitySchema,
  updateActivitySchema,
} from "./activity-schema";

type Operations = Pick<
  ActivityService,
  "list" | "get" | "create" | "update" | "delete"
>;
type Auth = Pick<AuthService, "getCurrentUser">;
type Context = { params: Promise<{ id: string }> };
const idSchema = z.string().trim().min(1, "活動IDを指定してください");

const sessionToken = (request: NextRequest) =>
  request.cookies.get(sessionCookieName)?.value;
const errorResponse = (error: unknown) => {
  const { status, body } = toHttpErrorResponse(error);
  return NextResponse.json(body, { status });
};
async function requestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError({ body: ["有効なJSONを指定してください"] });
  }
}

export function createActivityCollectionHandlers(
  activities: Operations,
  auth: Auth,
) {
  return {
    GET: async (request: NextRequest) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const search = parseInput(
          activitySearchSchema,
          Object.fromEntries(request.nextUrl.searchParams),
        );
        return NextResponse.json({
          data: await activities.list(actor, search),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
    POST: async (request: NextRequest) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const input = parseInput(
          createActivitySchema,
          await requestBody(request),
        );
        const activity = await activities.create(actor, input);
        return NextResponse.json({ data: { activity } }, { status: 201 });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

export function createActivityItemHandlers(activities: Operations, auth: Auth) {
  const activityId = async (context: Context) =>
    parseInput(idSchema, (await context.params).id);
  return {
    GET: async (request: NextRequest, context: Context) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const activity = await activities.get(actor, await activityId(context));
        return NextResponse.json({ data: { activity } });
      } catch (error) {
        return errorResponse(error);
      }
    },
    PATCH: async (request: NextRequest, context: Context) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        const input = parseInput(
          updateActivitySchema,
          await requestBody(request),
        );
        const activity = await activities.update(
          actor,
          await activityId(context),
          input,
        );
        return NextResponse.json({ data: { activity } });
      } catch (error) {
        return errorResponse(error);
      }
    },
    DELETE: async (request: NextRequest, context: Context) => {
      try {
        const actor = await auth.getCurrentUser(sessionToken(request));
        await activities.delete(actor, await activityId(context));
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
