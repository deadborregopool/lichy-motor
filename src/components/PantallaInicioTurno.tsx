'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Usuario } from '@/lib/supabase';
import { ShieldCheck, User, Wrench, Lock, Delete, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PantallaInicioTurno() {
  const { usuariosDisponibles, cambiarUsuario, cargando } = useAuth();
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [pin, setPin] = useState<string>('');
  const [errorPin, setErrorPin] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<boolean>(false);
  const [exito, setExito] = useState<boolean>(false);

  // Seleccionar automáticamente el primer usuario si no hay ninguno seleccionado
  useEffect(() => {
    if (usuariosDisponibles.length > 0 && !usuarioSeleccionado) {
      setUsuarioSeleccionado(usuariosDisponibles[0]);
    }
  }, [usuariosDisponibles, usuarioSeleccionado]);

  // Soporte para teclado físico (PC / Laptop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (procesando || exito) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        agregarDigito(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        borrarDigito();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        limpiarPin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, usuarioSeleccionado, procesando, exito]);

  const agregarDigito = (digito: string) => {
    if (pin.length >= 4) return;
    const nuevoPin = pin + digito;
    setPin(nuevoPin);
    setErrorPin(null);

    // Si completó 4 dígitos, validar automáticamente
    if (nuevoPin.length === 4 && usuarioSeleccionado) {
      validarPin(usuarioSeleccionado.id, nuevoPin);
    }
  };

  const borrarDigito = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorPin(null);
  };

  const limpiarPin = () => {
    setPin('');
    setErrorPin(null);
  };

  const seleccionarUsuario = (u: Usuario) => {
    setUsuarioSeleccionado(u);
    setPin('');
    setErrorPin(null);
  };

  const validarPin = async (userId: number, pinIngresado: string) => {
    setProcesando(true);
    try {
      const res = await cambiarUsuario(userId, pinIngresado);
      if (res.success) {
        setExito(true);
      } else {
        setErrorPin(res.message || 'PIN incorrecto. Intenta nuevamente.');
        setPin('');
      }
    } catch (err) {
      setErrorPin('Error al validar PIN.');
      setPin('');
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0A0C0F',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          gap: 16,
        }}
      >
        <img
          src="/icons/icon-192.png"
          alt="Lichy Motor"
          style={{ width: 72, height: 72, borderRadius: 14, animation: 'pulse 1.5s infinite' }}
        />
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--hd-orange)', letterSpacing: '0.08em' }}>
          CARGANDO SISTEMA LICHY MOTOR...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0A0C0F',
        backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(255, 94, 0, 0.12) 0%, #0A0C0F 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        color: '#FFFFFF',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        {/* LOGO & ENCABEZADO HARLEY */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              position: 'relative',
              padding: 4,
              borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(255, 94, 0, 0.4), rgba(0,0,0,0.8))',
              boxShadow: '0 8px 30px rgba(255, 94, 0, 0.25)',
            }}
          >
            <img
              src="/icons/icon-192.png"
              alt="Lichi Casa-Grande Motor"
              style={{
                width: 84,
                height: 84,
                borderRadius: 14,
                objectFit: 'contain',
                display: 'block',
                backgroundColor: '#0A0C0F',
              }}
            />
          </div>

          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                margin: 0,
                color: '#FFFFFF',
              }}
            >
              LICHI<span style={{ color: 'var(--hd-orange)' }}>MOTOR</span>
            </h1>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: 'var(--hd-orange)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'block',
                marginTop: 2,
              }}
            >
              CASA-GRANDE · TALLER & MOSTRADOR POS
            </span>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--hd-border)',
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--hd-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Lock size={12} color="var(--hd-orange)" />
            <span>Inicio de Turno · Caja Protegida</span>
          </div>
        </div>

        {/* SELECTOR DE CAJERO / USUARIO */}
        <div style={{ width: '100%' }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--hd-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            1. Selecciona tu Usuario:
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))',
              gap: 8,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {usuariosDisponibles.map((u) => {
              const activo = usuarioSeleccionado?.id === u.id;
              const esAdmin = u.rol === 'admin';
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => seleccionarUsuario(u)}
                  style={{
                    backgroundColor: activo ? 'var(--hd-elevated)' : 'var(--hd-surface)',
                    border: activo ? '2px solid var(--hd-orange)' : '1px solid var(--hd-border)',
                    borderRadius: 10,
                    padding: '10px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: activo ? '0 0 16px var(--hd-orange-glow)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      backgroundColor: activo ? 'var(--hd-orange)' : 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: activo ? '#FFFFFF' : 'var(--hd-text-title)',
                    }}
                  >
                    {esAdmin ? <ShieldCheck size={18} /> : <Wrench size={16} />}
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: activo ? '#FFFFFF' : 'var(--hd-text-title)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {u.nombre.split(' ')[0]}
                  </span>

                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: esAdmin ? 'var(--hd-orange)' : 'var(--status-info)',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      padding: '2px 5px',
                      borderRadius: 4,
                    }}
                  >
                    {esAdmin ? 'Admin' : 'Venta'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* INDICADOR DE PIN (PUNTOS) */}
        <div style={{ width: '100%', textAlign: 'center' }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--hd-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: 8,
            }}
          >
            2. Ingresa PIN de {usuarioSeleccionado?.nombre || 'Usuario'}:
          </label>

          <div
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px 0',
            }}
          >
            {[0, 1, 2, 3].map((idx) => {
              const lleno = pin.length > idx;
              return (
                <div
                  key={idx}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: lleno ? 'var(--hd-orange)' : 'rgba(255, 255, 255, 0.1)',
                    border: lleno ? '2px solid var(--hd-orange)' : '2px solid var(--hd-border)',
                    boxShadow: lleno ? '0 0 12px var(--hd-orange)' : 'none',
                    transform: lleno ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              );
            })}
          </div>

          {/* Mensaje de Error */}
          {errorPin && (
            <div
              style={{
                color: 'var(--status-danger)',
                fontSize: 12,
                fontWeight: 700,
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <AlertCircle size={14} />
              <span>{errorPin}</span>
            </div>
          )}

          {exito && (
            <div
              style={{
                color: 'var(--status-success)',
                fontSize: 12,
                fontWeight: 800,
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <CheckCircle2 size={14} />
              <span>¡Turno iniciado con éxito! Entrando...</span>
            </div>
          )}
        </div>

        {/* KEYPAD NUMÉRICO TÁCTIL (0-9) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            width: '100%',
            maxWidth: 320,
            boxSizing: 'border-box',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((tecla) => {
            const esAccion = tecla === 'C' || tecla === '⌫';
            return (
              <button
                key={tecla}
                type="button"
                disabled={procesando || exito}
                onClick={() => {
                  if (tecla === 'C') limpiarPin();
                  else if (tecla === '⌫') borrarDigito();
                  else agregarDigito(tecla);
                }}
                style={{
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: esAccion ? 'var(--hd-elevated)' : 'var(--hd-surface)',
                  border: esAccion ? '1px solid var(--hd-border)' : '1px solid var(--hd-border-strong)',
                  color: esAccion ? (tecla === 'C' ? 'var(--status-danger)' : 'var(--hd-orange)') : '#FFFFFF',
                  fontSize: esAccion ? 15 : 22,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.1s ease',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.94)';
                  e.currentTarget.style.backgroundColor = 'var(--hd-orange)';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = esAccion ? 'var(--hd-elevated)' : 'var(--hd-surface)';
                  e.currentTarget.style.color = esAccion ? (tecla === 'C' ? 'var(--status-danger)' : 'var(--hd-orange)') : '#FFFFFF';
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.94)';
                  e.currentTarget.style.backgroundColor = 'var(--hd-orange)';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = esAccion ? 'var(--hd-elevated)' : 'var(--hd-surface)';
                  e.currentTarget.style.color = esAccion ? (tecla === 'C' ? 'var(--status-danger)' : 'var(--hd-orange)') : '#FFFFFF';
                }}
              >
                {tecla === '⌫' ? <Delete size={20} /> : tecla}
              </button>
            );
          })}
        </div>

        {/* PIE CON PISTA DE PIN */}
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>
            PIN: Admins (Fabrizzio/Lichy/Carlos): <strong>1234</strong> · Vendedor: <strong>0000</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
