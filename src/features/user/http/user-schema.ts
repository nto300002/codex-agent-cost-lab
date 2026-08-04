import { z } from "zod";
import { userRoles } from "../domain/managed-user";

const name = z
  .string()
  .trim()
  .min(1, "名前を入力してください")
  .max(100, "名前は100文字以内で入力してください");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email("メールアドレスの形式を確認してください")
      .max(254, "メールアドレスは254文字以内で入力してください"),
  );

const password = z
  .string()
  .min(12, "パスワードは12文字以上で入力してください")
  .max(128, "パスワードは128文字以内で入力してください");

export const createUserSchema = z
  .object({
    name,
    email,
    password,
    role: z.enum(userRoles),
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    role: z.enum(userRoles).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "更新する項目を指定してください",
  });
