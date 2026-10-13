'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import ProductCard from '@/components/inventory/ProductCard';
import ProductModal from '@/components/inventory/ProductModal';
import { obtenerProductos } from '@/services/productService';
import { Producto } from '@/lib/supabase';
import { CATEGORIAS_MOTO, CategoriaMoto } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { LITROS_POR_GALON, formatearLitros } from '@/lib/conversions';
import { formatearSoles } from '@/lib/formatters';
import { Plus, Search, Fuel, Package, AlertTriangle, Coins, RefreshCw } from 'lucide-react';

export default function InventarioPage() {
  const { esAdmin } = useAuth();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [busqueda, setBusqueda] = useState<string>('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<CategoriaMoto>('Todos');
  const [soloStockBajo, setSoloStockBajo] = useState<boolean>(false);
  const [soloAceitesAbiertos, setSoloAceitesAbiertos] = useState<boolean>(false);

  // Modal
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null);

  const activarPestanaAceitesAbiertos = () => {
    setSoloAceitesAbiertos(true);
    setSoloStockBajo(false);
    setCategoriaSeleccionada('Todos');
  };

  const seleccionarCategoria = (cat: string) => {
    setCategoriaSeleccionada(cat as any);
    setSoloAceitesAbiertos(false);
  };

  const toggleStockBajo = () => {
    const nuevo = !soloStockBajo;
    setSoloStockBajo(nuevo);
    if (nuevo) {
      setSoloAceitesAbiertos(false);
    }
  };

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const data = await obtenerProductos();
      setProductos(data);
    } catch (err) {
      console.error('Error al cargar catálogo de productos:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Búsqueda instantánea en memoria (0ms de latencia, 60fps)
  const productosFiltrados = useMemo(() => {
    let prods = productos;

    if (categoriaSeleccionada !== 'Todos') {
      prods = prods.filter((p) => p.categoria === categoriaSeleccionada);
    }

    if (soloStockBajo) {
      prods = prods.filter((p) => (Number(p.stock_actual) || 0) <= 3);
    }

    if (soloAceitesAbiertos) {
      prods = prods.filter((p) => (Number(p.volumen_en_uso) || 0) > 0);
    }

    if (!busqueda.trim()) return prods;
    const term = busqueda.toLowerCase().trim();
    return prods.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        (p.codigo && p.codigo.toLowerCase().includes(term)) ||
        (p.categoria && p.categoria.toLowerCase().includes(term))
    );
  }, [productos, busqueda, categoriaSeleccionada, soloStockBajo, soloAceitesAbiertos]);

  // Lista de aceites que tienen envase/balde abierto en uso actualmente
  const aceitesAbiertos = useMemo(() => {
    return productos.filter((p) => (Number(p.volumen_en_uso) || 0) > 0);
  }, [productos]);

  // Categorías combinadas (base estándar + cualquier categoría personalizada creada)
  const listaCategorias = useMemo(() => {
    const setCats = new Set<string>(CATEGORIAS_MOTO);
    productos.forEach((p) => {
      if (p.categoria && p.categoria.trim()) {
        setCats.add(p.categoria.trim());
      }
    });
    return Array.from(setCats);
  }, [productos]);

  // Métricas de Aceite: Litros en uso (abiertos) y Envases cerrados en reserva
  const totalLitrosEnUso = useMemo(() => {
    return productos.reduce((acc, curr) => acc + (Number(curr.volumen_en_uso) || 0), 0);
  }, [productos]);

  const totalEnvasesCerradosAceite = useMemo(() => {
    return productos
      .filter(
        (p) =>
          p.categoria?.toLowerCase().includes('aceite') ||
          p.categoria?.toLowerCase().includes('lubricante') ||
          ['balde', 'galon', 'botella', 'tambor'].includes(p.unidad_medida)
      )
      .reduce((acc, curr) => acc + (Math.floor(Number(curr.stock_actual)) || 0), 0);
  }, [productos]);

  const totalItemsBajoStock = useMemo(() => {
    return productos.filter((p) => {
      const esAceite =
        p.categoria?.toLowerCase().includes('aceite') ||
        p.categoria?.toLowerCase().includes('lubricante') ||
        ['balde', 'galon', 'botella', 'tambor'].includes(p.unidad_medida);
      if (esAceite) {
        return Number(p.stock_actual) <= 1 && (Number(p.volumen_en_uso) || 0) <= 0;
      }
      return Number(p.stock_actual) <= 3;
    }).length;
  }, [productos]);

  const valorTotalInventario = useMemo(() => {
    return productos.reduce((acc, curr) => acc + (Number(curr.costo_unitario) * Number(curr.stock_actual)), 0);
  }, [productos]);

  const abrirModalNuevo = () => {
    setProductoEditar(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (prod: Producto) => {
    setProductoEditar(prod);
    setModalAbierto(true);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--hd-bg)',
        color: 'var(--hd-text-body)',
      }}
    >
      <Navbar />

      <main className="hd-page-container">
        {/* Cabecera Responsive */}
        <div className="inventario-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: 'clamp(20px, 4vw, 26px)',
                  fontWeight: 900,
                  color: 'var(--hd-text-title)',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}
              >
                Inventario de Repuestos
              </h1>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  backgroundColor: 'var(--hd-orange-subtle)',
                  color: 'var(--hd-orange)',
                  border: '1px solid var(--hd-orange)',
                  padding: '2px 7px',
                  borderRadius: 4,
                  letterSpacing: '0.06em',
                }}
              >
                VISTA MOTOS
              </span>
            </div>
            <p style={{ color: 'var(--hd-text-muted)', fontSize: 13, marginTop: 4, fontWeight: 500 }}>
              Stock en vivo, lubricantes en litros y precios de mostrador
            </p>
          </div>

          <div className="inventario-header-actions">
            <button
              type="button"
              onClick={cargarDatos}
              title="Recargar catálogo"
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: '6px',
                padding: '9px 12px',
                color: 'var(--hd-text-title)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} color="var(--hd-orange)" />
              <span className="hide-on-mobile">Actualizar</span>
            </button>

            <button
              type="button"
              onClick={abrirModalNuevo}
              style={{
                background: 'linear-gradient(135deg, var(--hd-orange) 0%, var(--hd-orange-dark) 100%)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                padding: '9px 16px',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: 'var(--shadow-card)',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} strokeWidth={3} />
              <span>+ Nuevo Repuesto</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas Adaptativas (.hd-metrics-grid) */}
        <div className={`hd-metrics-grid ${!esAdmin ? 'cols-3' : ''}`}>
          {/* Total Referencias */}
          <div
            className="metric-card"
            style={{
              backgroundColor: 'var(--hd-surface)',
              borderTop: '3px solid var(--hd-border-strong)',
              borderRight: '1px solid var(--hd-border)',
              borderBottom: '1px solid var(--hd-border)',
              borderLeft: '1px solid var(--hd-border)',
              borderRadius: '8px',
              padding: '14px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--hd-elevated)',
                padding: 8,
                borderRadius: '6px',
                color: 'var(--hd-text-muted)',
                border: '1px solid var(--hd-border)',
                display: 'flex',
              }}
            >
              <Package size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                Total Items
              </span>
              <div className="tabular metric-value" style={{ fontSize: 20, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                {productos.length}
              </div>
            </div>
          </div>

          {/* Aceites en Taller / Baldes Abiertos */}
          <div
            className="metric-card"
            onClick={() => {
              if (soloAceitesAbiertos) {
                setSoloAceitesAbiertos(false);
              } else {
                activarPestanaAceitesAbiertos();
              }
            }}
            title="Clic para ver pestaña de aceites abiertos con sus medidores"
            style={{
              backgroundColor: 'var(--hd-surface)',
              borderTop: '3px solid var(--hd-orange)',
              borderRight: soloAceitesAbiertos ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
              borderBottom: soloAceitesAbiertos ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
              borderLeft: soloAceitesAbiertos ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
              borderRadius: '8px',
              padding: '14px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: soloAceitesAbiertos ? '0 2px 12px var(--hd-orange-glow)' : 'var(--shadow-card)',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
          >
            <div
              style={{
                backgroundColor: soloAceitesAbiertos ? 'var(--hd-orange)' : 'var(--hd-orange-subtle)',
                padding: 8,
                borderRadius: '6px',
                color: soloAceitesAbiertos ? '#FFFFFF' : 'var(--hd-orange)',
                border: '1px solid var(--hd-orange)',
                display: 'flex',
              }}
            >
              <Fuel size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--hd-orange)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                Aceites en Taller
              </span>
              <div className="tabular metric-value" style={{ fontSize: 20, fontWeight: 900, color: 'var(--hd-orange)' }}>
                {aceitesAbiertos.length} {aceitesAbiertos.length === 1 ? 'abierto' : 'abiertos'}
              </div>
              <span style={{ fontSize: 10, color: soloAceitesAbiertos ? 'var(--hd-orange)' : 'var(--hd-text-muted)', fontWeight: 700 }}>
                {soloAceitesAbiertos ? '● Pestaña activa' : '👉 Clic para ver pestaña'}
              </span>
            </div>
          </div>

          {/* Alertas de Stock Bajo */}
          <div
            className="metric-card"
            style={{
              backgroundColor: 'var(--hd-surface)',
              borderTop: totalItemsBajoStock > 0 ? '3px solid var(--status-danger)' : '3px solid var(--status-success)',
              borderRight: '1px solid var(--hd-border)',
              borderBottom: '1px solid var(--hd-border)',
              borderLeft: '1px solid var(--hd-border)',
              borderRadius: '8px',
              padding: '14px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                backgroundColor: totalItemsBajoStock > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                padding: 8,
                borderRadius: '6px',
                color: totalItemsBajoStock > 0 ? 'var(--status-danger)' : 'var(--status-success)',
                border: totalItemsBajoStock > 0 ? '1px solid var(--status-danger)' : '1px solid var(--status-success)',
                display: 'flex',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <span style={{ fontSize: 10, color: totalItemsBajoStock > 0 ? 'var(--status-danger)' : 'var(--status-success)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                Stock Bajo
              </span>
              <div
                className="tabular metric-value"
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: totalItemsBajoStock > 0 ? 'var(--status-danger)' : 'var(--hd-text-title)',
                }}
              >
                {totalItemsBajoStock}
              </div>
            </div>
          </div>

          {/* Capital en Stock (Solo Admin) */}
          {esAdmin && (
            <div
              className="metric-card"
              style={{
                backgroundColor: 'var(--hd-surface)',
                borderTop: '3px solid var(--status-success)',
                borderRight: '1px solid var(--hd-border)',
                borderBottom: '1px solid var(--hd-border)',
                borderLeft: '1px solid var(--hd-border)',
                borderRadius: '8px',
                padding: '14px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  padding: 8,
                  borderRadius: '6px',
                  color: 'var(--status-success)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                }}
              >
                <Coins size={20} />
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--status-success)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                  Capital Stock
                </span>
                <div className="tabular metric-value" style={{ fontSize: 20, fontWeight: 900, color: 'var(--status-success)' }}>
                  {formatearSoles(valorTotalInventario)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Buscador & Categorías */}
        <div
          style={{
            backgroundColor: 'var(--hd-surface)',
            border: '1px solid var(--hd-border)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="inventario-search-controls">
            {/* Buscador */}
            <div className="inventario-search-input-box">
              <Search size={16} color="var(--hd-orange)" />
              <input
                type="text"
                placeholder="Buscar repuesto, SKU (BJ-NGK), etc..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--hd-text-title)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              />
            </div>

            <div className="inventario-filter-toggles">
              {/* Pestaña / Filtro Aceites Abiertos */}
              <button
                type="button"
                onClick={() => {
                  if (soloAceitesAbiertos) {
                    setSoloAceitesAbiertos(false);
                  } else {
                    activarPestanaAceitesAbiertos();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: soloAceitesAbiertos ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                  border: soloAceitesAbiertos ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                  color: soloAceitesAbiertos ? '#FFFFFF' : 'var(--hd-orange)',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: soloAceitesAbiertos ? '0 2px 10px var(--hd-orange-glow)' : 'none',
                }}
              >
                <Fuel size={14} color={soloAceitesAbiertos ? '#FFFFFF' : 'var(--hd-orange)'} />
                <span>Aceites Abiertos ({aceitesAbiertos.length})</span>
              </button>

              {/* Toggle Stock Bajo */}
              <button
                type="button"
                onClick={toggleStockBajo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: soloStockBajo ? 'var(--status-danger)' : 'var(--hd-elevated)',
                  border: soloStockBajo ? '1px solid var(--status-danger)' : '1px solid var(--hd-border)',
                  color: soloStockBajo ? '#FFFFFF' : 'var(--hd-text-muted)',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <AlertTriangle size={14} color={soloStockBajo ? '#FFFFFF' : 'var(--hd-orange)'} />
                <span>Stock Bajo</span>
              </button>
            </div>
          </div>

          {/* Categorías con Scroll Horizontal Táctil */}
          <div
            className="touch-scroll no-scrollbar"
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {listaCategorias.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => seleccionarCategoria(cat)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: 11,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  backgroundColor:
                    !soloAceitesAbiertos && categoriaSeleccionada === cat
                      ? 'var(--hd-orange)'
                      : 'var(--hd-elevated)',
                  color:
                    !soloAceitesAbiertos && categoriaSeleccionada === cat
                      ? '#FFFFFF'
                      : 'var(--hd-text-muted)',
                  border:
                    !soloAceitesAbiertos && categoriaSeleccionada === cat
                      ? '1px solid var(--hd-orange)'
                      : '1px solid var(--hd-border)',
                  boxShadow:
                    !soloAceitesAbiertos && categoriaSeleccionada === cat
                      ? '0 2px 10px var(--hd-orange-glow)'
                      : 'none',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Panel Especial para Pestaña de Aceites Abiertos en Taller */}
        {soloAceitesAbiertos && (
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              borderTop: '1px solid var(--hd-orange)',
              borderRight: '1px solid var(--hd-orange)',
              borderBottom: '1px solid var(--hd-orange)',
              borderLeft: '4px solid var(--hd-orange)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: 20,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: aceitesAbiertos.length > 0 ? 14 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    backgroundColor: 'var(--hd-orange-subtle)',
                    padding: 8,
                    borderRadius: '6px',
                    color: 'var(--hd-orange)',
                    border: '1px solid var(--hd-orange)',
                    display: 'flex',
                  }}
                >
                  <Fuel size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: 'var(--hd-text-title)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      margin: 0,
                    }}
                  >
                    Pestaña: Baldes y Aceites Abiertos en Taller
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--hd-text-muted)', margin: '3px 0 0', fontWeight: 500 }}>
                    Monitoreo independiente de litros disponibles por cada variedad en uso. Cada aceite se despacha de su propio envase.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSoloAceitesAbiertos(false)}
                style={{
                  backgroundColor: 'var(--hd-elevated)',
                  border: '1px solid var(--hd-border)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'var(--hd-text-dim)',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                ✕ Ver Catálogo Completo
              </button>
            </div>

            {/* Fichas rápidas de cada aceite abierto */}
            {aceitesAbiertos.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                  gap: 10,
                  paddingTop: 12,
                  borderTop: '1px dashed var(--hd-border)',
                }}
              >
                {aceitesAbiertos.map((prod) => {
                  const cap =
                    Number(prod.capacidad_envase) ||
                    (prod.unidad_medida === 'balde' ? 20 : prod.unidad_medida === 'galon' ? 3.785 : 1);
                  const vol = Number(prod.volumen_en_uso) || 0;
                  const pct = cap > 0 ? Math.round((vol / cap) * 100) : 0;
                  return (
                    <div
                      key={prod.id}
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px solid var(--hd-border)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: 'var(--hd-text-title)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 160,
                          }}
                        >
                          {prod.nombre}
                        </span>
                        <span
                          style={{ fontSize: 12, fontWeight: 900, color: 'var(--hd-orange)' }}
                          className="tabular"
                        >
                          {formatearLitros(vol)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          backgroundColor: 'var(--hd-input-bg)',
                          borderRadius: 3,
                          overflow: 'hidden',
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: pct > 25 ? 'var(--hd-orange)' : 'var(--status-danger)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 10,
                          color: 'var(--hd-text-dim)',
                          fontWeight: 600,
                        }}
                      >
                        <span>Envase: {cap}L ({pct}%)</span>
                        <span>Reserva: {Math.floor(Number(prod.stock_actual))} cerrados</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Grilla Adaptativa de Productos */}
        {cargando ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: 'var(--hd-text-muted)',
              gap: 12,
            }}
          >
            <RefreshCw size={28} color="var(--hd-orange)" className="animate-spin" />
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Cargando catálogo...
            </span>
          </div>
        ) : soloAceitesAbiertos && productosFiltrados.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '50px 16px',
              backgroundColor: 'var(--hd-surface)',
              border: '2px dashed var(--hd-border-strong)',
              borderRadius: '10px',
            }}
          >
            <Fuel size={42} color="var(--hd-orange)" style={{ marginBottom: 10 }} />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--hd-text-title)', textTransform: 'uppercase', marginBottom: 6 }}>
              No hay envases de aceite abiertos
            </h3>
            <p style={{ color: 'var(--hd-text-dim)', fontSize: 13, maxWidth: 420, margin: '0 auto 16px' }}>
              Todos los aceites se encuentran actualmente sellados en almacén. Puedes destapar un balde o botella desde la sección de Aceites & Lubricantes.
            </p>
            <button
              type="button"
              onClick={() => {
                setSoloAceitesAbiertos(false);
                setCategoriaSeleccionada('Aceites & Lubricantes');
              }}
              style={{
                backgroundColor: 'var(--hd-orange)',
                color: '#FFFFFF',
                padding: '9px 18px',
                borderRadius: '6px',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px var(--hd-orange-glow)',
              }}
            >
              Ir a Aceites & Lubricantes
            </button>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '50px 16px',
              backgroundColor: 'var(--hd-surface)',
              border: '2px dashed var(--hd-border-strong)',
              borderRadius: '10px',
            }}
          >
            <Package size={40} color="var(--hd-text-dim)" style={{ marginBottom: 10 }} />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--hd-text-title)', textTransform: 'uppercase', marginBottom: 6 }}>
              Sin repuestos encontrados
            </h3>
            <p style={{ color: 'var(--hd-text-dim)', fontSize: 13, maxWidth: 360, margin: '0 auto 16px' }}>
              {busqueda
                ? `No hay coincidencias para "${busqueda}".`
                : 'Aún no hay repuestos registrados en esta categoría.'}
            </p>
            <button
              type="button"
              onClick={abrirModalNuevo}
              style={{
                backgroundColor: 'var(--hd-orange)',
                color: '#FFFFFF',
                padding: '9px 18px',
                borderRadius: '6px',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px var(--hd-orange-glow)',
              }}
            >
              + Agregar Repuesto
            </button>
          </div>
        ) : (
          <div className="hd-products-grid">
            {productosFiltrados.map((p) => (
              <ProductCard
                key={p.id}
                producto={p}
                esAdmin={esAdmin}
                onEditar={abrirModalEditar}
                onActualizar={cargarDatos}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal Crear / Editar */}
      <ProductModal
        abierto={modalAbierto}
        productoEditar={productoEditar}
        esAdmin={esAdmin}
        onCerrar={() => setModalAbierto(false)}
        onGuardadoExitoso={cargarDatos}
      />
    </div>
  );
}
