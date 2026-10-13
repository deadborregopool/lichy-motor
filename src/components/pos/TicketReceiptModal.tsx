'use client';

import React, { useEffect } from 'react';
import { ItemCarritoVenta } from '@/services/ventaService';
import { Cliente, MetodoPago, TipoComprobanteVenta } from '@/lib/supabase';
import { formatearSoles } from '@/lib/formatters';
import { Printer, Plus, CheckCircle2, Download, AlertTriangle, X } from 'lucide-react';
import { generarTextoTicket, descargarArchivo } from '@/lib/ticketExporter';

interface TicketReceiptModalProps {
  numeroComprobante: string;
  items: ItemCarritoVenta[];
  total: number;
  totalGravada?: number | null;
  totalIgv?: number | null;
  metodoPago: MetodoPago;
  tipoComprobante: TipoComprobanteVenta;
  montoRecibido?: number | null;
  vuelto?: number | null;
  vendedorNombre: string | null;
  cliente: Cliente | null;
  fecha: string;
  onNuevaVenta: () => void;
  esAnulado?: boolean;
  motivoAnulacion?: string | null;
}

export default function TicketReceiptModal({
  numeroComprobante,
  items,
  total,
  totalGravada,
  totalIgv,
  metodoPago,
  tipoComprobante,
  montoRecibido,
  vuelto,
  vendedorNombre,
  cliente,
  fecha,
  onNuevaVenta,
  esAnulado = false,
  motivoAnulacion,
}: TicketReceiptModalProps) {
  const baseGravadaCalculada = totalGravada != null ? Number(totalGravada) : Number((total / 1.18).toFixed(2));
  const igvCalculado = totalIgv != null ? Number(totalIgv) : Number((total - baseGravadaCalculada).toFixed(2));

  const handleImprimir = () => {
    window.print();
  };

  const handleDescargar = () => {
    const texto = generarTextoTicket({
      numeroComprobante,
      nombreComprobante,
      fecha,
      vendedorNombre,
      clienteNombre: cliente?.nombre,
      clienteDoc: (cliente as any)?.numero_documento,
      clienteTelefono: cliente?.telefono,
      items: items.map((i) => ({
        nombre: i.producto.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precio_unitario,
        subtotal: i.subtotal,
        esGranel: i.es_granel,
        unidadMedida: i.unidad_medida_venta,
      })),
      total,
      totalGravada: baseGravadaCalculada,
      totalIgv: igvCalculado,
      metodoPago,
      montoRecibido,
      vuelto,
      esAnulado,
      motivoAnulacion,
    });
    descargarArchivo(`ticket_${numeroComprobante}${esAnulado ? '_ANULADO' : ''}.txt`, texto);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onNuevaVenta();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNuevaVenta]);

  const nombreComprobante =
    tipoComprobante === 'boleta'
      ? 'BOLETA DE VENTA ELECTRÓNICA'
      : tipoComprobante === 'factura'
      ? 'FACTURA ELECTRÓNICA'
      : 'TICKET DE VENTA';

  return (
    <div
      onClick={onNuevaVenta}
      title="Haz clic afuera para cerrar comprobante"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 16,
        cursor: 'pointer',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          maxWidth: 420,
          width: '100%',
          cursor: 'default',
        }}
      >
        {/* Botón flotante para cerrar rápidamente */}
        <button
          type="button"
          onClick={onNuevaVenta}
          title="Cerrar comprobante (Esc)"
          style={{
            position: 'absolute',
            top: -12,
            right: -12,
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: '#1F2937',
            border: '2px solid #4B5563',
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            zIndex: 70,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--hd-orange)';
            e.currentTarget.style.borderColor = 'var(--hd-orange)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1F2937';
            e.currentTarget.style.borderColor = '#4B5563';
          }}
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        {/* Banner Superior de Estado */}
        {esAnulado ? (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid #EF4444',
              borderRadius: 8,
              padding: '10px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              color: '#EF4444',
              fontWeight: 800,
              fontSize: 13,
              width: '100%',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} />
              <span>COMPROBANTE ANULADO (SIN VALOR)</span>
            </div>
            {motivoAnulacion && (
              <div style={{ fontSize: 11, fontWeight: 500, color: '#FCA5A5' }}>
                Motivo: {motivoAnulacion}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1.5px solid var(--status-success)',
              borderRadius: 8,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--status-success)',
              fontWeight: 800,
              fontSize: 13,
              width: '100%',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={18} />
            <span>¡Venta registrada exitosamente!</span>
          </div>
        )}

        {/* TICKET ESTILO PAPEL TÉRMICO (Imprimible) */}
        <div
          id="area-impresion-ticket"
          style={{
            position: 'relative',
            maxHeight: '62vh',
            overflowY: 'auto',
            backgroundColor: '#FFFFFF',
            color: '#111827',
            width: '100%',
            padding: '24px 20px',
            borderRadius: 8,
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
            fontFamily: 'Courier, monospace',
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {/* SELLO DE AGUA / ESTAMPA DE ANULADO */}
          {esAnulado && (
            <div
              style={{
                position: 'absolute',
                top: '46%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-24deg)',
                border: '4px dashed #DC2626',
                backgroundColor: 'rgba(254, 242, 242, 0.92)',
                padding: '10px 24px',
                borderRadius: 10,
                textAlign: 'center',
                zIndex: 25,
                pointerEvents: 'none',
                boxShadow: '0 0 20px rgba(220, 38, 38, 0.35)',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '0.15em', lineHeight: 1, color: '#DC2626' }}>
                ANULADO
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', marginTop: 4, color: '#B91C1C' }}>
                SIN VALOR COMERCIAL
              </div>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#7F1D1D', marginTop: 2 }}>
                STOCK RESTITUIDO AL KARDEX
              </div>
            </div>
          )}

          {/* Encabezado */}
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #9CA3AF', paddingBottom: 10, marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, letterSpacing: '0.05em', color: '#000000' }}>
              LICHY MOTOR
            </h2>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563' }}>
              REPUESTOS & ACEITES DE MOTO
            </div>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
              Av. Principal de Motos - Perú
            </div>

            {/* Aviso impreso de anulación */}
            {esAnulado && (
              <div
                style={{
                  backgroundColor: '#FEE2E2',
                  border: '1.5px solid #DC2626',
                  borderRadius: 4,
                  padding: '6px 8px',
                  marginTop: 8,
                  marginBottom: 4,
                  textAlign: 'center',
                  color: '#991B1B',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.05em' }}>
                  *** COMPROBANTE ANULADO ***
                </div>
                <div style={{ fontSize: 9, fontWeight: 700 }}>
                  NO ENTREGAR MERCADERÍA - VENTA SIN EFECTO
                </div>
                {motivoAnulacion && (
                  <div style={{ fontSize: 9, fontStyle: 'italic', marginTop: 2, color: '#7F1D1D' }}>
                    Motivo: {motivoAnulacion}
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 800, marginTop: 6, color: '#000000' }}>
              {nombreComprobante} {esAnulado ? '(ANULADO)' : ''}
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#000000' }}>
              N° {numeroComprobante}
            </div>
          </div>

          {/* Metadatos */}
          <div style={{ fontSize: 10, borderBottom: '1px dashed #9CA3AF', paddingBottom: 8, marginBottom: 8, color: '#374151' }}>
            <div><strong>Fecha:</strong> {new Date(fecha).toLocaleString('es-PE')}</div>
            <div><strong>Cajero:</strong> {vendedorNombre || 'Atención Mostrador'}</div>
            <div><strong>Cliente:</strong> {cliente ? cliente.nombre : 'PÚBLICO GENERAL'}</div>
            {cliente?.telefono && <div><strong>Teléfono:</strong> {cliente.telefono}</div>}
          </div>

          {/* Tabla de Productos */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000000', textAlign: 'left' }}>
                <th style={{ paddingBottom: 4, width: '40px' }}>Cant</th>
                <th style={{ paddingBottom: 4 }}>Descripción</th>
                <th style={{ paddingBottom: 4, textAlign: 'right', width: '60px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #E5E7EB' }}>
                  <td style={{ verticalAlign: 'top', paddingTop: 4 }}>
                    {item.es_granel ? `${item.cantidad.toFixed(2)}L` : `${item.cantidad}`}
                  </td>
                  <td style={{ verticalAlign: 'top', paddingTop: 4, paddingRight: 4 }}>
                    <div style={{ fontWeight: 700 }}>{item.producto.nombre}</div>
                    <div style={{ fontSize: 9, color: '#6B7280' }}>
                      {item.es_granel ? '(Aceite Granel)' : ''} x {formatearSoles(item.precio_unitario)}
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top', paddingTop: 4, textAlign: 'right', fontWeight: 700 }}>
                    {formatearSoles(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales y Desglose Fiscal SUNAT */}
          <div style={{ borderTop: '1px dashed #000000', paddingTop: 8, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#374151', marginBottom: 2 }}>
              <span>Op. Gravada:</span>
              <span className="tabular">{formatearSoles(baseGravadaCalculada)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#374151', marginBottom: 4 }}>
              <span>I.G.V. (18%):</span>
              <span className="tabular">{formatearSoles(igvCalculado)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 14, borderTop: '1px solid #000000', paddingTop: 4, marginBottom: 4 }}>
              <span>TOTAL A PAGAR:</span>
              <span className="tabular">{formatearSoles(total)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4B5563', marginTop: 4 }}>
              <span>Método de Pago:</span>
              <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                {metodoPago === 'credito' ? 'Al Fiado / Crédito' : metodoPago}
              </span>
            </div>

            {metodoPago === 'credito' && (
              <div style={{ marginTop: 4, padding: '4px 6px', backgroundColor: '#FEF3C7', borderRadius: 4, border: '1px solid #F59E0B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#B45309', fontWeight: 800 }}>
                  <span>Condición:</span>
                  <span>VENTA AL CRÉDITO / FIADO</span>
                </div>
                {Number(montoRecibido) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4B5563' }}>
                    <span>Abono inicial a cuenta:</span>
                    <span>{formatearSoles(Number(montoRecibido))}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#DC2626', fontWeight: 900 }}>
                  <span>Saldo pendiente agregado:</span>
                  <span>{formatearSoles(Math.max(0, total - (Number(montoRecibido) || 0)))}</span>
                </div>
              </div>
            )}

            {metodoPago === 'efectivo' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4B5563' }}>
                  <span>Efectivo Recibido:</span>
                  <span>{formatearSoles(montoRecibido || total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: '#000000' }}>
                  <span>Vuelto Entregado:</span>
                  <span>{formatearSoles(vuelto || 0)}</span>
                </div>
              </>
            )}
          </div>

          {/* Pie de Página */}
          <div style={{ textAlign: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px dashed #9CA3AF', fontSize: 9, color: '#6B7280' }}>
            <div>¡Gracias por su compra!</div>
            <div>Garantía de Repuestos & Taller</div>
            <div>Conserve este comprobante para cualquier cambio.</div>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8, width: '100%' }}>
          <button
            type="button"
            onClick={handleImprimir}
            style={{
              padding: '12px 6px',
              borderRadius: 8,
              backgroundColor: 'var(--hd-elevated)',
              border: '1.5px solid var(--hd-border-strong)',
              color: 'var(--hd-text-title)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Printer size={15} />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={handleDescargar}
            style={{
              padding: '12px 6px',
              borderRadius: 8,
              backgroundColor: 'var(--hd-elevated)',
              border: '1.5px solid var(--hd-orange)',
              color: 'var(--hd-orange)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
            title="Descargar archivo de texto del comprobante para guardar o compartir"
          >
            <Download size={15} />
            <span>Descargar</span>
          </button>

          <button
            type="button"
            onClick={onNuevaVenta}
            style={{
              padding: '12px 6px',
              borderRadius: 8,
              backgroundColor: esAnulado ? '#374151' : 'var(--hd-orange)',
              border: esAnulado ? '1px solid #4B5563' : 'none',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              boxShadow: esAnulado ? 'none' : '0 4px 15px var(--hd-orange-glow)',
            }}
          >
            {esAnulado ? <X size={15} /> : <Plus size={15} strokeWidth={3} />}
            <span>{esAnulado ? 'Cerrar' : 'Nueva Venta'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
