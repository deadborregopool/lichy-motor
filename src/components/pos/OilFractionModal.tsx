'use client';

import React, { useState } from 'react';
import { Producto } from '@/lib/supabase';
import { formatearSoles } from '@/lib/formatters';
import { formatearLitros, LITROS_POR_CUARTO, LITROS_POR_GALON } from '@/lib/conversions';
import { Droplet, Package, AlertCircle, Plus, X, Check } from 'lucide-react';

interface OilFractionModalProps {
  producto: Producto;
  onCerrar: () => void;
  onAgregar: (item: {
    producto: Producto;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    es_granel: boolean;
    unidad_medida_venta: string;
  }) => void;
  onDestaparEnvase?: (productoId: number) => Promise<void>;
  litrosEnCarrito?: number;
  cerradosEnCarrito?: number;
}

export default function OilFractionModal({
  producto,
  onCerrar,
  onAgregar,
  onDestaparEnvase,
  litrosEnCarrito = 0,
  cerradosEnCarrito = 0,
}: OilFractionModalProps) {
  const [modo, setModo] = useState<'granel' | 'cerrado'>('granel');
  const [cantidadCerrado, setCantidadCerrado] = useState<number>(1);
  const [cantidadLitros, setCantidadLitros] = useState<number>(1.0);
  const [destapando, setDestapando] = useState<boolean>(false);

  const capacidad = Number(producto.capacidad_envase) || 1;
  const volumenEnUso = Number(producto.volumen_en_uso) || 0;
  const stockCerrado = Number(producto.stock_actual) || 0;

  // Volumen y stock realmente disponibles restando lo que ya está en el carrito
  const volumenDisponible = Math.max(0, Number((volumenEnUso - litrosEnCarrito).toFixed(3)));
  const stockCerradoDisponible = Math.max(0, stockCerrado - cerradosEnCarrito);

  // Precio por litro proporcional
  const precioPorLitro = capacidad > 0 ? Number((producto.precio_venta / capacidad).toFixed(2)) : producto.precio_venta;

  // Cálculos de subtotal
  const subtotalCerrado = cantidadCerrado * producto.precio_venta;
  const subtotalGranel = Number((cantidadLitros * precioPorLitro).toFixed(2));

  // Validación de volumen y stock
  const faltaVolumen = modo === 'granel' && (cantidadLitros > volumenDisponible || volumenDisponible <= 0);
  const faltaStockCerrado = modo === 'cerrado' && (cantidadCerrado > stockCerradoDisponible || stockCerradoDisponible <= 0);

  const handleConfirmar = () => {
    if (modo === 'cerrado') {
      if (cantidadCerrado <= 0 || faltaStockCerrado) return;
      onAgregar({
        producto,
        cantidad: cantidadCerrado,
        precio_unitario: producto.precio_venta,
        subtotal: subtotalCerrado,
        es_granel: false,
        unidad_medida_venta: producto.unidad_medida || 'unidad',
      });
    } else {
      if (cantidadLitros <= 0 || faltaVolumen) return;
      onAgregar({
        producto,
        cantidad: Number(cantidadLitros.toFixed(3)),
        precio_unitario: precioPorLitro,
        subtotal: subtotalGranel,
        es_granel: true,
        unidad_medida_venta: 'Litro(s)',
      });
    }
  };

  const handleDestapar = async () => {
    if (!onDestaparEnvase || stockCerrado <= 0) return;
    try {
      setDestapando(true);
      await onDestaparEnvase(producto.id);
    } finally {
      setDestapando(false);
    }
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
          maxWidth: 500,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                backgroundColor: 'var(--hd-orange-subtle)',
                color: 'var(--hd-orange)',
                padding: '6px',
                borderRadius: 6,
                display: 'flex',
              }}
            >
              <Droplet size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0 }}>
                {producto.nombre}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                {producto.codigo ? `COD: ${producto.codigo} · ` : ''} Envase de {capacidad}L
              </span>
            </div>
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

        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          {/* Selector de Modo: Granel vs Cerrado */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              onClick={() => setModo('granel')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '12px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: modo === 'granel' ? 'var(--hd-orange-subtle)' : 'var(--hd-elevated)',
                border: modo === 'granel' ? '2px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                color: modo === 'granel' ? 'var(--hd-orange)' : 'var(--hd-text-title)',
              }}
            >
              <Droplet size={20} strokeWidth={2.5} />
              <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>
                A Granel (En Uso)
              </span>
              <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                Disponible: {formatearLitros(volumenEnUso)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setModo('cerrado')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '12px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: modo === 'cerrado' ? 'var(--hd-orange-subtle)' : 'var(--hd-elevated)',
                border: modo === 'cerrado' ? '2px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                color: modo === 'cerrado' ? 'var(--hd-orange)' : 'var(--hd-text-title)',
              }}
            >
              <Package size={20} strokeWidth={2.5} />
              <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>
                Envase Cerrado
              </span>
              <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                Stock: {stockCerrado} {producto.unidad_medida}(s)
              </span>
            </button>
          </div>

          {/* CUERPO SEGÚN EL MODO */}
          {modo === 'granel' ? (
            <div>
              {/* Opciones rápidas de Litros */}
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Selecciona o ingresa la cantidad de Litros:
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                {[
                  { label: '1 Litro', val: 1.0 },
                  { label: `1 Cuarto (${(LITROS_POR_CUARTO).toFixed(2)}L)`, val: Number(LITROS_POR_CUARTO.toFixed(3)) },
                  { label: `1/2 Galón (${(LITROS_POR_GALON / 2).toFixed(2)}L)`, val: Number((LITROS_POR_GALON / 2).toFixed(3)) },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setCantidadLitros(item.val)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: cantidadLitros === item.val ? 900 : 700,
                      cursor: 'pointer',
                      backgroundColor: cantidadLitros === item.val ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                      color: cantidadLitros === item.val ? '#FFFFFF' : 'var(--hd-text-title)',
                      border: cantidadLitros === item.val ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Input manual de Litros */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max={volumenEnUso > 0 ? volumenEnUso : 100}
                    value={cantidadLitros}
                    onChange={(e) => setCantidadLitros(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1.5px solid var(--hd-border-strong)',
                      color: 'var(--hd-text-title)',
                      fontSize: 16,
                      fontWeight: 800,
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--hd-text-title)' }}>
                    Litros
                  </span>
                </div>
              </div>

              {/* Alerta si falta volumen en el balde abierto */}
              {faltaVolumen && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid var(--status-danger)',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-danger)', fontSize: 12, fontWeight: 800 }}>
                    <AlertCircle size={15} />
                    <span>Solo quedan {formatearLitros(volumenEnUso)} en el balde abierto.</span>
                  </div>

                  {stockCerrado > 0 && onDestaparEnvase && (
                    <button
                      type="button"
                      onClick={handleDestapar}
                      disabled={destapando}
                      style={{
                        backgroundColor: 'var(--hd-orange)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Plus size={13} strokeWidth={3} />
                      <span>{destapando ? 'Destapando...' : `Destapar 1 envase nuevo cerrado (+${capacidad}L)`}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Resumen de cálculo por litro */}
              <div
                style={{
                  backgroundColor: 'var(--hd-elevated)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', display: 'block' }}>
                    Precio estimado: {formatearSoles(precioPorLitro)} / L
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--hd-orange)', fontWeight: 700 }}>
                    Se descontará del balde en uso
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    Subtotal Granel
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                    {formatearSoles(subtotalGranel)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Venta de Envase Cerrado */}
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Cantidad de Envases Cerrados:
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setCantidadCerrado((prev) => Math.max(1, prev - 1))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: 'var(--hd-elevated)',
                    border: '1px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 18,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  -
                </button>

                <input
                  type="number"
                  min="1"
                  max={stockCerrado > 0 ? stockCerrado : 99}
                  value={cantidadCerrado}
                  onChange={(e) => setCantidadCerrado(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                />

                <button
                  type="button"
                  onClick={() => setCantidadCerrado((prev) => (stockCerradoDisponible > 0 ? Math.min(stockCerradoDisponible, prev + 1) : prev + 1))}
                  disabled={cantidadCerrado >= stockCerradoDisponible}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: 'var(--hd-elevated)',
                    border: '1px solid var(--hd-border-strong)',
                    color: cantidadCerrado >= stockCerradoDisponible ? 'var(--hd-text-dim)' : 'var(--hd-text-title)',
                    fontSize: 18,
                    fontWeight: 900,
                    cursor: cantidadCerrado >= stockCerradoDisponible ? 'not-allowed' : 'pointer',
                    opacity: cantidadCerrado >= stockCerradoDisponible ? 0.4 : 1,
                  }}
                  title={cantidadCerrado >= stockCerradoDisponible ? 'Límite de stock alcanzado' : 'Aumentar'}
                >
                  +
                </button>
              </div>

              {/* Alerta de Stock Insuficiente Cerrado */}
              {faltaStockCerrado && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid var(--status-danger)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: '#EF4444',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>
                    No hay más stock: Solo {stockCerradoDisponible > 0 ? `quedan ${stockCerradoDisponible}` : 'no quedan'} envase(s) disponible(s) en tienda.
                  </span>
                </div>
              )}

              {/* Resumen cerrado */}
              <div
                style={{
                  backgroundColor: 'var(--hd-elevated)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', display: 'block' }}>
                    Precio unitario: {formatearSoles(producto.precio_venta)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--hd-text-muted)', fontWeight: 700 }}>
                    Se descontará de almacén
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    Subtotal Cerrado
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                    {formatearSoles(subtotalCerrado)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botón de Confirmación */}
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onCerrar}
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
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmar}
              disabled={(modo === 'granel' && faltaVolumen) || (modo === 'cerrado' && faltaStockCerrado)}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 8,
                backgroundColor: ((modo === 'granel' && faltaVolumen) || (modo === 'cerrado' && faltaStockCerrado))
                  ? 'var(--hd-elevated)'
                  : 'var(--hd-orange)',
                color: ((modo === 'granel' && faltaVolumen) || (modo === 'cerrado' && faltaStockCerrado))
                  ? 'var(--hd-text-dim)'
                  : '#FFFFFF',
                border: 'none',
                fontSize: 13,
                fontWeight: 900,
                cursor: ((modo === 'granel' && faltaVolumen) || (modo === 'cerrado' && faltaStockCerrado))
                  ? 'not-allowed'
                  : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: ((modo === 'granel' && faltaVolumen) || (modo === 'cerrado' && faltaStockCerrado))
                  ? 'none'
                  : '0 4px 15px var(--hd-orange-glow)',
              }}
            >
              <Check size={16} strokeWidth={3} />
              <span>
                Agregar {modo === 'granel' ? `${cantidadLitros} L Granel` : `${cantidadCerrado} Envase(s)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
