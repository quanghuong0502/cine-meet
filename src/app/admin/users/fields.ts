import { getTranslations } from "next-intl/server";
import type { ResourceField } from "@/components/admin/resource-types";

/** Form fields of the user screens, already translated. `create` adds the sign-in details; `edit` has name and role only. */
export async function userFields(mode: "create" | "edit"): Promise<ResourceField[]> {
  const t = await getTranslations("admin.users");
  const name: ResourceField = { name: "name", kind: "text", label: t("fields.name.label"), required: true, maxLength: 80 };
  const role: ResourceField = {
    name: "role",
    kind: "select",
    label: t("fields.role.label"),
    hint: t("fields.role.hint"),
    required: true,
    placeholder: t("fields.role.placeholder"),
    options: [
      { value: "user", label: t("roles.user") },
      { value: "admin", label: t("roles.admin") },
    ],
  };
  if (mode === "edit") return [name, role];
  return [
    name,
    { name: "username", kind: "text", plain: true, label: t("fields.username.label"), hint: t("fields.username.hint"), maxLength: 30 },
    { name: "email", kind: "email", label: t("fields.email.label"), hint: t("fields.email.hint"), maxLength: 120 },
    role,
    {
      name: "temporaryPassword",
      kind: "text",
      plain: true,
      label: t("fields.temporaryPassword.label"),
      hint: t("fields.temporaryPassword.hint"),
      required: true,
      maxLength: 100,
    },
  ];
}

export async function resetPasswordFields(): Promise<ResourceField[]> {
  const t = await getTranslations("admin.users");
  return [
    {
      name: "temporaryPassword",
      kind: "text",
      plain: true,
      label: t("fields.temporaryPassword.label"),
      hint: t("fields.temporaryPassword.resetHint"),
      required: true,
      maxLength: 100,
    },
  ];
}
