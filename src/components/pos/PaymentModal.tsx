'use client';

import React, { useState, useEffect } from 'react';
import { MetodoPago, TipoComprobanteVenta, Cliente } from '@/lib/supabase';
import { formatearSoles } from '@/lib/formatters';
import { Banknote, Smartphone, CreditCard, Building2, Clock, Check, X, AlertCircle, AlertTriangle, Users } from 'lucide-react';

interface PaymentModalProps {
  total: number;
  clienteSeleccionado: Cliente | null;
  onCerrar: () => void;
  onConfirmarPago: (datos: {
    metodoPago: MetodoPago;
    tipoComprobante: TipoComprobanteVenta;
    montoRecibido: number;
    vuelto: number;
    montoCredito?: number;
    notas?: string;
  }) => Promise<void>;
  procesando: boolean;
}

export default function PaymentModal({
  total,
  clienteSeleccionado,
  onCerrar,
  onConfirmarPago,
  procesando,
}: PaymentModalProps) {
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [tipoComp, setTipoComp] = useState<TipoComprobanteVenta>('boleta');
  const [montoRecibidoStr, setMontoRecibidoStr] = useState<string>(total.toFixed(2));
  const [pagoACuentaStr, setPagoACuentaStr] = useState<string>('0');
  const [notas, setNotas] = useState<string>('');

  const montoRecibido = parseFloat(montoRecibidoStr) || 0;
  const vuelto = Math.max(0, Number((montoRecibido - total).toFixed(2)));
  const falta = Math.max(0, Number((total - montoRecibido).toFixed(2)));

  // Cálculos de fiado / compra a cuenta
  const deudaActual = Number(clienteSeleccionado?.saldo_deudor) || 0;
  const pagoACuenta = Math.min(total, Math.max(0, parseFloat(pagoACuentaStr) || 0));
  const saldoFiado = Math.max(0, Number((total - pagoACuenta).toFixed(2)));
  const nuevaDeudaTotal = Number((deudaActual + saldoFiado).toFixed(2));

  // Al cambiar a un método digital, el monto recibido es exactamente el total
  useEffect(() => {
    if (metodo !== 'efectivo' && metodo !== 'credito') {
      setMontoRecibidoStr(total.toFixed(2));
    }
  }, [metodo, total]);

  const handleBotonBillete = (monto: number) => {
    setMontoRecibidoStr(monto.toFixed(2));
  };

  const handleSumarBillete = (monto: number) => {
    const actual = parseFloat(montoRecibidoStr) || 0;
    setMontoRecibidoStr((actual + monto).toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (metodo === 'credito') {
      if (!clienteSeleccionado) return;
      await onConfirmarPago({
        metodoPago: 'credito',
        tipoComprobante: tipoComp,
        montoRecibido: pagoACuenta,
        vuelto: 0,
        montoCredito: saldoFiado,
        notas: notas.trim() || undefined,
      });
      return;
    }

    if (metodo === 'efectivo' && montoRecibido < total) {
      return;
    }

    await onConfirmarPago({
      metodoPago: metodo,
      tipoComprobante: tipoComp,
      montoRecibido: metodo === 'efectivo' ? montoRecibido : total,
      vuelto: metodo === 'efectivo' ? vuelto : 0,
      notas: notas.trim() || undefined,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
      onClick={onCerrar}
    >
      <div
        style={{
          backgroundColor: 'var(--hd-surface)',
          border: '2px solid var(--hd-orange)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 540,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'var(--hd-card-header)',
            borderBottom: '1px solid var(--hd-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0 }}>
              Cobro en Mostrador
            </h3>
            <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
              Cliente: {clienteSeleccionado ? clienteSeleccionado.nombre : 'Público General / Al Paso'}
            </span>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--hd-text-dim)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
          {/* TOTAL A PAGAR EN GIGANTE */}
          <div
            style={{
              backgroundColor: 'var(--hd-elevated)',
              border: '1.5px solid var(--hd-orange)',
              borderRadius: 10,
              padding: '14px 18px',
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--hd-text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
              Total a Cobrar
            </span>
            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--hd-orange)', marginTop: 2 }} className="tabular">
              {formatearSoles(total)}
            </div>
          </div>

          {/* MÉTODOS DE PAGO PERUANOS */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Método de Pago:
          </label>

          <div className="pos-payment-methods-grid">
            {[
              { id: 'efectivo' as MetodoPago, label: 'Efectivo', icon: <Banknote size={16} /> },
              { id: 'yape' as MetodoPago, label: 'Yape / Plin', icon: <Smartphone size={16} /> },
              { id: 'tarjeta' as MetodoPago, label: 'Tarjeta', icon: <CreditCard size={16} /> },
              { id: 'transferencia' as MetodoPago, label: 'Transf.', icon: <Building2 size={16} /> },
              { id: 'credito' as MetodoPago, label: 'Al Fiado', icon: <Clock size={16} /> },
            ].map((m) => {
              const activo = metodo === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodo(m.id)}
                  style={{
                    padding: '9px 4px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: activo ? (m.id === 'credito' ? '#A855F7' : 'var(--hd-orange)') : 'var(--hd-elevated)',
                    color: activo ? '#FFFFFF' : 'var(--hd-text-title)',
                    border: activo
                      ? `1.5px solid ${m.id === 'credito' ? '#A855F7' : 'var(--hd-orange)'}`
                      : '1px solid var(--hd-border)',
                    boxShadow: activo ? (m.id === 'credito' ? '0 2px 10px rgba(168, 85, 247, 0.4)' : '0 2px 10px var(--hd-orange-glow)') : 'none',
                  }}
                >
                  {m.icon}
                  <span style={{ fontSize: 10, fontWeight: 800, textAlign: 'center' }}>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* SI ES CRÉDITO / FIADO */}
          {metodo === 'credito' && (
            <div
              style={{
                backgroundColor: 'var(--hd-elevated)',
                border: '1.5px solid #A855F7',
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
              }}
            >
              {!clienteSeleccionado ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--status-danger)' }}>
                  <AlertCircle size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: 12, display: 'block' }}>Cliente no seleccionado</strong>
                    <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>
                      Para vender al crédito debes seleccionar un cliente registrado en la barra superior. El público general no califica a fiado.
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Datos del Cliente */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--hd-border)',
                      paddingBottom: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>
                        Cliente Asignado
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                        {clienteSeleccionado.nombre}
                      </div>
                    </div>
                    {clienteSeleccionado.telefono && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: 'var(--hd-surface)',
                          color: 'var(--hd-text-muted)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--hd-border)',
                        }}
                      >
                        📞 {clienteSeleccionado.telefono}
                      </span>
                    )}
                  </div>

                  {/* Resumen de Compras en Deuda */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ backgroundColor: 'var(--hd-surface)', borderRadius: 6, padding: '8px 10px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>
                        Deuda Anterior Acumulada
                      </span>
                      <div style={{ fontSize: 14, fontWeight: 900, color: deudaActual > 0 ? 'var(--status-danger)' : 'var(--status-success)' }} className="tabular">
                        {formatearSoles(deudaActual)}
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--hd-surface)', borderRadius: 6, padding: '8px 10px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>
                        Compras Pendientes
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: (clienteSeleccionado.compras_pendientes_count || 0) > 0 ? '#F59E0B' : 'var(--status-success)' }}>
                        {(clienteSeleccionado.compras_pendientes_count || 0) > 0
                          ? `🔴 ${clienteSeleccionado.compras_pendientes_count} compra(s)`
                          : '🟢 Al día'}
                      </div>
                    </div>
                  </div>

                  {/* Input Pago a Cuenta */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Pago a Cuenta en Efectivo hoy (Opcional - S/)
                    </label>
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      max={total}
                      placeholder="0.00"
                      value={pagoACuentaStr}
                      onChange={(e) => setPagoACuentaStr(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        backgroundColor: 'var(--hd-input-bg)',
                        border: '1px solid var(--hd-border-strong)',
                        color: 'var(--hd-text-title)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    />
                  </div>

                  {/* Detalle Resultante */}
                  <div
                    style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.08)',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Queda al Fiado en esta compra
                      </span>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#A855F7' }} className="tabular">
                        {formatearSoles(saldoFiado)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Nueva Deuda Total
                      </span>
                      <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--status-danger)' }} className="tabular">
                        {formatearSoles(nuevaDeudaTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SI ES EFECTIVO: BILLETES Y VUELTO */}
          {metodo === 'efectivo' && (
            <div
              style={{
                backgroundColor: 'var(--hd-elevated)',
                border: '1px solid var(--hd-border)',
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
              }}
            >
              {/* Botones de billetes rápidos peruanos */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => handleBotonBillete(total)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    backgroundColor: 'var(--hd-surface)',
                    border: '1px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    cursor: 'pointer',
                  }}
                >
                  Exacto ({formatearSoles(total)})
                </button>

                {[10, 20, 50, 100, 200].map((billete) => (
                  <button
                    key={billete}
                    type="button"
                    onClick={() => handleBotonBillete(billete)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: 'var(--hd-surface)',
                      border: '1px solid var(--hd-border-strong)',
                      color: 'var(--hd-text-title)',
                      cursor: 'pointer',
                    }}
                  >
                    S/ {billete}
                  </button>
                ))}
              </div>

              {/* Input de Monto Recibido */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Monto Recibido (S/)
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={montoRecibidoStr}
                    onChange={(e) => setMontoRecibidoStr(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1.5px solid var(--hd-border-strong)',
                      color: 'var(--hd-text-title)',
                      fontSize: 18,
                      fontWeight: 900,
                    }}
                  />
                </div>

                {/* VUELTO O FALTA */}
                <div style={{ textAlign: 'right' }}>
                  {falta > 0 ? (
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--status-danger)', textTransform: 'uppercase' }}>
                        Falta Recibir
                      </span>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--status-danger)' }} className="tabular">
                        {formatearSoles(falta)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--status-success)', textTransform: 'uppercase' }}>
                        Vuelto a Entregar
                      </span>
                      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--status-success)' }} className="tabular">
                        {formatearSoles(vuelto)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SI ES YAPE / PLIN / DIGITAL: NOTA / OPERACIÓN */}
          {metodo !== 'efectivo' && metodo !== 'credito' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                N° de Operación / Referencia (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Operación Yape #184920"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--hd-input-bg)',
                  border: '1px solid var(--hd-border-strong)',
                  color: 'var(--hd-text-title)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              />
            </div>
          )}

          {/* TIPO DE COMPROBANTE */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              Tipo de Comprobante:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: 'boleta' as TipoComprobanteVenta, label: 'Boleta (B001)', sub: 'SUNAT / Greenter' },
                { id: 'ticket' as TipoComprobanteVenta, label: 'Ticket / Nota', sub: 'Control Interno' },
                { id: 'factura' as TipoComprobanteVenta, label: 'Factura (F001)', sub: 'RUC Empresa' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTipoComp(c.id)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    backgroundColor: tipoComp === c.id ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                    color: tipoComp === c.id ? '#FFFFFF' : 'var(--hd-text-title)',
                    border: tipoComp === c.id ? '1.5px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                    boxShadow: tipoComp === c.id ? '0 2px 10px var(--hd-orange-glow)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 900 }}>{c.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.85, fontWeight: 600 }}>{c.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onCerrar}
              disabled={procesando}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 8,
                backgroundColor: 'transparent',
                border: '1px solid var(--hd-border-strong)',
                color: 'var(--hd-text-dim)',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Volver
            </button>

            <button
              type="submit"
              disabled={
                procesando ||
                (metodo === 'efectivo' && montoRecibido < total) ||
                (metodo === 'credito' && !clienteSeleccionado)
              }
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 8,
                backgroundColor:
                  (metodo === 'efectivo' && montoRecibido < total) ||
                  (metodo === 'credito' && !clienteSeleccionado)
                    ? 'var(--hd-elevated)'
                    : metodo === 'credito'
                    ? '#A855F7'
                    : 'var(--hd-orange)',
                color:
                  (metodo === 'efectivo' && montoRecibido < total) ||
                  (metodo === 'credito' && !clienteSeleccionado)
                    ? 'var(--hd-text-dim)'
                    : '#FFFFFF',
                border: 'none',
                fontSize: 14,
                fontWeight: 900,
                cursor:
                  procesando ||
                  (metodo === 'efectivo' && montoRecibido < total) ||
                  (metodo === 'credito' && !clienteSeleccionado)
                    ? 'not-allowed'
                    : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow:
                  (metodo === 'efectivo' && montoRecibido < total) ||
                  (metodo === 'credito' && !clienteSeleccionado)
                    ? 'none'
                    : metodo === 'credito'
                    ? '0 4px 15px rgba(168, 85, 247, 0.4)'
                    : '0 4px 15px var(--hd-orange-glow)',
              }}
            >
              <Check size={18} strokeWidth={3} />
              <span>
                {procesando
                  ? 'Procesando Venta...'
                  : metodo === 'credito'
                  ? `Confirmar Fiado (${formatearSoles(total)})`
                  : `Confirmar Cobro (${formatearSoles(total)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
