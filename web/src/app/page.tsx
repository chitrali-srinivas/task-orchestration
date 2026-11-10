import { redirect } from "next/navigation";

// The app's pages are Season management and the HQ Admin pages (sidebar); start at Season management.
export default function Home() {
    redirect("/layouts/season-management");
}
