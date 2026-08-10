import { AuthForm } from "@/components/auth/auth-form";
import { AuthPage } from "@/components/auth/auth-page";

type ResetPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResetPasswordPage({ searchParams }: ResetPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;
  return (
    <AuthPage>
      <AuthForm mode="reset" token={token} />
    </AuthPage>
  );
}
