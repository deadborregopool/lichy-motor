import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan las variables de entorno de Supabase en .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Usuario {
  id: number;
  nombre: string;
  rol: 'admin' | 'vendedor';
  pin: string;
  activo: boolean;
  created_at: string;
}

export interface Producto {
  id: number;
  codigo: string | null;
  nombre: string;
  categoria: string | null;
  unidad_medida: string; // 'balde', 'botella', 'galon', 'unidad', etc.
  stock_actual: number; // Cantidad de envases cerrados o piezas
  capacidad_envase?: number | null; // Litros por envase cerrado
  volumen_en_uso?: number | null; // Litros en el envase abierto / en uso
  costo_unitario: number;
  precio_venta: number;
  imagen_url: string | null;
  proveedor_id?: number | null;
  created_at: string;
}

export interface Proveedor {
  id: number;
  nombre: string;
  empresa?: string | null;
  ruc?: string | null;
  telefono?: string | null;
  contacto?: string | null;
  direccion?: string | null;
  created_at?: string;
}

export interface Compra {
  id: number;
  proveedor_id: number | null;
  proveedor?: Proveedor | null;
  total: number;
  tipo_comprobante?: 'factura' | 'boleta' | 'guia' | 'nota' | string;
  numero_comprobante?: string | null;
  notas?: string | null;
  fecha_compra: string;
}

export interface DetalleCompra {
  id?: number;
  compra_id: number;
  producto_id: number;
  producto?: Producto | null;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
}

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  es_frecuente: boolean;
  limite_credito?: number;
  saldo_deudor?: number;
  placa_vehiculo?: string | null;
  marca_modelo?: string | null;
  direccion?: string | null;
  created_at: string;
  compras_pendientes_count?: number;
}

export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'tarjeta' | 'transferencia' | 'credito' | 'mixto';
export type TipoComprobanteVenta = 'ticket' | 'boleta' | 'factura';

export interface Venta {
  id: number;
  cliente_id: number | null; // null si es venta al paso / público general
  cliente?: Cliente | null;
  usuario_id: number | null;
  vendedor_nombre: string | null;
  total: number;
  estado: 'pagado' | 'fiado' | 'pendiente_pago' | 'cancelado' | 'anulado';
  metodo_pago?: MetodoPago;
  tipo_comprobante?: TipoComprobanteVenta;
  numero_comprobante?: string | null;
  monto_recibido?: number | null;
  vuelto?: number | null;
  monto_credito?: number | null;
  notas?: string | null;
  fecha_venta: string;
}

export interface AbonoCliente {
  id: number;
  cliente_id: number;
  cliente?: Cliente | null;
  venta_id?: number | null;
  monto_abonado: number;
  metodo_pago: string;
  fecha_abono: string;
  usuario_nombre?: string | null;
  notas?: string | null;
  created_at?: string;
  ventas?: {
    id: number;
    numero_comprobante?: string | null;
    tipo_comprobante?: string | null;
    total?: number;
  } | null;
}

export interface DetalleVenta {
  id?: number;
  venta_id: number;
  producto_id: number;
  producto?: Producto | null;
  cantidad: number; // Cantidad de unidades o litros fraccionados
  costo_unitario: number; // Costo congelado del momento
  precio_unitario: number; // Precio negociado en mostrador
  subtotal: number;
  es_granel?: boolean;
  unidad_medida_venta?: string;
}

export type TipoOperacionKardex = 'COMPRA' | 'VENTA' | 'DESTAPE' | 'AJUSTE' | 'DEVOLUCION';
export type TipoStockKardex = 'CERRADO' | 'GRANEL';

export interface MovimientoKardex {
  id: number;
  producto_id: number;
  producto?: Producto | null;
  fecha: string;
  tipo_operacion: TipoOperacionKardex;
  tipo_stock: TipoStockKardex;
  comprobante_tipo?: string | null;
  comprobante_numero?: string | null;
  cantidad_entrada: number;
  cantidad_salida: number;
  saldo_resultante: number;
  costo_unitario?: number | null;
  precio_venta?: number | null;
  usuario_nombre?: string | null;
  motivo?: string | null;
  created_at?: string;
}

