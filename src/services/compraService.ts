import { supabase, Compra, DetalleCompra, Producto } from '@/lib/supabase';
import { registrarMovimientoKardex } from './kardexService';

export interface ItemEntradaCompra {
  producto_id: number;
  producto_nombre: string;
  unidad_medida: string;
  stock_actual: number;
  costo_actual: number;
  precio_venta_actual?: number;
  nuevo_precio_venta?: number;
  modo_empaque?: 'unidades' | 'cajas';
  cajas?: number;
  unidades_por_caja?: number;
  costo_por_caja?: number;
  cantidad: number; // Unidades totales que ingresan al stock
  costo_unitario: number; // Costo unitario real de esta compra (reposición)
  subtotal: number;
  nuevo_costo_promedio?: number;
}

export interface DatosRegistrarCompra {
  proveedor_id: number;
  proveedor_nombre?: string;
  tipo_comprobante: 'factura' | 'boleta' | 'guia' | 'nota' | string;
  numero_comprobante?: string;
  notas?: string;
  items: ItemEntradaCompra[];
}

/**
 * Calcula el Costo Promedio Ponderado (CPP) para una entrada de mercadería.
 * 
 * Si el stock actual es 0 o negativo:
 *   nuevo_costo = costo_compra_nuevo
 * 
 * Si el stock actual es positivo:
 *   valor_actual = stock_actual * costo_actual
 *   valor_entrante = cantidad_comprada * costo_compra_nuevo
 *   nuevo_costo = (valor_actual + valor_entrante) / (stock_actual + cantidad_comprada)
 */
export function calcularCostoPromedio(
  stockActual: number,
  costoActual: number,
  cantidadComprada: number,
  costoCompraNuevo: number
): { nuevoStock: number; nuevoCostoUnitario: number } {
  const stockPrevio = Math.max(0, Number(stockActual) || 0);
  const costoPrevio = Math.max(0, Number(costoActual) || 0);
  const cant = Math.max(0, Number(cantidadComprada) || 0);
  const costoNuevo = Math.max(0, Number(costoCompraNuevo) || 0);

  const nuevoStock = stockPrevio + cant;

  if (nuevoStock <= 0) {
    return { nuevoStock: 0, nuevoCostoUnitario: costoNuevo };
  }

  if (stockPrevio <= 0) {
    return { nuevoStock, nuevoCostoUnitario: Number(costoNuevo.toFixed(2)) };
  }

  const valorTotal = (stockPrevio * costoPrevio) + (cant * costoNuevo);
  const nuevoCosto = valorTotal / nuevoStock;

  return {
    nuevoStock,
    nuevoCostoUnitario: Number(nuevoCosto.toFixed(2)),
  };
}

/**
 * Registra una entrada de mercadería (compra) con actualización de CPP e inventario.
 */
export async function registrarCompra(datos: DatosRegistrarCompra): Promise<Compra> {
  if (!datos.items || datos.items.length === 0) {
    throw new Error('Debe agregar al menos un repuesto o lubricante a la entrada.');
  }

  const totalCompra = datos.items.reduce((acc, curr) => acc + (Number(curr.subtotal) || 0), 0);

  // 1. Crear cabecera de Compra
  const { data: compra, error: errorCompra } = await supabase
    .from('compras')
    .insert([
      {
        proveedor_id: datos.proveedor_id,
        total: totalCompra,
        tipo_comprobante: datos.tipo_comprobante,
        numero_comprobante: datos.numero_comprobante?.trim() || null,
        notas: datos.notas?.trim() || null,
        fecha_compra: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (errorCompra || !compra) {
    console.error('Error al registrar cabecera de compra:', errorCompra);
    throw new Error(errorCompra?.message || 'Error al registrar la compra.');
  }

  // 2. Insertar detalles de compra
  const detallesPayload = datos.items.map((it) => ({
    compra_id: compra.id,
    producto_id: it.producto_id,
    cantidad: it.cantidad,
    costo_unitario: it.costo_unitario,
    subtotal: it.subtotal,
  }));

  const { error: errorDetalles } = await supabase
    .from('detalle_compras')
    .insert(detallesPayload);

  if (errorDetalles) {
    console.error('Error al registrar detalles de compra:', errorDetalles);
    throw new Error('Error al registrar los ítems de la compra.');
  }

  // 3. Actualizar productos: aplicar Costo Promedio Ponderado e incrementar Stock
  for (const it of datos.items) {
    // Obtener estado fresco del producto
    const { data: prodData } = await supabase
      .from('productos')
      .select('stock_actual, costo_unitario, proveedor_id')
      .eq('id', it.producto_id)
      .single();

    const stockActual = Number(prodData?.stock_actual) || 0;
    const costoActual = Number(prodData?.costo_unitario) || 0;
    const nuevoStock = stockActual + it.cantidad;

    // Estrategia Combinada Anti-Inflación (Costo de Reposición):
    // 1. Si el producto tenía costo 0 o el nuevo costo subió: adopta el último costo (reposición).
    // 2. Si el costo bajó (compra promocional): promedia con el stock previo para no devaluar inventario anterior.
    let costoFinal = it.costo_unitario;
    if (costoActual > 0 && it.costo_unitario < costoActual) {
      const { nuevoCostoUnitario } = calcularCostoPromedio(
        stockActual,
        costoActual,
        it.cantidad,
        it.costo_unitario
      );
      costoFinal = nuevoCostoUnitario;
    }

    const updatePayload: any = {
      stock_actual: nuevoStock,
      costo_unitario: Number(costoFinal.toFixed(2)),
    };

    // Actualizar Precio de Venta Mostrador si el asistente lo modificó
    if (it.nuevo_precio_venta && Number(it.nuevo_precio_venta) > 0) {
      updatePayload.precio_venta = Number(it.nuevo_precio_venta);
    }

    // Si el producto no tenía distribuidor asignado, asociarle este
    if (!prodData?.proveedor_id && datos.proveedor_id) {
      updatePayload.proveedor_id = datos.proveedor_id;
    }

    const { error: errorProd } = await supabase
      .from('productos')
      .update(updatePayload)
      .eq('id', it.producto_id);

    if (errorProd) {
      console.error(`Error al actualizar stock/costo para producto ${it.producto_id}:`, errorProd);
    }

    // 4. Registrar movimiento en Kardex
    let nombreProv = datos.proveedor_nombre?.trim();
    if (!nombreProv && datos.proveedor_id) {
      const { data: provData } = await supabase
        .from('proveedores')
        .select('nombre, empresa')
        .eq('id', datos.proveedor_id)
        .single();
      nombreProv = provData?.empresa || provData?.nombre;
    }

    const etiquetaProveedor =
      nombreProv && !nombreProv.toLowerCase().includes('casual')
        ? `Proveedor: ${nombreProv}`
        : 'Compra por 3eros';

    await registrarMovimientoKardex({
      producto_id: it.producto_id,
      tipo_operacion: 'COMPRA',
      tipo_stock: 'CERRADO',
      comprobante_tipo: datos.tipo_comprobante?.toUpperCase() || 'FACTURA',
      comprobante_numero: datos.numero_comprobante || `COM-${compra.id}`,
      cantidad_entrada: it.cantidad,
      cantidad_salida: 0,
      saldo_resultante: nuevoStock,
      costo_unitario: Number(costoFinal.toFixed(2)),
      usuario_nombre: 'Administrador',
      motivo: `${etiquetaProveedor} (Doc: ${datos.numero_comprobante || 'S/N'})`,
    });
  }

  return compra as Compra;
}

export interface CompraConDetalles extends Compra {
  proveedores?: {
    id: number;
    nombre: string;
    empresa?: string | null;
    ruc?: string | null;
    telefono?: string | null;
  } | null;
  detalle_compras?: Array<{
    id: number;
    producto_id: number;
    cantidad: number;
    costo_unitario: number;
    subtotal: number;
    productos?: {
      id: number;
      nombre: string;
      codigo?: string | null;
      unidad_medida: string;
    } | null;
  }>;
}

/**
 * Obtiene el historial de entradas / compras con sus proveedores e ítems.
 */
export async function obtenerHistorialCompras(limite: number = 30): Promise<CompraConDetalles[]> {
  const { data, error } = await supabase
    .from('compras')
    .select(`
      id,
      proveedor_id,
      total,
      tipo_comprobante,
      numero_comprobante,
      notas,
      fecha_compra,
      proveedores (
        id,
        nombre,
        empresa,
        ruc,
        telefono
      ),
      detalle_compras (
        id,
        producto_id,
        cantidad,
        costo_unitario,
        subtotal,
        productos (
          id,
          nombre,
          codigo,
          unidad_medida
        )
      )
    `)
    .order('fecha_compra', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('Error al obtener historial de compras:', error);
    throw error;
  }

  return (data || []) as unknown as CompraConDetalles[];
}
