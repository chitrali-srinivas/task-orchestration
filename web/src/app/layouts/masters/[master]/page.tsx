import { notFound } from "next/navigation";
import { MASTER_DEFINITIONS } from "../../survey-builder/lib/master-data-registry";
import { MasterPage } from "../components/master-page";

// One page per master: /layouts/masters/villages, /users, /fleet, /drivers, /suppliers (the sidebar's Masters items).
export function generateStaticParams() {
    return MASTER_DEFINITIONS.map((d) => ({ master: d.id }));
}

export default async function Page({ params }: { params: Promise<{ master: string }> }) {
    const { master } = await params;
    if (!MASTER_DEFINITIONS.some((d) => d.id === master)) notFound();
    return <MasterPage setId={master} />;
}
