import {
    Boxes,
    Building2,
    CalendarRange,
    ClipboardList,
    Factory,
    FlaskConical,
    IdCard,
    LayoutPanelLeft,
    ListTodo,
    Map,
    MapPin,
    Package,
    Route,
    Smartphone,
    TestTube,
    Tractor,
    Truck,
    Users,
    Workflow,
} from "lucide-react"

export type UserRole = "Verifier" | "Admin" | "HQ Verifier" | "HQ Admin";

export interface NavItem {
    title: string
    url: string
    icon?: any
    isActive?: boolean
    badge?: string
    items?: {
        title: string
        url: string
    }[]
    roles?: UserRole[] // Roles that can see this item. If undefined, visible to all.
}

export interface NavSection {
    /** Heading shown above the section's items. */
    label?: string
    items: NavItem[]
}

const HQ: UserRole[] = ["HQ Admin"]

export const data = {
    user: {
        name: "Username",
        email: "Username@example.com",
        avatar: "/avatars/shadcn.jpg",
    },
    roles: [
        { value: "Verifier", label: "Verifier" },
        { value: "Admin", label: "Admin" },
        { value: "HQ Verifier", label: "HQ Verifier" },
        { value: "HQ Admin", label: "HQ Admin" },
    ],
    franchises: [
        { name: "Franchise A", logo: Factory, plan: "Enterprise" },
        { name: "Franchise B", logo: Factory, plan: "Startup" },
        { name: "Franchise C", logo: Factory, plan: "Free" },
    ],
    bases: [
        { name: "Base A", logo: Map, plan: "Standard" },
        { name: "Base B", logo: Map, plan: "Standard" },
        { name: "Base C", logo: Map, plan: "Standard" },
    ],
    villages: [
        { name: "All Villages" },
        { name: "Rampur" },
        { name: "Sonpur" },
        { name: "Lakhanpur" },
        { name: "Madhopur" },
        { name: "Kishanpur" },
    ],
    /** Sidebar sections in order; a section without a label has no heading. */
    sections: [
        {
            items: [
                { title: "Dashboard", url: "#dashboard", icon: LayoutPanelLeft, roles: HQ },
            ],
        },
        {
            label: "Verification",
            items: [
                { title: "Farmers", url: "/layouts/farmers", icon: Tractor, roles: HQ },
                { title: "Tasks", url: "/layouts/tasks", icon: ListTodo, roles: HQ },
                { title: "Plans", url: "/layouts/plans", icon: Route, roles: HQ },
            ],
        },
        {
            // Placeholders until these pages are built.
            label: "Science",
            items: [
                { title: "Samples", url: "#samples", icon: TestTube, roles: HQ },
                { title: "Carts", url: "#carts", icon: Boxes, roles: HQ },
                { title: "Tests", url: "#tests", icon: FlaskConical, roles: HQ },
                { title: "Shipments", url: "#shipments", icon: Package, roles: HQ },
            ],
        },
        {
            label: "Admin",
            items: [
                { title: "Season Management", url: "/layouts/season-management", icon: CalendarRange, roles: HQ },
                { title: "Masters - Village", url: "/layouts/masters/villages", icon: MapPin, roles: HQ },
                { title: "Masters - Users", url: "/layouts/masters/users", icon: Users, roles: HQ },
                { title: "Masters - Fleet", url: "/layouts/masters/fleet", icon: Truck, roles: HQ },
                { title: "Masters - Drivers", url: "/layouts/masters/drivers", icon: IdCard, roles: HQ },
                { title: "Masters - Suppliers", url: "/layouts/masters/suppliers", icon: Building2, roles: HQ },
            ],
        },
        {
            label: "Super Admin",
            items: [
                { title: "Survey Builder", url: "/layouts/survey-builder/v1-0", icon: ClipboardList, roles: HQ },
                { title: "Survey Workflow", url: "/layouts/survey-workflow", icon: Workflow, roles: HQ },
                { title: "Phone simulator", url: "/phone", icon: Smartphone, roles: HQ },
            ],
        },
    ] as NavSection[],
    others: [] as NavItem[]
}

