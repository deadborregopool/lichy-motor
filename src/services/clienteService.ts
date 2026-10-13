import { supabase, Cliente, AbonoCliente, Venta } from '@/lib/supabase';

export interface FiltrosClientes {
  busqueda?: string;
  soloConDeuda?: boolean;
}

export interface ResumenCarteraClientes {
  totalClientes: number;
  totalDeudaGlobal: number;
  clientesConDeuda: number;
  clientesAlDia: number;
  totalComprasPendientes: number;
}

export interface ItemCompraDetalle {
  id: number;
  producto_id: number;
  nombre_producto: string;
  codigo?: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface CompraCliente {
  id: number;
  numero_comprobante: string | null;
  tipo_comprobante: string;
  fecha_venta: string;
  total: number;
  monto_recibido: number;
  monto_credito: number;
  total_abonado: number;
  saldo_pendiente: number;
  estado: string;
  metodo_pago?: string;
  vendedor_nombre?: string | null;
  notas?: string | null;
  items: ItemCompraDetalle[];
}

export interface HistorialCuentaCliente {
  comprasPendientes: CompraCliente[];
  comprasPagadas: CompraCliente[];
  abonos: AbonoCliente[];
  deudaTotal: number;
}

/**
 * Obtiene la lista de clientes con conteo de compras pendientes en deuda y filtro moroso.
 */
export async function obtenerClientes(filtros?: FiltrosClientes): Promise<Cliente[]> {
  try {
    let query = supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true });

    if (filtros?.busqueda && filtros.busqueda.trim() !== '') {
      const term = `%${filtros.busqueda.trim()}%`;
      query = query.or(
        `nombre.ilike.${term},numero_documento.ilike.${term},telefono.ilike.${term}`
      );
    }

    if (filtros?.soloConDeuda) {
      query = query.gt('saldo_deudor', 0);
    }

    const { data: clientesData, error } = await query;

    if (error) {
      console.error('Error al obtener clientes:', error);
      throw error;
    }

    const clientes = (clientesData || []) as Cliente[];

    // Obtener conteo de compras pendientes por cliente
    const { data: ventasPendientes, error: errorVentas } = await supabase
      .from('ventas')
      .select('id, cliente_id')
      .eq('estado', 'pendiente_pago');

    if (!errorVentas && ventasPendientes) {
      const counts: Record<number, number> = {};
      ventasPendientes.forEach((v) => {
        if (v.cliente_id) {
          counts[v.cliente_id] = (counts[v.cliente_id] || 0) + 1;
        }
      });

      clientes.forEach((c) => {
        c.compras_pendientes_count = counts[c.id] || 0;
      });
    }

    return clientes;
  } catch (error: any) {
    console.error('Excepción al obtener clientes:', error);
    return [];
  }
}

/**
 * Obtiene un cliente específico por su ID.
 */
export async function obtenerClientePorId(id: number): Promise<Cliente | null> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener cliente por ID:', error);
      return null;
    }

    return data as Cliente;
  } catch (error) {
    console.error('Excepción al obtener cliente:', error);
    return null;
  }
}

/**
 * Registra un nuevo cliente.
 * El nombre es obligatorio. Documento, teléfono y dirección son 100% opcionales.
 */
export async function crearCliente(datos: {
  nombre: string;
  telefono?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  direccion?: string | null;
  es_frecuente?: boolean;
}): Promise<{ success: boolean; data?: Cliente; error?: string }> {
  try {
    if (!datos.nombre.trim()) {
      return { success: false, error: 'El nombre del cliente o taller es obligatorio.' };
    }

    const numDocLimpio = datos.numero_documento?.trim() || null;

    // Verificar si ya existe un cliente con el mismo documento (únicamente si se ingresó un documento)
    if (numDocLimpio) {
      const { data: existente } = await supabase
        .from('clientes')
        .select('id, nombre')
        .eq('numero_documento', numDocLimpio)
        .maybeSingle();

      if (existente) {
        return {
          success: false,
          error: `Ya existe un cliente registrado con ese número de documento (${existente.nombre}).`,
        };
      }
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre: datos.nombre.trim(),
        telefono: datos.telefono?.trim() || null,
        tipo_documento: numDocLimpio ? (datos.tipo_documento || '1') : null,
        numero_documento: numDocLimpio,
        limite_credito: 0,
        saldo_deudor: 0,
        placa_vehiculo: null,
        marca_modelo: null,
        direccion: datos.direccion?.trim() || null,
        es_frecuente: Boolean(datos.es_frecuente),
      })
      .select()
      .single();

    if (error) {
      console.error('Error al insertar cliente:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Cliente };
  } catch (error: any) {
    console.error('Excepción al crear cliente:', error);
    return { success: false, error: error.message || 'Error inesperado al crear cliente' };
  }
}

/**
 * Actualiza la información de un cliente.
 */
export async function actualizarCliente(
  id: number,
  datos: {
    nombre?: string;
    telefono?: string | null;
    tipo_documento?: string | null;
    numero_documento?: string | null;
    direccion?: string | null;
    es_frecuente?: boolean;
  }
): Promise<{ success: boolean; data?: Cliente; error?: string }> {
  try {
    const payload: any = {};
    if (datos.nombre !== undefined) payload.nombre = datos.nombre.trim();
    if (datos.telefono !== undefined) payload.telefono = datos.telefono?.trim() || null;
    if (datos.direccion !== undefined) payload.direccion = datos.direccion?.trim() || null;
    if (datos.es_frecuente !== undefined) payload.es_frecuente = Boolean(datos.es_frecuente);

    const numDocLimpio = datos.numero_documento?.trim() || null;
    payload.numero_documento = numDocLimpio;
    payload.tipo_documento = numDocLimpio ? (datos.tipo_documento || '1') : null;

    if (numDocLimpio) {
      const { data: existente } = await supabase
        .from('clientes')
        .select('id, nombre')
        .eq('numero_documento', numDocLimpio)
        .neq('id', id)
        .maybeSingle();

      if (existente) {
        return {
          success: false,
          error: `Ya existe otro cliente con el documento ${numDocLimpio} (${existente.nombre}).`,
        };
      }
    }

    const { data, error } = await supabase
      .from('clientes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar cliente:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Cliente };
  } catch (error: any) {
    console.error('Excepción al actualizar cliente:', error);
    return { success: false, error: error.message || 'Error inesperado al actualizar cliente' };
  }
}

/**
 * Elimina un cliente si no tiene historial de ventas asociadas.
 */
export async function eliminarCliente(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { count, error: countError } = await supabase
      .from('ventas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', id);

    if (countError) throw countError;

    if (count && count > 0) {
      return {
        success: false,
        error: `No se puede eliminar el cliente porque cuenta con ${count} venta(s) o historial de compras registrada(s).`,
      };
    }

    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar cliente:', error);
    return { success: false, error: error.message || 'Error al eliminar cliente' };
  }
}

/**
 * Obtiene el desglose completo de una cuenta de cliente:
 * - Compras en deuda (activas con lista de productos comprados)
 * - Compras históricas ya pagadas
 * - Abonos registrados
 */
export async function obtenerHistorialCliente(clienteId: number): Promise<HistorialCuentaCliente> {
  try {
    const [resVentas, resAbonos] = await Promise.all([
      supabase
        .from('ventas')
        .select(`
          id,
          cliente_id,
          total,
          estado,
          metodo_pago,
          tipo_comprobante,
          numero_comprobante,
          monto_recibido,
          monto_credito,
          vendedor_nombre,
          notas,
          fecha_venta,
          detalle_ventas (
            id,
            producto_id,
            cantidad,
            costo_unitario,
            precio_unitario,
            subtotal,
            productos (
              id,
              nombre,
              codigo
            )
          ),
          abonos_clientes (
            id,
            monto_abonado,
            fecha_abono,
            metodo_pago,
            notas
          )
        `)
        .eq('cliente_id', clienteId)
        .order('fecha_venta', { ascending: false }),

      supabase
        .from('abonos_clientes')
        .select(`
          id,
          cliente_id,
          venta_id,
          monto_abonado,
          metodo_pago,
          fecha_abono,
          usuario_nombre,
          notas,
          ventas (
            id,
            numero_comprobante,
            tipo_comprobante,
            total
          )
        `)
        .eq('cliente_id', clienteId)
        .order('fecha_abono', { ascending: false }),
    ]);

    if (resVentas.error) {
      console.error('Error al consultar ventas del cliente:', resVentas.error);
    }

    const ventasRaw = resVentas.data || [];
    const abonosRaw = (resAbonos.data || []) as any[];
    const abonos: AbonoCliente[] = abonosRaw.map((ab: any) => ({
      id: ab.id,
      cliente_id: ab.cliente_id,
      venta_id: ab.venta_id,
      monto_abonado: Number(ab.monto_abonado) || 0,
      metodo_pago: ab.metodo_pago,
      fecha_abono: ab.fecha_abono,
      usuario_nombre: ab.usuario_nombre,
      notas: ab.notas,
      ventas: Array.isArray(ab.ventas) ? (ab.ventas[0] || null) : (ab.ventas || null),
    }));

    const comprasPendientes: CompraCliente[] = [];
    const comprasPagadas: CompraCliente[] = [];
    let deudaTotal = 0;

    ventasRaw.forEach((v: any) => {
      // Calcular abonos aplicados a esta venta específica
      const abonosEstaVenta: any[] = v.abonos_clientes || [];
      const totalAbonado = abonosEstaVenta.reduce(
        (sum: number, ab: any) => sum + (Number(ab.monto_abonado) || 0),
        0
      );

      const totalVenta = Number(v.total) || 0;
      const montoRecibidoInicial = Number(v.monto_recibido) || 0;
      const saldoPendiente = Math.max(0, Number((totalVenta - montoRecibidoInicial - totalAbonado).toFixed(2)));

      // Mapear items comprados
      const items: ItemCompraDetalle[] = (v.detalle_ventas || []).map((dv: any) => ({
        id: dv.id,
        producto_id: dv.producto_id,
        nombre_producto: dv.productos?.nombre || 'Producto sin nombre',
        codigo: dv.productos?.codigo || null,
        cantidad: Number(dv.cantidad) || 0,
        precio_unitario: Number(dv.precio_unitario) || 0,
        subtotal: Number(dv.subtotal) || 0,
      }));

      const compra: CompraCliente = {
        id: v.id,
        numero_comprobante: v.numero_comprobante,
        tipo_comprobante: v.tipo_comprobante || 'ticket',
        fecha_venta: v.fecha_venta,
        total: totalVenta,
        monto_recibido: montoRecibidoInicial,
        monto_credito: Number(v.monto_credito) || 0,
        total_abonado: totalAbonado,
        saldo_pendiente: saldoPendiente,
        estado: v.estado,
        metodo_pago: v.metodo_pago,
        vendedor_nombre: v.vendedor_nombre,
        notas: v.notas,
        items,
      };

      if (v.estado === 'pendiente_pago' || saldoPendiente > 0) {
        comprasPendientes.push(compra);
        deudaTotal += saldoPendiente;
      } else if (v.estado === 'pagado') {
        comprasPagadas.push(compra);
      }
    });

    return {
      comprasPendientes,
      comprasPagadas,
      abonos,
      deudaTotal: Number(deudaTotal.toFixed(2)),
    };
  } catch (error) {
    console.error('Error al obtener historial del cliente:', error);
    return { comprasPendientes: [], comprasPagadas: [], abonos: [], deudaTotal: 0 };
  }
}

/**
 * Registra un abono/amortización a una compra específica o a la cuenta global del cliente.
 * Si la compra se cancela por completo, actualiza automáticamente su estado a 'pagado'.
 */
export async function registrarAbonoCliente(datos: {
  cliente_id: number;
  monto_abonado: number;
  metodo_pago?: string;
  usuario_nombre?: string;
  venta_id?: number | null;
  notas?: string;
}): Promise<{ success: boolean; error?: string; nuevoSaldo?: number }> {
  try {
    const monto = Number(datos.monto_abonado);
    if (isNaN(monto) || monto <= 0) {
      return { success: false, error: 'El monto a abonar debe ser mayor a 0.' };
    }

    const cliente = await obtenerClientePorId(datos.cliente_id);
    if (!cliente) {
      return { success: false, error: 'Cliente no encontrado.' };
    }

    const deudaActual = Number(cliente.saldo_deudor) || 0;
    if (deudaActual <= 0) {
      return { success: false, error: 'El cliente no tiene deuda pendiente registrada.' };
    }

    if (monto > deudaActual + 0.01) {
      return {
        success: false,
        error: `El abono (S/ ${monto.toFixed(2)}) no puede exceder la deuda actual (S/ ${deudaActual.toFixed(2)}).`,
      };
    }

    // 1. Insertar comprobante de abono
    const { error: abonoError } = await supabase.from('abonos_clientes').insert({
      cliente_id: datos.cliente_id,
      venta_id: datos.venta_id || null,
      monto_abonado: monto,
      metodo_pago: datos.metodo_pago || 'efectivo',
      usuario_nombre: datos.usuario_nombre || 'Cajero',
      notas: datos.notas?.trim() || null,
    });

    if (abonoError) {
      console.error('Error al registrar abono:', abonoError);
      return { success: false, error: abonoError.message };
    }

    // 2. Si se especificó una venta, verificar si quedó saldada
    if (datos.venta_id) {
      const { data: venta } = await supabase
        .from('ventas')
        .select('id, total, monto_recibido, abonos_clientes(monto_abonado)')
        .eq('id', datos.venta_id)
        .single();

      if (venta) {
        const totalVenta = Number(venta.total) || 0;
        const inicial = Number(venta.monto_recibido) || 0;
        const abonosSum = (venta.abonos_clientes || []).reduce(
          (sum: number, ab: any) => sum + (Number(ab.monto_abonado) || 0),
          0
        );
        const restante = totalVenta - inicial - abonosSum;

        if (restante <= 0.01) {
          await supabase
            .from('ventas')
            .update({ estado: 'pagado' })
            .eq('id', datos.venta_id);
        }
      }
    }

    // 3. Descontar saldo deudor del cliente
    const nuevoSaldo = Math.max(0, Number((deudaActual - monto).toFixed(2)));
    const { error: updateError } = await supabase
      .from('clientes')
      .update({ saldo_deudor: nuevoSaldo })
      .eq('id', datos.cliente_id);

    if (updateError) {
      console.error('Error al actualizar saldo deudor del cliente:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, nuevoSaldo };
  } catch (error: any) {
    console.error('Excepción al registrar abono:', error);
    return { success: false, error: error.message || 'Error al procesar abono' };
  }
}

/**
 * Calcula las métricas de cartera, cobranza y total de compras pendientes globales.
 */
export async function obtenerResumenCartera(): Promise<ResumenCarteraClientes> {
  try {
    const [resClientes, resVentasPendientes] = await Promise.all([
      supabase.from('clientes').select('id, saldo_deudor'),
      supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente_pago'),
    ]);

    const clientes = resClientes.data || [];
    const totalClientes = clientes.length;
    let totalDeudaGlobal = 0;
    let clientesConDeuda = 0;

    clientes.forEach((c) => {
      const saldo = Number(c.saldo_deudor) || 0;
      if (saldo > 0) {
        totalDeudaGlobal += saldo;
        clientesConDeuda++;
      }
    });

    return {
      totalClientes,
      totalDeudaGlobal: Number(totalDeudaGlobal.toFixed(2)),
      clientesConDeuda,
      clientesAlDia: totalClientes - clientesConDeuda,
      totalComprasPendientes: resVentasPendientes.count || 0,
    };
  } catch (error) {
    console.error('Excepción al calcular resumen de cartera:', error);
    return {
      totalClientes: 0,
      totalDeudaGlobal: 0,
      clientesConDeuda: 0,
      clientesAlDia: 0,
      totalComprasPendientes: 0,
    };
  }
}
