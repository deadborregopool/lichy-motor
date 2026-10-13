'use client';

import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare, CheckCircle2 } from 'lucide-react';

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Detectar si ya está en modo standalone (App instalada abierta)
    const isRunningStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isRunningStandalone);

    // 2. Registrar el Service Worker inmediatamente
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Lichy Motor PWA: Service Worker registrado exitosamente', reg.scope);
        })
        .catch((err) => {
          console.warn('Lichy Motor PWA: Registro de SW (requiere HTTPS en red externa):', err);
        });
    }

    // 3. Capturar el evento de instalación nativo (Android / Chrome / Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);

      // Mostrar banner solo si no lo ha cerrado previamente en esta sesión
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed && !isRunningStandalone) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Exponer función global para que cualquier botón (Navbar) pueda invocar la instalación
    (window as any).instalarLichyMotorApp = () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult: any) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('Lichy Motor: Usuario aceptó instalar la PWA');
            setIsInstallable(false);
            setShowBanner(false);
          }
          setDeferredPrompt(null);
        });
      } else {
        // En iOS o navegadores sin beforeinstallprompt
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        if (isIOS) {
          setShowIosGuide(true);
        } else {
          alert('Para instalar: abre el menú de tu navegador (⋮) y selecciona "Instalar aplicación" o "Agregar a la pantalla principal".');
        }
      }
    };

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [deferredPrompt]);

  const handleInstalar = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setIsInstallable(false);
          setShowBanner(false);
        }
        setDeferredPrompt(null);
      });
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        setShowIosGuide(true);
      }
    }
  };

  const descartarBanner = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  // Si ya corre en standalone, no mostrar ningún banner
  if (isStandalone) return null;

  return (
    <>
      {/* Banner flotante discreto de instalación para móvil/tablet */}
      {showBanner && (
        <div
          style={{
            position: 'fixed',
            top: 60,
            left: 14,
            right: 14,
            maxWidth: 420,
            margin: '0 auto',
            zIndex: 9999,
            backgroundColor: 'var(--hd-surface)',
            border: '2px solid var(--hd-orange)',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            animation: 'posFloatIn 0.25s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Logo de Lichy Motor */}
            <img
              src="/icons/icon-192.png"
              alt="Lichy Motor"
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                border: '1px solid var(--hd-border)',
                objectFit: 'cover',
              }}
            />
            <div>
              <strong style={{ fontSize: 13, color: 'var(--hd-text-title)', display: 'block' }}>
                Instalar Lichy Motor
              </strong>
              <span style={{ fontSize: 11, color: 'var(--hd-text-dim)' }}>
                Acceso rápido sin barras de navegador
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={handleInstalar}
              style={{
                backgroundColor: 'var(--hd-orange)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 8px var(--hd-orange-glow)',
              }}
            >
              <Download size={13} strokeWidth={2.8} />
              <span>Instalar</span>
            </button>

            <button
              type="button"
              onClick={descartarBanner}
              title="Cerrar aviso"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--hd-text-dim)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Guía para iPhone / iPad (Safari) */}
      {showIosGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowIosGuide(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--hd-surface)',
              border: '2px solid var(--hd-orange)',
              borderRadius: 14,
              maxWidth: 360,
              width: '100%',
              padding: 20,
              boxShadow: 'var(--shadow-elevated)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src="/icons/icon-192.png"
              alt="Lichy Motor"
              style={{
                width: 58,
                height: 58,
                borderRadius: 12,
                border: '1.5px solid var(--hd-orange)',
                margin: '0 auto 12px',
                display: 'block',
              }}
            />

            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--hd-text-title)', marginBottom: 8 }}>
              Instalar en iPhone / iPad
            </h3>
            <p style={{ fontSize: 12, color: 'var(--hd-text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
              Agrega <strong>Lichy Motor</strong> a tu pantalla de inicio en 2 simples pasos desde Safari:
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                textAlign: 'left',
                backgroundColor: 'var(--hd-elevated)',
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--hd-text-body)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 6, backgroundColor: 'var(--hd-surface)', borderRadius: 6 }}>
                  <Share size={18} color="var(--hd-orange)" />
                </div>
                <span>
                  1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 6, backgroundColor: 'var(--hd-surface)', borderRadius: 6 }}>
                  <PlusSquare size={18} color="var(--hd-orange)" />
                </div>
                <span>
                  2. Desliza hacia abajo y pulsa <strong>"Agregar a pantalla de inicio"</strong>.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              style={{
                width: '100%',
                padding: '11px',
                backgroundColor: 'var(--hd-orange)',
                color: '#FFFFFF',
                borderRadius: 8,
                border: 'none',
                fontWeight: 900,
                fontSize: 13,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
