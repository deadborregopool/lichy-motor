/**
 * Formateador oficial de moneda para Perú: Soles (S/)
 * VistaTienda - Repuestos y Lubricantes
 */

export function formatearSoles(monto: number): string {
  const num = Number(monto) || 0;
  return `S/ ${num.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
