import { AuthPage } from "@/components/auth/auth-page";
import { LogoutForm } from "@/components/auth/logout-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LogoutPage() {
  return (
    <AuthPage>
      <LogoutForm />
    </AuthPage>
  );
}
