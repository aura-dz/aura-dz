import AdminDashboard from "@/components/admin-dashboard";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  if (!await isAdminAuthenticated()) redirect("/admin/login");
  return <AdminDashboard />;
}