export const CATEGORIAS_MOTO = [
  'Todos',
  'Aceites & Lubricantes',
  'Transmisión & Arrastre',
  'Frenos',
  'Motor & Combustión',
  'Eléctrico & Luces',
  'Chasis, Llantas & Suspensión',
  'Cables & Guayas',
  'Accesorios & Varios'
] as const;

export type CategoriaMoto = typeof CATEGORIAS_MOTO[number];

export const UNIDADES_MEDIDA = [
  { id: 'unidad', label: 'Unidad (Pieza general)' },
  { id: 'botella', label: 'Botella cerrada (1L / Cuarto)' },
  { id: 'balde', label: 'Balde / Bidón (20L / 5 Galones)' },
  { id: 'galon', label: 'Galón cerrado (3.785L)' },
  { id: 'tambor', label: 'Cilindro / Tambor (55 Galones / 208L)' },
  { id: 'litro', label: 'Litro a granel' },
  { id: 'par', label: 'Par (Juego de 2)' },
  { id: 'metro', label: 'Metro (Mangueras/Cables)' },
] as const;
