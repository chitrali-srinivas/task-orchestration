
import {
    LayoutDashboard,
    ListTodo,
    BarChart3,
    History,
    Settings,
    LogOut,
    HelpCircle,
    Bug,
    User,
    Tractor,
    Warehouse,
    FlaskConical,
    Activity,
    Factory,
    FileText,
    TrendingUp,
    Map,
    ClipboardCheck,
    ClipboardList,
    Users,
    Leaf,
    Calendar,
    Info,
    Truck,
    TestTube,
    ArrowLeftRight,
    ShieldPlus,
    CalendarCheck,
    LayoutPanelLeft
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
    navMain: [
        {
            title: "Dashboard",
            url: "#dashboard",
            icon: LayoutPanelLeft,
            roles: ["Verifier"] as UserRole[],
        },
        {
            title: "Farm app",
            url: "#farm-app",
            icon: Tractor,
            roles: ["Verifier"] as UserRole[],
            items: [
                { title: "Qualification", url: "#qualification" },
                { title: "Deployment", url: "/layouts/deployment" },
                { title: "Engagement", url: "/layouts/engagement" },
                { title: "Season Management", url: "/layouts/season-management" },
                { title: "Science Analysis", url: "/layouts/science-analysis" },
                { title: "Conversation", url: "#conversation" },
            ],
        },
        {
            title: "Warehouse app",
            url: "#warehouse",
            icon: Truck,
            roles: ["Verifier"] as UserRole[],
            items: [
                { title: "Overview", url: "#warehouse-overview" },
                { title: "Dispatched", url: "#warehouse-dispatched" },
                { title: "Delivered", url: "#warehouse-delivered" },
                { title: "Dispatch QCs", url: "#warehouse-dispatch-qcs" },
                { title: "Source QCs", url: "#warehouse-source-qcs" },
            ],
        },
        {
            title: "LAB app",
            url: "#lab",
            icon: TestTube,
            roles: ["Verifier"] as UserRole[],
            items: [
                { title: "Overview", url: "#lab-overview" },
                { title: "Samples", url: "#lab-samples" },
                { title: "Shipments", url: "#lab-shipments" },
                { title: "Carts", url: "#lab-carts" },
            ],
        },
        {
            title: "Supply & Demand",
            url: "#supply",
            icon: ArrowLeftRight,
            roles: ["Verifier"] as UserRole[],
            items: [
                { title: "Requests", url: "#supply-requests" },
                { title: "History", url: "#supply-history" },
            ],
        },
        {
            title: "HSE",
            url: "#hse",
            icon: ShieldPlus,
            badge: "16",
            roles: ["Verifier"] as UserRole[],
        },
        {
            title: "Quality System",
            url: "#quality",
            icon: ClipboardCheck,
            badge: "23",
            roles: ["Verifier"] as UserRole[],
        }
    ],
    admin: [
        {
            title: "Dashboard",
            url: "#admin-dashboard",
            icon: LayoutPanelLeft,
            roles: ["Admin"] as UserRole[],
            items: [
                { title: "Overview", url: "#admin-overview" },
                { title: "Track Logistics", url: "#admin-logistics" },
                { title: "Day End Report", url: "#admin-report" }
            ]
        },
        {
            title: "Planning",
            url: "#planning",
            icon: CalendarCheck,
            roles: ["Admin"] as UserRole[],
            items: [
                { title: "Season Management", url: "/layouts/season-management" },
                { title: "Create Plan", url: "#planning-create" },
                { title: "Saved Plans", url: "#planning-saved" },
                { title: "Completed plans", url: "#planning-completed" }
            ]
        }
    ],
    hqVerifier: [
        {
            title: "Dashboard",
            url: "#hq-v-dashboard",
            icon: LayoutPanelLeft,
            roles: ["HQ Verifier"] as UserRole[],
        },
        {
            title: "Farm app",
            url: "#hq-v-farm",
            icon: Tractor,
            roles: ["HQ Verifier"] as UserRole[],
            items: [
                { title: "Qualification", url: "#hq-v-qualification" },
                { title: "Deployment", url: "#hq-v-deployment" },
                { title: "Engagement", url: "#hq-v-engagement" },
                { title: "Conversation", url: "#hq-v-conversation" },
            ],
        },
        {
            title: "Warehouse app",
            url: "#hq-v-warehouse",
            icon: Truck,
            roles: ["HQ Verifier"] as UserRole[],
            items: [
                { title: "Overview", url: "#hq-v-w-overview" },
                { title: "Dispatched", url: "#hq-v-w-dispatched" },
                { title: "Delivered", url: "#hq-v-w-delivered" },
                { title: "Dispatch QCs", url: "#hq-v-w-dispatch-qcs" },
                { title: "Source QCs", url: "#hq-v-w-source-qcs" },
            ],
        },
        {
            title: "LAB app",
            url: "#hq-v-lab",
            icon: TestTube,
            roles: ["HQ Verifier"] as UserRole[],
            items: [
                { title: "Overview", url: "#hq-v-l-overview" },
                { title: "Samples", url: "#hq-v-l-samples" },
                { title: "Shipments", url: "#hq-v-l-shipments" },
                { title: "Carts", url: "#hq-v-l-carts" },
            ],
        },
        {
            title: "Supply & Demand",
            url: "#hq-v-supply",
            icon: ArrowLeftRight,
            roles: ["HQ Verifier"] as UserRole[],
            items: [
                { title: "Requests", url: "#hq-v-s-requests" },
                { title: "History", url: "#hq-v-s-history" },
            ],
        },
        {
            title: "HSE",
            url: "#hq-v-hse",
            icon: ShieldPlus,
            badge: "16",
            roles: ["HQ Verifier"] as UserRole[],
        },
        {
            title: "Quality System",
            url: "#hq-v-quality",
            icon: ClipboardCheck,
            badge: "23",
            roles: ["HQ Verifier"] as UserRole[],
        }
    ],
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
            title: "Farmers",
            url: "#hq-a-farmers",
            icon: Users,
            roles: ["HQ Admin"] as UserRole[],
        }
    ],
    others: [
        {
            title: "Manage",
            url: "#manage",
            icon: FileText,
            items: [
                { title: "Survey Builder", url: "/layouts/survey-builder" },
                { title: "Entities", url: "#manage-entities" },
                { title: "Verified", url: "#manage-verified" },
                { title: "Franchises", url: "#manage-franchises" }
            ]
        },
        {
            title: "Help",
            url: "#help",
            icon: HelpCircle,
        },
        {
            title: "About us",
            url: "#about",
            icon: Info,
        },
        {
            title: "Settings",
            url: "#settings",
            icon: Settings,
        }
    ]
}

