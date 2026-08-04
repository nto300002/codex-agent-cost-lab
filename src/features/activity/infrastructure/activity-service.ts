import { prisma } from "../../../infrastructure/database/prisma";
import { ActivityService } from "../application/activity-service";
import { PrismaActivityRepository } from "./prisma-activity-repository";

export const activityService = new ActivityService(
  new PrismaActivityRepository(prisma),
);
