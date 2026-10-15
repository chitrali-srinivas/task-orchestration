import { NavBarType2 } from "@/components/nav-bars/NavBarType2";

export default function NavBarType2Page() {
    return (
        <NavBarType2>
            <div className="flex flex-col gap-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                        <h3 className="font-semibold leading-none tracking-tight">Revenue</h3>
                        <div className="text-2xl font-bold mt-2">$45,231.89</div>
                    </div>
                </div>
            </div>
        </NavBarType2>
    )
}
