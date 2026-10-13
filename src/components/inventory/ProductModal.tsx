'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Producto, Proveedor } from '@/lib/supabase';
import { CATEGORIAS_MOTO, UNIDADES_MEDIDA } from '@/lib/constants';
import { crearProducto, actualizarProducto, eliminarProducto, DatosNuevoProducto } from '@/services/productService';
import { obtenerDistribuidores } from '@/services/distribuidorService';
import { formatearSoles } from '@/lib/formatters';
import { X, Upload, Trash2, Fuel, Package, Sparkles, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface ProductModalProps {
  abierto: boolean;
  productoEditar?: Producto | null;
  esAdmin: boolean;
  onCerrar: () => void;
  onGuardadoExitoso: () => void;
}

export default function ProductModal({
  abierto,
  productoEditar,
  esAdmin,
  onCerrar,
  onGuardadoExitoso,
}: ProductModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Aceites & Lubricantes');
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState('');
  const [esCategoriaNueva, setEsCategoriaNueva] = useState(false);
  const [unidadMedida, setUnidadMedida] = useState('botella');
  const [capacidadEnvase, setCapacidadEnvase] = useState<number | string>(1);
  const [volumenEnUso, setVolumenEnUso] = useState<number | string>(0);
  const [stockActual, setStockActual] = useState<number | string>(0);
  const [costoUnitario, setCostoUnitario] = useState<number | string>(0);
  const [precioVenta, setPrecioVenta] = useState<number | string>(0);
  const [imagenUrl, setImagenUrl] = useState('');
  const [proveedorId, setProveedorId] = useState<number | ''>('');
  const [distribuidores, setDistribuidores] = useState<Proveedor[]>([]);

  const [archivoFoto, setArchivoFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      obtenerDistribuidores().then(setDistribuidores).catch(console.error);
    }
  }, [abierto]);

  useEffect(() => {
    if (productoEditar) {
      setNombre(productoEditar.nombre);
      setCodigo(productoEditar.codigo || '');
      const catEdit = productoEditar.categoria || 'Aceites & Lubricantes';
      const esEstandar = (CATEGORIAS_MOTO as readonly string[]).includes(catEdit);
      if (esEstandar) {
        setCategoriaSeleccionada(catEdit);
        setEsCategoriaNueva(false);
        setCategoriaPersonalizada('');
      } else {
        setCategoriaSeleccionada('__OTRA__');
        setEsCategoriaNueva(true);
        setCategoriaPersonalizada(catEdit);
      }
      setUnidadMedida(productoEditar.unidad_medida || 'unidad');
      setStockActual(productoEditar.stock_actual);
      setCapacidadEnvase(productoEditar.capacidad_envase ?? (productoEditar.unidad_medida === 'balde' ? 20 : 1));
      setVolumenEnUso(productoEditar.volumen_en_uso ?? 0);
      setCostoUnitario(productoEditar.costo_unitario);
      setPrecioVenta(productoEditar.precio_venta);
      setImagenUrl(productoEditar.imagen_url || '');
      setProveedorId(productoEditar.proveedor_id || '');
      setPreviewFoto(productoEditar.imagen_url || null);
      setArchivoFoto(null);
    } else {
      setNombre('');
      setCodigo('');
      setCategoriaSeleccionada('Aceites & Lubricantes');
      setEsCategoriaNueva(false);
      setCategoriaPersonalizada('');
      setUnidadMedida('botella');
      setCapacidadEnvase(1);
      setVolumenEnUso(0);
      setStockActual(0);
      setCostoUnitario(0);
      setPrecioVenta(0);
      setImagenUrl('');
      setProveedorId('');
      setPreviewFoto(null);
      setArchivoFoto(null);
    }
    setErrorMsg(null);
  }, [productoEditar, abierto]);

  if (!abierto) return null;

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivoFoto(file);
      setPreviewFoto(URL.createObjectURL(file));
      setImagenUrl('');
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg('El nombre del repuesto es obligatorio');
      return;
    }

    if (Number(precioVenta) <= 0) {
      setErrorMsg('El precio de venta debe ser mayor a 0');
      return;
    }

    try {
      setGuardando(true);
      setErrorMsg(null);

      const categoriaFinal = esCategoriaNueva
        ? categoriaPersonalizada.trim() || 'Varios'
        : categoriaSeleccionada;

      const esCategoriaAceite = categoriaFinal.toLowerCase().includes('aceite') || categoriaFinal.toLowerCase().includes('lubricante');
      const esUnidadAceite = unidadMedida !== 'unidad';
      const esAceiteReal = esCategoriaAceite && esUnidadAceite;

      const payload: DatosNuevoProducto = {
        nombre: nombre.trim(),
        codigo: codigo.trim() || null,
        categoria: categoriaFinal || null,
        unidad_medida: unidadMedida,
        stock_actual: productoEditar ? Number(productoEditar.stock_actual) || 0 : 0,
        capacidad_envase: esAceiteReal && capacidadEnvase !== '' ? Number(capacidadEnvase) : null,
        volumen_en_uso: esAceiteReal && productoEditar ? Number(productoEditar.volumen_en_uso) || 0 : 0,
        costo_unitario: productoEditar ? (Number(costoUnitario) || 0) : 0,
        precio_venta: Number(precioVenta) || 0,
        imagen_url: imagenUrl.trim() || null,
        proveedor_id: proveedorId !== '' ? Number(proveedorId) : null,
      };

      if (productoEditar) {
        await actualizarProducto(productoEditar.id, payload, archivoFoto);
      } else {
        await crearProducto(payload, archivoFoto);
      }

      onGuardadoExitoso();
      onCerrar();
    } catch (err: any) {
      console.error('Error al guardar repuesto:', err);
      setErrorMsg(err?.message || 'Error al guardar en la base de datos');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!productoEditar) return;
    if (!confirm(`¿Estás seguro de eliminar "${productoEditar.nombre}" del catálogo?`)) return;

    try {
      setEliminando(true);
      await eliminarProducto(productoEditar.id);
      onGuardadoExitoso();
      onCerrar();
    } catch (err: any) {
      console.error('Error al eliminar:', err);
      setErrorMsg(err?.message || 'No se pudo eliminar el producto');
    } finally {
      setEliminando(false);
    }
  };

  const numPrecio = Number(precioVenta) || 0;
  const numCosto = Number(costoUnitario) || 0;
  const gananciaNeta = numPrecio - numCosto;
  const margenPorcentaje = numPrecio > 0 ? ((gananciaNeta / numPrecio) * 100).toFixed(1) : '0';

  const categoriaEfectiva = esCategoriaNueva ? categoriaPersonalizada : categoriaSeleccionada;
  const esCategoriaAceite = categoriaEfectiva.toLowerCase().includes('aceite') || categoriaEfectiva.toLowerCase().includes('lubricante');
  const esAceiteGranel = unidadMedida === 'litro' && esCategoriaAceite;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '12px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--hd-surface)',
          border: '2px solid var(--hd-orange)',
          borderRadius: '12px',
          maxWidth: 620,
          width: '100%',
          maxHeight: '94vh',
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--hd-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--hd-elevated)',
            borderRadius: '10px 10px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                backgroundColor: 'var(--hd-orange)',
                color: '#FFFFFF',
                padding: '6px 8px',
                borderRadius: '4px',
                display: 'flex',
              }}
            >
              {esCategoriaAceite ? <Fuel size={16} /> : <Package size={16} />}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--hd-text-title)' }}>
              {productoEditar ? 'Editar Repuesto' : 'Nuevo Repuesto'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            style={{ color: 'var(--hd-text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario con campos adaptativos */}
        <form onSubmit={handleGuardar} style={{ padding: '18px 16px', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--status-danger)',
                borderRadius: '6px',
                color: 'var(--status-danger)',
                fontSize: 13,
                marginBottom: 14,
                fontWeight: 600,
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Subida de Imagen con Compresión */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
              Foto del Repuesto (WebP automático)
            </label>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '8px',
                  backgroundColor: 'var(--hd-card-header)',
                  border: '1px dashed var(--hd-border-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {previewFoto ? (
                  <img src={previewFoto} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageIcon size={26} color="var(--hd-text-dim)" />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleSeleccionarArchivo}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    backgroundColor: 'var(--hd-elevated)',
                    border: '1px solid var(--hd-orange)',
                    borderRadius: '6px',
                    color: 'var(--hd-text-title)',
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    marginBottom: 4,
                  }}
                >
                  <Upload size={13} color="var(--hd-orange)" />
                  {previewFoto ? 'Cambiar Foto' : 'Subir o Tomar Foto'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--hd-text-dim)' }}>
                  <Sparkles size={11} color="var(--hd-orange)" />
                  <span>Comprime a WebP (&lt; 100 KB)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Nombre y Código (Adaptativo con clase responsive) */}
          <div className="hd-form-row-2">
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Nombre del Repuesto / Aceite *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Bujía NGK D8EA o Aceite 4T 20W-50"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--hd-input-bg)',
                  border: '1px solid var(--hd-border)',
                  borderRadius: '6px',
                  color: 'var(--hd-text-title)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Código / SKU
              </label>
              <input
                type="text"
                placeholder="Ej. BJ-NGK-01"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--hd-input-bg)',
                  border: '1px solid var(--hd-border)',
                  borderRadius: '6px',
                  color: 'var(--hd-orange)',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Categoría y Unidad de Medida */}
          <div className="hd-form-row-2">
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Categoría
              </label>
              <select
                value={categoriaSeleccionada}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategoriaSeleccionada(val);
                  if (val === '__OTRA__') {
                    setEsCategoriaNueva(true);
                    if (unidadMedida === 'litro') {
                      setUnidadMedida('unidad');
                    }
                  } else {
                    setEsCategoriaNueva(false);
                    if (val === 'Aceites & Lubricantes') {
                      if (unidadMedida !== 'litro' && unidadMedida !== 'botella') {
                        setUnidadMedida('botella');
                      }
                    } else {
                      if (unidadMedida === 'litro' || unidadMedida === 'botella') {
                        setUnidadMedida('unidad');
                      }
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--hd-input-bg)',
                  border: '1px solid var(--hd-border)',
                  borderRadius: '6px',
                  color: 'var(--hd-text-title)',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                {CATEGORIAS_MOTO.filter((c) => c !== 'Todos').map((c) => (
                  <option key={c} value={c} style={{ backgroundColor: 'var(--hd-surface)', color: 'var(--hd-text-title)' }}>
                    {c}
                  </option>
                ))}
                <option value="__OTRA__" style={{ backgroundColor: 'var(--hd-surface)', color: 'var(--hd-orange)', fontWeight: 700 }}>
                  + Otra categoría (Personalizada)...
                </option>
              </select>

              {esCategoriaNueva && (
                <input
                  type="text"
                  placeholder="Escribe la categoría (ej. Cascos, Pernos)..."
                  value={categoriaPersonalizada}
                  onChange={(e) => {
                    const texto = e.target.value;
                    setCategoriaPersonalizada(texto);
                    const pareceAceite = texto.toLowerCase().includes('aceite') || texto.toLowerCase().includes('lubricante');
                    if (pareceAceite && unidadMedida !== 'litro') {
                      setUnidadMedida('litro');
                    } else if (!pareceAceite && unidadMedida === 'litro') {
                      setUnidadMedida('unidad');
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '8px 12px',
                    backgroundColor: 'var(--hd-input-bg)',
                    border: '1px solid var(--hd-orange)',
                    borderRadius: '6px',
                    color: 'var(--hd-text-title)',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              )}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Unidad de Medida
              </label>
              <select
                value={unidadMedida}
                onChange={(e) => setUnidadMedida(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--hd-input-bg)',
                  border: '1px solid var(--hd-border)',
                  borderRadius: '6px',
                  color: 'var(--hd-text-title)',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                {UNIDADES_MEDIDA.map((u) => (
                  <option key={u.id} value={u.id} style={{ backgroundColor: 'var(--hd-surface)', color: 'var(--hd-text-title)' }}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Control Especial de Envases y Taller para Aceites */}
          {esCategoriaAceite && (
            <div
              style={{
                marginTop: 12,
                marginBottom: 14,
                padding: '12px',
                backgroundColor: 'var(--hd-elevated)',
                border: '1px solid var(--hd-border)',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Control de Envases y Balde Abierto
                </span>
                <span style={{ fontSize: 10, color: 'var(--hd-text-dim)', fontWeight: 600 }}>
                  Stock cerrado vs Balde en uso
                </span>
              </div>

              {/* Presets rápidos de tipos de envase */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 100px), 1fr))', gap: 6, marginBottom: 12 }}>
                {[
                  { id: 'balde', label: 'Balde (20L)', cap: 20 },
                  { id: 'galon', label: 'Galón (3.785L)', cap: 3.785 },
                  { id: 'botella', label: 'Botella (1L)', cap: 1 },
                  { id: 'botella', label: 'Cuarto (0.946L)', cap: 0.946 },
                  { id: 'tambor', label: 'Cilindro (208L)', cap: 208 },
                ].map((item, idx) => {
                  const seleccionado = unidadMedida === item.id && Number(capacidadEnvase) === item.cap;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setUnidadMedida(item.id);
                        setCapacidadEnvase(item.cap);
                      }}
                      style={{
                        padding: '7px 8px',
                        minHeight: 34,
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: seleccionado ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                        backgroundColor: seleccionado ? 'var(--hd-orange-subtle)' : 'var(--hd-surface)',
                        color: seleccionado ? 'var(--hd-orange)' : 'var(--hd-text-muted)',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="hd-form-row-2">
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Capacidad por Envase (Litros)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.1"
                    placeholder="Ej. 20 o 1"
                    value={capacidadEnvase}
                    onChange={(e) => setCapacidadEnvase(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border)',
                      borderRadius: '6px',
                      color: 'var(--hd-text-title)',
                      fontSize: 13,
                      fontWeight: 700,
                      outline: 'none',
                    }}
                    className="tabular"
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--hd-orange)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Balde Abierto en Taller
                  </label>
                  <div
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--hd-input-bg)',
                      border: '1px solid var(--hd-border)',
                      borderRadius: '6px',
                      color: 'var(--hd-text-title)',
                      fontSize: 13,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{productoEditar ? `${volumenEnUso} L` : '0 L (Inicial)'}</span>
                    <span style={{ fontSize: 9, color: 'var(--hd-text-dim)', fontWeight: 600 }}>👉 Vía + Destapar</span>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 10, color: 'var(--hd-text-dim)', marginTop: 6, lineHeight: 1.3 }}>
                💡 <strong>Stock Cerrado:</strong> Cantidad de envases cerrados en almacén. <br />
                <strong>En Uso:</strong> Litros disponibles en el balde que está actualmente destapado para venta suelta por cuarto o jarra.
              </p>
            </div>
          )}

          {/* Distribuidor Habitual */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
              Distribuidor Habitual (Opcional)
            </label>
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : '')}
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: 'var(--hd-input-bg)',
                border: '1px solid var(--hd-border)',
                borderRadius: '6px',
                color: 'var(--hd-text-title)',
                fontSize: 13,
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value="">-- Sin Distribuidor Asignado --</option>
              {distribuidores.map((d) => (
                <option key={d.id} value={d.id} style={{ backgroundColor: 'var(--hd-surface)', color: 'var(--hd-text-title)' }}>
                  {d.nombre} {d.ruc ? `(RUC: ${d.ruc})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Stock y Precios (Adaptativo con hd-form-row-3) */}
          <div className={esAdmin ? 'hd-form-row-3' : 'hd-form-row-2'}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                {esCategoriaAceite ? 'Envases Cerrados' : 'Stock en Almacén'}
              </label>
              <div
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--hd-elevated)',
                  border: '1px dashed var(--hd-border-strong)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--hd-text-title)' }} className="tabular">
                  {productoEditar ? `${stockActual} ${unidadMedida}(s)` : '0 (Inicial)'}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    backgroundColor: 'var(--hd-orange-subtle)',
                    color: 'var(--hd-orange)',
                    padding: '2px 5px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                  }}
                >
                  🔒 Vía Compras
                </span>
              </div>
            </div>

            {esAdmin && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  {productoEditar ? 'Costo de Reposición (S/)' : 'Costo de Compra (S/)'}
                </label>
                {productoEditar ? (
                  <div
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      backgroundColor: 'var(--hd-elevated)',
                      border: '1px solid var(--hd-border)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: 42,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 900, color: numCosto > 0 ? 'var(--hd-text-title)' : 'var(--hd-text-dim)' }} className="tabular">
                      {numCosto > 0 ? formatearSoles(numCosto) : '⏳ Sin compras'}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--hd-orange)', textTransform: 'uppercase' }}>
                      🔒 Vía Compras
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      backgroundColor: 'var(--hd-elevated)',
                      border: '1px dashed var(--hd-border-strong)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: 42,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--hd-text-dim)' }}>
                      ⏳ S/ 0.00 (Pendiente)
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--hd-orange)', textTransform: 'uppercase' }}>
                      Se fija al comprar
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-orange)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Precio Mostrador / Preferencial (S/) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.5"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                placeholder="Ej. 25.00"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--hd-input-bg)',
                  border: '2px solid var(--hd-orange)',
                  borderRadius: '6px',
                  color: 'var(--hd-text-title)',
                  fontSize: 16,
                  fontWeight: 900,
                  outline: 'none',
                }}
                className="tabular"
              />
            </div>
          </div>

          {/* Margen Calculado para Admin */}
          {esAdmin && numPrecio > 0 && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--hd-elevated)',
                borderRadius: '6px',
                border: '1px solid var(--hd-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              <span style={{ color: 'var(--hd-text-muted)', fontWeight: 600 }}>Rentabilidad Estimada:</span>
              {numCosto > 0 ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--hd-text-title)', fontWeight: 800 }} className="tabular">
                    +{formatearSoles(gananciaNeta)}
                  </span>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: Number(margenPorcentaje) > 25 ? 'rgba(16, 185, 129, 0.2)' : 'var(--hd-orange-subtle)',
                      color: Number(margenPorcentaje) > 25 ? 'var(--status-success)' : 'var(--hd-orange)',
                      fontWeight: 900,
                      fontSize: 11,
                    }}
                  >
                    {margenPorcentaje}%
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hd-text-dim)' }}>
                  ⏳ Pendiente de primera compra en /compras
                </span>
              )}
            </div>
          )}

          {/* Mensaje de Abastecimiento Estricto por Compras */}
          <div
            style={{
              backgroundColor: 'var(--hd-orange-subtle)',
              border: '1px solid var(--hd-orange)',
              borderRadius: '6px',
              padding: '9px 12px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: 'var(--hd-orange)',
              fontWeight: 700,
            }}
          >
            <span>🔒</span>
            <span>
              {productoEditar
                ? 'El stock y costo están protegidos. Para ingresar mercadería, regístralo como Entrada en /compras según la factura.'
                : 'Este producto se registrará con stock 0. Su stock y costo real se asignarán al recibir la mercadería en /compras.'}
            </span>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hd-border)' }}>
            {productoEditar && esAdmin ? (
              <button
                type="button"
                onClick={handleEliminar}
                disabled={eliminando || guardando}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--status-danger)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={15} />
                <span>{eliminando ? 'Borrando...' : 'Eliminar'}</span>
              </button>
            ) : (
              <div />
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onCerrar}
                disabled={guardando}
                style={{
                  padding: '9px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--hd-border)',
                  backgroundColor: 'var(--hd-elevated)',
                  color: 'var(--hd-text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                style={{
                  padding: '9px 18px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--hd-orange)',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px var(--hd-orange-glow)',
                  opacity: guardando ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {guardando ? 'Guardando...' : productoEditar ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
