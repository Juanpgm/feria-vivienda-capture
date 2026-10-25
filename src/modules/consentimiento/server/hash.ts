import { createHash } from "node:crypto";
import { CONSENTIMIENTO_VERSION, textoPlano } from "../domain/texto";

/** sha256 (hex) of version + text, computed on the server so the stored hash can never come from the client. */
export function hashConsentimiento(): string {
  return createHash("sha256").update(`${CONSENTIMIENTO_VERSION}\n${textoPlano()}`, "utf8").digest("hex");
}
