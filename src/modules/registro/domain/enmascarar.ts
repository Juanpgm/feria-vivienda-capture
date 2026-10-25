/**
 * Partially hides a document number for the confirmation screen (screenshots travel): keeps only the last 4
 * characters, or just the last one when the number is shorter than 6, so it can still be told apart.
 */
export function enmascararDocumento(numero: string): string {
  const n = numero.trim();
  if (!n) return "";
  const visibles = n.length >= 6 ? 4 : 1;
  return "*".repeat(Math.max(0, n.length - visibles)) + n.slice(-visibles);
}
