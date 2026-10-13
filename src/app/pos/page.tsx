'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Producto, Cliente, MetodoPago, TipoComprobanteVenta, supabase } from '@/lib/supabase';
import { obtenerProductos } from '@/services/productService';
import {
  ItemCarritoVenta,
  obtenerClientes,
  crearClienteRapido,
  registrarVenta,
  obtenerVentasDelDia,
  obtenerBoletasPorFecha,
  obtenerVentasPorRangoFecha,
  anularVenta,
  construirLoteGreenter,
  calcularResumenCaja,
  convertirTicketABoleta,
  VentaConDetalles,
} from '@/services/ventaService';
import { useAuth } from '@/context/AuthContext';
import { formatearSoles } from '@/lib/formatters';
import { formatearLitros } from '@/lib/conversions';
import { CATEGORIAS_MOTO } from '@/lib/constants';
import CartItemRow from '@/components/pos/CartItemRow';
import OilFractionModal from '@/components/pos/OilFractionModal';
import PaymentModal from '@/components/pos/PaymentModal';
import TicketReceiptModal from '@/components/pos/TicketReceiptModal';
import { generarTextoTicket, generarReporteLoteConsolidado, descargarArchivo } from '@/lib/ticketExporter';
import { registrarMovimientoKardex } from '@/services/kardexService';
import { destaparEnvase } from '@/services/productService';
import {
  ShoppingCart,
  Search,
  Droplet,
  Package,
  User,
  Plus,
  Trash2,
  Calendar,
  Banknote,
  Smartphone,
  CreditCard,
  Printer,
  X,
  RotateCcw,
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  ArrowLeft,
  Clock,
  Filter,
  AlertTriangle,
} from 'lucide-react';

export default function PosPage() {
  const { usuarioActual } = useAuth();

  // Pestaña activa: terminal de venta vs ventas de hoy vs historial general
  const [tabActiva, setTabActiva] = useState<'pos' | 'hoy' | 'historial'>('pos');

  // Alternancia móvil en Terminal POS (Catálogo vs Carrito)
  const [vistaMovilPos, setVistaMovilPos] = useState<'catalogo' | 'carrito'>('catalogo');

  // Datos del catálogo y clientes
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventasHoy, setVentasHoy] = useState<VentaConDetalles[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // Filtros del catálogo
  const [busqueda, setBusqueda] = useState<string>('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('Todos');
  const [soloAceitesAbiertos, setSoloAceitesAbiertos] = useState<boolean>(false);

  // Carrito de Venta
  const [carrito, setCarrito] = useState<ItemCarritoVenta[]>([]);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<number | ''>('');
  const [mostrarModalNuevoCliente, setMostrarModalNuevoCliente] = useState<boolean>(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState<string>('');
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState<string>('');
  const [nuevoClienteTipoDoc, setNuevoClienteTipoDoc] = useState<string>('1');
  const [nuevoClienteNumDoc, setNuevoClienteNumDoc] = useState<string>('');

  // Modales
  const [productoAceiteModal, setProductoAceiteModal] = useState<Producto | null>(null);
  const [modalCobroAbierto, setModalCobroAbierto] = useState<boolean>(false);
  const [procesandoCobro, setProcesandoCobro] = useState<boolean>(false);

  // Venta completada para ticket
  const [ventaCompletada, setVentaCompletada] = useState<{
    numeroComprobante: string;
    items: ItemCarritoVenta[];
    total: number;
    totalGravada?: number;
    totalIgv?: number;
    metodoPago: MetodoPago;
    tipoComprobante: TipoComprobanteVenta;
    montoRecibido?: number | null;
    vuelto?: number | null;
    vendedorNombre: string | null;
    cliente: Cliente | null;
    fecha: string;
  } | null>(null);

  // Modal reimprimir ticket del historial
  const [ticketParaReimprimir, setTicketParaReimprimir] = useState<VentaConDetalles | null>(null);

  // Sección Greenter (Boletas del día)
  const hoyISO = new Date().toISOString().split('T')[0];
  const [fechaGreenter, setFechaGreenter] = useState<string>(hoyISO);
  const [incluirTicketsGreenter, setIncluirTicketsGreenter] = useState<boolean>(true);
  const [boletasGreenter, setBoletasGreenter] = useState<VentaConDetalles[]>([]);
  const [cargandoGreenter, setCargandoGreenter] = useState<boolean>(false);

  // Sección Historial de Ventas por Fecha
  const [fechaHistorialInicio, setFechaHistorialInicio] = useState<string>(hoyISO);
  const [fechaHistorialFin, setFechaHistorialFin] = useState<string>(hoyISO);
  const [ventasHistorial, setVentasHistorial] = useState<VentaConDetalles[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState<boolean>(false);
  const [filtroEstadoHistorial, setFiltroEstadoHistorial] = useState<'todos' | 'pagado' | 'anulado'>('todos');
  const [filtroMetodoHistorial, setFiltroMetodoHistorial] = useState<string>('todos');
  const [busquedaHistorial, setBusquedaHistorial] = useState<string>('');

  // Modal Anulación / Devolución a Kardex
  const [ventaParaAnular, setVentaParaAnular] = useState<VentaConDetalles | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState<string>('Cliente devolvió el repuesto');
  const [anulando, setAnulando] = useState<boolean>(false);

  // Notificación flotante (Toast)
  const [notificacionToast, setNotificacionToast] = useState<{ tipo: 'success' | 'error' | 'info'; mensaje: string } | null>(null);

  const mostrarNotificacion = (mensaje: string, tipo: 'success' | 'error' | 'info' = 'success') => {
    setNotificacionToast({ tipo, mensaje });
    setTimeout(() => {
      setNotificacionToast((prev) => (prev?.mensaje === mensaje ? null : prev));
    }, 4500);
  };

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [prodsData, clientesData, ventasData] = await Promise.all([
        obtenerProductos(),
        obtenerClientes(),
        obtenerVentasDelDia(),
      ]);
      setProductos(prodsData);
      setClientes(clientesData);
      setVentasHoy(ventasData);
    } catch (err) {
      console.error('Error al cargar datos en POS:', err);
    } finally {
      setCargando(false);
    }
  };

  const cargarBoletasGreenter = async (fecha: string, incluirTickets: boolean) => {
    try {
      setCargandoGreenter(true);
      const data = await obtenerBoletasPorFecha(fecha, incluirTickets);
      setBoletasGreenter(data);
    } finally {
      setCargandoGreenter(false);
    }
  };

  const cargarHistorial = async (inicio: string, fin: string) => {
    try {
      setCargandoHistorial(true);
      const data = await obtenerVentasPorRangoFecha(inicio, fin);
      setVentasHistorial(data);
    } catch (err) {
      console.error('Error al cargar historial de ventas:', err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const handleConfirmarAnulacion = async () => {
    if (!ventaParaAnular) return;
    if (!motivoAnulacion.trim()) {
      mostrarNotificacion('Por favor escribe un motivo para la anulación.', 'error');
      return;
    }

    const ventaId = ventaParaAnular.id;
    const numComp = ventaParaAnular.numero_comprobante || `TK-${ventaId}`;

    try {
      setAnulando(true);
      const res = await anularVenta({
        ventaId: ventaParaAnular.id,
        motivo: motivoAnulacion.trim(),
        usuarioNombre: usuarioActual ? usuarioActual.nombre : 'Mostrador',
      });

      if (!res.success) {
        mostrarNotificacion(res.error || 'No se pudo anular la venta.', 'error');
        return;
      }

      // 1. Cerrar el modal inmediatamente para que no se quede pegado en la ventana
      setVentaParaAnular(null);
      setMotivoAnulacion('Cliente devolvió el repuesto');

      // 2. Notificación toast visible inmediata
      mostrarNotificacion(
        `¡Venta #${ventaId} (${numComp}) anulada con éxito! Stock reintegrado y Kardex actualizado.`,
        'success'
      );

      // 3. Autoload automático de todas las fuentes de datos en paralelo
      await Promise.all([
        cargarDatos(),
        cargarBoletasGreenter(fechaGreenter, incluirTicketsGreenter),
        cargarHistorial(fechaHistorialInicio, fechaHistorialFin),
      ]);
    } catch (err: any) {
      console.error('Error al anular venta:', err);
      mostrarNotificacion('Error inesperado al anular la venta.', 'error');
    } finally {
      setAnulando(false);
    }
  };

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
    cargarDatos();
  }, []);

  useEffect(() => {
    if (tabActiva === 'hoy') {
      cargarBoletasGreenter(fechaGreenter, incluirTicketsGreenter);
    } else if (tabActiva === 'historial') {
      cargarHistorial(fechaHistorialInicio, fechaHistorialFin);
    }
  }, [tabActiva, fechaGreenter, incluirTicketsGreenter]);

  // Mapa reactivo de ítems actualmente apartados en el carrito
  const itemsEnCarritoMap = useMemo(() => {
    const map = new Map<number, { cerrados: number; granelLitros: number }>();
    carrito.forEach((item) => {
      const prev = map.get(item.producto.id) || { cerrados: 0, granelLitros: 0 };
      if (item.es_granel) {
        prev.granelLitros += item.cantidad;
      } else {
        prev.cerrados += item.cantidad;
      }
      map.set(item.producto.id, prev);
    });
    return map;
  }, [carrito]);

  // Ventas filtradas en el historial por fecha
  const ventasHistorialFiltradas = useMemo(() => {
    return ventasHistorial.filter((v) => {
      if (filtroEstadoHistorial !== 'todos') {
        if (filtroEstadoHistorial === 'anulado' && v.estado !== 'anulado') return false;
        if (filtroEstadoHistorial === 'pagado' && v.estado === 'anulado') return false;
      }
      if (filtroMetodoHistorial !== 'todos' && v.metodo_pago !== filtroMetodoHistorial) {
        return false;
      }
      if (busquedaHistorial.trim()) {
        const q = busquedaHistorial.toLowerCase();
        const num = (v.numero_comprobante || `TK-${v.id}`).toLowerCase();
        const cli = (v.cliente?.nombre || 'Público General').toLowerCase();
        const caj = (v.vendedor_nombre || 'Mostrador').toLowerCase();
        return num.includes(q) || cli.includes(q) || caj.includes(q);
      }
      return true;
    });
  }, [ventasHistorial, filtroEstadoHistorial, filtroMetodoHistorial, busquedaHistorial]);

  // Resumen contable del Historial consultado
  const resumenHistorial = useMemo(() => {
    const validas = ventasHistorialFiltradas.filter((v) => v.estado !== 'anulado');
    const anuladas = ventasHistorialFiltradas.filter((v) => v.estado === 'anulado');
    const totalCobrado = validas.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const totalEfectivo = validas.filter((v) => v.metodo_pago === 'efectivo').reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const totalDigital = totalCobrado - totalEfectivo;
    return {
      cantidadTotal: ventasHistorialFiltradas.length,
      cantidadValidas: validas.length,
      cantidadAnuladas: anuladas.length,
      totalCobrado,
      totalEfectivo,
      totalDigital,
    };
  }, [ventasHistorialFiltradas]);

  // Categorías combinadas disponibles
  const categoriasDisponibles = useMemo(() => {
    const setCats = new Set<string>(CATEGORIAS_MOTO);
    productos.forEach((p) => {
      if (p.categoria) setCats.add(p.categoria.trim());
    });
    return Array.from(setCats);
  }, [productos]);

  // Filtrado de productos en catálogo
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (soloAceitesAbiertos && (Number(p.volumen_en_uso) || 0) <= 0) {
        return false;
      }

      const matchCat =
        categoriaSeleccionada === 'Todos' ||
        (p.categoria && p.categoria.toLowerCase() === categoriaSeleccionada.toLowerCase());

      if (!busqueda.trim()) return matchCat;

      const term = busqueda.toLowerCase().trim();
      const matchTerm =
        p.nombre.toLowerCase().includes(term) ||
        (p.codigo && p.codigo.toLowerCase().includes(term)) ||
        (p.categoria && p.categoria.toLowerCase().includes(term));

      return matchCat && matchTerm;
    });
  }, [productos, busqueda, categoriaSeleccionada, soloAceitesAbiertos]);

  // Cliente actual seleccionado
  const clienteActual = useMemo(() => {
    if (!clienteSeleccionadoId) return null;
    return clientes.find((c) => c.id === clienteSeleccionadoId) || null;
  }, [clientes, clienteSeleccionadoId]);

  // Totales del carrito (Siempre precio final)
  const totalCarrito = useMemo(() => {
    return Number(carrito.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  }, [carrito]);

  // Resumen de caja del día
  const resumenCaja = useMemo(() => {
    return calcularResumenCaja(ventasHoy);
  }, [ventasHoy]);

  // Resumen fiscal de Boletas para Greenter
  const resumenGreenter = useMemo(() => {
    const total = boletasGreenter.reduce((acc, b) => acc + Number(b.total), 0);
    const gravada = Number((total / 1.18).toFixed(2));
    const igv = Number((total - gravada).toFixed(2));
    return {
      cantidad: boletasGreenter.length,
      total,
      gravada,
      igv,
    };
  }, [boletasGreenter]);

  // SELECCIONAR PRODUCTO EN EL CATÁLOGO
  const handleSeleccionarProducto = (prod: Producto) => {
    // REGLA ESTRICTA: Solo es aceite si su categoría es Aceites & Lubricantes Y su unidad no es 'unidad'
    const esAceite = Boolean(
      prod.categoria &&
      (prod.categoria.toLowerCase().includes('aceite') || prod.categoria.toLowerCase().includes('lubricante')) &&
      prod.unidad_medida !== 'unidad'
    );

    if (esAceite) {
      // Abre modal de elección fraccionado vs cerrado
      setProductoAceiteModal(prod);
    } else {
      // Repuesto normal: validar stock disponible en tiempo real
      const apartados = itemsEnCarritoMap.get(prod.id)?.cerrados || 0;
      const stockFisico = Number(prod.stock_actual) || 0;

      if (apartados >= stockFisico) {
        mostrarNotificacion(`No hay más stock de "${prod.nombre}". Solo quedan ${stockFisico} unidades disponibles.`, 'error');
        return;
      }

      const indexExistente = carrito.findIndex((item) => item.producto.id === prod.id && !item.es_granel);
      if (indexExistente >= 0) {
        handleActualizarCantidad(indexExistente, carrito[indexExistente].cantidad + 1);
      } else {
        const nuevoItem: ItemCarritoVenta = {
          producto: prod,
          cantidad: 1,
          precio_unitario: prod.precio_venta,
          subtotal: prod.precio_venta,
          es_granel: false,
          unidad_medida_venta: prod.unidad_medida || 'unidad',
        };
        setCarrito((prev) => [nuevoItem, ...prev]);
      }
    }
  };

  const handleAgregarDesdeModalAceite = (item: ItemCarritoVenta) => {
    setCarrito((prev) => [item, ...prev]);
    setProductoAceiteModal(null);
  };

  const handleActualizarCantidad = (index: number, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      handleEliminarItem(index);
      return;
    }
    setCarrito((prev) => {
      const copia = [...prev];
      const item = copia[index];
      const stockMax = item.es_granel
        ? Number(item.producto.volumen_en_uso) || 0
        : Number(item.producto.stock_actual) || 0;

      if (nuevaCantidad > stockMax) {
        mostrarNotificacion(`No hay más stock disponible para "${item.producto.nombre}" (Máximo: ${stockMax} ${item.es_granel ? 'L' : 'unidades'}).`, 'error');
        return copia;
      }

      const nueva = Number(nuevaCantidad.toFixed(2));
      copia[index] = {
        ...item,
        cantidad: nueva,
        subtotal: Number((nueva * item.precio_unitario).toFixed(2)),
      };
      return copia;
    });
  };

  const handleActualizarPrecio = (index: number, nuevoPrecio: number) => {
    setCarrito((prev) => {
      const copia = [...prev];
      const item = copia[index];
      copia[index] = {
        ...item,
        precio_unitario: nuevoPrecio,
        subtotal: Number((item.cantidad * nuevoPrecio).toFixed(2)),
      };
      return copia;
    });
  };

  const handleEliminarItem = (index: number) => {
    setCarrito((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleVaciarCarrito = () => {
    if (carrito.length === 0) return;
    if (confirm('¿Deseas vaciar todos los productos del carrito actual?')) {
      setCarrito([]);
    }
  };

  // CREAR CLIENTE RÁPIDO CON DNI/RUC
  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoClienteNombre.trim()) return;

    const res = await crearClienteRapido(
      nuevoClienteNombre,
      nuevoClienteTelefono,
      nuevoClienteTipoDoc,
      nuevoClienteNumDoc
    );

    if (res.success && res.cliente) {
      setClientes((prev) => [res.cliente!, ...prev]);
      setClienteSeleccionadoId(res.cliente.id);
      setNuevoClienteNombre('');
      setNuevoClienteTelefono('');
      setNuevoClienteNumDoc('');
      setMostrarModalNuevoCliente(false);
    } else {
      alert(res.error || 'Error al crear cliente');
    }
  };

  // CONFIRMAR COBRO
  const handleConfirmarCobro = async (datosPago: {
    metodoPago: MetodoPago;
    tipoComprobante: TipoComprobanteVenta;
    montoRecibido: number;
    vuelto: number;
    montoCredito?: number;
    notas?: string;
  }) => {
    try {
      setProcesandoCobro(true);

      const res = await registrarVenta({
        cliente_id: clienteActual ? clienteActual.id : null,
        usuario_id: usuarioActual ? usuarioActual.id : null,
        vendedor_nombre: usuarioActual ? usuarioActual.nombre : 'Mostrador',
        total: totalCarrito,
        metodo_pago: datosPago.metodoPago,
        tipo_comprobante: datosPago.tipoComprobante,
        monto_recibido: datosPago.montoRecibido,
        vuelto: datosPago.vuelto,
        monto_credito: datosPago.montoCredito,
        notas: datosPago.notas,
        items: carrito,
      });

      if (!res.success) {
        alert(res.error || 'No se pudo procesar la venta.');
        return;
      }

      setVentaCompletada({
        numeroComprobante: res.numeroComprobante || 'B001-00000001',
        items: [...carrito],
        total: totalCarrito,
        totalGravada: Number((totalCarrito / 1.18).toFixed(2)),
        totalIgv: Number((totalCarrito - totalCarrito / 1.18).toFixed(2)),
        metodoPago: datosPago.metodoPago,
        tipoComprobante: datosPago.tipoComprobante,
        montoRecibido: datosPago.montoRecibido,
        vuelto: datosPago.vuelto,
        vendedorNombre: usuarioActual ? usuarioActual.nombre : 'Mostrador',
        cliente: clienteActual,
        fecha: new Date().toISOString(),
      });

      setCarrito([]);
      setModalCobroAbierto(false);

      // Autoload de todas las fuentes en paralelo
      await Promise.all([
        cargarDatos(),
        cargarBoletasGreenter(fechaGreenter, incluirTicketsGreenter),
        cargarHistorial(fechaHistorialInicio, fechaHistorialFin),
      ]);
    } catch (err: any) {
      console.error('Error al registrar venta:', err);
      alert('Error inesperado al procesar la venta: ' + err.message);
    } finally {
      setProcesandoCobro(false);
    }
  };

  // DESCARGAS PARA GREENTER
  const handleDescargarJsonGreenter = () => {
    if (boletasGreenter.length === 0) {
      alert('No hay boletas registradas en la fecha seleccionada.');
      return;
    }
    const jsonLote = construirLoteGreenter(boletasGreenter);
    const blob = new Blob([JSON.stringify(jsonLote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boletas_greenter_${fechaGreenter}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDescargarCsvGreenter = () => {
    if (boletasGreenter.length === 0) {
      alert('No hay boletas registradas en la fecha seleccionada.');
      return;
    }
    let csv = 'Serie,Numero,FechaEmision,Cliente,Documento,BaseGravada,IGV,Total\n';
    boletasGreenter.forEach((v) => {
      const num = v.numero_comprobante || `B001-${v.id}`;
      const [serie, corr] = num.split('-');
      const total = Number(v.total) || 0;
      const base = Number((total / 1.18).toFixed(2));
      const igv = Number((total - base).toFixed(2));
      const cliente = v.cliente?.nombre || 'CLIENTE CASUAL';
      const doc = (v.cliente as any)?.numero_documento || '-';
      csv += `"${serie}","${corr}","${v.fecha_venta?.split('T')[0]}","${cliente}","${doc}",${base},${igv},${total}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boletas_sunat_${fechaGreenter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDescargarReporteConsolidado = () => {
    if (boletasGreenter.length === 0) {
      alert('No hay boletas registradas en la fecha seleccionada.');
      return;
    }
    const reporte = generarReporteLoteConsolidado(boletasGreenter, fechaGreenter, resumenGreenter);
    descargarArchivo(`reporte_boletas_${fechaGreenter}.txt`, reporte);
  };

  const handleDescargarTicketIndividual = (v: VentaConDetalles) => {
    const num = v.numero_comprobante || `TK-${v.id}`;
    const txt = generarTextoTicket({
      numeroComprobante: num,
      nombreComprobante: v.tipo_comprobante === 'boleta' ? 'BOLETA DE VENTA ELECTRÓNICA' : 'TICKET DE VENTA',
      fecha: v.fecha_venta,
      vendedorNombre: v.vendedor_nombre,
      clienteNombre: v.cliente?.nombre,
      clienteDoc: (v.cliente as any)?.numero_documento,
      clienteTelefono: v.cliente?.telefono,
      items: (v.detalle_ventas || []).map((d: any) => ({
        nombre: d.productos?.nombre || 'Repuesto',
        cantidad: Number(d.cantidad) || 1,
        precioUnitario: Number(d.precio_unitario) || 0,
        subtotal: Number(d.subtotal) || 0,
        esGranel: Boolean(d.es_granel),
        unidadMedida: d.unidad_medida_venta,
      })),
      total: Number(v.total) || 0,
      totalGravada: v.total_gravada ? Number(v.total_gravada) : undefined,
      totalIgv: v.total_igv ? Number(v.total_igv) : undefined,
      metodoPago: v.metodo_pago || 'efectivo',
      montoRecibido: v.monto_recibido,
      vuelto: v.vuelto,
      esAnulado: v.estado === 'anulado',
      motivoAnulacion: v.notas,
    });
    descargarArchivo(`ticket_${num}${v.estado === 'anulado' ? '_ANULADO' : ''}.txt`, txt);
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
        {/* Barra de Pestañas Superior */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="touch-scroll no-scrollbar"
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'nowrap',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 4,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              flex: '1 1 auto',
            }}
          >
            <button
              type="button"
              onClick={() => setTabActiva('pos')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                backgroundColor: tabActiva === 'pos' ? 'var(--hd-orange)' : 'var(--hd-surface)',
                color: tabActiva === 'pos' ? '#FFFFFF' : 'var(--hd-text-muted)',
                border: tabActiva === 'pos' ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                boxShadow: tabActiva === 'pos' ? '0 2px 10px var(--hd-orange-glow)' : 'none',
              }}
            >
              <ShoppingCart size={16} />
              <span>Terminal POS (Caja)</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('hoy')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                backgroundColor: tabActiva === 'hoy' ? 'var(--hd-orange)' : 'var(--hd-surface)',
                color: tabActiva === 'hoy' ? '#FFFFFF' : 'var(--hd-text-muted)',
                border: tabActiva === 'hoy' ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                boxShadow: tabActiva === 'hoy' ? '0 2px 10px var(--hd-orange-glow)' : 'none',
              }}
            >
              <Calendar size={16} />
              <span>Ventas de Hoy</span>
              <span
                style={{
                  fontSize: 10,
                  backgroundColor: tabActiva === 'hoy' ? 'rgba(0,0,0,0.25)' : 'var(--hd-elevated)',
                  padding: '2px 6px',
                  borderRadius: 999,
                }}
              >
                {ventasHoy.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTabActiva('historial');
                cargarHistorial(fechaHistorialInicio, fechaHistorialFin);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                backgroundColor: tabActiva === 'historial' ? 'var(--hd-orange)' : 'var(--hd-surface)',
                color: tabActiva === 'historial' ? '#FFFFFF' : 'var(--hd-text-muted)',
                border: tabActiva === 'historial' ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                boxShadow: tabActiva === 'historial' ? '0 2px 10px var(--hd-orange-glow)' : 'none',
              }}
            >
              <Clock size={16} />
              <span>Historial de Ventas</span>
            </button>

            <Link
              href="/inventario"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                backgroundColor: 'var(--hd-elevated)',
                color: 'var(--hd-text-title)',
                border: '1.5px solid var(--hd-orange)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <Package size={16} color="var(--hd-orange)" />
              <span>📦 Inventario</span>
            </Link>
          </div>

          {/* Indicador de Tienda y Cajero */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 900, color: 'var(--hd-orange)', letterSpacing: '0.04em' }}>
                LICHY MOTOR
              </span>
              <span style={{ color: 'var(--hd-border-strong)' }}>|</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={13} color="var(--hd-text-dim)" />
                <span style={{ color: 'var(--hd-text-dim)' }}>Cajero:</span>
                <strong style={{ color: 'var(--hd-text-title)' }}>
                  {usuarioActual ? usuarioActual.nombre : 'Mostrador'}
                </strong>
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Punto de Venta
            </span>
          </div>
        </div>

      {/* PESTAÑA 1: TERMINAL POS */}
      {tabActiva === 'pos' && (
        <>
          {/* Segmented Switch para Móviles (Catálogo vs Carrito) */}
          <div
            className="pos-mobile-segmented"
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              borderRadius: 10,
              padding: 4,
              marginBottom: 12,
              gap: 4,
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              onClick={() => setVistaMovilPos('catalogo')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: vistaMovilPos === 'catalogo' ? 'var(--hd-orange)' : 'transparent',
                color: vistaMovilPos === 'catalogo' ? '#FFFFFF' : 'var(--hd-text-muted)',
                border: 'none',
                boxShadow: vistaMovilPos === 'catalogo' ? '0 2px 8px var(--hd-orange-glow)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Package size={15} />
              <span>Catálogo ({productosFiltrados.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setVistaMovilPos('carrito')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: vistaMovilPos === 'carrito' ? 'var(--hd-orange)' : 'transparent',
                color: vistaMovilPos === 'carrito' ? '#FFFFFF' : 'var(--hd-text-muted)',
                border: 'none',
                boxShadow: vistaMovilPos === 'carrito' ? '0 2px 8px var(--hd-orange-glow)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <ShoppingCart size={15} />
              <span>Carrito ({carrito.length})</span>
              {carrito.length > 0 && (
                <span
                  style={{
                    backgroundColor: vistaMovilPos === 'carrito' ? 'rgba(0,0,0,0.3)' : 'var(--hd-orange-subtle)',
                    color: vistaMovilPos === 'carrito' ? '#FFFFFF' : 'var(--hd-orange)',
                    padding: '2px 6px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  {formatearSoles(totalCarrito)}
                </span>
              )}
            </button>
          </div>

          <div
            className={`pos-main-grid ${vistaMovilPos === 'catalogo' ? 'pos-view-catalogo' : 'pos-view-carrito'}`}
          >
            {/* LADO IZQUIERDO: CATÁLOGO DE PRODUCTOS ÁGIL */}
            <div
              className="pos-panel-catalogo"
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 12,
                padding: 12,
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            >
            {/* Buscador predictivo rápido */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: 'var(--hd-input-bg)',
                border: '1.5px solid var(--hd-orange)',
                borderRadius: 8,
                padding: '9px 12px',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            >
              <Search size={18} color="var(--hd-orange)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Buscar por repuesto, código COD o aceite..."
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
                  minWidth: 0,
                }}
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer', flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Píldoras de Categoría + Filtro Aceites Abiertos */}
            <div
              className="touch-scroll no-scrollbar"
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 6,
                WebkitOverflowScrolling: 'touch',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCategoriaSeleccionada('Todos');
                  setSoloAceitesAbiertos(false);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: categoriaSeleccionada === 'Todos' && !soloAceitesAbiertos ? 900 : 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  backgroundColor:
                    categoriaSeleccionada === 'Todos' && !soloAceitesAbiertos
                      ? 'var(--hd-orange)'
                      : 'var(--hd-elevated)',
                  color:
                    categoriaSeleccionada === 'Todos' && !soloAceitesAbiertos ? '#FFFFFF' : 'var(--hd-text-dim)',
                  border:
                    categoriaSeleccionada === 'Todos' && !soloAceitesAbiertos
                      ? '1px solid var(--hd-orange)'
                      : '1px solid var(--hd-border)',
                }}
              >
                Todos
              </button>

              <button
                type="button"
                onClick={() => setSoloAceitesAbiertos(!soloAceitesAbiertos)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: soloAceitesAbiertos ? 900 : 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: soloAceitesAbiertos ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                  color: soloAceitesAbiertos ? '#FFFFFF' : 'var(--hd-orange)',
                  border: '1px solid var(--hd-orange)',
                }}
              >
                <Droplet size={12} strokeWidth={2.5} />
                <span>Baldes en Uso</span>
              </button>

              {categoriasDisponibles.map((cat) => {
                const activo = categoriaSeleccionada === cat && !soloAceitesAbiertos;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoriaSeleccionada(cat);
                      setSoloAceitesAbiertos(false);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: activo ? 900 : 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
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

            {/* Listado de Productos en Grilla Rápida */}
            {cargando ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)' }}>
                Cargando catálogo...
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)' }}>
                No se encontraron repuestos con los filtros seleccionados.
              </div>
            ) : (
              <div
                className="pos-catalog-grid"
                style={{
                  maxHeight: 560,
                  overflowY: 'auto',
                  paddingRight: 2,
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {productosFiltrados.map((prod) => {
                  const stockCerradoFisico = Number(prod.stock_actual) || 0;
                  const volUsoFisico = Number(prod.volumen_en_uso) || 0;

                  // REGLA ESTRICTA: Solo es aceite si su categoría es lubricante y unidad no es unidad
                  const esAceite = Boolean(
                    prod.categoria &&
                    (prod.categoria.toLowerCase().includes('aceite') || prod.categoria.toLowerCase().includes('lubricante')) &&
                    prod.unidad_medida !== 'unidad'
                  );

                  // Restar lo que ya está apartado en el carrito
                  const apartados = itemsEnCarritoMap.get(prod.id) || { cerrados: 0, granelLitros: 0 };
                  const stockCerradoDisp = Math.max(0, stockCerradoFisico - apartados.cerrados);
                  const volUsoDisp = Math.max(0, Number((volUsoFisico - apartados.granelLitros).toFixed(3)));

                  const sinStock = esAceite
                    ? stockCerradoDisp <= 0 && volUsoDisp <= 0
                    : stockCerradoDisp <= 0;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => !sinStock && handleSeleccionarProducto(prod)}
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px solid var(--hd-border)',
                        borderRadius: 8,
                        padding: 10,
                        cursor: sinStock ? 'not-allowed' : 'pointer',
                        opacity: sinStock ? 0.55 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 8,
                        transition: 'all 0.15s ease',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        if (!sinStock) e.currentTarget.style.borderColor = 'var(--hd-orange)';
                      }}
                      onMouseLeave={(e) => {
                        if (!sinStock) e.currentTarget.style.borderColor = 'var(--hd-border)';
                      }}
                    >
                      <div>
                        {/* Categoría / Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {prod.categoria || 'Repuesto'}
                          </span>
                          {esAceite ? (
                            <Droplet size={13} color="var(--hd-orange)" style={{ flexShrink: 0 }} />
                          ) : (
                            <Package size={13} color="var(--hd-text-dim)" style={{ flexShrink: 0 }} />
                          )}
                        </div>

                        {/* Nombre del repuesto */}
                        <h4
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: 'var(--hd-text-title)',
                            margin: '0 0 4px',
                            lineHeight: 1.3,
                            minHeight: 32,
                            wordBreak: 'break-word',
                            overflow: 'hidden',
                          }}
                        >
                          {prod.nombre}
                        </h4>

                        {prod.codigo && (
                          <span style={{ fontSize: 10, color: 'var(--hd-orange)', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            COD: {prod.codigo}
                          </span>
                        )}
                      </div>

                      {/* Stock y Precio */}
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--hd-text-dim)', marginBottom: 4 }}>
                          {esAceite ? (
                            <span>
                              Cerrados: <strong>{stockCerradoDisp}</strong> · En uso:{' '}
                              <strong style={{ color: volUsoDisp > 0 ? 'var(--hd-orange)' : 'inherit' }}>
                                {formatearLitros(volUsoDisp)}
                              </strong>
                            </span>
                          ) : (
                            <span>
                              Stock disp.:{' '}
                              <strong style={{ color: stockCerradoDisp > 0 ? 'inherit' : 'var(--status-danger)' }}>
                                {stockCerradoDisp} {prod.unidad_medida}
                              </strong>
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--hd-text-title)' }} className="tabular">
                            {formatearSoles(prod.precio_venta)}
                          </span>

                          <button
                            type="button"
                            disabled={sinStock}
                            style={{
                              backgroundColor: sinStock ? 'transparent' : 'var(--hd-orange)',
                              color: sinStock ? 'var(--hd-text-dim)' : '#FFFFFF',
                              border: sinStock ? '1px solid var(--hd-border)' : 'none',
                              borderRadius: 4,
                              padding: '4px 7px',
                              fontSize: 10,
                              fontWeight: 900,
                              cursor: sinStock ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sinStock ? (
                              <span>{apartados.cerrados > 0 || apartados.granelLitros > 0 ? 'En Carrito' : 'Agotado'}</span>
                            ) : (
                              <>
                                <Plus size={12} strokeWidth={3} />
                                <span>{esAceite ? 'Opciones' : '+ Agregar'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LADO DERECHO: TICKET / CARRITO DE VENTA EN VIVO */}
          <div
            className="pos-panel-carrito"
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--hd-orange)',
              borderRadius: 12,
              padding: 12,
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 560,
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            <div>
              {/* Botón Volver a Catálogo (Solo Móvil) */}
              <button
                type="button"
                className="pos-mobile-back-catalog"
                onClick={() => setVistaMovilPos('catalogo')}
                style={{
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--hd-elevated)',
                  border: '1.5px solid var(--hd-orange)',
                  color: 'var(--hd-orange)',
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  marginBottom: 12,
                  width: '100%',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}
              >
                <ArrowLeft size={15} strokeWidth={3} />
                <span>‹ Seguir Agregando Repuestos</span>
              </button>

              {/* Encabezado del Carrito */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--hd-border)',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingCart size={18} color="var(--hd-orange)" />
                  <h3 style={{ fontSize: 15, fontWeight: 900, textTransform: 'uppercase', margin: 0, color: 'var(--hd-text-title)' }}>
                    Orden de Mostrador
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: 'var(--hd-orange-subtle)',
                      color: 'var(--hd-orange)',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {carrito.length} {carrito.length === 1 ? 'ítem' : 'ítems'}
                  </span>
                </div>

                {carrito.length > 0 && (
                  <button
                    type="button"
                    onClick={handleVaciarCarrito}
                    title="Vaciar orden"
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--hd-text-dim)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Vaciar</span>
                  </button>
                )}
              </div>

              {/* Selector de Cliente */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase' }}>
                    Cliente *
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarModalNuevoCliente(true)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--hd-orange)',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Plus size={12} strokeWidth={3} />
                    <span>+ Registrar Cliente / DNI</span>
                  </button>
                </div>

                <select
                  value={clienteSeleccionadoId}
                  onChange={(e) => setClienteSeleccionadoId(e.target.value ? Number(e.target.value) : '')}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border-strong)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                >
                  <option value="">👤 Público General / Venta Casual</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {(c as any).numero_documento ? `(Doc: ${(c as any).numero_documento})` : c.telefono ? `(${c.telefono})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ítems del Carrito */}
              {carrito.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: 'var(--hd-text-dim)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <ShoppingCart size={36} strokeWidth={1.5} color="var(--hd-text-muted)" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    La orden está vacía
                  </span>
                  <span style={{ fontSize: 11, maxWidth: 220 }}>
                    Haz clic en los repuestos o aceites de la izquierda para agregarlos a la venta.
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 320,
                    overflowY: 'auto',
                    paddingRight: 4,
                    marginBottom: 14,
                  }}
                >
                  {carrito.map((item, idx) => {
                    const stockMax = item.es_granel
                      ? Number(item.producto.volumen_en_uso) || 0
                      : Number(item.producto.stock_actual) || 0;

                    return (
                      <CartItemRow
                        key={`${item.producto.id}-${item.es_granel ? 'granel' : 'cerrado'}-${idx}`}
                        item={item}
                        index={idx}
                        stockMaximo={stockMax}
                        onActualizarCantidad={handleActualizarCantidad}
                        onActualizarPrecio={handleActualizarPrecio}
                        onEliminar={handleEliminarItem}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN INFERIOR DE TOTALES Y BOTÓN COBRAR */}
            <div style={{ borderTop: '2px solid var(--hd-border)', paddingTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 14,
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: 'var(--hd-text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                    Total a Cobrar
                  </span>
                  <div style={{ fontSize: 10, color: 'var(--hd-text-dim)' }}>
                    Precio final en mano (Inc. IGV para boleta)
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--hd-orange)' }} className="tabular">
                  {formatearSoles(totalCarrito)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalCobroAbierto(true)}
                disabled={carrito.length === 0}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 8,
                  backgroundColor: carrito.length === 0 ? 'var(--hd-elevated)' : 'var(--hd-orange)',
                  color: carrito.length === 0 ? 'var(--hd-text-dim)' : '#FFFFFF',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: carrito.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: carrito.length === 0 ? 'none' : '0 4px 20px var(--hd-orange-glow)',
                }}
              >
                <Banknote size={20} strokeWidth={2.5} />
                <span>Cobrar Mostrador ({formatearSoles(totalCarrito)})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra flotante para móviles: Ver Carrito con 1 tap */}
        {vistaMovilPos === 'catalogo' && carrito.length > 0 && (
          <button
            type="button"
            className="pos-mobile-cart-float"
            onClick={() => setVistaMovilPos('carrito')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} />
              <span>Ver Carrito ({carrito.length} {carrito.length === 1 ? 'ítem' : 'ítems'})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{formatearSoles(totalCarrito)}</span>
              <span>➔</span>
            </div>
          </button>
        )}
      </>
    )}

      {/* PESTAÑA 2: VENTAS DE HOY & GREENTER */}
      {tabActiva === 'hoy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Botón Prominente para regresar a la vista normal del mostrador */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              borderRadius: 10,
              padding: '10px 16px',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setTabActiva('pos')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 8,
                  backgroundColor: 'var(--hd-orange)',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 3px 12px var(--hd-orange-glow)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowLeft size={18} strokeWidth={3} />
                <span>Volver a Caja Mostrador</span>
              </button>

              <Link
                href="/inventario"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 8,
                  backgroundColor: 'var(--hd-elevated)',
                  color: 'var(--hd-text-title)',
                  fontWeight: 900,
                  fontSize: 13,
                  border: '1.5px solid var(--hd-orange)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                <Package size={18} color="var(--hd-orange)" />
                <span>📦 Volver a Inventario</span>
              </Link>
            </div>

            <span style={{ fontSize: 12, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
              Cierre de caja, arqueo del turno y boletas para declaración SUNAT
            </span>
          </div>

          {/* Tarjetas de Arqueo / Cierre */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1.5px solid var(--hd-orange)',
                borderRadius: 10,
                padding: '14px 16px',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase' }}>
                Total Ventas Hoy
              </span>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--hd-orange)', marginTop: 4 }} className="tabular">
                {formatearSoles(resumenCaja.totalVentas)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                {resumenCaja.cantidadTransacciones} transacciones registradas
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-success)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                <Banknote size={14} />
                <span>Efectivo en Caja</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 4 }} className="tabular">
                {formatearSoles(resumenCaja.totalEfectivo)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>Billetes y monedas</span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A855F7', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                <Smartphone size={14} />
                <span>Yape / Plin</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 4 }} className="tabular">
                {formatearSoles(resumenCaja.totalYape + resumenCaja.totalPlin)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>Billeteras móviles</span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3B82F6', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                <CreditCard size={14} />
                <span>Tarjeta & Transf.</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 4 }} className="tabular">
                {formatearSoles(resumenCaja.totalTarjeta + resumenCaja.totalTransferencia)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>POS & Bancos</span>
            </div>
          </div>

          {/* SECCIÓN GREENTER: EXPORTAR BOLETAS DEL DÍA */}
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--hd-orange)',
              borderRadius: 12,
              padding: 18,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                borderBottom: '1px solid var(--hd-border)',
                paddingBottom: 14,
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    backgroundColor: 'var(--hd-orange-subtle)',
                    color: 'var(--hd-orange)',
                    padding: 8,
                    borderRadius: 8,
                    display: 'flex',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0, textTransform: 'uppercase' }}>
                    Boletas para SUNAT (Exportador Greenter)
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                    Descarga en JSON listo para alimentar tu software externo de Greenter
                  </span>
                </div>
              </div>

              {/* Selector de fecha y descargas */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={fechaGreenter}
                  onChange={(e) => setFechaGreenter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 800,
                    backgroundColor: 'var(--hd-elevated)',
                    border: '1px solid var(--hd-border)',
                    padding: '8px 10px',
                    borderRadius: 6,
                    color: 'var(--hd-text-title)',
                  }}
                  title="Incluye también los tickets/notas de venta emitidos hoy asignándoles correlativo B001 para SUNAT"
                >
                  <input
                    type="checkbox"
                    checked={incluirTicketsGreenter}
                    onChange={(e) => setIncluirTicketsGreenter(e.target.checked)}
                    style={{ accentColor: 'var(--hd-orange)', width: 14, height: 14 }}
                  />
                  <span>Incluir Tickets en Lote</span>
                </label>

                <button
                  type="button"
                  onClick={handleDescargarJsonGreenter}
                  disabled={boletasGreenter.length === 0}
                  style={{
                    backgroundColor: boletasGreenter.length === 0 ? 'var(--hd-elevated)' : 'var(--hd-orange)',
                    color: boletasGreenter.length === 0 ? 'var(--hd-text-dim)' : '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: boletasGreenter.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: boletasGreenter.length === 0 ? 'none' : '0 2px 10px var(--hd-orange-glow)',
                  }}
                >
                  <Download size={14} strokeWidth={2.5} />
                  <span>Descargar JSON Greenter</span>
                </button>

                <button
                  type="button"
                  onClick={handleDescargarCsvGreenter}
                  disabled={boletasGreenter.length === 0}
                  style={{
                    backgroundColor: 'var(--hd-elevated)',
                    border: '1px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: boletasGreenter.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <FileSpreadsheet size={14} />
                  <span>CSV / Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleDescargarReporteConsolidado}
                  disabled={boletasGreenter.length === 0}
                  style={{
                    backgroundColor: 'var(--hd-elevated)',
                    border: '1.5px solid var(--hd-orange)',
                    color: 'var(--hd-orange)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: boletasGreenter.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Descargar lote de boletas/tickets en reporte consolidado de texto"
                >
                  <FileText size={14} />
                  <span>Reporte Boletas (TXT)</span>
                </button>
              </div>
            </div>

            {/* Resumen de Boletas del Día */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
                backgroundColor: 'var(--hd-elevated)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>
                  Boletas Emitidas
                </span>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                  {resumenGreenter.cantidad} comprobantes
                </div>
              </div>

              <div>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>
                  Base Gravada (Sin IGV)
                </span>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--hd-text-title)' }} className="tabular">
                  {formatearSoles(resumenGreenter.gravada)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>
                  IGV (18%) Desglosado
                </span>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--hd-orange)' }} className="tabular">
                  {formatearSoles(resumenGreenter.igv)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>
                  Total Final Boletas
                </span>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--status-success)' }} className="tabular">
                  {formatearSoles(resumenGreenter.total)}
                </div>
              </div>
            </div>

            {/* Lista previa de Boletas para Greenter */}
            {cargandoGreenter ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 12 }}>
                Consultando boletas para Greenter...
              </div>
            ) : boletasGreenter.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 12 }}>
                No se registraron boletas con fecha {fechaGreenter}. Las notas de venta/tickets no se envían a SUNAT.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hd-border)', textAlign: 'left', color: 'var(--hd-text-muted)' }}>
                      <th style={{ padding: '6px 10px' }}>Serie-Número</th>
                      <th style={{ padding: '6px 10px' }}>Cliente</th>
                      <th style={{ padding: '6px 10px' }}>Doc. Identidad</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Gravada</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>IGV (18%)</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Total Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boletasGreenter.map((b) => {
                      const total = Number(b.total);
                      const gravada = b.total_gravada ? Number(b.total_gravada) : Number((total / 1.18).toFixed(2));
                      const igv = b.total_igv ? Number(b.total_igv) : Number((total - gravada).toFixed(2));
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--hd-border)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: 'var(--hd-orange)' }}>
                            {b.numero_comprobante || `B001-${b.id}`}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--hd-text-title)' }}>
                            {b.cliente?.nombre || 'Público General'}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--hd-text-dim)' }}>
                            {(b.cliente as any)?.numero_documento || 'Sin doc'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular">
                            {formatearSoles(gravada)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular">
                            {formatearSoles(igv)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--hd-text-title)' }} className="tabular">
                            {formatearSoles(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabla de Todas las Ventas del Turno (Tickets + Boletas) */}
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              borderRadius: 12,
              padding: 16,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0, textTransform: 'uppercase' }}>
                Historial General de Ventas del Turno
              </h3>
              <button
                type="button"
                onClick={cargarDatos}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--hd-border)',
                  color: 'var(--hd-text-dim)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <RotateCcw size={12} />
                <span>Refrescar</span>
              </button>
            </div>

            {ventasHoy.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
                Aún no hay ventas registradas en la jornada de hoy.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hd-border)', textAlign: 'left', color: 'var(--hd-text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Comprobante</th>
                      <th style={{ padding: '8px 12px' }}>Hora</th>
                      <th style={{ padding: '8px 12px' }}>Cliente</th>
                      <th style={{ padding: '8px 12px' }}>Cajero</th>
                      <th style={{ padding: '8px 12px' }}>Método</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasHoy.map((v) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--hd-border)', opacity: v.estado === 'anulado' ? 0.65 : 1 }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--hd-orange)' }}>
                          {v.numero_comprobante || `TK-${v.id}`}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--hd-text-dim)' }}>
                          {new Date(v.fecha_venta).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--hd-text-title)' }}>
                          {v.cliente ? v.cliente.nombre : 'Público General'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--hd-text-dim)' }}>
                          {v.vendedor_nombre || 'Mostrador'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              backgroundColor: 'var(--hd-elevated)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              color: 'var(--hd-text-title)',
                            }}
                          >
                            {v.metodo_pago || 'efectivo'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: v.estado === 'anulado' ? 'var(--hd-text-dim)' : 'var(--hd-text-title)', textDecoration: v.estado === 'anulado' ? 'line-through' : 'none' }} className="tabular">
                          {formatearSoles(v.total)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              backgroundColor: v.estado === 'anulado' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: v.estado === 'anulado' ? 'var(--status-danger)' : 'var(--status-success)',
                              border: `1px solid ${v.estado === 'anulado' ? 'var(--status-danger)' : 'var(--status-success)'}`,
                              padding: '2px 7px',
                              borderRadius: 4,
                            }}
                          >
                            {v.estado === 'anulado' ? 'Anulado' : 'Pagado'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setTicketParaReimprimir(v)}
                              title="Ver / Reimprimir ticket"
                              style={{
                                backgroundColor: 'var(--hd-elevated)',
                                border: '1px solid var(--hd-border)',
                                borderRadius: 4,
                                padding: '4px 8px',
                                color: 'var(--hd-text-title)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <Printer size={13} />
                              <span>Ticket</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDescargarTicketIndividual(v)}
                              title="Descargar comprobante en archivo de texto"
                              style={{
                                backgroundColor: 'var(--hd-elevated)',
                                border: '1px solid var(--hd-border)',
                                borderRadius: 4,
                                padding: '4px 8px',
                                color: 'var(--hd-text-title)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <Download size={13} />
                              <span>Descargar</span>
                            </button>

                            {v.estado !== 'anulado' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVentaParaAnular(v);
                                  setMotivoAnulacion('Cliente devolvió el repuesto');
                                }}
                                title="Anular venta y devolver mercadería al stock del Kardex"
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid var(--status-danger)',
                                  borderRadius: 4,
                                  padding: '4px 8px',
                                  color: 'var(--status-danger)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                <RotateCcw size={12} />
                                <span>Anular</span>
                              </button>
                            )}

                            {v.tipo_comprobante === 'ticket' && v.estado !== 'anulado' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`¿Deseas convertir el comprobante ${v.numero_comprobante || '#' + v.id} a Boleta Electrónica B001 para Greenter?`)) {
                                    const res = await convertirTicketABoleta(v.id);
                                    if (res.success) {
                                      alert(`¡Comprobante convertido a Boleta ${res.numeroComprobante}!`);
                                      await cargarDatos();
                                      await cargarBoletasGreenter(fechaGreenter, incluirTicketsGreenter);
                                    } else {
                                      alert('Error: ' + res.error);
                                    }
                                  }
                                }}
                                title="Convertir a Boleta B001 para SUNAT / Greenter"
                                style={{
                                  backgroundColor: 'rgba(255, 95, 0, 0.15)',
                                  border: '1px solid var(--hd-orange)',
                                  borderRadius: 4,
                                  padding: '4px 8px',
                                  color: 'var(--hd-orange)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                <FileText size={12} />
                                <span>Pasar a Boleta</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: HISTORIAL DE VENTAS POR FECHA & AUDITORÍA */}
      {tabActiva === 'historial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Barra superior de navegación interna */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              borderRadius: 10,
              padding: '10px 16px',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setTabActiva('pos')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 8,
                  backgroundColor: 'var(--hd-orange)',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 3px 12px var(--hd-orange-glow)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                <ArrowLeft size={18} strokeWidth={3} />
                <span>Volver a Caja Mostrador</span>
              </button>

              <Link
                href="/inventario"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 8,
                  backgroundColor: 'var(--hd-elevated)',
                  color: 'var(--hd-text-title)',
                  fontWeight: 900,
                  fontSize: 13,
                  border: '1.5px solid var(--hd-orange)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                <Package size={18} color="var(--hd-orange)" />
                <span>📦 Volver a Inventario</span>
              </Link>
            </div>

            <span style={{ fontSize: 12, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
              Auditoría histórica de ventas por fecha, método de pago y devoluciones
            </span>
          </div>

          {/* Panel de Filtros por Fecha y Criterios */}
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              borderRadius: 12,
              padding: 16,
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="var(--hd-orange)" />
                <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0, textTransform: 'uppercase' }}>
                  Filtros de Búsqueda Histórica
                </h3>
              </div>

              {/* Botones de fechas rápidas */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setFechaHistorialInicio(hoyISO);
                    setFechaHistorialFin(hoyISO);
                    cargarHistorial(hoyISO, hoyISO);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: fechaHistorialInicio === hoyISO && fechaHistorialFin === hoyISO ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                    color: fechaHistorialInicio === hoyISO && fechaHistorialFin === hoyISO ? '#FFFFFF' : 'var(--hd-text-dim)',
                    border: '1px solid var(--hd-border)',
                  }}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ayer = new Date();
                    ayer.setDate(ayer.getDate() - 1);
                    const ayerISO = ayer.toISOString().split('T')[0];
                    setFechaHistorialInicio(ayerISO);
                    setFechaHistorialFin(ayerISO);
                    cargarHistorial(ayerISO, ayerISO);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: 'var(--hd-elevated)',
                    color: 'var(--hd-text-dim)',
                    border: '1px solid var(--hd-border)',
                  }}
                >
                  Ayer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    const inicioISO = d.toISOString().split('T')[0];
                    setFechaHistorialInicio(inicioISO);
                    setFechaHistorialFin(hoyISO);
                    cargarHistorial(inicioISO, hoyISO);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: 'var(--hd-elevated)',
                    color: 'var(--hd-text-dim)',
                    border: '1px solid var(--hd-border)',
                  }}
                >
                  Últimos 7 días
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const hoyD = new Date();
                    const inicioMes = new Date(hoyD.getFullYear(), hoyD.getMonth(), 1).toISOString().split('T')[0];
                    setFechaHistorialInicio(inicioMes);
                    setFechaHistorialFin(hoyISO);
                    cargarHistorial(inicioMes, hoyISO);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: 'var(--hd-elevated)',
                    color: 'var(--hd-text-dim)',
                    border: '1px solid var(--hd-border)',
                  }}
                >
                  Este Mes
                </button>
              </div>
            </div>

            {/* Controles de Selección de Fecha y Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>Desde:</span>
                <input
                  type="date"
                  value={fechaHistorialInicio}
                  onChange={(e) => setFechaHistorialInicio(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>Hasta:</span>
                <input
                  type="date"
                  value={fechaHistorialFin}
                  onChange={(e) => setFechaHistorialFin(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* Filtro Estado */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>Estado:</span>
                <select
                  value={filtroEstadoHistorial}
                  onChange={(e) => setFiltroEstadoHistorial(e.target.value as any)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="pagado">Solo Pagados</option>
                  <option value="anulado">Solo Anulados</option>
                </select>
              </div>

              {/* Filtro Método */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>Método:</span>
                <select
                  value={filtroMetodoHistorial}
                  onChange={(e) => setFiltroMetodoHistorial(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <option value="todos">Todos los Métodos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>

              {/* Input búsqueda */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
                <input
                  type="text"
                  placeholder="Buscar por comprobante o cliente..."
                  value={busquedaHistorial}
                  onChange={(e) => setBusquedaHistorial(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => cargarHistorial(fechaHistorialInicio, fechaHistorialFin)}
                style={{
                  backgroundColor: 'var(--hd-orange)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 16px',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 10px var(--hd-orange-glow)',
                }}
              >
                <Search size={14} />
                <span>Consultar</span>
              </button>
            </div>
          </div>

          {/* Tarjetas de Resumen del Historial */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1.5px solid var(--hd-orange)',
                borderRadius: 10,
                padding: '14px 16px',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase' }}>
                Total Recaudado (Válidas)
              </span>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--hd-orange)', marginTop: 4 }} className="tabular">
                {formatearSoles(resumenHistorial.totalCobrado)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                {resumenHistorial.cantidadValidas} ventas completadas
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-success)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                <Banknote size={14} />
                <span>Total Efectivo</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 4 }} className="tabular">
                {formatearSoles(resumenHistorial.totalEfectivo)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>Cobrado en mostrador</span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A855F7', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                <Smartphone size={14} />
                <span>Total Digital / Bancos</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 4 }} className="tabular">
                {formatearSoles(resumenHistorial.totalDigital)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>Yape, Plin y Tarjetas</span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--hd-surface)',
                border: '1px solid var(--hd-border)',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-danger)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                <RotateCcw size={14} />
                <span>Ventas Anuladas</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--status-danger)', marginTop: 4 }} className="tabular">
                {resumenHistorial.cantidadAnuladas}
              </div>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>Mercadería reintegrada a Kardex</span>
            </div>
          </div>

          {/* Tabla de Resultados del Historial */}
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              borderRadius: 12,
              padding: 16,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0, textTransform: 'uppercase' }}>
                Ventas Registradas del Período ({ventasHistorialFiltradas.length})
              </h3>
              <button
                type="button"
                onClick={() => cargarHistorial(fechaHistorialInicio, fechaHistorialFin)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--hd-border)',
                  color: 'var(--hd-text-dim)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <RotateCcw size={12} />
                <span>Actualizar</span>
              </button>
            </div>

            {cargandoHistorial ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
                Consultando ventas del período...
              </div>
            ) : ventasHistorialFiltradas.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
                No se encontraron ventas para los filtros y fechas seleccionadas.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hd-border)', textAlign: 'left', color: 'var(--hd-text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Comprobante</th>
                      <th style={{ padding: '8px 12px' }}>Fecha / Hora</th>
                      <th style={{ padding: '8px 12px' }}>Cliente</th>
                      <th style={{ padding: '8px 12px' }}>Cajero</th>
                      <th style={{ padding: '8px 12px' }}>Método</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasHistorialFiltradas.map((v) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--hd-border)', opacity: v.estado === 'anulado' ? 0.65 : 1 }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--hd-orange)' }}>
                          {v.numero_comprobante || `TK-${v.id}`}
                          {v.tipo_comprobante === 'boleta' && (
                            <span style={{ fontSize: 9, marginLeft: 5, padding: '1px 5px', borderRadius: 3, backgroundColor: 'rgba(255, 95, 0, 0.15)', color: 'var(--hd-orange)', fontWeight: 800 }}>
                              BOLETA
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--hd-text-dim)' }}>
                          {new Date(v.fecha_venta).toLocaleString('es-PE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--hd-text-title)' }}>
                          {v.cliente ? v.cliente.nombre : 'Público General'}
                          {(v.cliente as any)?.numero_documento && (
                            <div style={{ fontSize: 10, color: 'var(--hd-text-dim)' }}>
                              Doc: {(v.cliente as any).numero_documento}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--hd-text-dim)' }}>
                          {v.vendedor_nombre || 'Mostrador'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              backgroundColor: 'var(--hd-elevated)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              color: 'var(--hd-text-title)',
                            }}
                          >
                            {v.metodo_pago || 'efectivo'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: v.estado === 'anulado' ? 'var(--hd-text-dim)' : 'var(--hd-text-title)', textDecoration: v.estado === 'anulado' ? 'line-through' : 'none' }} className="tabular">
                          {formatearSoles(v.total)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              backgroundColor: v.estado === 'anulado' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: v.estado === 'anulado' ? 'var(--status-danger)' : 'var(--status-success)',
                              border: `1px solid ${v.estado === 'anulado' ? 'var(--status-danger)' : 'var(--status-success)'}`,
                              padding: '2px 7px',
                              borderRadius: 4,
                            }}
                          >
                            {v.estado === 'anulado' ? 'Anulado' : 'Pagado'}
                          </span>
                          {v.estado === 'anulado' && v.notas && (
                            <div style={{ fontSize: 9, color: 'var(--hd-text-dim)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.notas}>
                              {v.notas}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setTicketParaReimprimir(v)}
                              title="Ver / Reimprimir ticket"
                              style={{
                                backgroundColor: 'var(--hd-elevated)',
                                border: '1px solid var(--hd-border)',
                                borderRadius: 4,
                                padding: '4px 8px',
                                color: 'var(--hd-text-title)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <Printer size={13} />
                              <span>Ticket</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDescargarTicketIndividual(v)}
                              title="Descargar comprobante en archivo de texto"
                              style={{
                                backgroundColor: 'var(--hd-elevated)',
                                border: '1px solid var(--hd-border)',
                                borderRadius: 4,
                                padding: '4px 8px',
                                color: 'var(--hd-text-title)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <Download size={13} />
                              <span>Descargar</span>
                            </button>

                            {v.estado !== 'anulado' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVentaParaAnular(v);
                                  setMotivoAnulacion('Cliente devolvió el repuesto');
                                }}
                                title="Anular venta y devolver mercadería al stock del Kardex"
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid var(--status-danger)',
                                  borderRadius: 4,
                                  padding: '4px 8px',
                                  color: 'var(--status-danger)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                <RotateCcw size={12} />
                                <span>Anular</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ACEITE FRACCIONADO VS CERRADO */}
      {productoAceiteModal && (
        <OilFractionModal
          producto={productoAceiteModal}
          onCerrar={() => setProductoAceiteModal(null)}
          onAgregar={handleAgregarDesdeModalAceite}
          litrosEnCarrito={itemsEnCarritoMap.get(productoAceiteModal.id)?.granelLitros || 0}
          cerradosEnCarrito={itemsEnCarritoMap.get(productoAceiteModal.id)?.cerrados || 0}
          onDestaparEnvase={async (prodId) => {
            try {
              const prodActualizado = await destaparEnvase(
                prodId,
                1,
                usuarioActual ? usuarioActual.nombre : 'Mostrador'
              );
              await cargarDatos();
              setProductoAceiteModal((prev) =>
                prev ? { ...prev, stock_actual: prodActualizado.stock_actual, volumen_en_uso: prodActualizado.volumen_en_uso } : null
              );
            } catch (err: any) {
              console.error('Error al destapar envase en POS:', err);
              alert(err?.message || 'Error al destapar envase');
            }
          }}
        />
      )}

      {/* MODAL 2: COBRO EN MOSTRADOR */}
      {modalCobroAbierto && (
        <PaymentModal
          total={totalCarrito}
          clienteSeleccionado={clienteActual}
          onCerrar={() => setModalCobroAbierto(false)}
          onConfirmarPago={handleConfirmarCobro}
          procesando={procesandoCobro}
        />
      )}

      {/* MODAL 3: TICKET DE VENTA COMPLETADA */}
      {ventaCompletada && (
        <TicketReceiptModal
          numeroComprobante={ventaCompletada.numeroComprobante}
          items={ventaCompletada.items}
          total={ventaCompletada.total}
          totalGravada={ventaCompletada.totalGravada}
          totalIgv={ventaCompletada.totalIgv}
          metodoPago={ventaCompletada.metodoPago}
          tipoComprobante={ventaCompletada.tipoComprobante}
          montoRecibido={ventaCompletada.montoRecibido}
          vuelto={ventaCompletada.vuelto}
          vendedorNombre={ventaCompletada.vendedorNombre}
          cliente={ventaCompletada.cliente}
          fecha={ventaCompletada.fecha}
          onNuevaVenta={() => setVentaCompletada(null)}
        />
      )}

      {/* MODAL 4: REIMPRIMIR TICKET DE HISTORIAL */}
      {ticketParaReimprimir && (
        <TicketReceiptModal
          numeroComprobante={ticketParaReimprimir.numero_comprobante || `TK-${ticketParaReimprimir.id}`}
          items={ticketParaReimprimir.detalle_ventas.map((d) => ({
            producto: {
              id: d.producto_id,
              nombre: d.productos?.nombre || 'Repuesto',
              codigo: d.productos?.codigo || null,
              categoria: null,
              unidad_medida: d.productos?.unidad_medida || 'unidad',
              stock_actual: 0,
              costo_unitario: d.costo_unitario,
              precio_venta: d.precio_unitario,
              imagen_url: null,
              created_at: '',
            },
            cantidad: Number(d.cantidad),
            precio_unitario: Number(d.precio_unitario),
            subtotal: Number(d.subtotal),
            es_granel: Boolean(d.es_granel),
            unidad_medida_venta: d.unidad_medida_venta || 'unidad',
          }))}
          total={Number(ticketParaReimprimir.total)}
          totalGravada={ticketParaReimprimir.total_gravada ? Number(ticketParaReimprimir.total_gravada) : undefined}
          totalIgv={ticketParaReimprimir.total_igv ? Number(ticketParaReimprimir.total_igv) : undefined}
          metodoPago={ticketParaReimprimir.metodo_pago || 'efectivo'}
          tipoComprobante={ticketParaReimprimir.tipo_comprobante || 'ticket'}
          montoRecibido={ticketParaReimprimir.monto_recibido}
          vuelto={ticketParaReimprimir.vuelto}
          vendedorNombre={ticketParaReimprimir.vendedor_nombre}
          cliente={ticketParaReimprimir.cliente || null}
          fecha={ticketParaReimprimir.fecha_venta}
          onNuevaVenta={() => setTicketParaReimprimir(null)}
          esAnulado={ticketParaReimprimir.estado === 'anulado'}
          motivoAnulacion={ticketParaReimprimir.notas}
        />
      )}

      {/* MODAL 5: REGISTRAR NUEVO CLIENTE RÁPIDO */}
      {mostrarModalNuevoCliente && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 55,
            padding: 16,
          }}
          onClick={() => setMostrarModalNuevoCliente(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--hd-orange)',
              borderRadius: 10,
              padding: 20,
              width: '100%',
              maxWidth: 420,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 0 }}>
              Registrar Cliente en Mostrador
            </h3>

            <form onSubmit={handleCrearCliente} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', marginBottom: 4 }}>
                  Nombre o Razón Social *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez (Taller Ronco)"
                  value={nuevoClienteNombre}
                  onChange={(e) => setNuevoClienteNombre(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', marginBottom: 4 }}>
                    Tipo Doc.
                  </label>
                  <select
                    value={nuevoClienteTipoDoc}
                    onChange={(e) => setNuevoClienteTipoDoc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: 6,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border-strong)',
                      color: 'var(--hd-text-title)',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <option value="1">DNI (8 dígitos)</option>
                    <option value="6">RUC (11 dígitos)</option>
                    <option value="0">Sin Doc.</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', marginBottom: 4 }}>
                    N° Documento
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 72481920"
                    value={nuevoClienteNumDoc}
                    onChange={(e) => setNuevoClienteNumDoc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border-strong)',
                      color: 'var(--hd-text-title)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', marginBottom: 4 }}>
                  Teléfono / WhatsApp (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. 987654321"
                  value={nuevoClienteTelefono}
                  onChange={(e) => setNuevoClienteTelefono(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border-strong)',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevoCliente(false)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 6,
                    backgroundColor: 'transparent',
                    border: '1px solid var(--hd-border)',
                    color: 'var(--hd-text-dim)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-orange)',
                    border: 'none',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ANULACIÓN Y DEVOLUCIÓN DE VENTA A KARDEX */}
      {ventaParaAnular && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => {
            if (!anulando) setVentaParaAnular(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--status-danger)',
              borderRadius: 14,
              maxWidth: 520,
              width: '100%',
              padding: 20,
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: 'var(--status-danger)',
                    padding: 8,
                    borderRadius: 8,
                    display: 'flex',
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-text-title)', margin: 0, textTransform: 'uppercase' }}>
                    Anular Venta & Devolución
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                    Reingreso automático al stock y registro en Kardex
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!anulando) setVentaParaAnular(null);
                }}
                disabled={anulando}
                style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Datos de la venta a anular */}
            <div
              style={{
                backgroundColor: 'var(--hd-elevated)',
                border: '1px solid var(--hd-border)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>Comprobante:</span>
                <div style={{ fontWeight: 900, color: 'var(--hd-orange)' }}>
                  {ventaParaAnular.numero_comprobante || `TK-${ventaParaAnular.id}`}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>Total Venta:</span>
                <div style={{ fontWeight: 900, color: 'var(--hd-text-title)' }} className="tabular">
                  {formatearSoles(ventaParaAnular.total)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>Cliente:</span>
                <div style={{ fontWeight: 700, color: 'var(--hd-text-title)' }}>
                  {ventaParaAnular.cliente?.nombre || 'Público General'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>Fecha / Hora:</span>
                <div style={{ color: 'var(--hd-text-muted)' }}>
                  {new Date(ventaParaAnular.fecha_venta).toLocaleString('es-PE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            {/* Lista de productos devueltos */}
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Mercadería que retornará al Almacén:
              </span>
              <div
                style={{
                  backgroundColor: 'var(--hd-elevated)',
                  border: '1px solid var(--hd-border)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  maxHeight: 120,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {(ventaParaAnular.detalle_ventas || []).map((det: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <span style={{ color: 'var(--hd-text-title)', fontWeight: 700 }}>
                      {det.productos?.nombre || 'Repuesto'}
                    </span>
                    <span style={{ color: 'var(--status-success)', fontWeight: 900 }} className="tabular">
                      +{det.cantidad} {det.es_granel ? 'Litro(s) a granel' : `${det.unidad_medida_venta || 'unidad'}(s)`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivo de Anulación */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Motivo de la Anulación (Obligatorio):
              </label>
              <input
                type="text"
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Ej. Cliente devolvió el repuesto / Error de digitación"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--hd-input-bg)',
                  border: '1.5px solid var(--hd-border-strong)',
                  color: 'var(--hd-text-title)',
                  fontSize: 12,
                  marginBottom: 8,
                }}
              />

              {/* Botones de sugerencias rápidas */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  'Cliente devolvió el repuesto',
                  'Error de digitación en caja',
                  'Medida/código equivocado',
                  'Garantía / Repuesto con falla',
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setMotivoAnulacion(sug)}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      backgroundColor: motivoAnulacion === sug ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                      color: motivoAnulacion === sug ? '#FFFFFF' : 'var(--hd-text-dim)',
                      border: '1px solid var(--hd-border)',
                      borderRadius: 4,
                      padding: '3px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setVentaParaAnular(null)}
                disabled={anulando}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--hd-elevated)',
                  border: '1px solid var(--hd-border)',
                  color: 'var(--hd-text-title)',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAnulacion}
                disabled={anulando || !motivoAnulacion.trim()}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  backgroundColor: 'var(--status-danger)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: anulando ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 12px rgba(239, 68, 68, 0.4)',
                }}
              >
                <RotateCcw size={14} />
                <span>{anulando ? 'Anulando y reingresando...' : 'Confirmar Anulación y Devolución'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FLOTANTE DE NOTIFICACIONES (AUTOLOAD / ANULACIÓN) */}
      {notificacionToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            backgroundColor: notificacionToast.tipo === 'success' ? '#064E3B' : '#7F1D1D',
            color: '#FFFFFF',
            border: `1.5px solid ${notificacionToast.tipo === 'success' ? '#10B981' : '#EF4444'}`,
            borderRadius: 8,
            boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
            maxWidth: 450,
          }}
        >
          {notificacionToast.tipo === 'success' ? (
            <CheckCircle2 size={18} color="#34D399" style={{ flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={18} color="#F87171" style={{ flexShrink: 0 }} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
            {notificacionToast.mensaje}
          </div>
          <button
            type="button"
            onClick={() => setNotificacionToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.8,
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
      </main>
    </div>
  );
}
