"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/Button";
import { post } from "./post";

export function BotonSalir() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      className="text-sm"
      onClick={async () => {
        await post("/api/auth/salir");
        router.replace("/login");
      }}
    >
      Cerrar sesión
    </Button>
  );
}
