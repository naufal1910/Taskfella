import { AuthForm } from "@/components/auth/auth-form";
import { AuthPage } from "@/components/auth/auth-page";

type VerifyPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VerifyEmailPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;
  return (
    <AuthPage>
      <div className="auth-stack">
        <AuthForm mode="verify" token={token} />
        <AuthForm mode="resend" />
      </div>
    </AuthPage>
  );
}
