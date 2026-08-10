import { AccountState } from "@/components/auth/account-state";
import { AuthPage } from "@/components/auth/auth-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AccountPage() {
  return (
    <AuthPage>
      <AccountState />
    </AuthPage>
  );
}
