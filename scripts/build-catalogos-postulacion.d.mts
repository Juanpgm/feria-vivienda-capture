export function construirMunicipios(filas: { cod_mpio: string; nom_mpio: string; dpto: string }[]): { codigo: string; nombre: string; departamento: string }[];
export function construirEstratos(csv: string): Record<string, number>;
export function construirEntidades(vigiladas: { tipo_entidad: string; razon_social: string; numeroidentificacion: string }[], cajas: { ccf: string }[]): { nombre: string; tipo: string; keywords?: string }[];
export function limpiarRazonSocial(s: string): string;
