/**
 * Reglas de negocio de conversión de aceites para motos (VistaTienda)
 * El inventario base se almacena estrictamente en litros.
 */

export const LITROS_POR_GALON = 3.785;
export const LITROS_POR_CUARTO = 0.946;

export type UnidadAceite = 'litro' | 'galon' | 'cuarto';

export function convertirALitros(cantidad: number, unidad: UnidadAceite): number {
  switch (unidad) {
    case 'galon':
      return Number((cantidad * LITROS_POR_GALON).toFixed(3));
    case 'cuarto':
      return Number((cantidad * LITROS_POR_CUARTO).toFixed(3));
    case 'litro':
    default:
      return Number(cantidad.toFixed(3));
  }
}

export function formatearLitros(litros: number): string {
  return `${Number(litros).toFixed(3)} L`;
}
