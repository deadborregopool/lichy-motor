'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import ProductModal from '@/components/inventory/ProductModal';
import { obtenerProductos } from '@/services/productService';
import {
  obtenerDistribuidores,
  crearDistribuidor,
  actualizarDistribuidor,
  DatosCrearProveedor,
} from '@/services/distribuidorService';
import {
  registrarCompra,
  calcularCostoPromedio,
  obtenerHistorialCompras,
  ItemEntradaCompra,
  CompraConDetalles,
} from '@/services/compraService';
import { Producto, Proveedor } from '@/lib/supabase';
import { formatearSoles } from '@/lib/formatters';
import confetti from 'canvas-confetti';
import {
  Truck,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Phone,
  MessageSquare,
  Building2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Package,
  History,
  X,
  ExternalLink,
  Edit2,
  Sparkles,
  Layers,
  Check,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';

type TabCompras = 'entrada' | 'distribuidores' | 'historial';

export default function ComprasPage() {
  const [tabActiva, setTabActiva] = useState<TabCompras>('entrada');

  // Datos base
  const [productos, setProductos] = useState<Producto[]>([]);
  const [distribuidores, setDistribuidores] = useState<Proveedor[]>([]);
  const [historialCompras, setHistorialCompras] = useState<CompraConDetalles[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // Formulario Entrada de Mercadería
  const [distribuidorSeleccionadoId, setDistribuidorSeleccionadoId] = useState<number | ''>('');
  const [tipoComprobante, setTipoComprobante] = useState<string>('factura');
  const [numeroComprobante, setNumeroComprobante] = useState<string>('');
  const [notasEntrada, setNotasEntrada] = useState<string>('');
  const [itemsEntrada, setItemsEntrada] = useState<ItemEntradaCompra[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState<string>('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todos');
  const [panelCatalogoAbierto, setPanelCatalogoAbierto] = useState<boolean>(false);
  const [limiteCatalogo, setLimiteCatalogo] = useState<number>(5);
  const [guardandoCompra, setGuardandoCompra] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorCompra, setErrorCompra] = useState<string | null>(null);

  // Modal Distribuidor (Crear / Editar)
  const [modalDistribuidorAbierto, setModalDistribuidorAbierto] = useState<boolean>(false);
  const [distribuidorEditar, setDistribuidorEditar] = useState<Proveedor | null>(null);
  const [formDistribuidor, setFormDistribuidor] = useState<DatosCrearProveedor>({
    nombre: '',
    empresa: '',
    ruc: '',
    telefono: '',
    contacto: '',
    direccion: '',
  });
  const [guardandoDistribuidor, setGuardandoDistribuidor] = useState<boolean>(false);
  const [busquedaDistribuidor, setBusquedaDistribuidor] = useState<string>('');

  // Modal Crear Producto desde Compras
  const [modalProductoAbierto, setModalProductoAbierto] = useState<boolean>(false);

  // Filtro en Historial
  const [filtroDistribuidorHistorial, setFiltroDistribuidorHistorial] = useState<number | ''>('');
  const [busquedaHistorial, setBusquedaHistorial] = useState<string>('');

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [prodsData, distsData, histData] = await Promise.all([
        obtenerProductos(),
        obtenerDistribuidores(),
        obtenerHistorialCompras(50),
      ]);
      setProductos(prodsData);
      setDistribuidores(distsData);
      setHistorialCompras(histData);
    } catch (err) {
      console.error('Error al cargar datos de compras:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Distribuidor Comodín para compras casuales sin RUC
  const distribuidorComodin = useMemo(() => {
    return distribuidores.find(
      (d) =>
        d.id === 4 ||
        d.nombre.toLowerCase().includes('casual') ||
        d.nombre.toLowerCase().includes('viaje') ||
        d.empresa?.toLowerCase().includes('sin ruc') ||
        d.ruc === null
    );
  }, [distribuidores]);

  // Proveedor seleccionado actualmente
  const proveedorActual = useMemo(() => {
    if (!distribuidorSeleccionadoId) return null;
    return distribuidores.find((d) => d.id === distribuidorSeleccionadoId) || null;
  }, [distribuidores, distribuidorSeleccionadoId]);

  // Categorías disponibles a partir de productos existentes
  const categoriasDisponibles = useMemo(() => {
    const cats = new Set<string>();
    productos.forEach((p) => {
      if (p.categoria) cats.add(p.categoria.trim());
    });
    return ['Todos', ...Array.from(cats)];
  }, [productos]);

  // Productos sugeridos en el buscador predictivo
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const matchCat =
        categoriaFiltro === 'Todos' ||
        (p.categoria && p.categoria.toLowerCase() === categoriaFiltro.toLowerCase());

      if (!busquedaProducto.trim()) return matchCat;

      const term = busquedaProducto.toLowerCase().trim();
      const matchTerm =
        p.nombre.toLowerCase().includes(term) ||
        (p.codigo && p.codigo.toLowerCase().includes(term)) ||
        (p.categoria && p.categoria.toLowerCase().includes(term));

      return matchCat && matchTerm;
    });
  }, [productos, busquedaProducto, categoriaFiltro]);

  const catalogoVisible = useMemo(() => {
    return panelCatalogoAbierto || busquedaProducto.trim().length > 0 || categoriaFiltro !== 'Todos';
  }, [panelCatalogoAbierto, busquedaProducto, categoriaFiltro]);

  const productosSugeridos = useMemo(() => {
    if (!catalogoVisible) return [];
    return productosFiltrados.slice(0, limiteCatalogo);
  }, [productosFiltrados, catalogoVisible, limiteCatalogo]);

  const cerrarPanelCatalogo = () => {
    setPanelCatalogoAbierto(false);
    setCategoriaFiltro('Todos');
    setBusquedaProducto('');
    setLimiteCatalogo(5);
  };

  // Distribuidores filtrados para pestaña de directorio
  const distribuidoresFiltrados = useMemo(() => {
    if (!busquedaDistribuidor.trim()) return distribuidores;
    const term = busquedaDistribuidor.toLowerCase().trim();
    return distribuidores.filter(
      (d) =>
        d.nombre.toLowerCase().includes(term) ||
        (d.empresa && d.empresa.toLowerCase().includes(term)) ||
        (d.ruc && d.ruc.includes(term)) ||
        (d.contacto && d.contacto.toLowerCase().includes(term))
    );
  }, [distribuidores, busquedaDistribuidor]);

  // Historial filtrado
  const historialFiltrado = useMemo(() => {
    return historialCompras.filter((compra) => {
      const matchDist =
        !filtroDistribuidorHistorial || compra.proveedor_id === filtroDistribuidorHistorial;

      if (!busquedaHistorial.trim()) return matchDist;

      const term = busquedaHistorial.toLowerCase().trim();
      const matchTerm =
        (compra.numero_comprobante && compra.numero_comprobante.toLowerCase().includes(term)) ||
        (compra.proveedores?.nombre && compra.proveedores.nombre.toLowerCase().includes(term)) ||
        (compra.notas && compra.notas.toLowerCase().includes(term)) ||
        (compra.detalle_compras &&
          compra.detalle_compras.some((d) =>
            d.productos?.nombre?.toLowerCase().includes(term)
          ));

      return matchDist && matchTerm;
    });
  }, [historialCompras, filtroDistribuidorHistorial, busquedaHistorial]);

  // Seleccionar proveedor con 1 clic (y preconfigurar comprobante si es casual)
  const seleccionarProveedor = (id: number) => {
    setDistribuidorSeleccionadoId(id);
    if (distribuidorComodin && id === distribuidorComodin.id) {
      setTipoComprobante('nota');
      if (!numeroComprobante) {
        setNumeroComprobante(`CAS-${new Date().toLocaleDateString('es-PE').replace(/\//g, '')}`);
      }
    } else {
      if (tipoComprobante === 'nota') {
        setTipoComprobante('factura');
      }
    }
  };

  // Agregar ítem al carrito de entrada
  // Agregar ítem al carrito de entrada
  const agregarItemAEntrada = (prod: Producto) => {
    const yaExisteIndex = itemsEntrada.findIndex((it) => it.producto_id === prod.id);

    if (yaExisteIndex >= 0) {
      const it = itemsEntrada[yaExisteIndex];
      if (it.modo_empaque === 'cajas') {
        actualizarItemCampo(yaExisteIndex, { cajas: (it.cajas || 1) + 1 });
      } else {
        actualizarItemCampo(yaExisteIndex, { cantidad: it.cantidad + 1 });
      }
      setBusquedaProducto('');
      return;
    }

    const defaultUnidPorCaja =
      prod.unidad_medida === 'litro' || prod.unidad_medida === 'botella' ? 12 : 10;
    const costoUnit = Number(prod.costo_unitario) || 0;
    const precioVentaActual = Number(prod.precio_venta) || 0;

    const nuevoItem: ItemEntradaCompra = {
      producto_id: prod.id,
      producto_nombre: prod.nombre,
      unidad_medida: prod.unidad_medida,
      stock_actual: Number(prod.stock_actual) || 0,
      costo_actual: costoUnit,
      precio_venta_actual: precioVentaActual,
      nuevo_precio_venta: precioVentaActual,
      modo_empaque: 'unidades',
      cajas: 1,
      unidades_por_caja: defaultUnidPorCaja,
      costo_por_caja: costoUnit > 0 ? Number((costoUnit * defaultUnidPorCaja).toFixed(2)) : 0,
      cantidad: 1,
      costo_unitario: costoUnit,
      subtotal: costoUnit,
    };

    setItemsEntrada([nuevoItem, ...itemsEntrada]);
    setBusquedaProducto('');
  };

  // Actualizar ítem con soporte para unidades o cajas y recálculo bidireccional
  const actualizarItemCampo = (index: number, cambios: Partial<ItemEntradaCompra>) => {
    const copia = [...itemsEntrada];
    const it = { ...copia[index], ...cambios };

    if (it.modo_empaque === 'cajas') {
      const c = Math.max(1, Number(it.cajas) || 1);
      const uPorCaja = Math.max(1, Number(it.unidades_por_caja) || 1);
      it.cajas = c;
      it.unidades_por_caja = uPorCaja;
      it.cantidad = c * uPorCaja;

      if ('costo_por_caja' in cambios) {
        const cCaja = Math.max(0, Number(it.costo_por_caja) || 0);
        it.costo_por_caja = cCaja;
        it.costo_unitario = Number((cCaja / uPorCaja).toFixed(2));
      } else if ('costo_unitario' in cambios) {
        const cUnit = Math.max(0, Number(it.costo_unitario) || 0);
        it.costo_unitario = cUnit;
        it.costo_por_caja = Number((cUnit * uPorCaja).toFixed(2));
      } else {
        it.costo_por_caja = Number(((it.costo_unitario || 0) * uPorCaja).toFixed(2));
      }

      it.subtotal = Number((it.cantidad * it.costo_unitario).toFixed(2));
    } else {
      it.cantidad = Math.max(1, Number(it.cantidad) || 1);
      it.costo_unitario = Math.max(0, Number(it.costo_unitario) || 0);
      it.subtotal = Number((it.cantidad * it.costo_unitario).toFixed(2));
    }

    copia[index] = it;
    setItemsEntrada(copia);
  };

  const eliminarItem = (index: number) => {
    setItemsEntrada(itemsEntrada.filter((_, idx) => idx !== index));
  };

  const totalGeneralEntrada = useMemo(() => {
    return itemsEntrada.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
  }, [itemsEntrada]);

  const totalUnidadesEntrada = useMemo(() => {
    return itemsEntrada.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
  }, [itemsEntrada]);

  // Enviar formulario de compra
  const handleGuardarCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCompra(null);
    setMensajeExito(null);

    if (!distribuidorSeleccionadoId) {
      setErrorCompra('Por favor, selecciona quién vendió la mercadería (o usa Compra Casual).');
      return;
    }

    if (itemsEntrada.length === 0) {
      setErrorCompra('Agrega al menos un repuesto o lubricante a la lista de entrada.');
      return;
    }

    try {
      setGuardandoCompra(true);
      const provSel = distribuidores.find((d) => d.id === Number(distribuidorSeleccionadoId));
      await registrarCompra({
        proveedor_id: Number(distribuidorSeleccionadoId),
        proveedor_nombre: provSel?.empresa || provSel?.nombre,
        tipo_comprobante: tipoComprobante,
        numero_comprobante: numeroComprobante,
        notas: notasEntrada,
        items: itemsEntrada,
      });

      // Efecto visual de éxito
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF5E00', '#FFFFFF', '#10B981'],
        });
      } catch (e) {}

      setMensajeExito(
        `¡Entrada confirmada con éxito! Se cargaron ${totalUnidadesEntrada} unidades al inventario y se recalcularon los costos promedio fidedignos.`
      );

      // Limpiar formulario de entrada
      setItemsEntrada([]);
      setNumeroComprobante('');
      setNotasEntrada('');
      await cargarDatos();
    } catch (err: any) {
      console.error('Error al guardar compra:', err);
      setErrorCompra(err?.message || 'Error al procesar la entrada de mercadería.');
    } finally {
      setGuardandoCompra(false);
    }
  };

  // Modal Distribuidor Handlers
  const abrirModalCrearDistribuidor = () => {
    setDistribuidorEditar(null);
    setFormDistribuidor({
      nombre: '',
      empresa: '',
      ruc: '',
      telefono: '',
      contacto: '',
      direccion: '',
    });
    setModalDistribuidorAbierto(true);
  };

  const abrirModalEditarDistribuidor = (dist: Proveedor) => {
    setDistribuidorEditar(dist);
    setFormDistribuidor({
      nombre: dist.nombre,
      empresa: dist.empresa || '',
      ruc: dist.ruc || '',
      telefono: dist.telefono || '',
      contacto: dist.contacto || '',
      direccion: dist.direccion || '',
    });
    setModalDistribuidorAbierto(true);
  };

  const handleGuardarDistribuidor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDistribuidor.nombre.trim()) return;

    try {
      setGuardandoDistribuidor(true);
      if (distribuidorEditar) {
        await actualizarDistribuidor(distribuidorEditar.id, formDistribuidor);
      } else {
        const nuevo = await crearDistribuidor(formDistribuidor);
        setDistribuidorSeleccionadoId(nuevo.id);
      }
      setModalDistribuidorAbierto(false);
      await cargarDatos();
    } catch (err) {
      console.error('Error al guardar distribuidor:', err);
    } finally {
      setGuardandoDistribuidor(false);
    }
  };

  // Acción rápida desde el directorio para ir a registrar compra con ese distribuidor
  const iniciarEntradaParaDistribuidor = (distId: number) => {
    setDistribuidorSeleccionadoId(distId);
    setTabActiva('entrada');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        {/* Cabecera Principal con Identidad Harley y Botones de Acción */}
        <div className="compras-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
                Entradas & Distribuidores
              </h1>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  backgroundColor: 'var(--hd-orange-subtle)',
                  color: 'var(--hd-orange)',
                  border: '1px solid var(--hd-orange)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  letterSpacing: '0.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sparkles size={13} />
                <span>CPP AUTOMÁTICO</span>
              </span>
            </div>
            <p style={{ color: 'var(--hd-text-muted)', fontSize: 13, marginTop: 4, fontWeight: 500 }}>
              Ingreso de stock, control de facturas de distribuidores y compras casuales
            </p>
          </div>

          {/* Acciones Rápidas en la Cabecera */}
          <div className="compras-header-actions">
            <button
              type="button"
              onClick={() => setModalProductoAbierto(true)}
              style={{
                backgroundColor: 'var(--hd-elevated)',
                color: 'var(--hd-text-title)',
                border: '1px solid var(--hd-border-strong)',
                borderRadius: '6px',
                padding: '9px 14px',
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
              title="Registrar una pieza nueva en el catálogo si aún no existe"
            >
              <Plus size={15} color="var(--hd-orange)" strokeWidth={3} />
              <span>+ Nuevo Repuesto</span>
            </button>

            <button
              type="button"
              onClick={abrirModalCrearDistribuidor}
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
              <Plus size={15} strokeWidth={3} />
              <span>+ Nuevo Distribuidor</span>
            </button>
          </div>
        </div>

        {/* Barra de Pestañas con Contadores Dinámicos */}
        <div
          className="touch-scroll no-scrollbar"
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 22,
            borderBottom: '1px solid var(--hd-border)',
            paddingBottom: 10,
            overflowX: 'auto',
            flexWrap: 'nowrap',
          }}
        >
          <button
            type="button"
            onClick={() => setTabActiva('entrada')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: '6px',
              fontSize: 12,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              backgroundColor: tabActiva === 'entrada' ? 'var(--hd-orange)' : 'var(--hd-elevated)',
              color: tabActiva === 'entrada' ? '#FFFFFF' : 'var(--hd-text-muted)',
              border: tabActiva === 'entrada' ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
              boxShadow: tabActiva === 'entrada' ? '0 2px 10px var(--hd-orange-glow)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Truck size={16} />
            <span>Registrar Entrada (Stock)</span>
            {itemsEntrada.length > 0 && (
              <span
                style={{
                  backgroundColor: tabActiva === 'entrada' ? '#FFFFFF' : 'var(--hd-orange)',
                  color: tabActiva === 'entrada' ? 'var(--hd-orange)' : '#FFFFFF',
                  borderRadius: 999,
                  padding: '2px 7px',
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                {itemsEntrada.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('distribuidores')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: '6px',
              fontSize: 12,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              backgroundColor: tabActiva === 'distribuidores' ? 'var(--hd-orange)' : 'var(--hd-elevated)',
              color: tabActiva === 'distribuidores' ? '#FFFFFF' : 'var(--hd-text-muted)',
              border: tabActiva === 'distribuidores' ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
              boxShadow: tabActiva === 'distribuidores' ? '0 2px 10px var(--hd-orange-glow)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Building2 size={16} />
            <span>Directorio Distribuidores ({distribuidores.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('historial')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: '6px',
              fontSize: 12,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              backgroundColor: tabActiva === 'historial' ? 'var(--hd-orange)' : 'var(--hd-elevated)',
              color: tabActiva === 'historial' ? '#FFFFFF' : 'var(--hd-text-muted)',
              border: tabActiva === 'historial' ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
              boxShadow: tabActiva === 'historial' ? '0 2px 10px var(--hd-orange-glow)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <History size={16} />
            <span>Historial de Entradas ({historialCompras.length})</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* PESTAÑA 1: REGISTRAR ENTRADA DE MERCADERÍA                    */}
        {/* ============================================================ */}
        {tabActiva === 'entrada' && (
          <div>
            {mensajeExito && (
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid var(--status-success)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  color: 'var(--status-success)',
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={20} />
                  <span>{mensajeExito}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMensajeExito(null)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {errorCompra && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--status-danger)',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  color: 'var(--status-danger)',
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={20} />
                  <span>{errorCompra}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorCompra(null)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Layout de 2 Columnas: Izquierda Selección & Guía / Derecha Resumen & Confirmación */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 20,
                alignItems: 'start',
              }}
            >
              {/* COLUMNA IZQUIERDA: Formulario Interactivo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>

                {/* PASO 1: SELECCIÓN VISUAL DEL PROVEEDOR */}
                <div
                  style={{
                    backgroundColor: 'var(--hd-surface)',
                    border: '1px solid var(--hd-border)',
                    borderRadius: '10px',
                    padding: '16px',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          backgroundColor: 'var(--hd-orange)',
                          color: '#FFFFFF',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        1
                      </span>
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          color: 'var(--hd-text-title)',
                          letterSpacing: '0.04em',
                          margin: 0,
                        }}
                      >
                        ¿Quién te vendió la mercadería?
                      </h3>
                    </div>

                    {proveedorActual && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--hd-orange)',
                          backgroundColor: 'var(--hd-orange-subtle)',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        ✓ Proveedor Seleccionado
                      </span>
                    )}
                  </div>

                  {/* Fila de Chips Rápidos de Distribuidores */}
                  <div className="compras-chips-distribuidores touch-scroll no-scrollbar">
                    {/* Tarjeta Prominente Comodín: Compras Casuales Trujillo */}
                    {distribuidorComodin && (
                      <button
                        type="button"
                        onClick={() => seleccionarProveedor(distribuidorComodin.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          backgroundColor:
                            distribuidorSeleccionadoId === distribuidorComodin.id
                              ? 'var(--hd-orange)'
                              : 'var(--hd-orange-subtle)',
                          color:
                            distribuidorSeleccionadoId === distribuidorComodin.id
                              ? '#FFFFFF'
                              : 'var(--hd-orange)',
                          border: '1.5px solid var(--hd-orange)',
                          boxShadow:
                            distribuidorSeleccionadoId === distribuidorComodin.id
                              ? '0 2px 10px var(--hd-orange-glow)'
                              : 'none',
                        }}
                      >
                        <span>⚡</span>
                        <span>Compra Casual (Sin RUC)</span>
                      </button>
                    )}

                    {/* Chips de Distribuidores Frecuentes */}
                    {distribuidores
                      .filter((d) => d.id !== distribuidorComodin?.id)
                      .map((d) => {
                        const seleccionado = distribuidorSeleccionadoId === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => seleccionarProveedor(d.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: 12,
                              fontWeight: seleccionado ? 900 : 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              backgroundColor: seleccionado ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                              color: seleccionado ? '#FFFFFF' : 'var(--hd-text-title)',
                              border: seleccionado ? '1.5px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                              boxShadow: seleccionado ? '0 2px 8px var(--hd-orange-glow)' : 'none',
                            }}
                          >
                            <Building2 size={13} color={seleccionado ? '#FFFFFF' : 'var(--hd-orange)'} />
                            <span>{d.nombre}</span>
                            {d.ruc && (
                              <span
                                style={{
                                  fontSize: 10,
                                  opacity: seleccionado ? 0.85 : 0.6,
                                  fontWeight: 600,
                                }}
                              >
                                ({d.ruc.slice(-4)})
                              </span>
                            )}
                          </button>
                        );
                      })}

                    {/* Botón rápido para agregar distribuidor nuevo */}
                    <button
                      type="button"
                      onClick={abrirModalCrearDistribuidor}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: 11,
                        fontWeight: 800,
                        backgroundColor: 'transparent',
                        color: 'var(--hd-text-dim)',
                        border: '1px dashed var(--hd-border-strong)',
                        cursor: 'pointer',
                      }}
                      title="Registrar un nuevo distribuidor"
                    >
                      <Plus size={13} />
                      <span>Otro Proveedor</span>
                    </button>
                  </div>

                  {/* Datos del Comprobante (Factura / Boleta / Guía) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
                      gap: 12,
                      paddingTop: 12,
                      borderTop: '1px solid var(--hd-border)',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Comprobante *
                      </label>
                      <select
                        value={tipoComprobante}
                        onChange={(e) => setTipoComprobante(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--hd-input-bg)',
                          border: '1px solid var(--hd-border-strong)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          color: 'var(--hd-text-title)',
                          fontSize: 12,
                          fontWeight: 700,
                          outline: 'none',
                        }}
                      >
                        <option value="factura">Factura Electrónica</option>
                        <option value="boleta">Boleta de Venta</option>
                        <option value="guia">Guía de Remisión</option>
                        <option value="nota">Nota de Entrada / Sin Comprobante</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                        N° Comprobante / Guía
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. F001-004821 o N° Nota"
                        value={numeroComprobante}
                        onChange={(e) => setNumeroComprobante(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--hd-input-bg)',
                          border: '1px solid var(--hd-border-strong)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          color: 'var(--hd-text-title)',
                          fontSize: 12,
                          fontWeight: 700,
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Notas / Transporte (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Incluye flete, pedido especial"
                        value={notasEntrada}
                        onChange={(e) => setNotasEntrada(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--hd-input-bg)',
                          border: '1px solid var(--hd-border-strong)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          color: 'var(--hd-text-title)',
                          fontSize: 12,
                          fontWeight: 500,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* PASO 2: BUSCADOR ÁGIL CON CATEGORÍAS RÁPIDAS Y SUGERENCIAS */}
                <div
                  style={{
                    backgroundColor: 'var(--hd-surface)',
                    border: '1px solid var(--hd-border)',
                    borderRadius: '10px',
                    padding: '16px',
                    boxShadow: 'var(--shadow-card)',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          backgroundColor: 'var(--hd-orange)',
                          color: '#FFFFFF',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        2
                      </span>
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          color: 'var(--hd-text-title)',
                          letterSpacing: '0.04em',
                          margin: 0,
                        }}
                      >
                        ¿Qué repuestos o aceites llegaron?
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setModalProductoAbierto(true)}
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--hd-orange)',
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Plus size={13} strokeWidth={3} />
                      <span>¿Es un repuesto nuevo? Créalo aquí</span>
                    </button>
                  </div>

                  {/* Píldoras de Categoría para Navegación Rápida */}
                  <div
                    className="touch-scroll no-scrollbar"
                    style={{
                      display: 'flex',
                      gap: 6,
                      overflowX: 'auto',
                      paddingBottom: 8,
                      marginBottom: 10,
                      flexWrap: 'nowrap',
                    }}
                  >
                    {categoriasDisponibles.map((cat) => {
                      const activo = categoriaFiltro === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategoriaFiltro(cat);
                            setLimiteCatalogo(5);
                            if (cat !== 'Todos') {
                              setPanelCatalogoAbierto(true);
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: activo ? 800 : 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            backgroundColor: activo ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                            color: activo ? '#FFFFFF' : 'var(--hd-text-dim)',
                            border: activo ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                          }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>

                  {/* Input de Búsqueda Predictiva */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1.5px solid var(--hd-orange)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                    }}
                  >
                    <Search size={18} color="var(--hd-orange)" />
                    <input
                      type="text"
                      placeholder="Escribe el nombre o código COD (ej. Mobil, Bujía, Pastillas, Cadena)..."
                      value={busquedaProducto}
                      onChange={(e) => {
                        setBusquedaProducto(e.target.value);
                        setLimiteCatalogo(5);
                        if (e.target.value.trim().length > 0) {
                          setPanelCatalogoAbierto(true);
                        }
                      }}
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
                    {busquedaProducto && (
                      <button
                        type="button"
                        onClick={() => setBusquedaProducto('')}
                        style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer' }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Estado colapsado: botón para desplegar fijo si está en 'Todos' */}
                  {!catalogoVisible && (
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px dashed var(--hd-border)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                        💡 Selecciona una categoría arriba o escribe en el buscador para ver los repuestos (máx. 5 por vista).
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPanelCatalogoAbierto(true);
                          setLimiteCatalogo(5);
                        }}
                        style={{
                          backgroundColor: 'var(--hd-surface)',
                          border: '1px solid var(--hd-border-strong)',
                          color: 'var(--hd-text-title)',
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Package size={13} color="var(--hd-orange)" />
                        <span>Ver Repuestos (Fijo)</span>
                      </button>
                    </div>
                  )}

                  {/* Catálogo Desplegable Fijo (Integrado en el flujo, no tapa la pantalla) */}
                  {catalogoVisible && (
                    <div
                      style={{
                        marginTop: 12,
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1.5px solid var(--hd-orange)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                      }}
                    >
                      {/* Cabecera del panel fijo con botón [✕ Cerrar lista] */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: 'var(--hd-card-header)',
                          borderBottom: '1px solid var(--hd-border)',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Package size={15} color="var(--hd-orange)" />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: 'var(--hd-text-title)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {categoriaFiltro === 'Todos'
                              ? busquedaProducto.trim()
                                ? `Búsqueda: "${busquedaProducto}"`
                                : 'Todos los Repuestos'
                              : `Categoría: ${categoriaFiltro}`}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: 'var(--hd-orange)',
                              backgroundColor: 'var(--hd-orange-subtle)',
                              padding: '2px 8px',
                              borderRadius: 999,
                            }}
                          >
                            Mostrando {Math.min(limiteCatalogo, productosFiltrados.length)} de {productosFiltrados.length}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={cerrarPanelCatalogo}
                          title="Cerrar lista de productos"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            color: 'var(--status-danger)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '5px',
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          <X size={14} strokeWidth={2.5} />
                          <span>✕ Cerrar lista</span>
                        </button>
                      </div>

                      {/* Lista de repuestos (máximo 5 por vista para no saturar) */}
                      {productosSugeridos.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 12 }}>
                          No se encontraron repuestos con ese filtro o búsqueda.
                        </div>
                      ) : (
                        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                          {productosSugeridos.map((prod) => (
                            <div
                              key={prod.id}
                              style={{
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--hd-border)',
                                transition: 'background 0.15s ease',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--hd-text-title)' }}>
                                  {prod.nombre}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--hd-text-dim)', marginTop: 2 }}>
                                  {prod.codigo ? `CÓD: ${prod.codigo} · ` : ''}
                                  Stock actual:{' '}
                                  <strong style={{ color: 'var(--hd-text-title)' }}>
                                    {prod.stock_actual} {prod.unidad_medida}(s)
                                  </strong>{' '}
                                  · Costo reg.: {prod.costo_unitario > 0 ? formatearSoles(prod.costo_unitario) : 'Pendiente'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => agregarItemAEntrada(prod)}
                                style={{
                                  backgroundColor: 'var(--hd-orange)',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: 11,
                                  fontWeight: 900,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  cursor: 'pointer',
                                }}
                              >
                                <Plus size={14} strokeWidth={3} />
                                <span>+ Agregar</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botón Ver 5 Más si la categoría o búsqueda tiene más repuestos */}
                      {productosFiltrados.length > limiteCatalogo && (
                        <div style={{ padding: '8px 14px', backgroundColor: 'var(--hd-card-header)', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setLimiteCatalogo((prev) => prev + 5)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: 'var(--hd-orange)',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            + Ver 5 repuestos más ({productosFiltrados.length - limiteCatalogo} restantes)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PASO 3: GUÍA DE RECEPCIÓN / LISTA DE ÍTEMS ENTRANTES */}
                <div
                  style={{
                    backgroundColor: 'var(--hd-surface)',
                    border: '1px solid var(--hd-border)',
                    borderRadius: '10px',
                    padding: '16px',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          backgroundColor: 'var(--hd-orange)',
                          color: '#FFFFFF',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        3
                      </span>
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          color: 'var(--hd-text-title)',
                          letterSpacing: '0.04em',
                          margin: 0,
                        }}
                      >
                        Guía de Recepción ({itemsEntrada.length} {itemsEntrada.length === 1 ? 'ítem' : 'ítems'})
                      </h3>
                    </div>

                    {itemsEntrada.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setItemsEntrada([])}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--hd-text-dim)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Vaciar lista
                      </button>
                    )}
                  </div>

                  {itemsEntrada.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '45px 16px',
                        border: '2px dashed var(--hd-border)',
                        borderRadius: '8px',
                        color: 'var(--hd-text-dim)',
                      }}
                    >
                      <Package size={40} color="var(--hd-text-dim)" style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--hd-text-title)' }}>
                        Ningún repuesto añadido todavía
                      </div>
                      <p style={{ fontSize: 12, marginTop: 4, maxWidth: 360, margin: '6px auto 0' }}>
                        Usa el buscador arriba o haz clic en las categorías para ir sumando los repuestos y aceites de tu factura.
                      </p>
                    </div>
                  ) : (
                    /* Tarjetas Compactas de Recepción con Controles Táctiles */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {itemsEntrada.map((it, idx) => {
                        const esModoCaja = it.modo_empaque === 'cajas';
                        const costoSubio = it.costo_actual > 0 && it.costo_unitario > it.costo_actual;
                        const costoBajo = it.costo_actual > 0 && it.costo_unitario < it.costo_actual;
                        const esPrimeraCompra = it.costo_actual === 0;

                        const precioVentaEfectivo = Number(it.nuevo_precio_venta) || Number(it.precio_venta_actual) || 0;
                        const gananciaEstimada = precioVentaEfectivo - it.costo_unitario;
                        const margenEstimadoPorc = precioVentaEfectivo > 0
                          ? ((gananciaEstimada / precioVentaEfectivo) * 100).toFixed(1)
                          : '0';

                        // Alerta si el costo subió o el margen es estrecho (< 20%) o es primera compra
                        const requiereAlertaPrecio =
                          costoSubio || esPrimeraCompra || (precioVentaEfectivo > 0 && Number(margenEstimadoPorc) < 20);

                        return (
                          <div
                            key={it.producto_id}
                            style={{
                              backgroundColor: 'var(--hd-elevated)',
                              border: costoSubio
                                ? '1.5px solid var(--hd-orange)'
                                : '1px solid var(--hd-border)',
                              borderRadius: '8px',
                              padding: '14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12,
                            }}
                          >
                            {/* Fila Superior: Nombre del Repuesto, Switch Unidades/Cajas y Botón Quitar */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: 10,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                                  {it.producto_nombre}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--hd-text-dim)', marginTop: 2 }}>
                                  Stock en tienda: <strong style={{ color: 'var(--hd-text-title)' }}>{it.stock_actual} {it.unidad_medida}(s)</strong> · Costo anterior: {it.costo_actual > 0 ? formatearSoles(it.costo_actual) : 'S/ 0.00 (Pendiente)'} · Precio mostrador: {formatearSoles(it.precio_venta_actual || 0)}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {/* Switch Unidades / Por Caja */}
                                <div
                                  style={{
                                    display: 'flex',
                                    backgroundColor: 'var(--hd-surface)',
                                    borderRadius: '6px',
                                    padding: '2px',
                                    border: '1px solid var(--hd-border)',
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => actualizarItemCampo(idx, { modo_empaque: 'unidades' })}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: 11,
                                      fontWeight: !esModoCaja ? 900 : 600,
                                      backgroundColor: !esModoCaja ? 'var(--hd-orange)' : 'transparent',
                                      color: !esModoCaja ? '#FFFFFF' : 'var(--hd-text-dim)',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🔹 Unidades
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      actualizarItemCampo(idx, {
                                        modo_empaque: 'cajas',
                                        cajas: it.cajas || 1,
                                        unidades_por_caja: it.unidades_por_caja || 12,
                                      })
                                    }
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: 11,
                                      fontWeight: esModoCaja ? 900 : 600,
                                      backgroundColor: esModoCaja ? 'var(--hd-orange)' : 'transparent',
                                      color: esModoCaja ? '#FFFFFF' : 'var(--hd-text-dim)',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    📦 Por Caja
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => eliminarItem(idx)}
                                  title="Quitar de la lista"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--hd-text-dim)',
                                    cursor: 'pointer',
                                    padding: 4,
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Fila Media: Controles Dinámicos según Modo (Unidades vs Cajas) */}
                            {esModoCaja ? (
                              <div
                                style={{
                                  backgroundColor: 'var(--hd-surface)',
                                  borderRadius: '6px',
                                  padding: '10px 12px',
                                  border: '1px solid var(--hd-border)',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                    gap: 12,
                                    alignItems: 'center',
                                  }}
                                >
                                  {/* Cajas Recibidas */}
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                      N° de Cajas
                                    </span>
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        backgroundColor: 'var(--hd-input-bg)',
                                        border: '1px solid var(--hd-border-strong)',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        width: '100%',
                                        maxWidth: 120,
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => actualizarItemCampo(idx, { cajas: (it.cajas || 1) - 1 })}
                                        style={{
                                          backgroundColor: 'transparent',
                                          border: 'none',
                                          color: 'var(--hd-text-title)',
                                          padding: '6px 10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        <Minus size={13} strokeWidth={2.5} />
                                      </button>
                                      <input
                                        type="number"
                                        min="1"
                                        value={it.cajas || 1}
                                        onChange={(e) =>
                                          actualizarItemCampo(idx, { cajas: parseFloat(e.target.value) || 1 })
                                        }
                                        style={{
                                          width: '100%',
                                          textAlign: 'center',
                                          background: 'none',
                                          border: 'none',
                                          outline: 'none',
                                          color: 'var(--hd-text-title)',
                                          fontSize: 13,
                                          fontWeight: 900,
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => actualizarItemCampo(idx, { cajas: (it.cajas || 1) + 1 })}
                                        style={{
                                          backgroundColor: 'transparent',
                                          border: 'none',
                                          color: 'var(--hd-text-title)',
                                          padding: '6px 10px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        <Plus size={13} strokeWidth={2.5} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Unidades por Caja */}
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                      Unid. por Caja
                                    </span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={it.unidades_por_caja || 12}
                                      onChange={(e) =>
                                        actualizarItemCampo(idx, {
                                          unidades_por_caja: parseFloat(e.target.value) || 1,
                                        })
                                      }
                                      style={{
                                        width: '100%',
                                        maxWidth: 110,
                                        textAlign: 'center',
                                        backgroundColor: 'var(--hd-input-bg)',
                                        border: '1px solid var(--hd-border-strong)',
                                        borderRadius: '6px',
                                        padding: '6px 8px',
                                        color: 'var(--hd-text-title)',
                                        fontSize: 13,
                                        fontWeight: 800,
                                        outline: 'none',
                                      }}
                                    />
                                  </div>

                                  {/* Costo por Caja Completa */}
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                      Costo por Caja (S/)
                                    </span>
                                    <div style={{ position: 'relative', width: '100%', maxWidth: 130 }}>
                                      <span style={{ position: 'absolute', left: 8, top: 6, fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 800 }}>
                                        S/
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={it.costo_por_caja || ''}
                                        onChange={(e) =>
                                          actualizarItemCampo(idx, {
                                            costo_por_caja: parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        placeholder="0.00"
                                        style={{
                                          width: '100%',
                                          textAlign: 'right',
                                          backgroundColor: 'var(--hd-input-bg)',
                                          border: '1px solid var(--hd-border-strong)',
                                          borderRadius: '6px',
                                          padding: '6px 8px 6px 26px',
                                          color: 'var(--hd-text-title)',
                                          fontSize: 13,
                                          fontWeight: 800,
                                          outline: 'none',
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Subtotal de Cajas */}
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                      Subtotal
                                    </span>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--hd-orange)' }} className="tabular">
                                      {formatearSoles(it.subtotal)}
                                    </div>
                                  </div>
                                </div>

                                {/* Píldora de Resultado del Desglose de Caja */}
                                <div
                                  style={{
                                    marginTop: 8,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--hd-text-body)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <span>💡</span>
                                  <span>
                                    {it.cajas || 1} Cajas × {it.unidades_por_caja || 12} unid ={' '}
                                    <strong style={{ color: 'var(--hd-text-title)' }}>
                                      {it.cantidad} {it.unidad_medida}(s) que van al stock
                                    </strong>{' '}
                                    a <strong style={{ color: 'var(--hd-orange)' }}>{formatearSoles(it.costo_unitario)} c/u</strong>
                                  </span>
                                </div>
                              </div>
                            ) : (
                              /* Modo Unidades Sueltas */
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 12,
                                  paddingTop: 4,
                                }}
                              >
                                {/* Stepper Cantidad Recibida */}
                                <div>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                    Cantidad recibida
                                  </span>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      backgroundColor: 'var(--hd-input-bg)',
                                      border: '1px solid var(--hd-border-strong)',
                                      borderRadius: '6px',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => actualizarItemCampo(idx, { cantidad: it.cantidad - 1 })}
                                      style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: 'var(--hd-text-title)',
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Minus size={13} strokeWidth={2.5} />
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={it.cantidad}
                                      onChange={(e) =>
                                        actualizarItemCampo(idx, { cantidad: parseFloat(e.target.value) || 1 })
                                      }
                                      style={{
                                        width: 46,
                                        textAlign: 'center',
                                        background: 'none',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'var(--hd-text-title)',
                                        fontSize: 13,
                                        fontWeight: 900,
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => actualizarItemCampo(idx, { cantidad: it.cantidad + 1 })}
                                      style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: 'var(--hd-text-title)',
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Plus size={13} strokeWidth={2.5} />
                                    </button>
                                  </div>
                                </div>

                                {/* Costo Unitario de Compra */}
                                <div>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                    Costo factura (S/)
                                  </span>
                                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 110 }}>
                                    <span style={{ position: 'absolute', left: 8, fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 800 }}>
                                      S/
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={it.costo_unitario}
                                      onChange={(e) =>
                                        actualizarItemCampo(idx, {
                                          costo_unitario: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      style={{
                                        width: '100%',
                                        textAlign: 'right',
                                        backgroundColor: 'var(--hd-input-bg)',
                                        border: '1px solid var(--hd-border-strong)',
                                        borderRadius: '6px',
                                        padding: '6px 8px 6px 26px',
                                        color: 'var(--hd-text-title)',
                                        fontSize: 13,
                                        fontWeight: 800,
                                        outline: 'none',
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Subtotal del Ítem */}
                                <div>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                    Subtotal
                                  </span>
                                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--hd-text-title)' }} className="tabular">
                                    {formatearSoles(it.subtotal)}
                                  </div>
                                </div>

                                {/* Costo de Reposición Resultante */}
                                <div>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                    Costo Reposición
                                  </span>
                                  <div
                                    style={{
                                      backgroundColor: 'var(--hd-surface)',
                                      border: '1px solid var(--hd-border)',
                                      borderRadius: '6px',
                                      padding: '3px 8px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--hd-orange)' }} className="tabular">
                                      {formatearSoles(it.costo_unitario)}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 800,
                                        color: costoSubio
                                          ? 'var(--status-danger)'
                                          : costoBajo
                                          ? 'var(--status-success)'
                                          : 'var(--hd-text-dim)',
                                      }}
                                    >
                                      {costoSubio ? '▲ Sube' : costoBajo ? '▼ Baja' : '= Fiel'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ASISTENTE EN VIVO DE PRECIO MOSTRADOR & MARGEN (OPCIÓN 1 + 2 COMBINADA) */}
                            {requiereAlertaPrecio && (
                              <div
                                style={{
                                  backgroundColor: 'var(--hd-orange-subtle)',
                                  border: '1px solid var(--hd-orange)',
                                  borderRadius: '6px',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 10,
                                }}
                              >
                                <div style={{ fontSize: 11, color: 'var(--hd-orange)', fontWeight: 800 }}>
                                  <span>⚠️ </span>
                                  {costoSubio ? (
                                    <span>
                                      El costo subió a {formatearSoles(it.costo_unitario)}. Precio mostrador actual:{' '}
                                      <strong>{formatearSoles(it.precio_venta_actual || 0)}</strong>
                                    </span>
                                  ) : esPrimeraCompra ? (
                                    <span>
                                      Primer ingreso de mercadería a {formatearSoles(it.costo_unitario)}. Revisa tu precio de venta:
                                    </span>
                                  ) : (
                                    <span>
                                      Margen estrecho ({margenEstimadoPorc}%). Te sugerimos ajustar el precio al cliente:
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--hd-text-title)', textTransform: 'uppercase' }}>
                                    Nuevo Precio Mostrador:
                                  </span>
                                  <div style={{ position: 'relative', width: 95 }}>
                                    <span style={{ position: 'absolute', left: 8, top: 5, fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 800 }}>
                                      S/
                                    </span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      value={it.nuevo_precio_venta || ''}
                                      onChange={(e) =>
                                        actualizarItemCampo(idx, {
                                          nuevo_precio_venta: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      placeholder="0.00"
                                      style={{
                                        width: '100%',
                                        textAlign: 'right',
                                        backgroundColor: 'var(--hd-surface)',
                                        border: '1.5px solid var(--hd-orange)',
                                        borderRadius: '4px',
                                        padding: '4px 6px 4px 24px',
                                        color: 'var(--hd-text-title)',
                                        fontSize: 13,
                                        fontWeight: 900,
                                        outline: 'none',
                                      }}
                                    />
                                  </div>

                                  {/* Ganancia resultante en vivo */}
                                  {precioVentaEfectivo > 0 && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 900,
                                        padding: '3px 6px',
                                        borderRadius: 4,
                                        backgroundColor: Number(margenEstimadoPorc) >= 20 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                        color: Number(margenEstimadoPorc) >= 20 ? 'var(--status-success)' : 'var(--status-danger)',
                                      }}
                                    >
                                      +{margenEstimadoPorc}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* COLUMNA DERECHA: Resumen de la Factura y Confirmación */}
              <div
                style={{
                  position: 'sticky',
                  top: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--hd-surface)',
                    border: '2px solid var(--hd-orange)',
                    borderRadius: '12px',
                    padding: '18px',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      color: 'var(--hd-orange)',
                      letterSpacing: '0.06em',
                      marginBottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <FileText size={15} />
                    <span>Resumen de la Entrada</span>
                  </div>

                  {/* Detalle del Distribuidor en el Resumen */}
                  <div
                    style={{
                      backgroundColor: 'var(--hd-elevated)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: 14,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>
                      Proveedor:
                    </span>
                    <strong style={{ color: 'var(--hd-text-title)', fontSize: 13, display: 'block' }}>
                      {proveedorActual ? proveedorActual.nombre : '⚠️ No seleccionado aún'}
                    </strong>
                    {proveedorActual?.ruc && (
                      <span style={{ fontSize: 11, color: 'var(--hd-orange)', fontWeight: 700 }}>
                        RUC: {proveedorActual.ruc}
                      </span>
                    )}
                  </div>

                  {/* Estadísticas de la Carga */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      paddingBottom: 14,
                      marginBottom: 14,
                      borderBottom: '1px solid var(--hd-border)',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hd-text-muted)' }}>
                      <span>Líneas de productos:</span>
                      <strong style={{ color: 'var(--hd-text-title)' }}>{itemsEntrada.length} ítems</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hd-text-muted)' }}>
                      <span>Unidades a ingresar al stock:</span>
                      <strong style={{ color: 'var(--hd-text-title)' }}>{totalUnidadesEntrada} unidades</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hd-text-muted)' }}>
                      <span>Tipo de documento:</span>
                      <span style={{ textTransform: 'capitalize', fontWeight: 700, color: 'var(--hd-text-title)' }}>
                        {tipoComprobante}
                      </span>
                    </div>

                    {numeroComprobante && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hd-text-muted)' }}>
                        <span>N° Documento:</span>
                        <strong style={{ color: 'var(--hd-orange)' }}>#{numeroComprobante}</strong>
                      </div>
                    )}
                  </div>

                  {/* Total a Pagar en Letras Gigantes */}
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--hd-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Total a Pagar al Proveedor
                    </span>
                    <div
                      style={{
                        fontSize: 30,
                        fontWeight: 900,
                        color: 'var(--hd-orange)',
                        lineHeight: 1.1,
                        marginTop: 2,
                      }}
                      className="tabular"
                    >
                      {formatearSoles(totalGeneralEntrada)}
                    </div>
                  </div>

                  {/* Botón Prominente de Confirmación de Entrada */}
                  <button
                    type="button"
                    onClick={handleGuardarCompra}
                    disabled={guardandoCompra || itemsEntrada.length === 0 || !distribuidorSeleccionadoId}
                    style={{
                      width: '100%',
                      background:
                        itemsEntrada.length === 0 || !distribuidorSeleccionadoId
                          ? 'var(--hd-elevated)'
                          : 'linear-gradient(135deg, var(--hd-orange) 0%, var(--hd-orange-dark) 100%)',
                      color:
                        itemsEntrada.length === 0 || !distribuidorSeleccionadoId
                          ? 'var(--hd-text-dim)'
                          : '#FFFFFF',
                      border:
                        itemsEntrada.length === 0 || !distribuidorSeleccionadoId
                          ? '1px solid var(--hd-border)'
                          : '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      fontSize: 13,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow:
                        itemsEntrada.length > 0 && distribuidorSeleccionadoId
                          ? 'var(--shadow-card)'
                          : 'none',
                      cursor:
                        guardandoCompra || itemsEntrada.length === 0 || !distribuidorSeleccionadoId
                          ? 'not-allowed'
                          : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CheckCircle2 size={18} strokeWidth={2.5} />
                    <span>
                      {guardandoCompra ? 'Ingresando Stock...' : 'Confirmar Entrada al Stock'}
                    </span>
                  </button>

                  {(!distribuidorSeleccionadoId || itemsEntrada.length === 0) && (
                    <p style={{ fontSize: 11, color: 'var(--hd-text-dim)', textAlign: 'center', marginTop: 8, margin: '8px 0 0' }}>
                      {!distribuidorSeleccionadoId
                        ? '👆 Selecciona un distribuidor en el Paso 1'
                        : '👆 Añade repuestos en el Paso 2'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Barra Flotante Inferior en Celular (Fase 6) */}
            {itemsEntrada.length > 0 && (
              <div className="compras-mobile-floating-bar">
                <div>
                  <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>
                    {totalUnidadesEntrada} uds · {itemsEntrada.length} ítems
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--hd-orange)' }} className="tabular">
                    {formatearSoles(totalGeneralEntrada)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGuardarCompra}
                  disabled={guardandoCompra || itemsEntrada.length === 0 || !distribuidorSeleccionadoId}
                  style={{
                    backgroundColor: 'var(--hd-orange)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: 12,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px var(--hd-orange-glow)',
                    opacity: guardandoCompra || !distribuidorSeleccionadoId ? 0.6 : 1,
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{guardandoCompra ? 'Guardando...' : 'Confirmar'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 2: DIRECTORIO DE DISTRIBUIDORES                      */}
        {/* ============================================================ */}
        {tabActiva === 'distribuidores' && (
          <div>
            {/* Buscador de Distribuidores */}
            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Search size={16} color="var(--hd-orange)" />
              <input
                type="text"
                placeholder="Buscar distribuidor por nombre, razón social, RUC o contacto..."
                value={busquedaDistribuidor}
                onChange={(e) => setBusquedaDistribuidor(e.target.value)}
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
            </div>

            {/* Grilla de Tarjetas de Distribuidores */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                gap: 16,
              }}
            >
              {distribuidoresFiltrados.map((dist) => {
                const esComodin = dist.id === distribuidorComodin?.id;
                return (
                  <div
                    key={dist.id}
                    style={{
                      backgroundColor: 'var(--hd-card)',
                      border: esComodin ? '2px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: esComodin ? '0 4px 16px var(--hd-orange-glow)' : 'var(--shadow-card)',
                      borderTop: esComodin ? '3px solid var(--hd-orange)' : '3px solid var(--hd-border-strong)',
                    }}
                  >
                    <div>
                      {esComodin && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            backgroundColor: 'var(--hd-orange)',
                            color: '#FFFFFF',
                            padding: '3px 8px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginBottom: 8,
                          }}
                        >
                          <span>⚡</span>
                          <span>Distribuidor Comodín (Sin RUC)</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0 }}>
                            {dist.nombre}
                          </h4>
                          {dist.empresa && (
                            <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600, display: 'block' }}>
                              {dist.empresa}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => abrirModalEditarDistribuidor(dist)}
                          style={{
                            backgroundColor: 'var(--hd-elevated)',
                            border: '1px solid var(--hd-border)',
                            borderRadius: '4px',
                            padding: '5px',
                            color: 'var(--hd-text-muted)',
                            cursor: 'pointer',
                          }}
                          title="Editar información"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>

                      {/* RUC */}
                      {dist.ruc && (
                        <div style={{ fontSize: 11, color: 'var(--hd-orange)', fontWeight: 800, marginBottom: 8 }}>
                          RUC: {dist.ruc}
                        </div>
                      )}

                      {/* Contacto / Vendedor */}
                      {dist.contacto && (
                        <div style={{ fontSize: 12, color: 'var(--hd-text-body)', fontWeight: 600, marginBottom: 6 }}>
                          👤 Contacto: <span style={{ color: 'var(--hd-text-title)' }}>{dist.contacto}</span>
                        </div>
                      )}

                      {/* Dirección */}
                      {dist.direccion && (
                        <div style={{ fontSize: 11, color: 'var(--hd-text-dim)', marginBottom: 12 }}>
                          📍 {dist.direccion}
                        </div>
                      )}
                    </div>

                    {/* Acciones del Distribuidor */}
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--hd-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Botón Prominente: Registrar Entrada Directa */}
                      <button
                        type="button"
                        onClick={() => iniciarEntradaParaDistribuidor(dist.id)}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--hd-orange-subtle)',
                          color: 'var(--hd-orange)',
                          border: '1px solid var(--hd-orange)',
                          borderRadius: '6px',
                          padding: '7px 10px',
                          fontSize: 11,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <Truck size={14} />
                        <span>Registrar Compra a este Distribuidor</span>
                      </button>

                      {/* Botones de Contacto Directo */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {dist.telefono ? (
                          <>
                            <a
                              href={`tel:${dist.telefono}`}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 5,
                                backgroundColor: 'var(--hd-elevated)',
                                border: '1px solid var(--hd-border)',
                                borderRadius: '6px',
                                padding: '7px 10px',
                                color: 'var(--hd-text-title)',
                                fontSize: 11,
                                fontWeight: 800,
                                textDecoration: 'none',
                              }}
                            >
                              <Phone size={13} color="var(--hd-orange)" />
                              <span>Llamar</span>
                            </a>

                            <a
                              href={`https://wa.me/51${dist.telefono.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 5,
                                backgroundColor: '#25D366',
                                color: '#FFFFFF',
                                borderRadius: '6px',
                                padding: '7px 10px',
                                fontSize: 11,
                                fontWeight: 800,
                                textDecoration: 'none',
                              }}
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </a>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontStyle: 'italic', padding: '4px 0' }}>
                            Sin teléfono registrado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PESTAÑA 3: HISTORIAL DE ENTRADAS CON FILTROS INTELIGENTES    */}
        {/* ============================================================ */}
        {tabActiva === 'historial' && (
          <div>
            {/* Barra de Filtros en Historial */}
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 240,
                  backgroundColor: 'var(--hd-surface)',
                  border: '1px solid var(--hd-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Search size={15} color="var(--hd-orange)" />
                <input
                  type="text"
                  placeholder="Buscar por N° comprobante, proveedor o repuesto..."
                  value={busquedaHistorial}
                  onChange={(e) => setBusquedaHistorial(e.target.value)}
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
              </div>

              <select
                value={filtroDistribuidorHistorial}
                onChange={(e) =>
                  setFiltroDistribuidorHistorial(
                    e.target.value ? Number(e.target.value) : ''
                  )
                }
                style={{
                  backgroundColor: 'var(--hd-surface)',
                  border: '1px solid var(--hd-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--hd-text-title)',
                  fontSize: 13,
                  fontWeight: 700,
                  outline: 'none',
                }}
              >
                <option value="">Todos los distribuidores</option>
                {distribuidores.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Listado de Entradas Históricas */}
            {historialFiltrado.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '50px 16px',
                  backgroundColor: 'var(--hd-surface)',
                  border: '2px dashed var(--hd-border)',
                  borderRadius: '10px',
                  color: 'var(--hd-text-dim)',
                }}
              >
                <History size={40} color="var(--hd-orange)" style={{ marginBottom: 10 }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--hd-text-title)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Sin entradas registradas con estos filtros
                </h3>
                <p style={{ fontSize: 13 }}>
                  Cuando registres entradas de mercadería aparecerán aquí para control de auditoría.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {historialFiltrado.map((compra) => {
                  const fecha = new Date(compra.fecha_compra).toLocaleDateString('es-PE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={compra.id}
                      style={{
                        backgroundColor: 'var(--hd-surface)',
                        border: '1px solid var(--hd-border)',
                        borderRadius: '8px',
                        padding: '16px',
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
                          marginBottom: 12,
                          paddingBottom: 10,
                          borderBottom: '1px solid var(--hd-border)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                color: '#FFFFFF',
                                backgroundColor: 'var(--hd-orange)',
                                padding: '2px 8px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                              }}
                            >
                              {compra.tipo_comprobante || 'Compra'}
                            </span>
                            {compra.numero_comprobante && (
                              <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                                #{compra.numero_comprobante}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--hd-text-muted)', fontWeight: 600, marginTop: 4 }}>
                            Proveedor: <strong style={{ color: 'var(--hd-text-title)' }}>{compra.proveedores?.nombre || 'Distribuidor no especificado'}</strong>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--hd-orange)' }} className="tabular">
                            {formatearSoles(compra.total)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>
                            {fecha}
                          </div>
                        </div>
                      </div>

                      {/* Lista de Repuestos Ingresados en esta Entrada */}
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800, display: 'block', marginBottom: 6 }}>
                          Repuestos Ingresados:
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {compra.detalle_compras?.map((det) => (
                            <div
                              key={det.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: 'var(--hd-elevated)',
                                padding: '6px 12px',
                                borderRadius: '4px',
                              }}
                            >
                              <span style={{ fontWeight: 700, color: 'var(--hd-text-title)' }}>
                                {det.productos?.nombre || (det.producto_id ? `Producto #${det.producto_id}` : 'Repuesto')}
                              </span>
                              <span style={{ color: 'var(--hd-text-muted)' }} className="tabular">
                                {det.cantidad} {det.productos?.unidad_medida || 'unid'} x {formatearSoles(det.costo_unitario)} = <strong style={{ color: 'var(--hd-text-title)' }}>{formatearSoles(det.subtotal)}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {compra.notas && (
                        <div style={{ fontSize: 11, color: 'var(--hd-text-dim)', marginTop: 10, fontStyle: 'italic' }}>
                          Nota: {compra.notas}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL CREAR / EDITAR DISTRIBUIDOR */}
      {modalDistribuidorAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 14,
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--hd-orange)',
              borderRadius: '12px',
              maxWidth: 480,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--hd-card-header)',
                padding: '14px 18px',
                borderBottom: '1px solid var(--hd-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', color: 'var(--hd-text-title)', margin: 0 }}>
                {distribuidorEditar ? 'Editar Distribuidor' : 'Registrar Nuevo Distribuidor'}
              </h3>
              <button
                type="button"
                onClick={() => setModalDistribuidorAbierto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGuardarDistribuidor} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Nombre Comercial / Distribuidor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Lubricantes & Repuestos del Centro"
                  value={formDistribuidor.nombre}
                  onChange={(e) => setFormDistribuidor({ ...formDistribuidor, nombre: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    RUC (11 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="Ej. 20601234567"
                    value={formDistribuidor.ruc || ''}
                    onChange={(e) => setFormDistribuidor({ ...formDistribuidor, ruc: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: 'var(--hd-text-title)',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 987654321"
                    value={formDistribuidor.telefono || ''}
                    onChange={(e) => setFormDistribuidor({ ...formDistribuidor, telefono: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: 'var(--hd-text-title)',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Razón Social (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Distribuidora LubriPerú S.A.C."
                  value={formDistribuidor.empresa || ''}
                  onChange={(e) => setFormDistribuidor({ ...formDistribuidor, empresa: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Nombre del Contacto / Preventista
                </label>
                <input
                  type="text"
                  placeholder="Ej. Carlos Mendoza (Vendedor)"
                  value={formDistribuidor.contacto || ''}
                  onChange={(e) => setFormDistribuidor({ ...formDistribuidor, contacto: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Dirección del Distribuidor
                </label>
                <input
                  type="text"
                  placeholder="Ej. Av. Iquitos 845, La Victoria"
                  value={formDistribuidor.direccion || ''}
                  onChange={(e) => setFormDistribuidor({ ...formDistribuidor, direccion: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalDistribuidorAbierto(false)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--hd-elevated)',
                    border: '1px solid var(--hd-border)',
                    color: 'var(--hd-text-dim)',
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardandoDistribuidor}
                  style={{
                    flex: 2,
                    padding: '9px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--hd-orange)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    cursor: guardandoDistribuidor ? 'not-allowed' : 'pointer',
                  }}
                >
                  {guardandoDistribuidor ? 'Guardando...' : 'Guardar Distribuidor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR PRODUCTO NUEVO DIRECTAMENTE DESDE COMPRAS */}
      <ProductModal
        abierto={modalProductoAbierto}
        productoEditar={null}
        esAdmin={true}
        onCerrar={() => setModalProductoAbierto(false)}
        onGuardadoExitoso={async () => {
          setModalProductoAbierto(false);
          await cargarDatos();
        }}
      />
    </div>
  );
}
