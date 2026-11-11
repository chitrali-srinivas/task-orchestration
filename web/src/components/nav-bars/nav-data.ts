import {
    CalendarRange,
    ClipboardList,
    Database,
    Factory,
    LayoutPanelLeft,
    ListTodo,
    Map,
    Route,
    Smartphone,
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
    navMain: [] as NavItem[],
    admin: [] as NavItem[],
    hqVerifier: [] as NavItem[],
    hqAdmin: [
        {
            title: "Dashboard",
            url: "#hq-a-dashboard",
            icon: LayoutPanelLeft,
            roles: ["HQ Admin"] as UserRole[],
        },
        {
            title: "Survey Builder",
            url: "/layouts/survey-builder/v1-0",
            icon: ClipboardList,
            roles: ["HQ Admin"] as UserRole[],
        },
        {
            title: "Survey Workflow",
            url: "/layouts/survey-workflow",
            icon: Workflow,
            roles: ["HQ Admin"] as UserRole[],
        },
        {
            title: "Season management",
            url: "/layouts/season-management",
            icon: CalendarRange,
            roles: ["HQ Admin"] as UserRole[],
        },
        {
            title: "Tasks",
            url: "/layouts/tasks",
            icon: ListTodo,
            roles: ["HQ Admin"] as UserRole[],
        },
        {
            title: "Task planning",
            url: "/layouts/task-planning",
            icon: Route,
            roles: ["HQ Admin"] as UserRole[],
        },
        {
            title: "Phone simulator",
            url: "/phone",
            icon: Smartphone,
            roles: ["HQ Admin"] as UserRole[],
        },
        {
            title: "Masters",
            url: "/layouts/masters",
            icon: Database,
            roles: ["HQ Admin"] as UserRole[],
        },
        {
            title: "Farmers",
            url: "#hq-a-farmers",
            icon: Users,
            roles: ["HQ Admin"] as UserRole[],
        }
    ],
    others: [] as NavItem[]
}

