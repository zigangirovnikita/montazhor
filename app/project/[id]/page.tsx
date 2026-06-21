import { ProjectCockpit } from "@/app/components/ProjectCockpit";

export default async function ProjectPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const { step } = await searchParams;
  return <ProjectCockpit projectId={id} initialView={step === "style" || step === "templates" ? "style" : "main"} />;
}
