import { AuthForm } from "@/components/auth/auth-form";
import { AuthPage } from "@/components/auth/auth-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VerifyEmailPage() {
  return (
    <AuthPage>
      <div className="auth-stack">
        <AuthForm mode="verify" />
        <AuthForm mode="resend" />
      </div>
    </AuthPage>
  );
}
