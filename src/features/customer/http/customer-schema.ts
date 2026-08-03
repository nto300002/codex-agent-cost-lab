import { z } from "zod";

import { customerStatuses } from "../domain/customer";

const customerName = z
  .string()
  .trim()
  .min(1, "顧客名を入力してください")
  .max(200, "顧客名は200文字以内で入力してください");

function nullableString(maxLength: number, message: string) {
  return z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .pipe(z.string().max(maxLength, message).nullable());
}

const nullableEmail = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed.toLowerCase();
  })
  .pipe(
    z
      .email("メールアドレスの形式を確認してください")
      .max(254, "メールアドレスは254文字以内で入力してください")
      .nullable(),
  );

const ownerId = z.string().trim().min(1, "担当者を指定してください");

export const createCustomerSchema = z
  .object({
    name: customerName,
    email: nullableEmail.optional().default(null),
    phone: nullableString(50, "電話番号は50文字以内で入力してください")
      .optional()
      .default(null),
    status: z.enum(customerStatuses),
    ownerId,
    notes: nullableString(2000, "メモは2000文字以内で入力してください")
      .optional()
      .default(null),
  })
  .strict();

export const updateCustomerSchema = z
  .object({
    name: customerName.optional(),
    email: nullableEmail.optional(),
    phone: nullableString(
      50,
      "電話番号は50文字以内で入力してください",
    ).optional(),
    status: z.enum(customerStatuses).optional(),
    ownerId: ownerId.optional(),
    notes: nullableString(
      2000,
      "メモは2000文字以内で入力してください",
    ).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "更新する項目を指定してください",
  });

const optionalSearchText = z
  .string()
  .trim()
  .max(200, "検索文字列は200文字以内で指定してください")
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const customerSearchSchema = z
  .object({
    name: optionalSearchText,
    email: optionalSearchText,
    phone: optionalSearchText,
    status: z.enum(customerStatuses).optional(),
    ownerId: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? undefined : value))
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
