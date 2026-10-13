'use client';

import React, { useState } from 'react';
import { ItemCarritoVenta } from '@/services/ventaService';
import { formatearSoles } from '@/lib/formatters';
import { Droplet, Package, Trash2, Edit3, Check, X } from 'lucide-react';

interface CartItemRowProps {
  item: ItemCarritoVenta;
  index: number;
  stockMaximo?: number;
  onActualizarCantidad: (index: number, nuevaCantidad: number) => void;
  onActualizarPrecio: (index: number, nuevoPrecio: number) => void;
  onEliminar: (index: number) => void;
}

export default function CartItemRow({
  item,
  index,
  stockMaximo,
  onActualizarCantidad,
  onActualizarPrecio,
  onEliminar,
}: CartItemRowProps) {
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [precioInput, setPrecioInput] = useState(item.precio_unitario.toString());

  const handleGuardarPrecio = () => {
    const nuevo = parseFloat(precioInput);
    if (!isNaN(nuevo) && nuevo >= 0) {
      onActualizarPrecio(index, nuevo);
    }
    setEditandoPrecio(false);
  };

  const pasoCantidad = item.es_granel ? 0.25 : 1;
  const alMaximo = stockMaximo !== undefined && item.cantidad >= stockMaximo;

  return (
    <div
      style={{
        padding: '10px 12px',
        backgroundColor: 'var(--hd-elevated)',
        border: '1px solid var(--hd-border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Fila Superior: Nombre del producto, tipo de venta y botón eliminar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {item.es_granel ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  backgroundColor: 'var(--hd-orange-subtle)',
                  color: 'var(--hd-orange)',
                  border: '1px solid var(--hd-orange)',
                  padding: '2px 5px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  textTransform: 'uppercase',
                }}
              >
                <Droplet size={10} />
                Granel ({item.cantidad.toFixed(2)} L)
              </span>
            ) : (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  backgroundColor: 'var(--hd-surface)',
                  color: 'var(--hd-text-muted)',
                  border: '1px solid var(--hd-border)',
                  padding: '2px 5px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  textTransform: 'uppercase',
                }}
              >
                <Package size={10} />
                {item.unidad_medida_venta}
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--hd-text-title)' }}>
              {item.producto.nombre}
            </span>
          </div>
          {item.producto.codigo && (
            <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
              CÓD: {item.producto.codigo}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onEliminar(index)}
          title="Quitar ítem"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--hd-text-dim)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-danger)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--hd-text-dim)')}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Fila Inferior: Controles de Cantidad, Precio Unitario y Subtotal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* Controles de Cantidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => onActualizarCantidad(index, Math.max(pasoCantidad, item.cantidad - pasoCantidad))}
            style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border-strong)',
              color: 'var(--hd-text-title)',
              fontSize: 14,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            -
          </button>

          <span
            style={{
              minWidth: 42,
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 900,
              color: 'var(--hd-text-title)',
            }}
            className="tabular"
          >
            {item.es_granel ? item.cantidad.toFixed(2) : item.cantidad}
          </span>

          <button
            type="button"
            disabled={alMaximo}
            onClick={() => !alMaximo && onActualizarCantidad(index, item.cantidad + pasoCantidad)}
            title={alMaximo ? 'No hay más stock disponible' : 'Aumentar cantidad'}
            style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              backgroundColor: alMaximo ? 'var(--hd-surface)' : 'var(--hd-surface)',
              border: alMaximo ? '1px solid var(--hd-border)' : '1px solid var(--hd-border-strong)',
              color: alMaximo ? 'var(--hd-text-dim)' : 'var(--hd-text-title)',
              fontSize: 14,
              fontWeight: 900,
              cursor: alMaximo ? 'not-allowed' : 'pointer',
              opacity: alMaximo ? 0.35 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>

          {alMaximo && (
            <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--hd-orange)', marginLeft: 2 }}>
              (Máx)
            </span>
          )}
        </div>

        {/* Precio Unitario (Editable para descuentos o tratos) */}
        <div>
          {editandoPrecio ? (
            (() => {
              const costo = Number(item.producto.costo_unitario) || 0;
              const precioNuevoNum = parseFloat(precioInput) || 0;
              const gananciaSoles = precioNuevoNum - costo;
              const margenPct = precioNuevoNum > 0 && costo > 0
                ? ((gananciaSoles / precioNuevoNum) * 100).toFixed(1)
                : costo === 0 ? '100' : '0.0';
              const esBajoCosto = precioNuevoNum < costo;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-dim)' }}>S/</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={precioInput}
                      onChange={(e) => setPrecioInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGuardarPrecio();
                        if (e.key === 'Escape') setEditandoPrecio(false);
                      }}
                      autoFocus
                      style={{
                        width: 72,
                        padding: '4px 6px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 900,
                        backgroundColor: 'var(--hd-input-bg)',
                        border: `1.5px solid ${esBajoCosto ? 'var(--status-danger)' : 'var(--hd-orange)'}`,
                        color: 'var(--hd-text-title)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleGuardarPrecio}
                      title="Guardar nuevo precio"
                      style={{
                        backgroundColor: 'var(--hd-orange)',
                        border: 'none',
                        color: '#FFFFFF',
                        borderRadius: 4,
                        padding: '5px 7px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoPrecio(false)}
                      title="Cancelar"
                      style={{
                        backgroundColor: 'var(--hd-surface)',
                        border: '1px solid var(--hd-border)',
                        color: 'var(--hd-text-dim)',
                        borderRadius: 4,
                        padding: '5px 7px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Margen de Ganancia en vivo */}
                  {costo > 0 && (
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: esBajoCosto ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: esBajoCosto ? 'var(--status-danger)' : 'var(--status-success)',
                        border: `1px solid ${esBajoCosto ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      title={`Costo base: S/ ${costo.toFixed(2)} | Ganancia: S/ ${gananciaSoles.toFixed(2)}`}
                    >
                      {esBajoCosto ? (
                        <span>⚠️ Bajo costo ({margenPct}%)</span>
                      ) : (
                        <span>+{margenPct}% ganancia (+S/ {gananciaSoles.toFixed(2)})</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <button
              type="button"
              onClick={() => {
                setPrecioInput(item.precio_unitario.toString());
                setEditandoPrecio(true);
              }}
              title="Clic para editar precio de venta"
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                color: 'var(--hd-text-title)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--hd-orange)';
                e.currentTarget.style.color = 'var(--hd-orange)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--hd-border)';
                e.currentTarget.style.color = 'var(--hd-text-title)';
              }}
            >
              <span>x {formatearSoles(item.precio_unitario)}</span>
              <Edit3 size={11} color="var(--hd-orange)" />
            </button>
          )}
        </div>

        {/* Subtotal del Ítem */}
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--hd-orange)' }} className="tabular">
            {formatearSoles(item.subtotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
