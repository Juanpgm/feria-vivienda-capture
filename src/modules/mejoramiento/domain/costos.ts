/** COSTO DIRECTO of a row = ROUNDUP(CANTIDAD × COSTO UNITARIO, 0), like the budget sheet. toFixed avoids float drift. */
export const costoDirecto = (cantidad: number, costoUnitario: number) => Math.ceil(Number((cantidad * costoUnitario).toFixed(6)));
