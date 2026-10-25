import { describe, expect, it } from "vitest";
import { parseServiceAccount } from "./config";

const CLAVE = "-----BEGIN PRIVATE KEY-----\nAAAA\nBBBB\n-----END PRIVATE KEY-----\n";
const cuenta = { type: "service_account", project_id: "demo", client_email: "sa@demo.iam.gserviceaccount.com", private_key: CLAVE };
const esperado = { project_id: "demo", client_email: cuenta.client_email, private_key: CLAVE };

describe("parseServiceAccount", () => {
  it("lee el JSON en una sola línea", () => {
    expect(parseServiceAccount(JSON.stringify(cuenta))).toEqual(esperado);
  });

  it("lee el JSON con formato (varias líneas)", () => {
    expect(parseServiceAccount(JSON.stringify(cuenta, null, 2))).toEqual(esperado);
  });

  it("lee el JSON con saltos de línea reales dentro de la clave privada", () => {
    const conSaltos = `{"project_id":"demo","client_email":"${cuenta.client_email}","private_key":"${CLAVE}"}`;
    expect(parseServiceAccount(conSaltos)).toEqual(esperado);
  });

  it("lee el JSON envuelto en comillas simples o dobles", () => {
    const json = JSON.stringify(cuenta);
    expect(parseServiceAccount(`'${json}'`)).toEqual(esperado);
    expect(parseServiceAccount(`"${json}"`)).toEqual(esperado);
  });

  it("lee el JSON codificado como cadena JSON (comillas escapadas)", () => {
    expect(parseServiceAccount(JSON.stringify(JSON.stringify(cuenta)))).toEqual(esperado);
  });

  it("lee base64, con o sin comillas", () => {
    const b64 = Buffer.from(JSON.stringify(cuenta)).toString("base64");
    expect(parseServiceAccount(b64)).toEqual(esperado);
    expect(parseServiceAccount(`"${b64}"`)).toEqual(esperado);
  });

  it("restaura los saltos de línea cuando la clave llega con \\n literales", () => {
    const doble = { ...cuenta, private_key: CLAVE.replace(/\n/g, "\\n") };
    expect(parseServiceAccount(JSON.stringify(doble)).private_key).toBe(CLAVE);
  });

  it("falla con un mensaje estructural que no filtra el contenido", () => {
    const secreto = "SECRETO-NO-DEBE-APARECER";
    let mensaje = "";
    try {
      parseServiceAccount(`{ esto no es json ${secreto}`);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toContain("no es un JSON de cuenta de servicio válido");
    expect(mensaje).not.toContain(secreto);
  });
});
