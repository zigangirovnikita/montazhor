import { ProjectCockpit } from "@/app/components/ProjectCockpit";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectCockpit projectId={id} />;
}
