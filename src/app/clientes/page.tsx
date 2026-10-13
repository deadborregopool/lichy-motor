'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { Cliente } from '@/lib/supabase';
import {
  obtenerClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  registrarAbonoCliente,
  obtenerHistorialCliente,
  obtenerResumenCartera,
  ResumenCarteraClientes,
  HistorialCuentaCliente,
  CompraCliente,
} from '@/services/clienteService';
import { formatearSoles } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  Search,
  Plus,
  Phone,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  X,
  Edit2,
  Trash2,
  Receipt,
  Coins,
  Package,
  Calendar,
  User,
  ShoppingBag,
  ExternalLink,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function ClientesPage() {
  const { usuarioActual } = useAuth();

  // Estados principales
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'con_deuda' | 'al_dia'>('todos');
  const [resumenCartera, setResumenCartera] = useState<ResumenCarteraClientes>({
    totalClientes: 0,
    totalDeudaGlobal: 0,
    clientesConDeuda: 0,
    clientesAlDia: 0,
    totalComprasPendientes: 0,
  });

  // Modal Crear / Editar Cliente
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false);
  const [clienteEnEdicion, setClienteEnEdicion] = useState<Cliente | null>(null);
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [errorCliente, setErrorCliente] = useState<string | null>(null);

  // Campos de formulario Cliente (Simplificado: sin vehículo ni límite de crédito)
  const [formNombre, setFormNombre] = useState('');
  const [formTipoDoc, setFormTipoDoc] = useState<'1' | '6' | ''>(''); // 1=DNI, 6=RUC, ''=Sin doc
  const [formNumDoc, setFormNumDoc] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formDireccion, setFormDireccion] = useState('');
  const [formEsFrecuente, setFormEsFrecuente] = useState(false);

  // Modal Detalle / Historial de Cuenta y Compras (Modal 3 - zIndex 60)
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);
  const [historialCuenta, setHistorialCuenta] = useState<HistorialCuentaCliente>({
    comprasPendientes: [],
    comprasPagadas: [],
    abonos: [],
    deudaTotal: 0,
  });
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [pestanaHistorial, setPestanaHistorial] = useState<'pendientes' | 'pagadas' | 'abonos'>('pendientes');

  // Modal Registrar Abono (Modal 2 - zIndex 120 para quedar encima de todo)
  const [modalAbonoAbierto, setModalAbonoAbierto] = useState(false);
  const [clienteParaAbono, setClienteParaAbono] = useState<Cliente | null>(null);
  const [ventaIdAbono, setVentaIdAbono] = useState<number | null>(null);
  const [comprasPendientesParaAbono, setComprasPendientesParaAbono] = useState<CompraCliente[]>([]);
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoAbono, setMetodoAbono] = useState('efectivo');
  const [notasAbono, setNotasAbono] = useState('');
  const [procesandoAbono, setProcesandoAbono] = useState(false);
  const [errorAbono, setErrorAbono] = useState<string | null>(null);
  const [exitoAbono, setExitoAbono] = useState(false);

  // Cargar datos iniciales
  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [lista, cartera] = await Promise.all([
        obtenerClientes(),
        obtenerResumenCartera(),
      ]);
      setClientes(lista);
      setResumenCartera(cartera);
    } catch (error) {
      console.error('Error al cargar datos de clientes:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Filtrado de clientes
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const term = busqueda.toLowerCase().trim();
      const coincideBusqueda =
        !term ||
        c.nombre.toLowerCase().includes(term) ||
        (c.numero_documento && c.numero_documento.toLowerCase().includes(term)) ||
        (c.telefono && c.telefono.toLowerCase().includes(term));

      if (!coincideBusqueda) return false;

      const deuda = Number(c.saldo_deudor) || 0;
      const pendientes = Number(c.compras_pendientes_count) || 0;
      if (filtroEstado === 'con_deuda') return deuda > 0 || pendientes > 0;
      if (filtroEstado === 'al_dia') return deuda <= 0 && pendientes === 0;

      return true;
    });
  }, [clientes, busqueda, filtroEstado]);

  // Abrir modal para crear cliente
  const abrirModalCrear = () => {
    setClienteEnEdicion(null);
    setFormNombre('');
    setFormTipoDoc('');
    setFormNumDoc('');
    setFormTelefono('');
    setFormDireccion('');
    setFormEsFrecuente(false);
    setErrorCliente(null);
    setModalClienteAbierto(true);
  };

  // Abrir modal para editar cliente
  const abrirModalEditar = (c: Cliente) => {
    setClienteEnEdicion(c);
    setFormNombre(c.nombre);
    setFormTipoDoc((c.tipo_documento as any) || (c.numero_documento ? (c.numero_documento.length === 11 ? '6' : '1') : ''));
    setFormNumDoc(c.numero_documento || '');
    setFormTelefono(c.telefono || '');
    setFormDireccion(c.direccion || '');
    setFormEsFrecuente(Boolean(c.es_frecuente));
    setErrorCliente(null);
    setModalClienteAbierto(true);
  };

  // Guardar cliente
  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCliente(null);

    if (!formNombre.trim()) {
      setErrorCliente('El nombre del cliente o taller es obligatorio.');
      return;
    }

    setGuardandoCliente(true);
    try {
      const numDoc = formNumDoc.trim() || null;
      const tipoDoc = numDoc ? (formTipoDoc || (numDoc.length === 11 ? '6' : '1')) : null;

      if (clienteEnEdicion) {
        const res = await actualizarCliente(clienteEnEdicion.id, {
          nombre: formNombre.trim(),
          tipo_documento: tipoDoc,
          numero_documento: numDoc,
          telefono: formTelefono.trim() || null,
          direccion: formDireccion.trim() || null,
          es_frecuente: formEsFrecuente,
        });

        if (!res.success) {
          setErrorCliente(res.error || 'No se pudo actualizar el cliente.');
          return;
        }
      } else {
        const res = await crearCliente({
          nombre: formNombre.trim(),
          tipo_documento: tipoDoc,
          numero_documento: numDoc,
          telefono: formTelefono.trim() || null,
          direccion: formDireccion.trim() || null,
          es_frecuente: formEsFrecuente,
        });

        if (!res.success) {
          setErrorCliente(res.error || 'No se pudo registrar el cliente.');
          return;
        }
      }

      setModalClienteAbierto(false);
      await cargarDatos();
    } catch (err: any) {
      setErrorCliente(err.message || 'Error al guardar cliente');
    } finally {
      setGuardandoCliente(false);
    }
  };

  // Abrir modal de Abono
  const abrirModalAbono = async (c: Cliente, ventaPreseleccionada?: CompraCliente) => {
    setClienteParaAbono(c);
    setErrorAbono(null);
    setExitoAbono(false);
    setMetodoAbono('efectivo');
    setNotasAbono('');

    try {
      const historial = await obtenerHistorialCliente(c.id);
      setComprasPendientesParaAbono(historial.comprasPendientes);

      if (ventaPreseleccionada) {
        setVentaIdAbono(ventaPreseleccionada.id);
        setMontoAbono(ventaPreseleccionada.saldo_pendiente.toFixed(2));
      } else if (historial.comprasPendientes.length > 0) {
        setVentaIdAbono(historial.comprasPendientes[0].id);
        setMontoAbono(historial.comprasPendientes[0].saldo_pendiente.toFixed(2));
      } else {
        setVentaIdAbono(null);
        setMontoAbono(Number(c.saldo_deudor || 0).toFixed(2));
      }
    } catch (e) {
      setVentaIdAbono(null);
      setMontoAbono(Number(c.saldo_deudor || 0).toFixed(2));
    }

    setModalAbonoAbierto(true);
  };

  // Registrar abono
  const handleRegistrarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteParaAbono) return;

    setErrorAbono(null);
    const monto = parseFloat(montoAbono);
    const deudaActual = Number(clienteParaAbono.saldo_deudor) || 0;

    if (isNaN(monto) || monto <= 0) {
      setErrorAbono('Ingresa un monto válido mayor a S/ 0.');
      return;
    }

    if (monto > deudaActual + 0.01) {
      setErrorAbono(`El abono (S/ ${monto.toFixed(2)}) no puede superar la deuda actual (${formatearSoles(deudaActual)}).`);
      return;
    }

    setProcesandoAbono(true);
    try {
      const res = await registrarAbonoCliente({
        cliente_id: clienteParaAbono.id,
        monto_abonado: monto,
        metodo_pago: metodoAbono,
        usuario_nombre: usuarioActual?.nombre || 'Cajero',
        venta_id: ventaIdAbono || null,
        notas: notasAbono.trim() || undefined,
      });

      if (!res.success) {
        setErrorAbono(res.error || 'No se pudo registrar el abono.');
        return;
      }

      setExitoAbono(true);
      await cargarDatos();

      // Si el modal de historial estaba abierto, actualizarlo inmediatamente
      if (clienteDetalle && clienteDetalle.id === clienteParaAbono.id) {
        const histActualizado = await obtenerHistorialCliente(clienteParaAbono.id);
        setHistorialCuenta(histActualizado);
        setClienteDetalle((prev) => (prev ? { ...prev, saldo_deudor: histActualizado.deudaTotal } : null));
      }

      setTimeout(() => {
        setModalAbonoAbierto(false);
        setExitoAbono(false);
      }, 1000);
    } catch (err: any) {
      setErrorAbono(err.message || 'Error al procesar abono');
    } finally {
      setProcesandoAbono(false);
    }
  };

  // Abrir modal de Detalle / Compras en Deuda
  const abrirModalHistorial = async (c: Cliente) => {
    setClienteDetalle(c);
    setCargandoHistorial(true);
    setPestanaHistorial('pendientes');
    setModalHistorialAbierto(true);
    try {
      const data = await obtenerHistorialCliente(c.id);
      setHistorialCuenta(data);
    } catch (err) {
      console.error('Error al obtener historial de compras:', err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Eliminar cliente
  const handleEliminarCliente = async (c: Cliente) => {
    const deuda = Number(c.saldo_deudor) || 0;
    if (deuda > 0) {
      alert(`No se puede eliminar el cliente "${c.nombre}" porque mantiene una deuda pendiente de ${formatearSoles(deuda)}.`);
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar al cliente "${c.nombre}"?`)) return;

    const res = await eliminarCliente(c.id);
    if (!res.success) {
      alert(res.error || 'No se pudo eliminar el cliente.');
      return;
    }

    await cargarDatos();
  };

  // Venta seleccionada en modal de abono para ver su saldo
  const ventaSeleccionadaAbono = useMemo(() => {
    if (!ventaIdAbono) return null;
    return comprasPendientesParaAbono.find((v) => v.id === ventaIdAbono) || null;
  }, [ventaIdAbono, comprasPendientesParaAbono]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--hd-bg)', color: 'var(--hd-text-body)' }}>
      <Navbar />

      <main className="hd-page-container">
        {/* Cabecera Principal */}
        <div className="clientes-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  backgroundColor: 'var(--hd-elevated)',
                  border: '1.5px solid var(--hd-orange)',
                  borderRadius: 8,
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px var(--hd-orange-glow)',
                  flexShrink: 0,
                }}
              >
                <Users size={22} color="var(--hd-orange)" />
              </div>
              <div>
                <h1 style={{ fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 900, color: 'var(--hd-text-title)', textTransform: 'uppercase', margin: 0, lineHeight: 1.2 }}>
                  Clientes & Compras en Deuda
                </h1>
                <span style={{ fontSize: 11.5, color: 'var(--hd-text-dim)', display: 'block', marginTop: 2 }}>
                  Gestión ágil de clientes, fiados detallados por repuestos y cobranzas
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={abrirModalCrear}
            style={{
              backgroundColor: 'var(--hd-orange)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 12,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 0 14px var(--hd-orange-glow)',
              transition: 'transform 0.15s, background-color 0.15s',
            }}
          >
            <Plus size={16} />
            <span>Nuevo Cliente / Taller</span>
          </button>
        </div>

        {/* Tarjetas de Resumen KPI */}
        <div className="clientes-kpi-grid">
          {/* Card 1: Total Clientes */}
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid var(--hd-border)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>
                Total Clientes
              </span>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--hd-text-title)', marginTop: 4 }}>
                {resumenCartera.totalClientes}
              </div>
              <span style={{ fontSize: 10, color: 'var(--hd-text-muted)' }}>Mecánicos y público</span>
            </div>
            <div style={{ backgroundColor: 'var(--hd-elevated)', borderRadius: 8, padding: 8, flexShrink: 0 }}>
              <Users size={20} color="var(--hd-orange)" />
            </div>
          </div>

          {/* Card 2: Deuda Total en la Calle */}
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--status-danger)', textTransform: 'uppercase' }}>
                Deuda en Calle
              </span>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--status-danger)', marginTop: 4 }} className="tabular">
                {formatearSoles(resumenCartera.totalDeudaGlobal)}
              </div>
              <span style={{ fontSize: 10, color: 'var(--hd-text-muted)' }}>
                {resumenCartera.clientesConDeuda} con saldo pendiente
              </span>
            </div>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 8, padding: 8, flexShrink: 0 }}>
              <DollarSign size={20} color="var(--status-danger)" />
            </div>
          </div>

          {/* Card 3: Compras en Deuda por Cobrar */}
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase' }}>
                Compras Pendientes
              </span>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#F59E0B', marginTop: 4 }}>
                {resumenCartera.totalComprasPendientes}
              </div>
              <span style={{ fontSize: 10, color: 'var(--hd-text-muted)' }}>Boletas con saldo</span>
            </div>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', borderRadius: 8, padding: 8, flexShrink: 0 }}>
              <ShoppingBag size={20} color="#F59E0B" />
            </div>
          </div>

          {/* Card 4: Clientes al Día */}
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--status-success)', textTransform: 'uppercase' }}>
                Clientes al Día
              </span>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--status-success)', marginTop: 4 }}>
                {resumenCartera.clientesAlDia}
              </div>
              <span style={{ fontSize: 10, color: 'var(--hd-text-muted)' }}>Cuentas en S/ 0.00</span>
            </div>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: 8, padding: 8, flexShrink: 0 }}>
              <CheckCircle2 size={20} color="var(--status-success)" />
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Buscador */}
        <div
          className="clientes-search-bar"
          style={{
            backgroundColor: 'var(--hd-surface)',
            border: '1px solid var(--hd-border)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 16,
          }}
        >
          {/* Buscador predictivo */}
          <div
            className="clientes-search-input"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'var(--hd-input-bg)',
              border: '1.5px solid var(--hd-orange)',
              borderRadius: 8,
              padding: '9px 12px',
              width: '100%',
              maxWidth: 460,
            }}
          >
            <Search size={16} color="var(--hd-orange)" />
            <input
              type="text"
              placeholder="Buscar por nombre, documento o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--hd-text-title)',
                fontSize: 12,
                width: '100%',
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

          {/* Filtros de Estado */}
          <div className="clientes-filter-buttons touch-scroll no-scrollbar" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
            <button
              type="button"
              onClick={() => setFiltroEstado('todos')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: filtroEstado === 'todos' ? 900 : 700,
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: filtroEstado === 'todos' ? 'var(--hd-orange)' : 'var(--hd-elevated)',
                color: filtroEstado === 'todos' ? '#FFFFFF' : 'var(--hd-text-muted)',
                border: '1px solid var(--hd-border)',
                textTransform: 'uppercase',
              }}
            >
              Todos ({clientes.length})
            </button>

            <button
              type="button"
              onClick={() => setFiltroEstado('con_deuda')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: filtroEstado === 'con_deuda' ? 900 : 700,
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: filtroEstado === 'con_deuda' ? 'var(--status-danger)' : 'var(--hd-elevated)',
                color: filtroEstado === 'con_deuda' ? '#FFFFFF' : 'var(--status-danger)',
                border: '1px solid var(--hd-border)',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <AlertTriangle size={13} />
              <span>Con Deuda ({resumenCartera.clientesConDeuda})</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroEstado('al_dia')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: filtroEstado === 'al_dia' ? 900 : 700,
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: filtroEstado === 'al_dia' ? 'var(--status-success)' : 'var(--hd-elevated)',
                color: filtroEstado === 'al_dia' ? '#FFFFFF' : 'var(--status-success)',
                border: '1px solid var(--hd-border)',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <CheckCircle2 size={13} />
              <span>Al Día ({resumenCartera.clientesAlDia})</span>
            </button>
          </div>
        </div>

        {/* VISTA DESKTOP: TABLA CORPORATIVA */}
        <div
          className="clientes-table-desktop"
          style={{
            backgroundColor: 'var(--hd-surface)',
            border: '1px solid var(--hd-border)',
            borderRadius: 12,
            padding: 16,
            boxShadow: 'var(--shadow-card)',
            overflowX: 'auto',
          }}
        >
          {cargando ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
              Cargando directorio de clientes y compras en deuda...
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
              {busqueda
                ? 'No se encontraron clientes que coincidan con la búsqueda.'
                : 'Aún no tienes clientes registrados. Haz clic en "Nuevo Cliente / Taller" para comenzar.'}
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hd-border)', textAlign: 'left', color: 'var(--hd-text-muted)' }}>
                  <th style={{ padding: '10px 12px', width: 280 }}>Cliente / Taller</th>
                  <th style={{ padding: '10px 12px', width: 140 }}>Documento</th>
                  <th style={{ padding: '10px 12px', width: 150 }}>Teléfono / WhatsApp</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: 180 }}>Compras en Deuda</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: 140 }}>Total Adeudado</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: 200 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((c) => {
                  const deuda = Number(c.saldo_deudor) || 0;
                  const cantCompras = Number(c.compras_pendientes_count) || 0;
                  const tieneDeuda = deuda > 0 || cantCompras > 0;

                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid var(--hd-border)',
                        backgroundColor: tieneDeuda ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {/* Cliente / Taller */}
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: tieneDeuda ? 'rgba(239, 68, 68, 0.15)' : 'var(--hd-elevated)',
                              border: tieneDeuda ? '1px solid var(--status-danger)' : '1px solid var(--hd-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <User size={18} color={tieneDeuda ? 'var(--status-danger)' : 'var(--hd-orange)'} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--hd-text-title)', fontSize: 13 }}>
                              {c.nombre}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              {c.es_frecuente && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 900,
                                    backgroundColor: 'var(--hd-elevated)',
                                    color: 'var(--hd-orange)',
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    border: '1px solid var(--hd-orange)',
                                  }}
                                >
                                  Mecánico / Frecuente
                                </span>
                              )}
                              {c.direccion && (
                                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  📍 {c.direccion}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Documento (Opcional) */}
                      <td style={{ padding: '12px 12px' }}>
                        {c.numero_documento ? (
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-title)' }} className="tabular">
                              {c.numero_documento}
                            </span>
                            <div style={{ fontSize: 9, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>
                              {c.tipo_documento === '6' ? 'RUC' : 'DNI'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--hd-text-dim)', fontSize: 11, fontStyle: 'italic' }}>
                            Sin documento
                          </span>
                        )}
                      </td>

                      {/* Teléfono / WhatsApp */}
                      <td style={{ padding: '12px 12px' }}>
                        {c.telefono ? (
                          <a
                            href={`https://wa.me/51${c.telefono.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              color: 'var(--status-success)',
                              fontWeight: 700,
                              textDecoration: 'none',
                              fontSize: 12,
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                            title="Contactar por WhatsApp"
                          >
                            <Phone size={12} />
                            <span>{c.telefono}</span>
                          </a>
                        ) : (
                          <span style={{ color: 'var(--hd-text-dim)', fontSize: 11 }}>—</span>
                        )}
                      </td>

                      {/* Compras en Deuda */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        {cantCompras > 0 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: 'var(--status-danger)',
                              border: '1px solid var(--status-danger)',
                              borderRadius: 20,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            <ShoppingBag size={12} />
                            <span>{cantCompras} compra{cantCompras > 1 ? 's' : ''} pendiente{cantCompras > 1 ? 's' : ''}</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: 'var(--status-success)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: 20,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>Al día (0 deudas)</span>
                          </span>
                        )}
                      </td>

                      {/* Total Adeudado */}
                      <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                        {tieneDeuda ? (
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 900,
                              color: 'var(--status-danger)',
                            }}
                            className="tabular"
                          >
                            {formatearSoles(deuda)}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: 'var(--status-success)',
                            }}
                            className="tabular"
                          >
                            S/ 0.00
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {/* Botón Ver Cuenta */}
                          <button
                            type="button"
                            onClick={() => abrirModalHistorial(c)}
                            title="Ver Cuenta e Ítems Comprados"
                            style={{
                              backgroundColor: 'var(--hd-elevated)',
                              border: '1px solid var(--hd-orange)',
                              borderRadius: 6,
                              padding: '5px 10px',
                              color: 'var(--hd-orange)',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <Receipt size={13} />
                            <span>Ver Cuenta</span>
                          </button>

                          {/* Botón Abonar */}
                          {tieneDeuda && (
                            <button
                              type="button"
                              onClick={() => abrirModalAbono(c)}
                              title="Registrar Abono a Compra"
                              style={{
                                backgroundColor: 'var(--status-success)',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: 6,
                                padding: '5px 9px',
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              <Coins size={12} />
                              <span>Abonar</span>
                            </button>
                          )}

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(c)}
                            title="Editar Datos"
                            style={{
                              backgroundColor: 'var(--hd-elevated)',
                              border: '1px solid var(--hd-border)',
                              borderRadius: 6,
                              padding: '5px 7px',
                              color: 'var(--hd-text-dim)',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleEliminarCliente(c)}
                            title="Eliminar Cliente"
                            style={{
                              backgroundColor: 'var(--hd-elevated)',
                              border: '1px solid var(--hd-border)',
                              borderRadius: 6,
                              padding: '5px 7px',
                              color: 'var(--hd-text-dim)',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* VISTA MÓVIL: TARJETAS TÁCTILES ERGONÓMICAS */}
        <div className="clientes-cards-mobile">
          {cargando ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13, backgroundColor: 'var(--hd-surface)', borderRadius: 12, border: '1px solid var(--hd-border)' }}>
              Cargando directorio de clientes...
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13, backgroundColor: 'var(--hd-surface)', borderRadius: 12, border: '1px solid var(--hd-border)' }}>
              {busqueda
                ? 'No se encontraron clientes que coincidan con la búsqueda.'
                : 'Aún no tienes clientes registrados.'}
            </div>
          ) : (
            clientesFiltrados.map((c) => {
              const deuda = Number(c.saldo_deudor) || 0;
              const cantCompras = Number(c.compras_pendientes_count) || 0;
              const tieneDeuda = deuda > 0 || cantCompras > 0;

              return (
                <article
                  key={`card-${c.id}`}
                  className={`clientes-card-item ${tieneDeuda ? 'con-deuda' : ''}`}
                >
                  {/* Fila 1: Avatar, Nombre + Badges, Estado de Deuda */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          backgroundColor: tieneDeuda ? 'rgba(239, 68, 68, 0.15)' : 'var(--hd-elevated)',
                          border: tieneDeuda ? '1px solid var(--status-danger)' : '1px solid var(--hd-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <User size={18} color={tieneDeuda ? 'var(--status-danger)' : 'var(--hd-orange)'} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: 'var(--hd-text-title)',
                            fontSize: 13.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.nombre}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                          {c.es_frecuente && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 900,
                                backgroundColor: 'rgba(255, 95, 0, 0.15)',
                                color: 'var(--hd-orange)',
                                padding: '1px 5px',
                                borderRadius: 3,
                                border: '1px solid var(--hd-orange)',
                              }}
                            >
                              Mecánico / Frecuente
                            </span>
                          )}
                          {c.numero_documento && (
                            <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 700 }}>
                              {c.tipo_documento === '6' ? 'RUC' : 'DNI'}: {c.numero_documento}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Estado de Deuda Badge */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {tieneDeuda ? (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--status-danger)' }} className="tabular">
                            {formatearSoles(deuda)}
                          </div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--status-danger)', marginTop: 1 }}>
                            {cantCompras} pendiente{cantCompras > 1 ? 's' : ''}
                          </div>
                        </div>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: 'var(--status-success)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: 12,
                            padding: '3px 8px',
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          <CheckCircle2 size={11} />
                          <span>Al día</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fila 2: Teléfono / WhatsApp y Dirección */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 11,
                      paddingTop: 4,
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {c.telefono ? (
                      <a
                        href={`https://wa.me/51${c.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          color: 'var(--status-success)',
                          fontWeight: 700,
                          textDecoration: 'none',
                          fontSize: 11,
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <Phone size={11} />
                        <span>{c.telefono}</span>
                      </a>
                    ) : (
                      <span style={{ color: 'var(--hd-text-dim)', fontSize: 10 }}>Sin teléfono</span>
                    )}

                    {c.direccion && (
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--hd-text-dim)',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={c.direccion}
                      >
                        📍 {c.direccion}
                      </span>
                    )}
                  </div>

                  {/* Fila 3: Botones de Acción Ergonómicos */}
                  <div style={{ display: 'grid', gridTemplateColumns: tieneDeuda ? '1fr 1fr 38px 38px' : '1fr 38px 38px', gap: 6, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => abrirModalHistorial(c)}
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px solid var(--hd-orange)',
                        borderRadius: 6,
                        padding: '8px 10px',
                        color: 'var(--hd-orange)',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}
                    >
                      <Receipt size={13} />
                      <span>Ver Cuenta</span>
                    </button>

                    {tieneDeuda && (
                      <button
                        type="button"
                        onClick={() => abrirModalAbono(c)}
                        style={{
                          backgroundColor: 'var(--status-success)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 10px',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        <Coins size={12} />
                        <span>Abonar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => abrirModalEditar(c)}
                      title="Editar Datos"
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px solid var(--hd-border)',
                        borderRadius: 6,
                        padding: '8px 0',
                        color: 'var(--hd-text-dim)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEliminarCliente(c)}
                      title="Eliminar Cliente"
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px solid var(--hd-border)',
                        borderRadius: 6,
                        padding: '8px 0',
                        color: 'var(--hd-text-dim)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>

      {/* ======================================================== */}
      {/* MODAL 1: REGISTRAR / EDITAR CLIENTE (zIndex: 50)         */}
      {/* ======================================================== */}
      {modalClienteAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1.5px solid var(--hd-orange)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={20} color="var(--hd-orange)" />
                <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-text-title)', textTransform: 'uppercase', margin: 0 }}>
                  {clienteEnEdicion ? 'Editar Cliente' : 'Nuevo Cliente / Taller'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalClienteAbierto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {errorCliente && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--status-danger)',
                  color: 'var(--status-danger)',
                  padding: '10px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                {errorCliente}
              </div>
            )}

            <form onSubmit={handleSubmitCliente}>
              {/* Nombre / Razón Social (OBLIGATORIO) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-title)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Nombre del Cliente o Taller *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Don Lucho, Taller El Chino, Carlos Mendoza..."
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1.5px solid var(--hd-orange)',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* Teléfono / WhatsApp (OPCIONAL) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Teléfono / Celular WhatsApp (Opcional)
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 987654321"
                  value={formTelefono}
                  onChange={(e) => setFormTelefono(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border)',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                  }}
                />
              </div>

              {/* Documento Opcional (DNI o RUC) */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Tipo Doc
                  </label>
                  <select
                    value={formTipoDoc}
                    onChange={(e) => setFormTipoDoc(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 8px',
                      borderRadius: 6,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border)',
                      color: 'var(--hd-text-title)',
                      fontSize: 12,
                    }}
                  >
                    <option value="">Sin Doc</option>
                    <option value="1">DNI</option>
                    <option value="6">RUC</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    N° Documento (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="DNI (8 dígitos) o RUC (11)"
                    value={formNumDoc}
                    onChange={(e) => setFormNumDoc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border)',
                      color: 'var(--hd-text-title)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Dirección / Referencia (OPCIONAL) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Dirección o Referencia del Taller (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Av. Las Américas 450, frente al grifo"
                  value={formDireccion}
                  onChange={(e) => setFormDireccion(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-border)',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                  }}
                />
              </div>

              {/* Switch Cliente Frecuente */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    backgroundColor: 'var(--hd-elevated)',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--hd-border)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formEsFrecuente}
                    onChange={(e) => setFormEsFrecuente(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--hd-orange)', cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ fontSize: 12, color: 'var(--hd-text-title)', display: 'block' }}>
                      Mecánico / Cliente Frecuente
                    </strong>
                    <span style={{ fontSize: 10, color: 'var(--hd-text-dim)' }}>
                      Destaca al cliente en el mostrador para búsquedas rápidas.
                    </span>
                  </div>
                </label>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalClienteAbierto(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-elevated)',
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
                  disabled={guardandoCliente}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 6,
                    backgroundColor: 'var(--hd-orange)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: '0 0 10px var(--hd-orange-glow)',
                    opacity: guardandoCliente ? 0.6 : 1,
                  }}
                >
                  {guardandoCliente ? 'Guardando...' : clienteEnEdicion ? 'Actualizar' : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ESTADO DE CUENTA & COMPRAS EN DEUDA (zIndex: 60)                */}
      {/* ========================================================================= */}
      {modalHistorialAbierto && clienteDetalle && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '1.5px solid var(--hd-orange)',
              borderRadius: 14,
              padding: 24,
              maxWidth: 860,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--hd-text-title)', textTransform: 'uppercase', margin: 0 }}>
                    {clienteDetalle.nombre}
                  </h2>
                  {clienteDetalle.es_frecuente && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        backgroundColor: 'var(--hd-elevated)',
                        color: 'var(--hd-orange)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        border: '1px solid var(--hd-orange)',
                      }}
                    >
                      Mecánico / Frecuente
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--hd-text-dim)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {clienteDetalle.numero_documento && (
                    <span>📄 {clienteDetalle.tipo_documento === '6' ? 'RUC' : 'DNI'}: {clienteDetalle.numero_documento}</span>
                  )}
                  {clienteDetalle.telefono && (
                    <span>📞 Tel: {clienteDetalle.telefono}</span>
                  )}
                  {clienteDetalle.direccion && (
                    <span>📍 {clienteDetalle.direccion}</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalHistorialAbierto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer', padding: 4 }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Banner de Deuda Global del Cliente */}
            <div
              style={{
                backgroundColor: 'var(--hd-elevated)',
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid var(--hd-border)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>
                  Deuda Total Acumulada
                </span>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: historialCuenta.deudaTotal > 0 ? 'var(--status-danger)' : 'var(--status-success)',
                    marginTop: 2,
                  }}
                  className="tabular"
                >
                  {formatearSoles(historialCuenta.deudaTotal)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    backgroundColor: historialCuenta.comprasPendientes.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: historialCuenta.comprasPendientes.length > 0 ? 'var(--status-danger)' : 'var(--status-success)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: `1px solid ${historialCuenta.comprasPendientes.length > 0 ? 'var(--status-danger)' : 'var(--status-success)'}`,
                  }}
                >
                  {historialCuenta.comprasPendientes.length > 0
                    ? `🔴 ${historialCuenta.comprasPendientes.length} compra(s) pendiente(s)`
                    : '🟢 Al día (0 compras pendientes)'}
                </span>

                {historialCuenta.deudaTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => abrirModalAbono(clienteDetalle)}
                    style={{
                      backgroundColor: 'var(--status-success)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 14px',
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <Coins size={14} />
                    <span>Registrar Abono</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pestañas de Navegación */}
            <div className="touch-scroll no-scrollbar" style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--hd-border)', marginBottom: 16, overflowX: 'auto', flexWrap: 'nowrap' }}>
              <button
                type="button"
                onClick={() => setPestanaHistorial('pendientes')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: pestanaHistorial === 'pendientes' ? '2.5px solid var(--status-danger)' : '2.5px solid transparent',
                  color: pestanaHistorial === 'pendientes' ? 'var(--status-danger)' : 'var(--hd-text-dim)',
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ShoppingBag size={14} />
                <span>Compras en Deuda ({historialCuenta.comprasPendientes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setPestanaHistorial('pagadas')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: pestanaHistorial === 'pagadas' ? '2.5px solid var(--status-success)' : '2.5px solid transparent',
                  color: pestanaHistorial === 'pagadas' ? 'var(--status-success)' : 'var(--hd-text-dim)',
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={14} />
                <span>Historial de Compras Pagadas ({historialCuenta.comprasPagadas.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setPestanaHistorial('abonos')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: pestanaHistorial === 'abonos' ? '2.5px solid var(--hd-orange)' : '2.5px solid transparent',
                  color: pestanaHistorial === 'abonos' ? 'var(--hd-orange)' : 'var(--hd-text-dim)',
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Coins size={14} />
                <span>Historial de Abonos ({historialCuenta.abonos.length})</span>
              </button>
            </div>

            {/* Contenido según la pestaña seleccionada */}
            {cargandoHistorial ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
                Cargando cuenta e ítems comprados...
              </div>
            ) : pestanaHistorial === 'pendientes' ? (
              /* PESTAÑA 1: COMPRAS EN DEUDA CON PRODUCTOS DETALLADOS */
              historialCuenta.comprasPendientes.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: 10,
                    border: '1px dashed var(--status-success)',
                  }}
                >
                  <Sparkles size={36} color="var(--status-success)" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--status-success)' }}>
                    ¡Este cliente no tiene compras en deuda!
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--hd-text-dim)', marginTop: 4, display: 'block' }}>
                    Todas sus compras al fiado están canceladas al 100%.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {historialCuenta.comprasPendientes.map((compra) => (
                    <div
                      key={compra.id}
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: 10,
                        padding: 16,
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      {/* Cabecera de la Tarjeta de Compra */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid var(--hd-border)',
                          paddingBottom: 10,
                          marginBottom: 12,
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: 'var(--hd-text-title)',
                              backgroundColor: 'var(--hd-surface)',
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--hd-border)',
                            }}
                          >
                            {compra.numero_comprobante || `Venta #${compra.id}`}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} />
                            {new Date(compra.fecha_venta).toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {compra.vendedor_nombre && (
                            <span style={{ fontSize: 10, color: 'var(--hd-text-muted)' }}>
                              • Vendedor: {compra.vendedor_nombre}
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--status-danger)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: '1px solid var(--status-danger)',
                          }}
                        >
                          🔴 PENDIENTE DE PAGO
                        </span>
                      </div>

                      {/* Desglose de Productos Comprados */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
                          Repuestos / Productos Comprados en este Fiado:
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--hd-border)', textAlign: 'left', color: 'var(--hd-text-muted)' }}>
                              <th style={{ padding: '4px 6px', width: 60 }}>Cant.</th>
                              <th style={{ padding: '4px 6px' }}>Descripción / Repuesto</th>
                              <th style={{ padding: '4px 6px', textAlign: 'right', width: 90 }}>P. Unit.</th>
                              <th style={{ padding: '4px 6px', textAlign: 'right', width: 90 }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {compra.items.map((it) => (
                              <tr key={it.id} style={{ borderBottom: '1px dashed rgba(255,255,255,0.06)' }}>
                                <td style={{ padding: '6px 6px', fontWeight: 800, color: 'var(--hd-orange)' }}>
                                  {it.cantidad}x
                                </td>
                                <td style={{ padding: '6px 6px', color: 'var(--hd-text-title)', fontWeight: 600 }}>
                                  {it.nombre_producto}
                                  {it.codigo && (
                                    <span style={{ fontSize: 9, color: 'var(--hd-text-dim)', marginLeft: 6 }}>
                                      [{it.codigo}]
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '6px 6px', textAlign: 'right', color: 'var(--hd-text-dim)' }} className="tabular">
                                  {formatearSoles(it.precio_unitario)}
                                </td>
                                <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 800, color: 'var(--hd-text-title)' }} className="tabular">
                                  {formatearSoles(it.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Barra de Liquidación y Saldo de esta Compra */}
                      <div
                        style={{
                          backgroundColor: 'var(--hd-surface)',
                          borderRadius: 8,
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid var(--hd-border)',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: 9, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block' }}>
                              Total Compra
                            </span>
                            <strong style={{ fontSize: 13, color: 'var(--hd-text-title)' }} className="tabular">
                              {formatearSoles(compra.total)}
                            </strong>
                          </div>

                          <div>
                            <span style={{ fontSize: 9, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block' }}>
                              Adelanto en Venta (Mostrador)
                            </span>
                            <strong style={{ fontSize: 13, color: 'var(--status-success)' }} className="tabular">
                              {formatearSoles(compra.monto_recibido)}
                            </strong>
                          </div>

                          <div>
                            <span style={{ fontSize: 9, color: 'var(--hd-text-dim)', textTransform: 'uppercase', display: 'block' }}>
                              Abonos Posteriores
                            </span>
                            <strong style={{ fontSize: 13, color: 'var(--status-success)' }} className="tabular">
                              {formatearSoles(compra.total_abonado)}
                            </strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--status-danger)', textTransform: 'uppercase' }}>
                              Saldo en Deuda:
                            </span>
                            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--status-danger)' }} className="tabular">
                              {formatearSoles(compra.saldo_pendiente)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => abrirModalAbono(clienteDetalle, compra)}
                            style={{
                              backgroundColor: 'var(--status-success)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 6,
                              padding: '7px 12px',
                              fontSize: 11,
                              fontWeight: 900,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            <Coins size={13} />
                            <span>Abonar a esta Compra</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : pestanaHistorial === 'pagadas' ? (
              /* PESTAÑA 2: HISTORIAL DE COMPRAS PAGADAS */
              historialCuenta.comprasPagadas.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
                  No se registran compras pagadas aún para este cliente.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historialCuenta.comprasPagadas.map((compra) => (
                    <div
                      key={compra.id}
                      style={{
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1px solid var(--hd-border)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 12, color: 'var(--hd-text-title)' }}>
                            {compra.numero_comprobante || `Venta #${compra.id}`}
                          </strong>
                          <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>
                            {new Date(compra.fecha_venta).toLocaleDateString('es-PE')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--status-success)' }} className="tabular">
                            {formatearSoles(compra.total)}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 900,
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: 'var(--status-success)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid var(--status-success)',
                            }}
                          >
                            PAGADO 100%
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>
                        {compra.items.map((it) => `${it.cantidad}x ${it.nombre_producto}`).join(' • ')}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* PESTAÑA 3: HISTORIAL DE ABONOS RECIBIDOS */
              historialCuenta.abonos.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--hd-text-dim)', fontSize: 13 }}>
                  No se registran abonos o pagos registrados para este cliente.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hd-border)', textAlign: 'left', color: 'var(--hd-text-muted)' }}>
                      <th style={{ padding: '8px 10px' }}>Fecha y Hora</th>
                      <th style={{ padding: '8px 10px' }}>Compra / Ticket Vinculado</th>
                      <th style={{ padding: '8px 10px' }}>Método</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Monto Abonado</th>
                      <th style={{ padding: '8px 10px' }}>Responsable / Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialCuenta.abonos.map((ab) => (
                      <tr key={ab.id} style={{ borderBottom: '1px solid var(--hd-border)' }}>
                        <td style={{ padding: '10px 10px', color: 'var(--hd-text-dim)' }}>
                          {new Date(ab.fecha_abono).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          {ab.ventas ? (
                            <div>
                              <span style={{ fontWeight: 800, color: 'var(--hd-text-title)' }}>
                                {ab.ventas.numero_comprobante || `Venta #${ab.ventas.id}`}
                              </span>
                              <div style={{ fontSize: 10, color: 'var(--hd-text-dim)' }}>
                                Total: {formatearSoles(ab.ventas.total || 0)}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--hd-text-muted)' }}>
                              Cuenta General
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 10px', textTransform: 'uppercase', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-title)' }}>
                          {ab.metodo_pago}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--status-success)' }} className="tabular">
                          +{formatearSoles(ab.monto_abonado)}
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--hd-text-dim)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--hd-text-title)' }}>{ab.usuario_nombre || 'Cajero'}</span>
                          {ab.notas && <div style={{ fontSize: 10, color: 'var(--hd-text-dim)', marginTop: 2 }}>{ab.notas}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTRAR ABONO (zIndex: 120 - RENDERIZADO AL FINAL PARA QUEDAR   */}
      {/* SIEMPRE POR ENCIMA DE CUALQUIER OTRO MODAL SIN PANTALLAZO NEGRO)          */}
      {/* ========================================================================= */}
      {modalAbonoAbierto && clienteParaAbono && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--status-success)',
              borderRadius: 14,
              padding: 24,
              maxWidth: 520,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 25px 70px rgba(0,0,0,0.95)',
              position: 'relative',
              zIndex: 125,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Coins size={22} color="var(--status-success)" />
                <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-text-title)', textTransform: 'uppercase', margin: 0 }}>
                  Registrar Abono a Compra
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalAbonoAbierto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--hd-text-dim)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {exitoAbono ? (
              <div
                style={{
                  padding: 28,
                  textAlign: 'center',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid var(--status-success)',
                  borderRadius: 8,
                }}
              >
                <CheckCircle2 size={40} color="var(--status-success)" style={{ margin: '0 auto 10px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--status-success)', margin: 0 }}>
                  ¡Abono Registrado Exitosamente!
                </h3>
                <span style={{ fontSize: 12, color: 'var(--hd-text-dim)', marginTop: 4, display: 'block' }}>
                  El pago se aplicó a la compra y el saldo fue actualizado.
                </span>
              </div>
            ) : (
              <form onSubmit={handleRegistrarAbono}>
                {/* Info Cliente */}
                <div
                  style={{
                    backgroundColor: 'var(--hd-elevated)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--hd-border)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>
                      Cliente / Taller
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--hd-text-title)' }}>
                      {clienteParaAbono.nombre}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-dim)', textTransform: 'uppercase' }}>
                      Deuda Total Cliente
                    </span>
                    <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--status-danger)' }} className="tabular">
                      {formatearSoles(Number(clienteParaAbono.saldo_deudor) || 0)}
                    </div>
                  </div>
                </div>

                {/* Selección de Compra Específica a Abonar */}
                {comprasPendientesParaAbono.length > 0 ? (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-title)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Compra a la que se aplicará el Abono *
                    </label>
                    <select
                      value={ventaIdAbono || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        setVentaIdAbono(val);
                        if (val) {
                          const v = comprasPendientesParaAbono.find((comp) => comp.id === val);
                          if (v) setMontoAbono(v.saldo_pendiente.toFixed(2));
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 6,
                        backgroundColor: 'var(--hd-input-bg)',
                        border: '1.5px solid var(--hd-orange)',
                        color: 'var(--hd-text-title)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {comprasPendientesParaAbono.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.numero_comprobante || `Venta #${v.id}`} — Saldo a Pagar: S/ {v.saldo_pendiente.toFixed(2)} ({new Date(v.fecha_venta).toLocaleDateString('es-PE')})
                        </option>
                      ))}
                      <option value="">Abono a Cuenta General</option>
                    </select>

                    {/* Resumen de la compra seleccionada */}
                    {ventaSeleccionadaAbono && (
                      <div
                        style={{
                          marginTop: 8,
                          backgroundColor: 'rgba(255, 94, 0, 0.08)',
                          border: '1px solid rgba(255, 94, 0, 0.25)',
                          borderRadius: 6,
                          padding: '8px 12px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 6,
                          fontSize: 10,
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--hd-text-dim)', display: 'block' }}>Total Compra</span>
                          <strong style={{ color: 'var(--hd-text-title)' }} className="tabular">
                            {formatearSoles(ventaSeleccionadaAbono.total)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--hd-text-dim)', display: 'block' }}>Adelanto Inicial</span>
                          <strong style={{ color: 'var(--status-success)' }} className="tabular">
                            {formatearSoles(ventaSeleccionadaAbono.monto_recibido)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--hd-text-dim)', display: 'block' }}>Abonos Previos</span>
                          <strong style={{ color: 'var(--status-success)' }} className="tabular">
                            {formatearSoles(ventaSeleccionadaAbono.total_abonado)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--status-danger)', fontWeight: 800, display: 'block' }}>Saldo a Pagar</span>
                          <strong style={{ color: 'var(--status-danger)', fontSize: 12 }} className="tabular">
                            {formatearSoles(ventaSeleccionadaAbono.saldo_pendiente)}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginBottom: 14, fontSize: 11, color: 'var(--hd-text-dim)' }}>
                    No hay compras individuales pendientes. El abono se registrará a la cuenta general.
                  </div>
                )}

                {/* Input Monto a Abonar */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-title)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Monto a Abonar (S/) *
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    min="0.10"
                    required
                    placeholder="0.00"
                    value={montoAbono}
                    onChange={(e) => setMontoAbono(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 6,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '2px solid var(--status-success)',
                      color: 'var(--status-success)',
                      fontSize: 18,
                      fontWeight: 900,
                    }}
                  />
                  {/* Botones rápidos */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (ventaSeleccionadaAbono) {
                          setMontoAbono(ventaSeleccionadaAbono.saldo_pendiente.toFixed(2));
                        } else {
                          setMontoAbono(Number(clienteParaAbono.saldo_deudor || 0).toFixed(2));
                        }
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 900,
                        backgroundColor: 'var(--hd-elevated)',
                        border: '1.5px solid var(--status-success)',
                        color: 'var(--status-success)',
                        cursor: 'pointer',
                      }}
                    >
                      Pagar Saldo Completo ({formatearSoles(ventaSeleccionadaAbono ? ventaSeleccionadaAbono.saldo_pendiente : Number(clienteParaAbono.saldo_deudor || 0))})
                    </button>
                    {[20, 50, 100].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setMontoAbono(val.toFixed(2))}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          backgroundColor: 'var(--hd-elevated)',
                          border: '1px solid var(--hd-border)',
                          color: 'var(--hd-text-title)',
                          cursor: 'pointer',
                        }}
                      >
                        S/ {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Método de Pago */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Método de Pago del Abono
                  </label>
                  <select
                    value={metodoAbono}
                    onChange={(e) => setMetodoAbono(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border)',
                      color: 'var(--hd-text-title)',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <option value="efectivo">💵 Efectivo en Caja</option>
                    <option value="yape">🟣 Yape</option>
                    <option value="plin">🔵 Plin</option>
                    <option value="transferencia">🏦 Transferencia Bancaria</option>
                    <option value="tarjeta">💳 Tarjeta Débito / Crédito</option>
                  </select>
                </div>

                {/* Notas */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Notas / Comentario (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Dejó a cuenta por repuesto CB125, vino su ayudante..."
                    value={notasAbono}
                    onChange={(e) => setNotasAbono(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border)',
                      color: 'var(--hd-text-title)',
                      fontSize: 12,
                    }}
                  />
                </div>

                {errorAbono && (
                  <div
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid var(--status-danger)',
                      color: 'var(--status-danger)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      marginBottom: 14,
                    }}
                  >
                    {errorAbono}
                  </div>
                )}

                {/* Botones */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setModalAbonoAbierto(false)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 6,
                      backgroundColor: 'var(--hd-elevated)',
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
                    disabled={procesandoAbono}
                    style={{
                      padding: '9px 22px',
                      borderRadius: 6,
                      backgroundColor: 'var(--status-success)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                      opacity: procesandoAbono ? 0.6 : 1,
                    }}
                  >
                    {procesandoAbono ? 'Registrando...' : 'Confirmar Cobro'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
