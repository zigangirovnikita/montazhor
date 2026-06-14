import { TemplateBuilder } from "../../components/template-builder/TemplateBuilder";

export default async function NewTemplatePage({
  searchParams
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  return <TemplateBuilder returnTo={safeReturnTo(params.returnTo)} />;
}

function safeReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}
