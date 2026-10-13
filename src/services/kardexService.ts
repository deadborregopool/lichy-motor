import { supabase, MovimientoKardex, TipoOperacionKardex, TipoStockKardex, Producto } from '@/lib/supabase';

export interface FiltrosKardex {
  fechaInicio?: string;
  fechaFin?: string;
  tipoOperacion?: TipoOperacionKardex | 'TODOS';
}

export interface ResumenKardexProducto {
  stockActualCerrado: number;
  volumenEnUsoGranel: number;
  totalEntradasCerradas: number;
  totalComprasCerradas: number;
  totalDevolucionesCerradas: number;
  totalSalidasCerradas: number;
  totalVentasCerradas: number;
  totalDestapesCerrados: number;
  totalLitrosDestapados: number;
  totalEntradasGranel: number;
  totalSalidasGranel: number;
  valorizacionCostoTotal: number;
  costoUnitarioActual: number;
  precioVentaActual: number;
}

/**
 * Registra un movimiento individual en la tabla de Kardex.
 */
export async function registrarMovimientoKardex(datos: {
  producto_id: number;
  fecha?: string;
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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('movimientos_kardex').insert({
      producto_id: datos.producto_id,
      fecha: datos.fecha || new Date().toISOString(),
      tipo_operacion: datos.tipo_operacion,
      tipo_stock: datos.tipo_stock,
      comprobante_tipo: datos.comprobante_tipo || null,
      comprobante_numero: datos.comprobante_numero || null,
      cantidad_entrada: Number(datos.cantidad_entrada) || 0,
      cantidad_salida: Number(datos.cantidad_salida) || 0,
      saldo_resultante: Number(datos.saldo_resultante) || 0,
      costo_unitario: datos.costo_unitario != null ? Number(datos.costo_unitario) : 0,
      precio_venta: datos.precio_venta != null ? Number(datos.precio_venta) : 0,
      usuario_nombre: datos.usuario_nombre || 'Sistema',
      motivo: datos.motivo || null,
    });

    if (error) {
      console.error('Error al insertar movimiento en Kardex:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Excepción al registrar en Kardex:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Obtiene el historial cronológico de movimientos de un producto con filtros opcionales.
 */
export async function obtenerKardexPorProducto(
  productoId: number,
  filtros?: FiltrosKardex
): Promise<MovimientoKardex[]> {
  try {
    let query = supabase
      .from('movimientos_kardex')
      .select(`
        *,
        producto:productos(id, nombre, codigo, categoria, unidad_medida, stock_actual, volumen_en_uso, costo_unitario, precio_venta)
      `)
      .eq('producto_id', productoId)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });

    if (filtros?.fechaInicio) {
      query = query.gte('fecha', `${filtros.fechaInicio}T00:00:00`);
    }
    if (filtros?.fechaFin) {
      query = query.lte('fecha', `${filtros.fechaFin}T23:59:59`);
    }
    if (filtros?.tipoOperacion && filtros.tipoOperacion !== 'TODOS') {
      query = query.eq('tipo_operacion', filtros.tipoOperacion);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener movimientos de Kardex:', error);
      return [];
    }

    return (data as unknown as MovimientoKardex[]) || [];
  } catch (err) {
    console.error('Excepción al consultar Kardex:', err);
    return [];
  }
}

/**
 * Calcula métricas resumen del producto para la cabecera del Kardex.
 */
export async function obtenerResumenKardex(
  producto: Producto,
  movimientos: MovimientoKardex[]
): Promise<ResumenKardexProducto> {
  let totalEntradasCerradas = 0;
  let totalComprasCerradas = 0;
  let totalDevolucionesCerradas = 0;
  let totalSalidasCerradas = 0;
  let totalVentasCerradas = 0;
  let totalDestapesCerrados = 0;
  let totalLitrosDestapados = 0;
  let totalEntradasGranel = 0;
  let totalSalidasGranel = 0;

  movimientos.forEach((m) => {
    const cantEntrada = Number(m.cantidad_entrada) || 0;
    const cantSalida = Number(m.cantidad_salida) || 0;

    if (m.tipo_stock === 'CERRADO') {
      totalEntradasCerradas += cantEntrada;
      totalSalidasCerradas += cantSalida;

      if (m.tipo_operacion === 'COMPRA') {
        totalComprasCerradas += cantEntrada;
      } else if (m.tipo_operacion === 'DEVOLUCION') {
        totalDevolucionesCerradas += cantEntrada;
      }

      if (m.tipo_operacion === 'VENTA') {
        totalVentasCerradas += cantSalida;
      } else if (m.tipo_operacion === 'DESTAPE') {
        totalDestapesCerrados += cantSalida;
      }
    } else {
      totalEntradasGranel += cantEntrada;
      totalSalidasGranel += cantSalida;

      if (m.tipo_operacion === 'DESTAPE') {
        totalLitrosDestapados += cantEntrada;
      }
    }
  });

  const stockCerrado = Number(producto.stock_actual) || 0;
  const volGranel = Number(producto.volumen_en_uso) || 0;
  const costoUnitario = Number(producto.costo_unitario) || 0;

  return {
    stockActualCerrado: stockCerrado,
    volumenEnUsoGranel: volGranel,
    totalEntradasCerradas: Number(totalEntradasCerradas.toFixed(2)),
    totalComprasCerradas: Number(totalComprasCerradas.toFixed(2)),
    totalDevolucionesCerradas: Number(totalDevolucionesCerradas.toFixed(2)),
    totalSalidasCerradas: Number(totalSalidasCerradas.toFixed(2)),
    totalVentasCerradas: Number(totalVentasCerradas.toFixed(2)),
    totalDestapesCerrados: Number(totalDestapesCerrados.toFixed(2)),
    totalLitrosDestapados: Number(totalLitrosDestapados.toFixed(3)),
    totalEntradasGranel: Number(totalEntradasGranel.toFixed(3)),
    totalSalidasGranel: Number(totalSalidasGranel.toFixed(3)),
    valorizacionCostoTotal: Number((stockCerrado * costoUnitario).toFixed(2)),
    costoUnitarioActual: costoUnitario,
    precioVentaActual: Number(producto.precio_venta) || 0,
  };
}

/**
 * Realiza un ajuste manual justificado de inventario físico y lo registra en el Kardex.
 */
export async function registrarAjusteInventario(datos: {
  productoId: number;
  tipoStock: TipoStockKardex;
  nuevoStock: number;
  motivo: string;
  usuarioNombre: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!datos.motivo.trim()) {
      return { success: false, error: 'Es obligatorio indicar el motivo del ajuste (ej. Merma, rotura o conteo físico).' };
    }

    // 1. Obtener producto actual
    const { data: prod, error: pErr } = await supabase
      .from('productos')
      .select('*')
      .eq('id', datos.productoId)
      .single();

    if (pErr || !prod) {
      return { success: false, error: 'Producto no encontrado.' };
    }

    const stockAnterior = datos.tipoStock === 'CERRADO'
      ? Number(prod.stock_actual) || 0
      : Number(prod.volumen_en_uso) || 0;

    const diferencia = datos.nuevoStock - stockAnterior;

    if (diferencia === 0) {
      return { success: false, error: 'El nuevo stock ingresado es idéntico al actual.' };
    }

    const cantEntrada = diferencia > 0 ? diferencia : 0;
    const cantSalida = diferencia < 0 ? Math.abs(diferencia) : 0;

    // 2. Actualizar stock en productos
    const updateField = datos.tipoStock === 'CERRADO'
      ? { stock_actual: datos.nuevoStock }
      : { volumen_en_uso: Number(datos.nuevoStock.toFixed(3)) };

    const { error: upErr } = await supabase
      .from('productos')
      .update(updateField)
      .eq('id', datos.productoId);

    if (upErr) {
      return { success: false, error: upErr.message };
    }

    // 3. Registrar movimiento en Kardex
    await registrarMovimientoKardex({
      producto_id: datos.productoId,
      tipo_operacion: 'AJUSTE',
      tipo_stock: datos.tipoStock,
      comprobante_tipo: 'NOTA_AJUSTE',
      comprobante_numero: `AJ-${Date.now().toString().slice(-6)}`,
      cantidad_entrada: cantEntrada,
      cantidad_salida: cantSalida,
      saldo_resultante: datos.nuevoStock,
      costo_unitario: prod.costo_unitario,
      precio_venta: prod.precio_venta,
      usuario_nombre: datos.usuarioNombre,
      motivo: `Ajuste manual: ${datos.motivo.trim()} (Anterior: ${stockAnterior} -> Nuevo: ${datos.nuevoStock})`,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error al registrar ajuste en Kardex:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Genera el archivo CSV para exportar el Kardex de un repuesto a Excel.
 */
export function exportarKardexCsv(movimientos: MovimientoKardex[], producto: Producto): string {
  let csv = 'Fecha,Operacion,TipoStock,Comprobante,Numero,Entrada,Salida,SaldoResultante,CostoUnit,PrecioVenta,Responsable,Motivo\n';

  movimientos.forEach((m) => {
    const fecha = new Date(m.fecha).toLocaleString('es-PE');
    const entrada = m.cantidad_entrada > 0 ? m.cantidad_entrada : '';
    const salida = m.cantidad_salida > 0 ? m.cantidad_salida : '';
    const saldo = m.saldo_resultante;
    const costo = m.costo_unitario || '';
    const precio = m.precio_venta || '';
    const resp = (m.usuario_nombre || 'Sistema').replace(/"/g, '""');
    const motivo = (m.motivo || '').replace(/"/g, '""');

    csv += `"${fecha}","${m.tipo_operacion}","${m.tipo_stock}","${m.comprobante_tipo || '-'}","${m.comprobante_numero || '-'}","${entrada}","${salida}","${saldo}","${costo}","${precio}","${resp}","${motivo}"\n`;
  });

  return csv;
}
