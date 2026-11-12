import type { ReactNode } from "react";
import { AppShell } from "@/shared/ui/AppShell";

export const dynamic = "force-dynamic"; // the citizen link can be switched off at any time

export default function CiudadanoLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
