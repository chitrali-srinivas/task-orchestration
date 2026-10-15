import { NavBarType1 } from "@/components/nav-bars/NavBarType1";

export default function NavBarType1Page() {
    return (
        <NavBarType1>
            <div className="grid auto-rows-min gap-4 md:grid-cols-3 pt-4">
                <div className="aspect-video rounded-xl bg-muted/50" />
                <div className="aspect-video rounded-xl bg-muted/50" />
                <div className="aspect-video rounded-xl bg-muted/50" />
            </div>
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
        </NavBarType1>
    )
}
