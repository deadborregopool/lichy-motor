'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Wrench, Package, ShoppingCart, Users, KeyRound, Check, X, ShieldAlert, ShieldCheck, Sun, Moon, Truck, Layers, Download, Lock, LogOut } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { usuarioActual, usuariosDisponibles, cambiarUsuario, cerrarSesion, esAdmin } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<number | null>(null);
  const [pinIngresado, setPinIngresado] = useState('');
  const [errorPin, setErrorPin] = useState<string | null>(null);

  const abrirModalCambio = (id: number) => {
    setUsuarioSeleccionado(id);
    setPinIngresado('');
    setErrorPin(null);
    setModalAbierto(true);
  };

  const confirmarCambio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioSeleccionado) return;

    const res = await cambiarUsuario(usuarioSeleccionado, pinIngresado);
    if (res.success) {
      setModalAbierto(false);
      setPinIngresado('');
      setErrorPin(null);
    } else {
      setErrorPin(res.message || 'PIN incorrecto');
    }
  };

  return (
    <>
      {/* Barra Superior */}
      <header
        style={{
          backgroundColor: 'var(--hd-surface)',
          borderBottom: '2px solid var(--hd-orange)',
          boxShadow: 'var(--shadow-card)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div className="hd-navbar-inner">
          {/* Logo & Marca Harley-Davidson */}
          <Link
            href="/inventario"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              textDecoration: 'none',
              color: 'inherit',
              flexShrink: 0,
            }}
          >
            <img
              src="/icons/icon-192.png"
              alt="Lichi Casa-Grande Motor"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                objectFit: 'contain',
                backgroundColor: '#0A0C0F',
                border: '1.5px solid var(--hd-orange)',
                boxShadow: '0 2px 10px var(--hd-orange-glow)',
                flexShrink: 0,
              }}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 'clamp(15px, 4vw, 18px)',
                    fontWeight: 900,
                    letterSpacing: '0.03em',
                    color: 'var(--hd-text-title)',
                    textTransform: 'uppercase',
                  }}
                >
                  LICHI<span style={{ color: 'var(--hd-orange)' }}>MOTOR</span>
                </span>
                <span
                  className="hide-on-mobile"
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    backgroundColor: 'var(--hd-elevated)',
                    color: 'var(--hd-orange)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid var(--hd-orange)',
                    letterSpacing: '0.08em',
                  }}
                >
                  CASA-GRANDE
                </span>
              </div>
              <span
                style={{
                  fontSize: 9.5,
                  color: 'var(--hd-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 600,
                  display: 'block',
                }}
              >
                Repuestos & Aceites
              </span>
            </div>
          </Link>

          {/* Navegación Desktop (Oculta en Celular) */}
          <nav className="hide-on-mobile" style={{ alignItems: 'center', gap: 6 }}>
            <Link
              href="/pos"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: 13,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textDecoration: 'none',
                color: pathname.startsWith('/pos') ? 'var(--hd-text-title)' : 'var(--hd-text-muted)',
                backgroundColor: pathname.startsWith('/pos') ? 'var(--hd-elevated)' : 'transparent',
                border: pathname.startsWith('/pos') ? '1px solid var(--hd-orange)' : '1px solid transparent',
                boxShadow: pathname.startsWith('/pos') ? '0 0 12px var(--hd-orange-glow)' : 'none',
              }}
            >
              <ShoppingCart size={17} color={pathname.startsWith('/pos') ? 'var(--hd-orange)' : 'currentColor'} />
              Caja POS
            </Link>

            <Link
              href="/inventario"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: 13,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textDecoration: 'none',
                color: pathname.startsWith('/inventario') ? 'var(--hd-text-title)' : 'var(--hd-text-muted)',
                backgroundColor: pathname.startsWith('/inventario') ? 'var(--hd-elevated)' : 'transparent',
                border: pathname.startsWith('/inventario') ? '1px solid var(--hd-orange)' : '1px solid transparent',
                boxShadow: pathname.startsWith('/inventario') ? '0 0 12px var(--hd-orange-glow)' : 'none',
              }}
            >
              <Package size={17} color={pathname.startsWith('/inventario') ? 'var(--hd-orange)' : 'currentColor'} />
              Inventario & Aceites
            </Link>

            <Link
              href="/compras"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: 13,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textDecoration: 'none',
                color: pathname.startsWith('/compras') ? 'var(--hd-text-title)' : 'var(--hd-text-muted)',
                backgroundColor: pathname.startsWith('/compras') ? 'var(--hd-elevated)' : 'transparent',
                border: pathname.startsWith('/compras') ? '1px solid var(--hd-orange)' : '1px solid transparent',
                boxShadow: pathname.startsWith('/compras') ? '0 0 12px var(--hd-orange-glow)' : 'none',
              }}
            >
              <Truck size={17} color={pathname.startsWith('/compras') ? 'var(--hd-orange)' : 'currentColor'} />
              Entradas & Distribuidores
            </Link>

            <Link
              href="/kardex"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: 13,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textDecoration: 'none',
                color: pathname.startsWith('/kardex') ? 'var(--hd-text-title)' : 'var(--hd-text-muted)',
                backgroundColor: pathname.startsWith('/kardex') ? 'var(--hd-elevated)' : 'transparent',
                border: pathname.startsWith('/kardex') ? '1px solid var(--hd-orange)' : '1px solid transparent',
                boxShadow: pathname.startsWith('/kardex') ? '0 0 12px var(--hd-orange-glow)' : 'none',
              }}
            >
              <Layers size={17} color={pathname.startsWith('/kardex') ? 'var(--hd-orange)' : 'currentColor'} />
              Kardex
            </Link>

            <Link
              href="/clientes"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: 13,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textDecoration: 'none',
                color: pathname.startsWith('/clientes') ? 'var(--hd-text-title)' : 'var(--hd-text-muted)',
                backgroundColor: pathname.startsWith('/clientes') ? 'var(--hd-elevated)' : 'transparent',
                border: pathname.startsWith('/clientes') ? '1px solid var(--hd-orange)' : '1px solid transparent',
                boxShadow: pathname.startsWith('/clientes') ? '0 0 12px var(--hd-orange-glow)' : 'none',
              }}
            >
              <Users size={17} color={pathname.startsWith('/clientes') ? 'var(--hd-orange)' : 'currentColor'} />
              Fiados & Clientes
            </Link>
          </nav>

          {/* Acciones de Cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Botón Instalar PWA */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).instalarLichyMotorApp) {
                  (window as any).instalarLichyMotorApp();
                }
              }}
              title="Instalar Lichy Motor en este dispositivo"
              style={{
                backgroundColor: 'var(--hd-elevated)',
                border: '1px solid var(--hd-orange)',
                borderRadius: '6px',
                padding: '7px 9px',
                color: 'var(--hd-orange)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              <Download size={14} strokeWidth={2.8} />
              <span className="hide-on-mobile" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Instalar
              </span>
            </button>

            {/* Toggle Tema */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Cambiar a Tema Claro' : 'Cambiar a Tema Oscuro'}
              style={{
                backgroundColor: 'var(--hd-elevated)',
                border: '1px solid var(--hd-border)',
                borderRadius: '6px',
                padding: '7px 9px',
                color: 'var(--hd-text-title)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isDark ? <Sun size={15} color="var(--hd-orange)" /> : <Moon size={15} color="var(--hd-orange)" />}
              <span className="hide-on-mobile" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                {isDark ? 'Claro' : 'Oscuro'}
              </span>
            </button>

            {/* Selector de Usuario / PIN & Botón Cerrar Sesión */}
            {usuarioActual && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => abrirModalCambio(usuarioActual.id)}
                  title="Cambiar turno / PIN"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 8px',
                    backgroundColor: 'var(--hd-elevated)',
                    border: '1px solid var(--hd-border)',
                    borderRadius: '6px',
                    color: 'inherit',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--hd-text-title)', whiteSpace: 'nowrap' }}>
                        {usuarioActual.nombre.split(' ')[0]}
                      </span>
                      {esAdmin ? (
                        <span title="Administrador" style={{ display: 'inline-flex' }}>
                          <ShieldCheck size={13} color="var(--hd-orange)" />
                        </span>
                      ) : (
                        <span title="Vendedor" style={{ display: 'inline-flex' }}>
                          <ShieldAlert size={13} color="var(--hd-text-dim)" />
                        </span>
                      )}
                    </div>
                    <span
                      className="hide-on-mobile"
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: esAdmin ? 'var(--hd-orange)' : 'var(--status-info)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {usuarioActual.rol}
                    </span>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--hd-surface)',
                      border: '1px solid var(--hd-border-strong)',
                      borderRadius: '4px',
                      padding: '2px 5px',
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--hd-orange)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <KeyRound size={11} />
                    <span className="hide-on-mobile">PIN</span>
                  </div>
                </button>

                {/* Botón Cierre de Sesión / Bloquear Caja */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`¿Cerrar sesión de ${usuarioActual.nombre} y bloquear la caja?`)) {
                      cerrarSesion();
                    }
                  }}
                  title="Cerrar turno / Bloquear caja"
                  aria-label="Cerrar sesión"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '6px',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 800,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <LogOut size={14} strokeWidth={2.5} />
                  <span className="hide-on-mobile" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    Salir
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Barra de Navegación Inferior Móvil (Bottom Navigation) */}
      <div
        className="show-on-mobile"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--hd-surface)',
          borderTop: '2px solid var(--hd-orange)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
          zIndex: 50,
          padding: '6px 6px calc(6px + var(--safe-bottom, 0px))',
          minHeight: 'calc(var(--bottom-nav-height, 64px) + var(--safe-bottom, 0px))',
          justifyContent: 'space-around',
          alignItems: 'center',
          backdropFilter: 'blur(12px)',
        }}
      >
        {[
          { href: '/pos', label: 'Caja POS', icon: ShoppingCart },
          { href: '/inventario', label: 'Inventario', icon: Package },
          { href: '/compras', label: 'Entradas', icon: Truck },
          { href: '/kardex', label: 'Kardex', icon: Layers },
          { href: '/clientes', label: 'Clientes', icon: Users },
        ].map((item) => {
          const activo = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                textDecoration: 'none',
                color: activo ? 'var(--hd-orange)' : 'var(--hd-text-dim)',
                padding: '5px 6px',
                borderRadius: 8,
                backgroundColor: activo ? 'var(--hd-orange-subtle)' : 'transparent',
                flex: 1,
                maxWidth: 72,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={19} strokeWidth={activo ? 2.8 : 2} color={activo ? 'var(--hd-orange)' : 'currentColor'} />
                {activo && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -1,
                      right: -3,
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: 'var(--hd-orange)',
                      boxShadow: '0 0 6px var(--hd-orange)',
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: activo ? 900 : 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Modal de Cambio de Turno con PIN */}
      {modalAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--hd-orange)',
              borderRadius: '12px',
              maxWidth: 380,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 20,
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <KeyRound size={22} color="var(--hd-orange)" />
                <h3 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', color: 'var(--hd-text-title)', letterSpacing: '0.04em' }}>
                  Control de Turno
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                style={{ color: 'var(--hd-text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Selector de personas */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--hd-text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Selecciona quién atiende:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {usuariosDisponibles.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setUsuarioSeleccionado(u.id);
                      setErrorPin(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: usuarioSeleccionado === u.id ? 'var(--hd-elevated)' : 'transparent',
                      border: usuarioSeleccionado === u.id ? '1px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                      color: usuarioSeleccionado === u.id ? 'var(--hd-text-title)' : 'var(--hd-text-muted)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: usuarioSeleccionado === u.id ? 'var(--hd-orange)' : 'var(--hd-text-title)' }}>
                        {u.nombre}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--hd-text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {u.rol === 'admin' ? 'Administrador (Costos)' : 'Vendedor de mostrador'}
                      </div>
                    </div>
                    {usuarioSeleccionado === u.id && <Check size={18} color="var(--hd-orange)" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Formulario de PIN */}
            <form onSubmit={confirmarCambio}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11, color: 'var(--hd-text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Ingresa tu PIN:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="••••"
                  value={pinIngresado}
                  onChange={(e) => setPinIngresado(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 24,
                    letterSpacing: '0.4em',
                    textAlign: 'center',
                    backgroundColor: 'var(--hd-input-bg)',
                    border: errorPin ? '1px solid var(--status-danger)' : '1px solid var(--hd-orange)',
                    borderRadius: '6px',
                    color: 'var(--hd-text-title)',
                    outline: 'none',
                  }}
                />
                {errorPin && (
                  <p style={{ color: 'var(--status-danger)', fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                    {errorPin}
                  </p>
                )}
                <span style={{ fontSize: 11, color: 'var(--hd-text-dim)', display: 'block', marginTop: 4 }}>
                  PIN Admins (Fabrizzio/Lichy/Carlos): 1234 · Vendedor: 0000
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '6px',
                    border: '1px solid var(--hd-border)',
                    backgroundColor: 'var(--hd-elevated)',
                    color: 'var(--hd-text-muted)',
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalAbierto(false);
                    cerrarSesion();
                  }}
                  title="Cerrar turno y bloquear"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '11px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={15} />
                  <span>Salir</span>
                </button>
                <button
                  type="submit"
                  disabled={!pinIngresado || !usuarioSeleccionado}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--hd-orange)',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px var(--hd-orange-glow)',
                    opacity: !pinIngresado || !usuarioSeleccionado ? 0.5 : 1,
                  }}
                >
                  Entrar
                </button>
              </div>
            </form>

            {/* Botón Bloquear / Cerrar Turno */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hd-border)' }}>
              <button
                type="button"
                onClick={() => {
                  setModalAbierto(false);
                  cerrarSesion();
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid var(--status-danger)',
                  color: 'var(--status-danger)',
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <Lock size={14} />
                <span>Bloquear Caja / Cerrar Turno</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
