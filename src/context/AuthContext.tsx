'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, Usuario } from '@/lib/supabase';

import PantallaInicioTurno from '@/components/PantallaInicioTurno';

interface AuthContextType {
  usuarioActual: Usuario | null;
  usuariosDisponibles: Usuario[];
  cargando: boolean;
  cambiarUsuario: (usuarioId: number, pin: string) => Promise<{ success: boolean; message?: string }>;
  cerrarSesion: () => void;
  esAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<Usuario[]>([]);
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  // Cargar usuarios de Supabase
  useEffect(() => {
    async function cargarUsuarios() {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('activo', true)
          .order('id', { ascending: true });

        if (error) throw error;

        const users = data || [];
        setUsuariosDisponibles(users);

        // Recuperar usuario guardado en localStorage
        const savedUserId = localStorage.getItem('vistatienda_usuario_id');
        if (savedUserId) {
          const matched = users.find((u) => u.id === Number(savedUserId));
          if (matched) {
            setUsuarioActual(matched);
          } else {
            setUsuarioActual(null);
            localStorage.removeItem('vistatienda_usuario_id');
          }
        } else {
          // Sin sesión previa: requiere inicio de turno con PIN
          setUsuarioActual(null);
        }
      } catch (err) {
        console.error('Error al cargar usuarios de Supabase:', err);
      } finally {
        setCargando(false);
      }
    }

    cargarUsuarios();
  }, []);

  const cambiarUsuario = async (usuarioId: number, pinIngresado: string) => {
    const usuarioTarget = usuariosDisponibles.find((u) => u.id === usuarioId);
    if (!usuarioTarget) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    // Validar PIN
    if (usuarioTarget.pin !== pinIngresado) {
      return { success: false, message: 'PIN de 4 dígitos incorrecto' };
    }

    setUsuarioActual(usuarioTarget);
    localStorage.setItem('vistatienda_usuario_id', String(usuarioTarget.id));
    return { success: true };
  };

  const cerrarSesion = () => {
    setUsuarioActual(null);
    localStorage.removeItem('vistatienda_usuario_id');
  };

  const esAdmin = usuarioActual?.rol === 'admin';

  return (
    <AuthContext.Provider
      value={{
        usuarioActual,
        usuariosDisponibles,
        cargando,
        cambiarUsuario,
        cerrarSesion,
        esAdmin,
      }}
    >
      {usuarioActual ? children : <PantallaInicioTurno />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
