import AdminLogin from "@/components/admin-login";
import { isAdminAuthenticated } from "@/lib/admin-session";
import { redirect } from "next/navigation";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");
  return <AdminLogin />;
}