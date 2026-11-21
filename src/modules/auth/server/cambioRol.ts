import { adminAuth } from "@/shared/firebase/admin";
import type { Rol } from "../domain/roles";
import { cambiarRol } from "./usuarios.repo";

/**
 * Gives an approved account a new role. Claims and revocation go first: if they fail, the doc keeps the old role,
 * so a retry is not a "no change" no-op that would leave the old session alive. Revoking refresh tokens makes the
 * session cookie fail verification (checkRevoked), so the person is signed out and gets the new claims on login.
 */
export async function aplicarRol(uid: string, rol: Rol, actorUid: string) {
  const auth = adminAuth();
  await auth.setCustomUserClaims(uid, { rol, aprobado: true });
  await auth.revokeRefreshTokens(uid);
  await cambiarRol(uid, rol, actorUid);
}
