import { supabase, Proveedor } from '@/lib/supabase';

export interface DatosCrearProveedor {
  nombre: string;
  empresa?: string;
  ruc?: string;
  telefono?: string;
  contacto?: string;
  direccion?: string;
}

export async function obtenerDistribuidores(busqueda?: string): Promise<Proveedor[]> {
  let query = supabase
    .from('proveedores')
    .select('*')
    .order('nombre', { ascending: true });

  if (busqueda && busqueda.trim() !== '') {
    const term = `%${busqueda.trim()}%`;
    query = query.or(`nombre.ilike.${term},empresa.ilike.${term},ruc.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error al obtener distribuidores:', error);
    throw error;
  }

  return (data || []) as Proveedor[];
}

export async function obtenerDistribuidorPorId(id: number): Promise<Proveedor | null> {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error al obtener distribuidor:', error);
    return null;
  }

  return data as Proveedor;
}

export async function crearDistribuidor(datos: DatosCrearProveedor): Promise<Proveedor> {
  const { data, error } = await supabase
    .from('proveedores')
    .insert([
      {
        nombre: datos.nombre.trim(),
        empresa: datos.empresa?.trim() || null,
        ruc: datos.ruc?.trim() || null,
        telefono: datos.telefono?.trim() || null,
        contacto: datos.contacto?.trim() || null,
        direccion: datos.direccion?.trim() || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error al crear distribuidor:', error);
    throw error;
  }

  return data as Proveedor;
}

export async function actualizarDistribuidor(id: number, datos: Partial<DatosCrearProveedor>): Promise<Proveedor> {
  const payload: any = {};
  if (datos.nombre !== undefined) payload.nombre = datos.nombre.trim();
  if (datos.empresa !== undefined) payload.empresa = datos.empresa?.trim() || null;
  if (datos.ruc !== undefined) payload.ruc = datos.ruc?.trim() || null;
  if (datos.telefono !== undefined) payload.telefono = datos.telefono?.trim() || null;
  if (datos.contacto !== undefined) payload.contacto = datos.contacto?.trim() || null;
  if (datos.direccion !== undefined) payload.direccion = datos.direccion?.trim() || null;

  const { data, error } = await supabase
    .from('proveedores')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error al actualizar distribuidor:', error);
    throw error;
  }

  return data as Proveedor;
}

export async function eliminarDistribuidor(id: number): Promise<void> {
  // Verificar si tiene compras asociadas
  const { data: compras } = await supabase
    .from('compras')
    .select('id')
    .eq('proveedor_id', id)
    .limit(1);

  if (compras && compras.length > 0) {
    throw new Error('No se puede eliminar: el distribuidor tiene facturas o guías de compra registradas.');
  }

  const { error } = await supabase
    .from('proveedores')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error al eliminar distribuidor:', error);
    throw error;
  }
}
