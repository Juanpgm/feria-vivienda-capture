"use client";

import { useRouter } from "next/navigation";
import { post } from "@/modules/auth/ui/post";
import { Button } from "@/shared/ui/Button";

export function BotonSalirCiudadano() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await post("/api/ciudadano/salir");
        router.replace("/ciudadano");
      }}
    >
      Cerrar sesión
    </Button>
  );
}
