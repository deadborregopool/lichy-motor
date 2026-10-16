import { supabase, Venta, DetalleVenta, Cliente, MetodoPago, TipoComprobanteVenta, Producto } from '@/lib/supabase';
import { registrarMovimientoKardex } from './kardexService';

export interface ItemCarritoVenta {
  producto: Producto;
  cantidad: number; // Unidades enteras o litros fraccionados
  precio_unitario: number;
  subtotal: number;
  es_granel: boolean; // true si es del balde abierto
  unidad_medida_venta: string; // 'unidad', 'Litro', 'Cuarto', etc.
}

export interface DatosRegistroVenta {
  cliente_id: number | null;
  usuario_id: number | null;
  vendedor_nombre: string | null;
  total: number;
  metodo_pago: MetodoPago;
  tipo_comprobante: TipoComprobanteVenta;
  numero_comprobante?: string | null;
  monto_recibido?: number | null;
  vuelto?: number | null;
  monto_credito?: number | null;
  notas?: string | null;
  items: ItemCarritoVenta[];
}

export interface VentaConDetalles extends Venta {
  cliente?: Cliente | null;
  total_gravada?: number | null;
  total_igv?: number | null;
  estado_sunat?: string | null;
  detalle_ventas: (DetalleVenta & {
    productos?: {
      id: number;
      nombre: string;
      codigo: string | null;
      unidad_medida: string;
    } | null;
  })[];
}

export interface ResumenCajaHoy {
  totalVentas: number;
  totalEfectivo: number;
  totalYape: number;
  totalPlin: number;
  totalTarjeta: number;
  totalTransferencia: number;
  totalCredito: number;
  cantidadCredito: number;
  cantidadTransacciones: number;
}

/**
 * Registra una venta completa en el POS con descuento atómico de inventario:
 * - Para repuestos o envases sellados: descuenta de stock_actual.
 * - Para aceites a granel / fraccionados: descuenta de volumen_en_uso (litros).
 * - Calcula automáticamente base gravada e IGV (18%) a partir del precio final para Boletas SUNAT.
 */
export async function registrarVenta(datos: DatosRegistroVenta): Promise<{ success: boolean; ventaId?: number; numeroComprobante?: string; error?: string }> {
  try {
    if (!datos.items || datos.items.length === 0) {
      return { success: false, error: 'No hay productos en el carrito para procesar la venta.' };
    }

    // 1. Generar número de comprobante secuencial SUNAT si no se especificó
    let numComp = datos.numero_comprobante;
    if (!numComp) {
      if (datos.tipo_comprobante === 'boleta') {
        const { count } = await supabase.from('ventas').select('*', { count: 'exact', head: true }).eq('tipo_comprobante', 'boleta');
        const prox = (count || 0) + 1;
        numComp = `B001-${prox.toString().padStart(8, '0')}`;
      } else if (datos.tipo_comprobante === 'factura') {
        const { count } = await supabase.from('ventas').select('*', { count: 'exact', head: true }).eq('tipo_comprobante', 'factura');
        const prox = (count || 0) + 1;
        numComp = `F001-${prox.toString().padStart(8, '0')}`;
      } else {
        const { count } = await supabase.from('ventas').select('*', { count: 'exact', head: true }).eq('tipo_comprobante', 'ticket');
        const prox = (count || 0) + 1;
        numComp = `TK-${prox.toString().padStart(6, '0')}`;
      }
    }

    // 2. Desglose fiscal exacto (precio final = lo cobrado; base gravada = total / 1.18; igv = total - base)
    const totalGravada = Number((datos.total / 1.18).toFixed(2));
    const totalIgv = Number((datos.total - totalGravada).toFixed(2));

    const esCredito = datos.metodo_pago === 'credito';
    const montoCredito = esCredito
      ? (datos.monto_credito !== undefined && datos.monto_credito !== null
          ? Number(datos.monto_credito)
          : Math.max(0, Number((datos.total - (datos.monto_recibido || 0)).toFixed(2))))
      : 0;

    // 3. Insertar cabecera en `ventas`
    const { data: ventaData, error: ventaError } = await supabase
      .from('ventas')
      .insert({
        cliente_id: datos.cliente_id,
        usuario_id: datos.usuario_id,
        vendedor_nombre: datos.vendedor_nombre,
        total: datos.total,
        total_gravada: totalGravada,
        total_igv: totalIgv,
        estado: esCredito ? 'pendiente_pago' : 'pagado',
        estado_sunat: 'pendiente',
        metodo_pago: datos.metodo_pago,
        tipo_comprobante: datos.tipo_comprobante,
        numero_comprobante: numComp,
        monto_recibido: datos.monto_recibido ?? (esCredito ? 0 : datos.total),
        vuelto: datos.vuelto ?? 0,
        monto_credito: montoCredito,
        notas: datos.notas || null,
        fecha_venta: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (ventaError || !ventaData) {
      console.error('Error al insertar cabecera de venta:', ventaError);
      return { success: false, error: `Error al registrar la venta: ${ventaError?.message || 'Desconocido'}` };
    }

    const ventaId = ventaData.id;

    // Si la venta tiene saldo a crédito / fiado, actualizar el saldo deudor del cliente
    if (esCredito && datos.cliente_id && montoCredito > 0) {
      const { data: c } = await supabase
        .from('clientes')
        .select('saldo_deudor')
        .eq('id', datos.cliente_id)
        .single();

      const deudaActual = Number(c?.saldo_deudor) || 0;
      await supabase
        .from('clientes')
        .update({
          saldo_deudor: Number((deudaActual + montoCredito).toFixed(2)),
        })
        .eq('id', datos.cliente_id);
    }

    // 4. Preparar filas para `detalle_ventas`
    const detallesInsert = datos.items.map((item) => ({
      venta_id: ventaId,
      producto_id: item.producto.id,
      cantidad: item.cantidad,
      costo_unitario: Number(item.producto.costo_unitario) || 0,
      precio_unitario: Number(item.precio_unitario),
      subtotal: Number(item.subtotal),
      es_granel: Boolean(item.es_granel),
      unidad_medida_venta: item.unidad_medida_venta || 'unidad',
    }));

    const { error: detallesError } = await supabase.from('detalle_ventas').insert(detallesInsert);

    if (detallesError) {
      console.error('Error al insertar detalles de venta:', detallesError);
      return { success: false, error: `Venta #${ventaId} creada pero falló el detalle: ${detallesError.message}` };
    }

    // 5. Actualizar inventario atómicamente para cada producto
    for (const item of datos.items) {
      const prod = item.producto;

      if (item.es_granel) {
        // Descontar litros del balde en uso
        const volActual = Number(prod.volumen_en_uso) || 0;
        const nuevoVol = Math.max(0, volActual - item.cantidad);

        await supabase
          .from('productos')
          .update({
            volumen_en_uso: Number(nuevoVol.toFixed(3)),
          })
          .eq('id', prod.id);

        // Registrar salida de granel en Kardex
        await registrarMovimientoKardex({
          producto_id: prod.id,
          tipo_operacion: 'VENTA',
          tipo_stock: 'GRANEL',
          comprobante_tipo: datos.tipo_comprobante?.toUpperCase() || 'BOLETA',
          comprobante_numero: numComp,
          cantidad_entrada: 0,
          cantidad_salida: item.cantidad,
          saldo_resultante: Number(nuevoVol.toFixed(3)),
          costo_unitario: Number(prod.costo_unitario) || 0,
          precio_venta: item.precio_unitario,
          usuario_nombre: datos.vendedor_nombre || 'Mostrador',
          motivo: `Despacho de aceite a granel (${item.cantidad.toFixed(2)} L) en mostrador`,
        });
      } else {
        // Descontar unidades enteras del stock sellado
        const stockActual = Number(prod.stock_actual) || 0;
        const nuevoStock = Math.max(0, stockActual - item.cantidad);

        await supabase
          .from('productos')
          .update({
            stock_actual: Math.round(nuevoStock),
          })
          .eq('id', prod.id);

        // Registrar salida de unidades cerradas en Kardex
        await registrarMovimientoKardex({
          producto_id: prod.id,
          tipo_operacion: 'VENTA',
          tipo_stock: 'CERRADO',
          comprobante_tipo: datos.tipo_comprobante?.toUpperCase() || 'BOLETA',
          comprobante_numero: numComp,
          cantidad_entrada: 0,
          cantidad_salida: item.cantidad,
          saldo_resultante: Math.round(nuevoStock),
          costo_unitario: Number(prod.costo_unitario) || 0,
          precio_venta: item.precio_unitario,
          usuario_nombre: datos.vendedor_nombre || 'Mostrador',
          motivo: `Venta en mostrador (${item.cantidad} ${prod.unidad_medida})`,
        });
      }
    }

    return {
      success: true,
      ventaId,
      numeroComprobante: numComp,
    };
  } catch (err: any) {
    console.error('Excepción al registrar venta en POS:', err);
    return { success: false, error: err?.message || 'Error inesperado al registrar la venta.' };
  }
}

/**
 * Obtiene las ventas registradas el día de hoy.
 */
export async function obtenerVentasDelDia(): Promise<VentaConDetalles[]> {
  try {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('ventas')
      .select(`
        *,
        cliente:clientes(id, nombre, telefono, es_frecuente, tipo_documento, numero_documento),
        detalle_ventas(
          id,
          venta_id,
          producto_id,
          cantidad,
          costo_unitario,
          precio_unitario,
          subtotal,
          es_granel,
          unidad_medida_venta,
          productos:productos(id, nombre, codigo, unidad_medida)
        )
      `)
      .gte('fecha_venta', inicioHoy.toISOString())
      .order('fecha_venta', { ascending: false });

    if (error) {
      console.error('Error al obtener ventas del día:', error);
      return [];
    }

    return (data as unknown as VentaConDetalles[]) || [];
  } catch (err) {
    console.error('Excepción al obtener ventas de hoy:', err);
    return [];
  }
}

/**
 * Obtiene las boletas de una fecha específica para exportar a Greenter.
 * Opcionalmente permite incluir tickets del mostrador para declararlos como boletas.
 */
export async function obtenerBoletasPorFecha(
  fechaStr: string,
  incluirTickets = false
): Promise<VentaConDetalles[]> {
  try {
    const inicio = new Date(`${fechaStr}T00:00:00`);
    const fin = new Date(`${fechaStr}T23:59:59`);

    let query = supabase
      .from('ventas')
      .select(`
        *,
        cliente:clientes(id, nombre, telefono, es_frecuente, tipo_documento, numero_documento),
        detalle_ventas(
          id,
          venta_id,
          producto_id,
          cantidad,
          costo_unitario,
          precio_unitario,
          subtotal,
          es_granel,
          unidad_medida_venta,
          productos:productos(id, nombre, codigo, unidad_medida)
        )
      `)
      .gte('fecha_venta', inicio.toISOString())
      .lte('fecha_venta', fin.toISOString())
      .order('id', { ascending: true });

    if (!incluirTickets) {
      query = query.eq('tipo_comprobante', 'boleta');
    }

    // Excluir comprobantes anulados del lote Greenter UBL
    query = query.neq('estado', 'anulado');

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener boletas para Greenter:', error);
      return [];
    }

    return (data as unknown as VentaConDetalles[]) || [];
  } catch (err) {
    console.error('Excepción al obtener boletas por fecha:', err);
    return [];
  }
}

/**
 * Convierte un ticket o nota de venta en una Boleta formal con serie B001.
 */
export async function convertirTicketABoleta(ventaId: number): Promise<{ success: boolean; numeroComprobante?: string; error?: string }> {
  try {
    const { data: venta, error: vErr } = await supabase
      .from('ventas')
      .select('id, total, tipo_comprobante')
      .eq('id', ventaId)
      .single();

    if (vErr || !venta) {
      return { success: false, error: 'No se encontró la venta a convertir.' };
    }

    // Generar correlativo B001
    const { data: ultimasBoletas } = await supabase
      .from('ventas')
      .select('numero_comprobante')
      .eq('tipo_comprobante', 'boleta')
      .like('numero_comprobante', 'B001-%')
      .order('id', { ascending: false })
      .limit(1);

    let correlativo = 1;
    if (ultimasBoletas && ultimasBoletas.length > 0 && ultimasBoletas[0].numero_comprobante) {
      const partes = ultimasBoletas[0].numero_comprobante.split('-');
      if (partes[1]) {
        correlativo = (parseInt(partes[1], 10) || 0) + 1;
      }
    }
    const nuevoNumero = `B001-${correlativo.toString().padStart(8, '0')}`;

    const total = Number(venta.total) || 0;
    const totalGravada = Number((total / 1.18).toFixed(2));
    const totalIgv = Number((total - totalGravada).toFixed(2));

    const { error: upErr } = await supabase
      .from('ventas')
      .update({
        tipo_comprobante: 'boleta',
        numero_comprobante: nuevoNumero,
        total_gravada: totalGravada,
        total_igv: totalIgv,
        estado_sunat: 'pendiente',
      })
      .eq('id', ventaId);

    if (upErr) {
      return { success: false, error: upErr.message };
    }

    return { success: true, numeroComprobante: nuevoNumero };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Transforma un lote de boletas al formato de objeto compatible con Greenter (UBL 2.1)
 */
export function construirLoteGreenter(boletas: VentaConDetalles[], rucEmpresa = '20601234567', razonSocial = 'LICHY MOTOR E.I.R.L.') {
  return boletas.map((v) => {
    const total = Number(v.total) || 0;
    const baseGravada = v.total_gravada ? Number(v.total_gravada) : Number((total / 1.18).toFixed(2));
    const igv = v.total_igv ? Number(v.total_igv) : Number((total - baseGravada).toFixed(2));

    let serie = 'B001';
    let correlativo = '00000001';
    if (v.numero_comprobante && v.numero_comprobante.startsWith('B001-')) {
      const partes = v.numero_comprobante.split('-');
      serie = partes[0] || 'B001';
      correlativo = partes[1] || '00000001';
    } else {
      correlativo = v.id.toString().padStart(8, '0');
    }

    const fechaISO = v.fecha_venta ? v.fecha_venta.split('T')[0] : new Date().toISOString().split('T')[0];
    const hora = v.fecha_venta && v.fecha_venta.includes('T') ? v.fecha_venta.split('T')[1].substring(0, 8) : '12:00:00';

    return {
      tipoDoc: '03', // Boleta de Venta
      serie: serie,
      correlativo: correlativo,
      fechaEmision: `${fechaISO}T${hora}-05:00`,
      formaPago: { moneda: 'PEN', tipo: 'Contado' },
      tipoMoneda: 'PEN',
      client: {
        tipoDoc: (v.cliente as any)?.tipo_documento || '1',
        numDoc: (v.cliente as any)?.numero_documento || (v.cliente ? '00000000' : '00000000'),
        rznSocial: v.cliente?.nombre || 'CLIENTE CASUAL',
      },
      company: {
        ruc: rucEmpresa,
        razonSocial: razonSocial,
      },
      mtoOperGravadas: baseGravada,
      mtoIGV: igv,
      totalImpuestos: igv,
      valorVenta: baseGravada,
      subTotal: total,
      mtoImpVenta: total,
      details: (v.detalle_ventas || []).map((det) => {
        const subtotal = Number(det.subtotal) || 0;
        const valVenta = Number((subtotal / 1.18).toFixed(2));
        const itemIgv = Number((subtotal - valVenta).toFixed(2));
        const cant = Number(det.cantidad) || 1;
        const valUnitario = Number((valVenta / cant).toFixed(4));
        const precUnitario = Number((subtotal / cant).toFixed(2));

        return {
          codProducto: det.productos?.codigo || `REP-${det.producto_id}`,
          unidad: det.es_granel ? 'LTR' : 'NIU',
          descripcion: det.productos?.nombre || 'Repuesto de Moto',
          cantidad: cant,
          mtoValorUnitario: valUnitario,
          mtoValorGratuito: 0,
          mtoValorVenta: valVenta,
          mtoBaseIgv: valVenta,
          porcentajeIgv: 18,
          igv: itemIgv,
          tipAfeIgv: '10', // Gravado - Operación Onerosa
          totalImpuestos: itemIgv,
          mtoPrecioUnitario: precUnitario,
        };
      }),
    };
  });
}

/**
 * Calcula el resumen de caja del día para el arqueo / cierre de turno.
 */
export function calcularResumenCaja(ventas: Venta[]): ResumenCajaHoy {
  const resumen: ResumenCajaHoy = {
    totalVentas: 0,
    totalEfectivo: 0,
    totalYape: 0,
    totalPlin: 0,
    totalTarjeta: 0,
    totalTransferencia: 0,
    totalCredito: 0,
    cantidadCredito: 0,
    cantidadTransacciones: 0,
  };

  ventas.forEach((v) => {
    if (v.estado === 'anulado') return;

    resumen.cantidadTransacciones++;
    const monto = Number(v.total) || 0;
    resumen.totalVentas += monto;

    const metodo = (v.metodo_pago || 'efectivo').toLowerCase();
    if (metodo === 'credito') {
      const montoCredito =
        Number(v.monto_credito) > 0
          ? Number(v.monto_credito)
          : Math.max(0, monto - (Number(v.monto_recibido) || 0));
      const adelantoEfectivo = Number(v.monto_recibido) || 0;

      resumen.totalCredito += montoCredito;
      resumen.cantidadCredito++;

      // Solo si el cliente dejó un adelanto en efectivo contante, ese monto suma a caja
      if (adelantoEfectivo > 0) {
        resumen.totalEfectivo += adelantoEfectivo;
      }
    } else if (metodo === 'efectivo') {
      resumen.totalEfectivo += monto;
    } else if (metodo === 'yape') {
      resumen.totalYape += monto;
    } else if (metodo === 'plin') {
      resumen.totalPlin += monto;
    } else if (metodo === 'tarjeta') {
      resumen.totalTarjeta += monto;
    } else if (metodo === 'transferencia') {
      resumen.totalTransferencia += monto;
    } else {
      resumen.totalEfectivo += monto;
    }
  });

  return resumen;
}

/**
 * Obtiene lista de clientes para selector rápido en mostrador.
 */
export async function obtenerClientes(): Promise<Cliente[]> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error al obtener clientes:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Excepción al obtener clientes:', err);
    return [];
  }
}

/**
 * Registra un cliente de forma instantánea desde el mostrador con DNI / RUC opcional.
 */
export async function crearClienteRapido(
  nombre: string,
  telefono?: string,
  tipoDocumento = '1',
  numeroDocumento?: string
): Promise<{ success: boolean; cliente?: Cliente; error?: string }> {
  try {
    if (!nombre.trim()) {
      return { success: false, error: 'El nombre del cliente es obligatorio.' };
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        tipo_documento: tipoDocumento,
        numero_documento: numeroDocumento?.trim() || null,
        es_frecuente: false,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, cliente: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Obtiene ventas dentro de un rango de fechas con filtros opcionales.
 */
export async function obtenerVentasPorRangoFecha(
  fechaInicio?: string,
  fechaFin?: string
): Promise<VentaConDetalles[]> {
  try {
    let query = supabase
      .from('ventas')
      .select(`
        *,
        cliente:clientes(id, nombre, telefono, es_frecuente, tipo_documento, numero_documento),
        detalle_ventas(
          id,
          venta_id,
          producto_id,
          cantidad,
          costo_unitario,
          precio_unitario,
          subtotal,
          es_granel,
          unidad_medida_venta,
          productos:productos(id, nombre, codigo, unidad_medida)
        )
      `)
      .order('fecha_venta', { ascending: false });

    if (fechaInicio) {
      query = query.gte('fecha_venta', `${fechaInicio}T00:00:00`);
    }
    if (fechaFin) {
      query = query.lte('fecha_venta', `${fechaFin}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener ventas por rango de fecha:', error);
      return [];
    }
    return (data as unknown as VentaConDetalles[]) || [];
  } catch (err) {
    console.error('Excepción al obtener ventas:', err);
    return [];
  }
}

/**
 * Anula una venta registrada, reintegra la mercadería al stock del inventario
 * y genera los movimientos de DEVOLUCION en el Kardex.
 */
export async function anularVenta(datos: {
  ventaId: number;
  motivo: string;
  usuarioNombre?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { ventaId, motivo, usuarioNombre } = datos;

    // 1. Obtener los datos completos de la venta y sus detalles
    const { data: venta, error: ventaErr } = await supabase
      .from('ventas')
      .select(`
        *,
        detalle_ventas(
          id,
          producto_id,
          cantidad,
          costo_unitario,
          precio_unitario,
          subtotal,
          es_granel,
          unidad_medida_venta,
          productos:productos(id, nombre, stock_actual, volumen_en_uso, costo_unitario, precio_venta)
        )
      `)
      .eq('id', ventaId)
      .single();

    if (ventaErr || !venta) {
      return { success: false, error: 'No se encontró la venta a anular.' };
    }

    if (venta.estado === 'anulado') {
      return { success: false, error: 'Esta venta ya se encuentra anulada.' };
    }

    // 2. Reintegrar cada producto al inventario y registrar en Kardex
    for (const item of (venta.detalle_ventas || [])) {
      const prod = item.productos;
      if (!prod) continue;

      if (item.es_granel) {
        // Reintegrar litros al balde abierto
        const volumenActual = Number(prod.volumen_en_uso) || 0;
        const nuevoVolumen = Number((volumenActual + Number(item.cantidad)).toFixed(3));

        const { error: updGranelErr } = await supabase
          .from('productos')
          .update({
            volumen_en_uso: nuevoVolumen,
          })
          .eq('id', item.producto_id);

        if (updGranelErr) {
          console.error('Error al reintegrar volumen a granel:', updGranelErr);
        }

        await registrarMovimientoKardex({
          producto_id: item.producto_id,
          tipo_operacion: 'DEVOLUCION',
          tipo_stock: 'GRANEL',
          comprobante_tipo: venta.tipo_comprobante || 'ticket',
          comprobante_numero: venta.numero_comprobante || `V-${venta.id}`,
          cantidad_entrada: Number(item.cantidad),
          cantidad_salida: 0,
          saldo_resultante: nuevoVolumen,
          costo_unitario: Number(item.costo_unitario) || 0,
          precio_venta: Number(item.precio_unitario) || 0,
          usuario_nombre: usuarioNombre || 'Administrador',
          motivo: `Devolución por anulación de Venta #${venta.id} (${venta.numero_comprobante || 'S/N'}): ${motivo.trim() || 'Devolución de mercadería'}`,
        });
      } else {
        // Reintegrar piezas/envases cerrados
        const stockActual = Number(prod.stock_actual) || 0;
        const nuevoStock = stockActual + Number(item.cantidad);

        const { error: updStockErr } = await supabase
          .from('productos')
          .update({
            stock_actual: nuevoStock,
          })
          .eq('id', item.producto_id);

        if (updStockErr) {
          console.error('Error al reintegrar stock cerrado:', updStockErr);
        }

        await registrarMovimientoKardex({
          producto_id: item.producto_id,
          tipo_operacion: 'DEVOLUCION',
          tipo_stock: 'CERRADO',
          comprobante_tipo: venta.tipo_comprobante || 'ticket',
          comprobante_numero: venta.numero_comprobante || `V-${venta.id}`,
          cantidad_entrada: Number(item.cantidad),
          cantidad_salida: 0,
          saldo_resultante: nuevoStock,
          costo_unitario: Number(item.costo_unitario) || 0,
          precio_venta: Number(item.precio_unitario) || 0,
          usuario_nombre: usuarioNombre || 'Administrador',
          motivo: `Devolución por anulación de Venta #${venta.id} (${venta.numero_comprobante || 'S/N'}): ${motivo.trim() || 'Devolución de mercadería'}`,
        });
      }
    }

    // 3. Si la venta fue a crédito o generó deuda, descontarla del saldo deudor del cliente
    if (venta.cliente_id && (venta.metodo_pago === 'credito' || Number(venta.monto_credito) > 0)) {
      const deudaDeVenta = Number(venta.monto_credito) || Number(venta.total);
      const { data: c } = await supabase
        .from('clientes')
        .select('saldo_deudor')
        .eq('id', venta.cliente_id)
        .single();

      if (c) {
        const saldoActual = Number(c.saldo_deudor) || 0;
        const nuevoSaldo = Math.max(0, Number((saldoActual - deudaDeVenta).toFixed(2)));
        await supabase
          .from('clientes')
          .update({ saldo_deudor: nuevoSaldo })
          .eq('id', venta.cliente_id);
      }
    }

    // 4. Marcar la venta como anulada en la tabla ventas
    const notaAnulacion = `[ANULADO el ${new Date().toLocaleDateString('es-PE')} por ${usuarioNombre || 'Admin'}: ${motivo.trim()}]`;
    const notasActualizadas = venta.notas ? `${venta.notas} | ${notaAnulacion}` : notaAnulacion;

    const { error: updateErr } = await supabase
      .from('ventas')
      .update({
        estado: 'anulado',
        notas: notasActualizadas,
      })
      .eq('id', ventaId);

    if (updateErr) {
      console.error('Error al actualizar estado de la venta:', updateErr);
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Excepción al anular venta:', err);
    return { success: false, error: err?.message || 'Error inesperado al anular la venta.' };
  }
}

