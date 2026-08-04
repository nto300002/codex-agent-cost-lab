import { z } from "zod";
import { activityTypes } from "../domain/activity";

const id = z.string().trim().min(1, "選択してください");
const summary = z
  .string()
  .trim()
  .min(1, "活動内容を入力してください")
  .max(1000, "活動内容は1000文字以内で入力してください");
const occurredAt = z
  .string()
  .datetime({ offset: true, message: "活動日時の形式を確認してください" })
  .transform((value) => new Date(value));
const dealId = z.union([z.string(), z.null()]).transform((value) => {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
});

export const createActivitySchema = z
  .object({
    customerId: id,
    dealId: dealId.optional().default(null),
    type: z.enum(activityTypes),
    summary,
    occurredAt,
  })
  .strict();

export const updateActivitySchema = z
  .object({
    type: z.enum(activityTypes).optional(),
    summary: summary.optional(),
    occurredAt: occurredAt.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "更新する項目を指定してください",
  });

export const activitySearchSchema = z
  .object({
    customerId: id.optional(),
    dealId: id.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
