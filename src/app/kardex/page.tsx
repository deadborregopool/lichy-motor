'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Producto, MovimientoKardex, TipoOperacionKardex, TipoStockKardex } from '@/lib/supabase';
import { obtenerProductos } from '@/services/productService';
import {
  obtenerKardexPorProducto,
  obtenerResumenKardex,
  registrarAjusteInventario,
  exportarKardexCsv,
  ResumenKardexProducto,
} from '@/services/kardexService';
import { useAuth } from '@/context/AuthContext';
import { formatearSoles } from '@/lib/formatters';
import { formatearLitros } from '@/lib/conversions';
import { descargarArchivo } from '@/lib/ticketExporter';
import {
  Search,
  Package,
  Droplet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Settings,
  X,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowLeft,
  RotateCcw,
  PackageOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function KardexContent() {
  const searchParams = useSearchParams();
  const productoIdParam = searchParams.get('productoId');
  const { usuarioActual } = useAuth();

  // Estados principales
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoKardex[]>([]);
  const [resumen, setResumen] = useState<ResumenKardexProducto | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [cargandoMovs, setCargandoMovs] = useState<boolean>(false);

  // Buscador de productos
  const [busqueda, setBusqueda] = useState<string>('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todos');
  const [selectorMovilAbierto, setSelectorMovilAbierto] = useState<boolean>(false);

  // Filtros de movimientos
  const [filtroOperacion, setFiltroOperacion] = useState<TipoOperacionKardex | 'TODOS'>('TODOS');
  const [filtroFecha, setFiltroFecha] = useState<'todos' | 'hoy' | 'semana' | 'mes'>('todos');

  // Modal de Ajuste de Inventario
  const [modalAjusteAbierto, setModalAjusteAbierto] = useState<boolean>(false);
  const [tipoStockAjuste, setTipoStockAjuste] = useState<TipoStockKardex>('CERRADO');
  const [nuevoStockAjuste, setNuevoStockAjuste] = useState<string>('');
  const [motivoAjuste, setMotivoAjuste] = useState<string>('');
  const [guardandoAjuste, setGuardandoAjuste] = useState<boolean>(false);

  // Cargar catálogo de productos
  useEffect(() => {
    const cargarCatalogo = async () => {
      try {
        setCargando(true);
        const data = await obtenerProductos();
        setProductos(data);

        // Si hay parámetro en URL, preseleccionar
        if (productoIdParam) {
          const match = data.find((p) => p.id === Number(productoIdParam));
          if (match) setProductoSeleccionado(match);
        } else if (data.length > 0) {
          setProductoSeleccionado(data[0]);
        }
      } finally {
        setCargando(false);
      }
    };
    cargarCatalogo();
  }, [productoIdParam]);

  // Cargar movimientos cuando cambia el producto o los filtros
  const recargarMovimientos = async () => {
    if (!productoSeleccionado) return;
    try {
      setCargandoMovs(true);

      // Calcular fechas para el filtro
      let fechaInicio: string | undefined;
      const hoy = new Date();
      if (filtroFecha === 'hoy') {
        fechaInicio = hoy.toISOString().split('T')[0];
      } else if (filtroFecha === 'semana') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fechaInicio = d.toISOString().split('T')[0];
      } else if (filtroFecha === 'mes') {
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fechaInicio = d.toISOString().split('T')[0];
      }

      const movs = await obtenerKardexPorProducto(productoSeleccionado.id, {
        fechaInicio,
        tipoOperacion: filtroOperacion,
      });

      setMovimientos(movs);

      const res = await obtenerResumenKardex(productoSeleccionado, movs);
      setResumen(res);
    } finally {
      setCargandoMovs(false);
    }
  };

  useEffect(() => {
    recargarMovimientos();
  }, [productoSeleccionado, filtroOperacion, filtroFecha]);

  // Categorías para filtro rápido de selección
  const categorias = useMemo(() => {
    const s = new Set<string>();
    productos.forEach((p) => {
      if (p.categoria) s.add(p.categoria.trim());
    });
    return ['Todos', ...Array.from(s)];
  }, [productos]);

  // Productos filtrados para el selector
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const matchCat = categoriaFiltro === 'Todos' || p.categoria === categoriaFiltro;
      if (!busqueda.trim()) return matchCat;
      const b = busqueda.toLowerCase().trim();
      const matchTerm =
        p.nombre.toLowerCase().includes(b) ||
        (p.codigo && p.codigo.toLowerCase().includes(b)) ||
        (p.categoria && p.categoria.toLowerCase().includes(b));
      return matchCat && matchTerm;
    });
  }, [productos, busqueda, categoriaFiltro]);

  const esAceite = Boolean(
    productoSeleccionado?.categoria &&
    (productoSeleccionado.categoria.toLowerCase().includes('aceite') ||
      productoSeleccionado.categoria.toLowerCase().includes('lubricante')) &&
    productoSeleccionado.unidad_medida !== 'unidad'
  );

  // Exportar a CSV
  const handleExportarCsv = () => {
    if (!productoSeleccionado || movimientos.length === 0) {
      alert('No hay movimientos registrados para exportar.');
      return;
    }
    const csv = exportarKardexCsv(movimientos, productoSeleccionado);
    descargarArchivo(`kardex_${productoSeleccionado.codigo || productoSeleccionado.id}_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  // Imprimir Kardex
  const handleImprimir = () => {
    window.print();
  };

  // Abrir modal de ajuste
  const abrirModalAjuste = (tipo: TipoStockKardex) => {
    if (!productoSeleccionado) return;
    setTipoStockAjuste(tipo);
    const stockActual = tipo === 'CERRADO'
      ? productoSeleccionado.stock_actual
      : productoSeleccionado.volumen_en_uso || 0;
    setNuevoStockAjuste(String(stockActual));
    setMotivoAjuste('');
    setModalAjusteAbierto(true);
  };

  // Guardar ajuste
  const handleGuardarAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoSeleccionado) return;
    const nuevoStockNum = parseFloat(nuevoStockAjuste);
    if (isNaN(nuevoStockNum) || nuevoStockNum < 0) {
      alert('Por favor ingresa un número de stock válido (0 o mayor).');
      return;
    }

    try {
      setGuardandoAjuste(true);
      const res = await registrarAjusteInventario({
        productoId: productoSeleccionado.id,
        tipoStock: tipoStockAjuste,
        nuevoStock: nuevoStockNum,
        motivo: motivoAjuste,
        usuarioNombre: usuarioActual ? usuarioActual.nombre : 'Mostrador',
      });

      if (!res.success) {
        alert(res.error || 'No se pudo registrar el ajuste.');
        return;
      }

      // Actualizar localmente el producto
      setProductoSeleccionado((prev) => {
        if (!prev) return null;
        return tipoStockAjuste === 'CERRADO'
          ? { ...prev, stock_actual: nuevoStockNum }
          : { ...prev, volumen_en_uso: nuevoStockNum };
      });

      // Recargar lista de productos y movimientos
      const prodsActualizados = await obtenerProductos();
      setProductos(prodsActualizados);
      await recargarMovimientos();
      setModalAjusteAbierto(false);
      alert('¡Ajuste de inventario registrado con éxito en el Kardex!');
    } finally {
      setGuardandoAjuste(false);
    }
  };

  return (
    <main className="hd-page-container">
      {/* Cabecera Responsive estilo Harley */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                backgroundColor: 'var(--hd-orange)',
                color: '#FFFFFF',
                padding: '6px 8px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 10px var(--hd-orange-glow)',
              }}
            >
              <Layers size={18} strokeWidth={2.5} />
            </div>
            <h1
              style={{
                fontSize: 'clamp(20px, 4vw, 26px)',
                fontWeight: 900,
                color: 'var(--hd-text-title)',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Kardex & Control de Inventario
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
          <p style={{ color: 'var(--hd-text-muted)', fontSize: 13, marginTop: 4, fontWeight: 500, margin: '4px 0 0 0' }}>
            Auditoría cronológica de compras, ventas mostrador, destapes y ajustes físicos
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: 'auto' }}>
          <button
            type="button"
            onClick={recargarMovimientos}
            title="Recargar movimientos"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: '6px',
              backgroundColor: 'var(--hd-surface)',
              color: 'var(--hd-text-title)',
              border: '1px solid var(--hd-border)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            <RefreshCw size={14} />
            <span>Actualizar</span>
          </button>
          <a
            href="/inventario"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: '6px',
              backgroundColor: 'var(--hd-surface)',
              color: 'var(--hd-text-title)',
              border: '1px solid var(--hd-border)',
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
              textTransform: 'uppercase',
            }}
          >
            <ArrowLeft size={14} color="var(--hd-orange)" />
            <span>Inventario</span>
          </a>
        </div>
      </div>

      {/* Selector Móvil de Producto (Barra Colapsable táctil) */}
      <div
        className="kardex-mobile-selector-trigger"
        onClick={() => setSelectorMovilAbierto(!selectorMovilAbierto)}
        style={{
          backgroundColor: 'var(--hd-surface)',
          border: '1.5px solid var(--hd-orange)',
          borderRadius: 10,
          padding: '12px 14px',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          boxShadow: 'var(--shadow-card)',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              backgroundColor: 'var(--hd-orange-subtle)',
              color: 'var(--hd-orange)',
              padding: '6px 8px',
              borderRadius: 6,
              display: 'flex',
              flexShrink: 0,
            }}
          >
            {productoSeleccionado &&
            productoSeleccionado.categoria &&
            (productoSeleccionado.categoria.toLowerCase().includes('aceite') ||
              productoSeleccionado.categoria.toLowerCase().includes('lubricante')) ? (
              <Droplet size={18} />
            ) : (
              <Package size={18} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--hd-orange)', fontWeight: 800, textTransform: 'uppercase' }}>
              {selectorMovilAbierto ? 'Tocá para cerrar buscador' : 'Producto Seleccionado (Tocar para cambiar)'}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: 'var(--hd-text-title)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {productoSeleccionado ? productoSeleccionado.nombre : 'Seleccionar Producto...'}
            </div>
            {productoSeleccionado && (
              <div style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                Stock: <strong style={{ color: 'var(--hd-text-title)' }}>{productoSeleccionado.stock_actual} {productoSeleccionado.unidad_medida}</strong>
                {Number(productoSeleccionado.volumen_en_uso) > 0 && ` · Balde: ${formatearLitros(Number(productoSeleccionado.volumen_en_uso))}`}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'var(--hd-elevated)',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--hd-border)',
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--hd-orange)',
            flexShrink: 0,
          }}
        >
          <span>{selectorMovilAbierto ? 'Cerrar' : 'Cambiar'}</span>
          {selectorMovilAbierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Grilla Principal: Selector de Producto a la izquierda y Kardex a la derecha */}
      <div className="kardex-main-grid">
        {/* PANEL IZQUIERDO: SELECTOR DE REPUESTO O ACEITE */}
        <div
          className={`kardex-left-panel ${selectorMovilAbierto ? 'kardex-panel-expanded' : 'kardex-panel-collapsed'}`}
          style={{
            backgroundColor: 'var(--hd-surface)',
            border: '1px solid var(--hd-border)',
            borderRadius: 12,
            padding: 16,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--hd-text-title)', textTransform: 'uppercase' }}>
            Seleccionar Producto ({productos.length})
          </div>

          {/* Buscador predictivo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'var(--hd-input-bg)',
              border: '1.5px solid var(--hd-orange)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <Search size={16} color="var(--hd-orange)" />
            <input
              type="text"
              placeholder="Buscar por nombre, código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--hd-text-title)',
                fontSize: 13,
                fontWeight: 600,
              }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro por Categoría */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {categorias.slice(0, 5).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaFiltro(cat)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: categoriaFiltro === cat ? 900 : 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  backgroundColor: categoriaFiltro === cat ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                  color: categoriaFiltro === cat ? '#FFFFFF' : 'var(--hd-text-dim)',
                  border: categoriaFiltro === cat ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lista de selección de productos */}
          {cargando ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 12 }}>
              Cargando catálogo...
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 12 }}>
              No se encontraron repuestos.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 480,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {productosFiltrados.map((p) => {
                const activo = productoSeleccionado?.id === p.id;
                const esP = Boolean(
                  p.categoria &&
                  (p.categoria.toLowerCase().includes('aceite') || p.categoria.toLowerCase().includes('lubricante')) &&
                  p.unidad_medida !== 'unidad'
                );

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setProductoSeleccionado(p);
                      setSelectorMovilAbierto(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: activo ? 'var(--hd-elevated)' : 'transparent',
                      border: activo ? '1.5px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                      boxShadow: activo ? '0 2px 8px var(--hd-orange-glow)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase' }}>
                          {p.categoria || 'Repuesto'}
                        </span>
                        {p.codigo && (
                          <span style={{ fontSize: 9, color: 'var(--hd-orange)', fontWeight: 700 }}>
                            {p.codigo}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: activo ? 'var(--hd-orange)' : 'var(--hd-text-title)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          marginTop: 2,
                        }}
                      >
                        {p.nombre}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                        {p.stock_actual} {p.unidad_medida}
                      </span>
                      {esP && Number(p.volumen_en_uso) > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--hd-orange)', fontWeight: 700 }}>
                          💧 {formatearLitros(Number(p.volumen_en_uso))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PANEL DERECHO: KARDEX DEL PRODUCTO SELECCIONADO */}
        {productoSeleccionado ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            {/* Tarjeta de Identificación y Acciones Rápidas */}
            <div
              className="kardex-card"
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1.5px solid var(--hd-orange)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="kardex-product-header">
                <div className="kardex-product-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        backgroundColor: 'var(--hd-elevated)',
                        color: 'var(--hd-orange)',
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--hd-orange)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {productoSeleccionado.categoria || 'Repuesto'}
                    </span>
                    {productoSeleccionado.codigo && (
                      <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 700 }}>
                        COD: {productoSeleccionado.codigo}
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--hd-text-title)', margin: '6px 0 0' }}>
                    {productoSeleccionado.nombre}
                  </h2>
                </div>

                {/* Botones de Acción: Ajuste, CSV, Imprimir */}
                <div className="kardex-actions-grid">
                  <button
                    type="button"
                    onClick={() => abrirModalAjuste('CERRADO')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: 'var(--hd-elevated)',
                      border: '1px solid var(--hd-border-strong)',
                      color: 'var(--hd-text-title)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                    title="Registrar merma, rotura o ajuste por conteo físico"
                  >
                    <Settings size={13} color="var(--hd-orange)" />
                    <span>Ajustar Stock</span>
                  </button>

                  {esAceite && (
                    <button
                      type="button"
                      onClick={() => abrirModalAjuste('GRANEL')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px solid var(--hd-orange)',
                        color: 'var(--hd-orange)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}
                      title="Ajustar litros reales en el balde abierto"
                    >
                      <Droplet size={13} />
                      <span>Ajustar Balde</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExportarCsv}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: 'var(--hd-elevated)',
                      border: '1px solid var(--hd-border-strong)',
                      color: 'var(--hd-text-title)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                  >
                    <FileSpreadsheet size={13} />
                    <span>CSV / Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleImprimir}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: 'var(--hd-orange)',
                      border: 'none',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                  >
                    <Printer size={13} />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              {/* Tarjetas de Resumen del Kardex (Nivel 1: Métricas Estructurales + Nivel 2: Tráfico) */}
              {resumen && (
                <div>
                  {/* Nivel 1: Cuadrícula de Métricas Principales */}
                  <div className="kardex-kpi-grid">
                    {/* Stock Actual */}
                    <div
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ minHeight: 24, display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', lineHeight: 1.2 }}>
                          Stock Cerrado Actual
                        </span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 4 }}>
                        {resumen.stockActualCerrado}{' '}
                        <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>
                          {productoSeleccionado.unidad_medida}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', marginTop: 2 }}>
                        Unidades intactas
                      </span>
                    </div>

                    {/* Balde Abierto si aplica */}
                    {esAceite && (
                      <div
                        style={{
                          backgroundColor: 'var(--hd-elevated)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          border: '1px solid var(--hd-orange)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ minHeight: 24, display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-orange)', textTransform: 'uppercase', lineHeight: 1.2 }}>
                            Litros en Balde Abierto
                          </span>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--hd-orange)', marginTop: 4 }}>
                          {formatearLitros(resumen.volumenEnUsoGranel)}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--hd-orange)', opacity: 0.8, marginTop: 2 }}>
                          Dispensador activo
                        </span>
                      </div>
                    )}

                    {/* Destapados de Baldes si aplica */}
                    {esAceite && (
                      <div
                        style={{
                          backgroundColor: 'var(--hd-elevated)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          border: '1px solid #3B82F6',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <PackageOpen size={12} color="#3B82F6" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#3B82F6', textTransform: 'uppercase', lineHeight: 1.2 }}>
                            Baldes Destapados
                          </span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#3B82F6' }}>
                            +{resumen.totalDestapesCerrados}{' '}
                            <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 700 }}>
                              {productoSeleccionado.unidad_medida}(s)
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 700, marginTop: 2 }}>
                            +{formatearLitros(resumen.totalLitrosDestapados)} liberados
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Valorización */}
                    <div
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ minHeight: 24, display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', lineHeight: 1.2 }}>
                          Valorización de Stock
                        </span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 4 }} className="tabular">
                        {formatearSoles(resumen.valorizacionCostoTotal)}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', marginTop: 2 }}>
                        Costo estimado
                      </span>
                    </div>
                  </div>

                  {/* Nivel 2: Fila de Flujo de Operaciones (Compras / Ventas / Devolución) */}
                  <div className="kardex-flow-grid">
                    <div
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--status-success)', textTransform: 'uppercase', display: 'block' }}>
                        Compras
                      </span>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--status-success)', marginTop: 2 }}>
                        +{resumen.totalComprasCerradas} <span style={{ fontSize: 10, fontWeight: 700 }}>u</span>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: 'rgba(255, 106, 0, 0.1)',
                        border: '1px solid rgba(255, 106, 0, 0.3)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--hd-orange)', textTransform: 'uppercase', display: 'block' }}>
                        Ventas
                      </span>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-orange)', marginTop: 2 }}>
                        -{resumen.totalVentasCerradas || resumen.totalSalidasCerradas} <span style={{ fontSize: 10, fontWeight: 700 }}>u</span>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: '#A855F7', textTransform: 'uppercase', display: 'block' }}>
                        Devolución
                      </span>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#A855F7', marginTop: 2 }}>
                        +{resumen.totalDevolucionesCerradas} <span style={{ fontSize: 10, fontWeight: 700 }}>u</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filtros de la Tabla de Movimientos */}
            <div
              className="kardex-filters-bar"
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* Filtro por tipo de movimiento */}
              <div
                className="touch-scroll no-scrollbar"
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  paddingBottom: 2,
                  maxWidth: '100%',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--hd-text-dim)',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  Movimiento:
                </span>
                {(['TODOS', 'COMPRA', 'VENTA', 'DESTAPE', 'AJUSTE', 'DEVOLUCION'] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setFiltroOperacion(op)}
                    style={{
                      padding: '5px 9px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: filtroOperacion === op ? 900 : 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      backgroundColor: filtroOperacion === op ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                      color: filtroOperacion === op ? '#FFFFFF' : 'var(--hd-text-dim)',
                      border: filtroOperacion === op ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                    }}
                  >
                    {op === 'DESTAPE' ? 'DESTAPADOS' : op}
                  </button>
                ))}
              </div>

              {/* Filtro por fecha */}
              <div
                className="touch-scroll no-scrollbar"
                style={{
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  paddingBottom: 2,
                }}
              >
                <Calendar size={13} color="var(--hd-text-dim)" style={{ flexShrink: 0 }} />
                {(['todos', 'hoy', 'semana', 'mes'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltroFecha(f)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: filtroFecha === f ? 900 : 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      backgroundColor: filtroFecha === f ? 'var(--hd-elevated)' : 'transparent',
                      color: filtroFecha === f ? 'var(--hd-orange)' : 'var(--hd-text-dim)',
                      border: filtroFecha === f ? '1px solid var(--hd-orange)' : '1px solid transparent',
                      textTransform: 'uppercase',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* TABLA DE MOVIMIENTOS KARDEX */}
            <div
              id="area-kardex-impresion"
              className="kardex-area-impresion"
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {cargandoMovs ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
                  Consultando movimientos en Kardex...
                </div>
              ) : movimientos.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
                  No se registran movimientos para este producto con los filtros seleccionados.
                </div>
              ) : (
                <>
                  {/* VISTA MÓVIL: TARJETAS DE MOVIMIENTO ESTILO STITCH */}
                  <div className="kardex-cards-mobile">
                    {movimientos.map((m) => {
                      const badgeBg =
                        m.tipo_operacion === 'COMPRA'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : m.tipo_operacion === 'VENTA'
                          ? 'rgba(255, 95, 0, 0.15)'
                          : m.tipo_operacion === 'DESTAPE'
                          ? 'rgba(59, 130, 246, 0.15)'
                          : m.tipo_operacion === 'DEVOLUCION'
                          ? 'rgba(168, 85, 247, 0.15)'
                          : 'rgba(234, 179, 8, 0.15)';

                      const badgeColor =
                        m.tipo_operacion === 'COMPRA'
                          ? 'var(--status-success)'
                          : m.tipo_operacion === 'VENTA'
                          ? 'var(--hd-orange)'
                          : m.tipo_operacion === 'DESTAPE'
                          ? '#3B82F6'
                          : m.tipo_operacion === 'DEVOLUCION'
                          ? '#A855F7'
                          : '#EAB308';

                      const esEntrada = Number(m.cantidad_entrada) > 0;
                      const esSalida = Number(m.cantidad_salida) > 0;

                      return (
                        <article
                          key={m.id}
                          style={{
                            backgroundColor: 'var(--hd-elevated)',
                            border: '1px solid var(--hd-border)',
                            borderRadius: 12,
                            padding: 12,
                            boxShadow: 'var(--shadow-card)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          {/* Header: Operación, Comprobante y Fecha */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 900,
                                  textTransform: 'uppercase',
                                  padding: '3px 7px',
                                  borderRadius: 4,
                                  backgroundColor: badgeBg,
                                  color: badgeColor,
                                  border: `1px solid ${badgeColor}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                {m.tipo_operacion === 'DESTAPE' && <PackageOpen size={10} />}
                                {m.tipo_operacion === 'DESTAPE' ? 'DESTAPADO' : m.tipo_operacion}
                              </span>
                              {m.comprobante_numero && (
                                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-title)' }}>
                                  {m.comprobante_numero}
                                </span>
                              )}
                              {m.comprobante_tipo && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: 'var(--hd-text-dim)',
                                    backgroundColor: 'var(--hd-surface)',
                                    padding: '2px 5px',
                                    borderRadius: 4,
                                    border: '1px solid var(--hd-border)',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {m.comprobante_tipo}
                                </span>
                              )}
                            </div>
                            <time style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                              {new Date(m.fecha).toLocaleString('es-PE', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </div>

                          {/* Bloque central en 3 columnas: Tipo Stock | Delta (+/-) | Saldo Resultante */}
                          <div
                            style={{
                              backgroundColor: 'var(--hd-surface)',
                              borderRadius: 8,
                              padding: '8px 10px',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: 6,
                              textAlign: 'center',
                              border: '1px solid var(--hd-border)',
                            }}
                          >
                            <div>
                              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block' }}>
                                Tipo Stock
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: m.tipo_stock === 'GRANEL' ? 'var(--hd-orange)' : 'var(--hd-text-title)', marginTop: 2, display: 'block' }}>
                                {m.tipo_stock === 'GRANEL' ? '💧 Granel' : '📦 Cerrado'}
                              </span>
                            </div>

                            <div style={{ borderLeft: '1px solid var(--hd-border)', borderRight: '1px solid var(--hd-border)' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: esEntrada ? 'var(--status-success)' : esSalida ? 'var(--hd-orange)' : 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block' }}>
                                {esEntrada ? 'Entrada' : esSalida ? 'Salida' : 'Movimiento'}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 900,
                                  color: esEntrada ? 'var(--status-success)' : esSalida ? 'var(--hd-orange)' : 'var(--hd-text-dim)',
                                  marginTop: 2,
                                  display: 'block',
                                }}
                                className="tabular"
                              >
                                {esEntrada ? `+${m.cantidad_entrada}` : esSalida ? `-${m.cantidad_salida}` : '0'}{' '}
                                <span style={{ fontSize: 10 }}>{m.tipo_stock === 'GRANEL' ? 'L' : productoSeleccionado?.unidad_medida || 'u'}</span>
                              </span>
                            </div>

                            <div>
                              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block' }}>
                                Saldo Final
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 2, display: 'block' }} className="tabular">
                                {m.saldo_resultante}{' '}
                                <span style={{ fontSize: 10 }}>{m.tipo_stock === 'GRANEL' ? 'L' : productoSeleccionado?.unidad_medida || 'u'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Pie con Responsable y Motivo */}
                          <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
                            {m.motivo && (
                              <div style={{ color: 'var(--hd-text-muted)', fontSize: 10.5, lineHeight: 1.35, wordBreak: 'break-word' }}>
                                <strong style={{ color: 'var(--hd-text-dim)' }}>Detalle / Motivo:</strong> {m.motivo}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed var(--hd-border)', paddingTop: 6, marginTop: 2 }}>
                              <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 600 }}>Responsable:</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-title)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--hd-orange)' }}></span>
                                {m.usuario_nombre || 'Sistema'}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* VISTA ESCRITORIO: TABLA COMPLETA CORPORATIVA */}
                  <div className="kardex-table-desktop">
                    <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--hd-border)', textAlign: 'left', color: 'var(--hd-text-muted)' }}>
                          <th style={{ padding: '8px 10px', width: 130 }}>Fecha / Hora</th>
                          <th style={{ padding: '8px 10px', width: 100 }}>Operación</th>
                          <th style={{ padding: '8px 10px', width: 95 }}>Tipo Stock</th>
                          <th style={{ padding: '8px 10px', width: 125 }}>Comprobante</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', width: 75 }}>Entrada</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', width: 75 }}>Salida</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', width: 75 }}>Saldo</th>
                          <th style={{ padding: '8px 10px', minWidth: 210 }}>Responsable / Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((m) => {
                          const esEntrada = Number(m.cantidad_entrada) > 0;
                          const badgeBg =
                            m.tipo_operacion === 'COMPRA'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : m.tipo_operacion === 'VENTA'
                              ? 'rgba(255, 95, 0, 0.15)'
                              : m.tipo_operacion === 'DESTAPE'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : m.tipo_operacion === 'DEVOLUCION'
                              ? 'rgba(168, 85, 247, 0.15)'
                              : 'rgba(234, 179, 8, 0.15)';

                          const badgeColor =
                            m.tipo_operacion === 'COMPRA'
                              ? 'var(--status-success)'
                              : m.tipo_operacion === 'VENTA'
                              ? 'var(--hd-orange)'
                              : m.tipo_operacion === 'DESTAPE'
                              ? '#3B82F6'
                              : m.tipo_operacion === 'DEVOLUCION'
                              ? '#A855F7'
                              : '#EAB308';

                          return (
                            <tr key={m.id} style={{ borderBottom: '1px solid var(--hd-border)' }}>
                              <td style={{ padding: '10px 10px', color: 'var(--hd-text-dim)', whiteSpace: 'nowrap' }}>
                                {new Date(m.fecha).toLocaleString('es-PE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>

                              {/* Operación */}
                              <td style={{ padding: '10px 10px' }}>
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    padding: '3px 7px',
                                    borderRadius: 4,
                                    backgroundColor: badgeBg,
                                    color: badgeColor,
                                    border: `1px solid ${badgeColor}`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  {m.tipo_operacion === 'DESTAPE' && <PackageOpen size={10} />}
                                  {m.tipo_operacion === 'DESTAPE' ? 'DESTAPADO' : m.tipo_operacion}
                                </span>
                              </td>

                              {/* Tipo Stock */}
                              <td style={{ padding: '10px 10px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: m.tipo_stock === 'GRANEL' ? 'var(--hd-orange)' : 'var(--hd-text-dim)' }}>
                                  {m.tipo_stock === 'GRANEL' ? '💧 Granel (L)' : '📦 Cerrado'}
                                </span>
                              </td>

                              {/* Comprobante */}
                              <td style={{ padding: '10px 10px', fontWeight: 800, color: 'var(--hd-text-title)' }}>
                                {m.comprobante_numero || '-'}
                                {m.comprobante_tipo && (
                                  <div style={{ fontSize: 9, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                                    {m.comprobante_tipo}
                                  </div>
                                )}
                              </td>

                              {/* Entrada */}
                              <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--status-success)' }} className="tabular">
                                {Number(m.cantidad_entrada) > 0 ? `+${m.cantidad_entrada}` : '-'}
                              </td>

                              {/* Salida */}
                              <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--hd-orange)' }} className="tabular">
                                {Number(m.cantidad_salida) > 0 ? `-${m.cantidad_salida}` : '-'}
                              </td>

                              {/* Saldo Resultante */}
                              <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--hd-text-title)', fontSize: 12 }} className="tabular">
                                {m.saldo_resultante}
                              </td>

                              {/* Motivo / Responsable */}
                              <td style={{ padding: '10px 10px', minWidth: 210 }}>
                                <div style={{ fontWeight: 700, color: 'var(--hd-text-title)' }}>
                                  {m.usuario_nombre || 'Sistema'}
                                </div>
                                {m.motivo && (
                                  <div style={{ fontSize: 10, color: 'var(--hd-text-dim)', marginTop: 2, wordBreak: 'break-word', lineHeight: 1.35 }}>
                                    {m.motivo}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)' }}>
            Selecciona un producto para visualizar su Kardex.
          </div>
        )}
      </div>

      {/* MODAL DE AJUSTE MANUAL DE INVENTARIO */}
      {modalAjusteAbierto && productoSeleccionado && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => setModalAjusteAbierto(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--hd-orange)',
              borderRadius: 12,
              padding: 20,
              maxWidth: 440,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} color="var(--hd-orange)" />
                <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0 }}>
                  Ajuste Manual de Inventario
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAjusteAbierto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--hd-text-dim)', marginBottom: 14 }}>
              Producto:{' '}
              <strong style={{ color: 'var(--hd-text-title)' }}>{productoSeleccionado.nombre}</strong>
            </div>

            <form onSubmit={handleGuardarAjuste} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Tipo de Stock */}
              {esAceite && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', marginBottom: 4 }}>
                    Tipo de Stock a Ajustar:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setTipoStockAjuste('CERRADO')}
                      style={{
                        padding: '8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: tipoStockAjuste === 'CERRADO' ? 900 : 700,
                        backgroundColor: tipoStockAjuste === 'CERRADO' ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                        color: tipoStockAjuste === 'CERRADO' ? '#FFFFFF' : 'var(--hd-text-dim)',
                        border: '1px solid var(--hd-border)',
                        cursor: 'pointer',
                      }}
                    >
                      📦 Envases Cerrados
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoStockAjuste('GRANEL')}
                      style={{
                        padding: '8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: tipoStockAjuste === 'GRANEL' ? 900 : 700,
                        backgroundColor: tipoStockAjuste === 'GRANEL' ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                        color: tipoStockAjuste === 'GRANEL' ? '#FFFFFF' : 'var(--hd-text-dim)',
                        border: '1px solid var(--hd-border)',
                        cursor: 'pointer',
                      }}
                    >
                      💧 Litros en Balde
                    </button>
                  </div>
                </div>
              )}

              {/* Nuevo Stock Físico */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', marginBottom: 4 }}>
                  Nuevo Stock Real {tipoStockAjuste === 'GRANEL' ? '(Litros exactos)' : `(${productoSeleccionado.unidad_medida})`} *
                </label>
                <input
                  type="number"
                  step={tipoStockAjuste === 'GRANEL' ? '0.01' : '1'}
                  min="0"
                  value={nuevoStockAjuste}
                  onChange={(e) => setNuevoStockAjuste(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-orange)',
                    color: 'var(--hd-text-title)',
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                />
              </div>

              {/* Motivo Obligatorio */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', marginBottom: 4 }}>
                  Motivo o Justificación del Ajuste *
                </label>
                <textarea
                  placeholder="Ej. Conteo físico mensual, rotura en taller, garantía o devolución..."
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)}
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                    resize: 'none',
                  }}
                />
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalAjusteAbierto(false)}
                  disabled={guardandoAjuste}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 8,
                    backgroundColor: 'transparent',
                    border: '1px solid var(--hd-border)',
                    color: 'var(--hd-text-dim)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardandoAjuste}
                  style={{
                    flex: 1.5,
                    padding: '10px',
                    borderRadius: 8,
                    backgroundColor: 'var(--hd-orange)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: guardandoAjuste ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px var(--hd-orange-glow)',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{guardandoAjuste ? 'Guardando...' : 'Confirmar Ajuste'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function KardexPage() {
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
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)' }}>Cargando Kardex...</div>}>
        <KardexContent />
      </Suspense>
    </div>
  );
}
