import { AuthForm } from "@/components/auth/auth-form";
import { AuthPage } from "@/components/auth/auth-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ResendVerificationPage() {
  return (
    <AuthPage>
      <AuthForm mode="resend" />
    </AuthPage>
  );
}
