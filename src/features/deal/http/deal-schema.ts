import { z } from "zod";
import { dealStages } from "../domain/deal";

const title = z.string().trim().min(1, "タイトルを入力してください").max(200);
const id = z.string().trim().min(1, "選択してください");
const amountCents = z.coerce
  .number()
  .int("金額は整数で入力してください")
  .min(0);
const nullableDate = z
  .union([z.string(), z.null()])
  .transform((value, context) => {
    if (value === null || value.trim() === "") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      context.addIssue({
        code: "custom",
        message: "日付の形式を確認してください",
      });
      return z.NEVER;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({
        code: "custom",
        message: "有効な日付を指定してください",
      });
      return z.NEVER;
    }
    return date;
  });

export const createDealSchema = z
  .object({
    customerId: id,
    title,
    amountCents,
    stage: z.enum(dealStages),
    ownerId: id,
    expectedCloseDate: nullableDate.optional().default(null),
  })
  .strict();

export const updateDealSchema = z
  .object({
    customerId: id.optional(),
    title: title.optional(),
    amountCents: amountCents.optional(),
    stage: z.enum(dealStages).optional(),
    ownerId: id.optional(),
    expectedCloseDate: nullableDate.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "更新する項目を指定してください",
  });

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .optional();
export const dealSearchSchema = z
  .object({
    customerId: id.optional(),
    stage: z.enum(dealStages).optional(),
    ownerId: id.optional(),
    expectedFrom: optionalDate,
    expectedTo: optionalDate,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
