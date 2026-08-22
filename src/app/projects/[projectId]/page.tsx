import { BoardScreen } from "@/components/projects/board-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <BoardScreen projectId={projectId} />;
}
