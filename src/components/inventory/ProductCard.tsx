'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Producto } from '@/lib/supabase';
import { LITROS_POR_GALON, LITROS_POR_CUARTO, formatearLitros } from '@/lib/conversions';
import { formatearSoles } from '@/lib/formatters';
import { destaparEnvase } from '@/services/productService';
import { useAuth } from '@/context/AuthContext';
import { Fuel, Package, Edit2, AlertTriangle, CheckCircle2, Droplet, Plus, Layers } from 'lucide-react';

interface ProductCardProps {
  producto: Producto;
  esAdmin: boolean;
  onEditar: (p: Producto) => void;
  onActualizar?: () => void;
}

export default function ProductCard({ producto, esAdmin, onEditar, onActualizar }: ProductCardProps) {
  const { usuarioActual } = useAuth();
  const [destapando, setDestapando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const esAceite =
    producto.categoria?.toLowerCase().includes('aceite') ||
    producto.categoria?.toLowerCase().includes('lubricante') ||
    ['balde', 'galon', 'botella', 'tambor', 'litro'].includes(producto.unidad_medida);

  const stockCerrado = Math.floor(Number(producto.stock_actual) || 0);
  const capacidad = Number(producto.capacidad_envase) || (producto.unidad_medida === 'balde' ? 20 : producto.unidad_medida === 'galon' ? 3.785 : 1);
  const volumenEnUso = Number(producto.volumen_en_uso) || 0;
  const porcentajeNivel = capacidad > 0 ? Math.min(100, Math.max(0, (volumenEnUso / capacidad) * 100)) : 0;

  // Alerta de stock bajo (menos de 1 envase cerrado o menos de 3 piezas)
  const limiteStockBajo = esAceite ? 1 : 3;
  const esStockBajo = stockCerrado <= limiteStockBajo && volumenEnUso <= 0;
  const esAgotado = stockCerrado <= 0 && volumenEnUso <= 0;

  // Margen de ganancia para admin
  const margen =
    producto.precio_venta > 0 && producto.costo_unitario > 0
      ? (((producto.precio_venta - producto.costo_unitario) / producto.precio_venta) * 100).toFixed(1)
      : null;

  const handleConfirmarDestape = async () => {
    if (stockCerrado <= 0) {
      setErrorMsg('Sin envases cerrados');
      return;
    }
    try {
      setDestapando(true);
      setErrorMsg(null);
      await destaparEnvase(producto.id, 1, usuarioActual?.nombre || 'Taller / Inventario');
      setConfirmando(false);
      onActualizar?.();
    } catch (err: any) {
      console.error('Error al destapar envase:', err);
      setErrorMsg(err?.message || 'Error al destapar');
    } finally {
      setDestapando(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--hd-card)',
        border: esStockBajo ? '1px solid var(--status-danger)' : '1px solid var(--hd-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
        transition: 'transform 0.18s ease, border-color 0.18s ease',
      }}
    >
      {/* Barra superior estilo Harley */}
      <div
        style={{
          height: 3,
          backgroundColor: esStockBajo ? 'var(--status-danger)' : 'var(--hd-orange)',
          width: '100%',
        }}
      />

      {/* Contenedor de Imagen o Gráfico de Taller */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 160,
          backgroundColor: 'var(--hd-card-header)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid var(--hd-border)',
        }}
      >
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              color: 'var(--hd-text-dim)',
            }}
          >
            {esAceite ? (
              <Fuel size={42} strokeWidth={1.5} color="var(--hd-orange)" />
            ) : (
              <Package size={42} strokeWidth={1.5} color="var(--hd-text-muted)" />
            )}
            <span
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 700,
                color: 'var(--hd-text-dim)',
              }}
            >
              Foto No Registrada
            </span>
          </div>
        )}

        {/* Badge de Categoría Harley */}
        {producto.categoria && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--hd-text-title)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {producto.categoria}
          </div>
        )}

        {/* Acciones rápidas (Kardex + Editar) */}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, zIndex: 2 }}>
          <Link
            href={`/kardex?productoId=${producto.id}`}
            title="Ver Kardex / Movimientos de inventario"
            style={{
              backgroundColor: 'rgba(26, 26, 26, 0.85)',
              border: '1px solid var(--hd-border-strong)',
              borderRadius: '6px',
              width: 34,
              height: 34,
              color: 'var(--hd-orange)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              backdropFilter: 'blur(4px)',
              transition: 'background-color 0.15s ease, transform 0.15s ease',
            }}
          >
            <Layers size={16} />
          </Link>
          <button
            type="button"
            onClick={() => onEditar(producto)}
            title="Editar repuesto"
            style={{
              backgroundColor: 'rgba(26, 26, 26, 0.85)',
              border: '1px solid var(--hd-border-strong)',
              borderRadius: '6px',
              width: 34,
              height: 34,
              color: 'var(--hd-text-title)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Edit2 size={16} />
          </button>
        </div>
      </div>

      {/* Cuerpo de la tarjeta */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Código de parte SKU */}
        {producto.codigo ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--hd-orange)',
              fontWeight: 800,
              letterSpacing: '0.04em',
              marginBottom: 4,
            }}
          >
            CÓD: {producto.codigo}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', marginBottom: 4, fontWeight: 600 }}>
            SIN CÓDIGO
          </span>
        )}

        {/* Nombre del repuesto */}
        <h4
          style={{
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.3,
            color: 'var(--hd-text-title)',
            marginBottom: 12,
            minHeight: 38,
          }}
        >
          {producto.nombre}
        </h4>

        {/* Indicador de Stock estilo Taller */}
        <div
          style={{
            backgroundColor: 'var(--hd-elevated)',
            border: '1px solid var(--hd-border)',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--hd-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Stock:
            </span>
            <div>
              {esAgotado ? (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--status-danger)',
                    fontWeight: 900,
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    padding: '2px 6px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  Agotado
                </span>
              ) : esStockBajo ? (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--hd-orange)',
                    fontWeight: 900,
                    backgroundColor: 'var(--hd-orange-subtle)',
                    padding: '2px 6px',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  <AlertTriangle size={11} />
                  Bajo Stock
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--status-success)',
                    fontWeight: 800,
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    padding: '2px 6px',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  <CheckCircle2 size={11} />
                  Stock Óptimo
                </span>
              )}
            </div>
          </div>

          {/* Indicador de Stock */}
          {esAceite ? (
            <div>
              {/* Envases Cerrados */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--hd-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Stock Cerrado:
                </span>
                {stockCerrado > 0 && (
                  <div>
                    {confirmando ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: 'var(--hd-elevated)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--hd-orange)',
                        }}
                      >
                        <span style={{ fontSize: 10.5, color: 'var(--hd-orange)', fontWeight: 800 }}>
                          ¿Destapar (+{capacidad}L)?
                        </span>
                        <button
                          type="button"
                          onClick={handleConfirmarDestape}
                          disabled={destapando}
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            padding: '3px 8px',
                            minHeight: 26,
                            backgroundColor: 'var(--hd-orange)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          {destapando ? '...' : 'Sí'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmando(false)}
                          disabled={destapando}
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '3px 8px',
                            minHeight: 26,
                            backgroundColor: 'transparent',
                            color: 'var(--hd-text-dim)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmando(true)}
                        title={`Destapar 1 ${producto.unidad_medida} y sumar ${capacidad}L al balde abierto`}
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 10px',
                          minHeight: 26,
                          backgroundColor: 'var(--hd-orange-subtle)',
                          border: '1px solid var(--hd-orange)',
                          borderRadius: '5px',
                          color: 'var(--hd-orange)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Plus size={12} strokeWidth={3} />
                        <span>+ Destapar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              {errorMsg && (
                <div style={{ fontSize: 10, color: 'var(--status-danger)', fontWeight: 700, marginTop: 2 }}>
                  ⚠️ {errorMsg}
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 900, color: stockCerrado <= 0 ? 'var(--status-danger)' : 'var(--hd-text-title)', marginTop: 2 }} className="tabular">
                {stockCerrado} {producto.unidad_medida}(s) cerrados
              </div>

              {/* Contenedor Abierto / Balde en Uso */}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--hd-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                  <span style={{ color: volumenEnUso > 0 ? 'var(--hd-orange)' : 'var(--hd-text-dim)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Droplet size={12} color={volumenEnUso > 0 ? 'var(--hd-orange)' : 'var(--hd-text-dim)'} />
                    <span>{volumenEnUso > 0 ? 'Balde en Uso:' : 'Sin balde abierto'}</span>
                  </span>
                  <span style={{ fontWeight: 800, color: volumenEnUso > 0 ? 'var(--hd-text-title)' : 'var(--hd-text-dim)' }} className="tabular">
                    {formatearLitros(volumenEnUso)}
                  </span>
                </div>

                {/* Barra medidora */}
                {capacidad > 0 && (
                  <div style={{ marginTop: 4, height: 6, backgroundColor: 'var(--hd-input-bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${porcentajeNivel}%`,
                        backgroundColor: porcentajeNivel > 25 ? 'var(--hd-orange)' : 'var(--status-danger)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                )}

                {/* Equivalencias fraccionadas */}
                {volumenEnUso > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--hd-text-dim)', marginTop: 4, display: 'flex', gap: 6, fontWeight: 600 }}>
                    <span>≈ {(volumenEnUso / LITROS_POR_GALON).toFixed(1)} Gal</span>
                    <span>·</span>
                    <span>≈ {(volumenEnUso / LITROS_POR_CUARTO).toFixed(1)} Cuartos</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Cantidad / Unidades:
              </span>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: esAgotado ? 'var(--status-danger)' : 'var(--hd-text-title)',
                  marginTop: 4,
                }}
                className="tabular"
              >
                {producto.stock_actual} {producto.unidad_medida}(s)
              </div>
            </div>
          )}
        </div>

        {/* Sección de Precios */}
        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--hd-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                Precio Mostrador
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: 'var(--hd-orange)',
                  letterSpacing: '-0.02em',
                }}
                className="tabular"
              >
                {formatearSoles(producto.precio_venta)}
                {esAceite && (
                  <span style={{ fontSize: 11, color: 'var(--hd-text-muted)', fontWeight: 600, marginLeft: 4 }}>
                    /{producto.unidad_medida}
                  </span>
                )}
              </span>
            </div>

            {/* Datos confidenciales para Admin */}
            {esAdmin && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 700 }}>COSTO:</span>
                  <span style={{ fontSize: 11, color: Number(producto.costo_unitario) > 0 ? 'var(--hd-text-body)' : 'var(--hd-text-dim)', fontWeight: 700 }} className="tabular">
                    {Number(producto.costo_unitario) > 0 ? formatearSoles(producto.costo_unitario) : 'Pendiente'}
                  </span>
                </div>
                {Number(producto.costo_unitario) > 0 && margen ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: Number(margen) > 30 ? 'var(--status-success)' : 'var(--status-warning)',
                    }}
                  >
                    +{margen}%
                  </span>
                ) : (
                  <span style={{ fontSize: 9, color: 'var(--hd-text-dim)', fontWeight: 700 }}>
                    Sin compras
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
