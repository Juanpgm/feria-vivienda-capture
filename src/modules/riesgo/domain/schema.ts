import { z } from "zod";
import { DICTAMENES } from "@/shared/constantes";
import { enumDe, textoOpcional } from "@/shared/validacion";

/** Risk (RUD + technical opinion). With RUD "si", either a number or the explicit "No lo sabe". */
export const riesgoSchema = z
  .object({
    esta_en_rud: z.boolean({ error: "Seleccione Sí o No" }),
    numero_rud: textoOpcional,
    rud_no_sabe: z.boolean().nullish(),
    dictamen: enumDe(DICTAMENES),
    dictamen_otro: textoOpcional,
  })
  .superRefine((v, ctx) => {
    if (v.esta_en_rud && !v.numero_rud && !v.rud_no_sabe)
      ctx.addIssue({ code: "custom", path: ["numero_rud"], message: "Ingrese el número de RUD o marque «No lo sabe»" });
    if (v.dictamen === "otro" && !v.dictamen_otro)
      ctx.addIssue({ code: "custom", path: ["dictamen_otro"], message: "Indique cuál es el dictamen" });
  })
  .transform((v) => {
    const noSabe = v.esta_en_rud && !!v.rud_no_sabe && !v.numero_rud;
    return {
      esta_en_rud: v.esta_en_rud,
      numero_rud: v.esta_en_rud && !noSabe ? v.numero_rud : null,
      rud_no_sabe: noSabe,
      dictamen: v.dictamen,
      dictamen_otro: v.dictamen === "otro" ? v.dictamen_otro : null,
    };
  });

export type Riesgo = z.output<typeof riesgoSchema>;
