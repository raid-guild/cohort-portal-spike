import { ModuleRequestDetail } from "@/modules/module-requests/ModuleRequestDetail";

export default async function ModuleRequestDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <ModuleRequestDetail id={id} />;
}
