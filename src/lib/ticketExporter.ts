/**
 * Utilidades para exportación y descarga de Tickets y Boletas de Lichy Motor
 */

export interface DatosTicketExportacion {
  numeroComprobante: string;
  nombreComprobante?: string;
  fecha: string;
  vendedorNombre?: string | null;
  clienteNombre?: string | null;
  clienteDoc?: string | null;
  clienteTelefono?: string | null;
  items: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    esGranel?: boolean;
    unidadMedida?: string;
  }>;
  total: number;
  totalGravada?: number | null;
  totalIgv?: number | null;
  metodoPago: string;
  montoRecibido?: number | null;
  vuelto?: number | null;
  notas?: string | null;
  esAnulado?: boolean;
  motivoAnulacion?: string | null;
}

/**
 * Genera el texto formateado para ticket de 40 columnas (térmico estándar de 80mm).
 */
export function generarTextoTicket(d: DatosTicketExportacion): string {
  const formatearMonto = (n: number) => `S/ ${n.toFixed(2)}`;
  const fechaStr = new Date(d.fecha).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const gravada = d.totalGravada != null ? Number(d.totalGravada) : Number((d.total / 1.18).toFixed(2));
  const igv = d.totalIgv != null ? Number(d.totalIgv) : Number((d.total - gravada).toFixed(2));

  let txt = '';
  txt += '========================================\n';
  txt += '              LICHY MOTOR               \n';
  txt += '      REPUESTOS & ACEITES DE MOTO       \n';
  txt += '      Av. Principal de Motos - Perú     \n';
  txt += '========================================\n';

  if (d.esAnulado) {
    txt += '****************************************\n';
    txt += '      *** COMPROBANTE ANULADO ***       \n';
    txt += '       VENTA ANULADA - SIN VALOR        \n';
    txt += '    MERCADERÍA DEVUELTA AL INVENTARIO   \n';
    if (d.motivoAnulacion) {
      txt += ` Motivo: ${d.motivoAnulacion.substring(0, 30)}\n`;
    }
    txt += '****************************************\n';
  }

  txt += `${(d.nombreComprobante || 'COMPROBANTE DE VENTA').toUpperCase()}${d.esAnulado ? ' (ANULADO)' : ''}\n`;
  txt += `N°: ${d.numeroComprobante}\n`;
  txt += `Fecha:   ${fechaStr}\n`;
  txt += `Cajero:  ${d.vendedorNombre || 'Atención Mostrador'}\n`;
  txt += `Cliente: ${d.clienteNombre || 'PÚBLICO GENERAL'}\n`;
  if (d.clienteDoc) txt += `Doc:     ${d.clienteDoc}\n`;
  if (d.clienteTelefono) txt += `Tel:     ${d.clienteTelefono}\n`;
  txt += '----------------------------------------\n';
  txt += 'CANT  DESCRIPCIÓN                  TOTAL\n';
  txt += '----------------------------------------\n';

  d.items.forEach((item) => {
    const cantStr = item.esGranel ? `${item.cantidad.toFixed(2)}L` : `${item.cantidad}`;
    const desc = item.nombre.length > 22 ? item.nombre.substring(0, 20) + '..' : item.nombre;
    const subStr = formatearMonto(item.subtotal);
    const linea = `${cantStr.padEnd(5)} ${desc.padEnd(23)} ${subStr.padStart(10)}\n`;
    txt += linea;
    if (item.esGranel) {
      txt += `      (Aceite granel x ${formatearMonto(item.precioUnitario)})\n`;
    }
  });

  txt += '----------------------------------------\n';
  txt += `Op. Gravada:               ${formatearMonto(gravada).padStart(13)}\n`;
  txt += `I.G.V. (18%):              ${formatearMonto(igv).padStart(13)}\n`;
  txt += '----------------------------------------\n';
  txt += `TOTAL A PAGAR:             ${formatearMonto(d.total).padStart(13)}\n`;
  txt += '----------------------------------------\n';
  txt += `Método de Pago:            ${d.metodoPago.toUpperCase().padStart(13)}\n`;

  if (d.metodoPago.toLowerCase() === 'efectivo') {
    txt += `Efectivo Recibido:         ${formatearMonto(d.montoRecibido || d.total).padStart(13)}\n`;
    txt += `Vuelto Entregado:          ${formatearMonto(d.vuelto || 0).padStart(13)}\n`;
  }

  if (d.notas) {
    txt += `Nota: ${d.notas}\n`;
  }

  if (d.esAnulado) {
    txt += '****************************************\n';
    txt += '   *** ESTE TICKET HA SIDO ANULADO ***  \n';
    txt += '    NO ES VÁLIDO PARA RETIRO O CANJE    \n';
    txt += '****************************************\n';
  } else {
    txt += '========================================\n';
    txt += '       ¡GRACIAS POR SU COMPRA!          \n';
    txt += '    Garantía de Repuestos & Taller      \n';
    txt += '========================================\n';
  }

  return txt;
}

/**
 * Dispara la descarga en el navegador de un archivo de texto o reporte.
 */
export function descargarArchivo(nombreArchivo: string, contenido: string, tipoMime = 'text/plain;charset=utf-8;') {
  const blob = new Blob([contenido], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Genera un reporte consolidado en texto de un lote de boletas/tickets del día.
 */
export function generarReporteLoteConsolidado(
  boletas: any[],
  fecha: string,
  resumen: { cantidad: number; total: number; gravada: number; igv: number }
): string {
  const formatearMonto = (n: number) => `S/ ${n.toFixed(2)}`;

  let rpt = '';
  rpt += '================================================================================\n';
  rpt += '                   LICHY MOTOR - REPORTE CONSOLIDADO DE BOLETAS                 \n';
  rpt += `Fecha del Turno: ${fecha}                                                  \n`;
  rpt += `Generado el:     ${new Date().toLocaleString('es-PE')}                     \n`;
  rpt += '================================================================================\n\n';

  rpt += 'RESUMEN DEL DÍA (SUNAT / GREENTER):\n';
  rpt += `· Total de Comprobantes: ${resumen.cantidad}\n`;
  rpt += `· Base Gravada:          ${formatearMonto(resumen.gravada)}\n`;
  rpt += `· I.G.V. (18%):          ${formatearMonto(resumen.igv)}\n`;
  rpt += `· TOTAL FACTURADO:       ${formatearMonto(resumen.total)}\n\n`;

  rpt += 'DETALLE DE COMPROBANTES EMITIDOS:\n';
  rpt += '--------------------------------------------------------------------------------\n';
  rpt += 'NUMERO          HORA      CLIENTE               DOC / DNI       TOTAL      METODO\n';
  rpt += '--------------------------------------------------------------------------------\n';

  boletas.forEach((b) => {
    const num = (b.numero_comprobante || `B001-${b.id}`).padEnd(15);
    const hora = (b.fecha_venta ? new Date(b.fecha_venta).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--:--').padEnd(9);
    const cliNombre = (b.cliente?.nombre || 'Público General').substring(0, 20).padEnd(21);
    const doc = ((b.cliente as any)?.numero_documento || '-').padEnd(15);
    const tot = formatearMonto(Number(b.total) || 0).padStart(10);
    const met = (b.metodo_pago || 'efectivo').toUpperCase().padStart(8);

    rpt += `${num} ${hora} ${cliNombre} ${doc} ${tot} ${met}\n`;

    if (b.detalle_ventas && b.detalle_ventas.length > 0) {
      b.detalle_ventas.forEach((d: any) => {
        const c = d.es_granel ? `${Number(d.cantidad).toFixed(2)}L` : `${d.cantidad}u`;
        const nom = d.productos?.nombre || 'Repuesto';
        const st = formatearMonto(Number(d.subtotal) || 0);
        rpt += `   └─ ${c.padEnd(6)} ${nom.padEnd(35)} ${st.padStart(10)}\n`;
      });
    }
    rpt += '\n';
  });

  rpt += '================================================================================\n';
  rpt += '                            FIN DEL REPORTE                                     \n';
  rpt += '================================================================================\n';

  return rpt;
}
