import { supabase, Producto } from '@/lib/supabase';
import { comprimirImagen } from '@/lib/imageCompression';
import { registrarMovimientoKardex } from '@/services/kardexService';

export interface FiltrosProducto {
  categoria?: string;
  busqueda?: string;
  soloStockBajo?: boolean;
}

export async function obtenerProductos(filtros?: FiltrosProducto): Promise<Producto[]> {
  let query = supabase
    .from('productos')
    .select('*')
    .order('nombre', { ascending: true });

  if (filtros?.categoria && filtros.categoria !== 'Todos') {
    query = query.eq('categoria', filtros.categoria);
  }

  if (filtros?.busqueda && filtros.busqueda.trim() !== '') {
    const term = `%${filtros.busqueda.trim()}%`;
    query = query.or(`nombre.ilike.${term},codigo.ilike.${term}`);
  }

  if (filtros?.soloStockBajo) {
    query = query.lte('stock_actual', 3);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error al obtener productos:', error);
    throw error;
  }

  return (data || []) as Producto[];
}

export async function subirFotoProducto(file: File): Promise<string> {
  // Comprimir automáticamente a WebP (< 100 KB)
  const archivoComprimido = await comprimirImagen(file);

  // Nombre de archivo seguro y único
  const extension = 'webp';
  const nombreArchivo = `repuesto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
  const ruta = `catalogo/${nombreArchivo}`;

  const { error: uploadError } = await supabase.storage
    .from('productos')
    .upload(ruta, archivoComprimido, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error al subir foto a Supabase Storage:', uploadError);
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from('productos')
    .getPublicUrl(ruta);

  return publicUrlData.publicUrl;
}

export interface DatosNuevoProducto {
  codigo?: string | null;
  nombre: string;
  categoria?: string | null;
  unidad_medida: string;
  stock_actual: number;
  capacidad_envase?: number | null;
  volumen_en_uso?: number | null;
  costo_unitario: number;
  precio_venta: number;
  imagen_url?: string | null;
  proveedor_id?: number | null;
}

export async function crearProducto(
  datos: DatosNuevoProducto,
  archivoFoto?: File | null
): Promise<Producto> {
  let urlFotoFinal = datos.imagen_url || null;

  if (archivoFoto) {
    urlFotoFinal = await subirFotoProducto(archivoFoto);
  }

  const nuevoItem = {
    ...datos,
    codigo: datos.codigo?.trim() || null,
    imagen_url: urlFotoFinal,
  };

  const { data, error } = await supabase
    .from('productos')
    .insert([nuevoItem])
    .select()
    .single();

  if (error) {
    console.error('Error al crear producto en Supabase:', error);
    throw error;
  }

  return data as Producto;
}

export async function actualizarProducto(
  id: number,
  datos: Partial<DatosNuevoProducto>,
  archivoFoto?: File | null
): Promise<Producto> {
  let itemActualizado: any = { ...datos };

  if (datos.codigo !== undefined) {
    itemActualizado.codigo = datos.codigo?.trim() || null;
  }

  if (archivoFoto) {
    const nuevaUrl = await subirFotoProducto(archivoFoto);
    itemActualizado.imagen_url = nuevaUrl;
  }

  const { data, error } = await supabase
    .from('productos')
    .update(itemActualizado)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error al actualizar producto:', error);
    throw error;
  }

  return data as Producto;
}

export async function eliminarProducto(id: number): Promise<void> {
  const { error } = await supabase.from('productos').delete().eq('id', id);
  if (error) {
    console.error('Error al eliminar producto:', error);
    throw error;
  }
}

/**
 * Destapa o abre uno o más envases cerrados de aceite y traspasa su capacidad en litros al volumen en uso
 */
export async function destaparEnvase(
  productoId: number,
  cantidadEnvases: number = 1,
  usuarioNombre: string = 'Mostrador'
): Promise<Producto> {
  const { data: producto, error: errFetch } = await supabase
    .from('productos')
    .select('*')
    .eq('id', productoId)
    .single();

  if (errFetch || !producto) {
    throw new Error('No se encontró el repuesto/aceite para destapar');
  }

  const stockActual = Number(producto.stock_actual) || 0;
  let capacidad = Number(producto.capacidad_envase) || 0;
  if (capacidad <= 0) {
    if (producto.unidad_medida === 'balde') capacidad = 20;
    else if (producto.unidad_medida === 'galon') capacidad = 3.785;
    else if (producto.unidad_medida === 'botella') capacidad = 1;
    else capacidad = 1;
  }
  const volumenActual = Number(producto.volumen_en_uso) || 0;

  if (stockActual < cantidadEnvases) {
    throw new Error(`No hay suficientes envases cerrados (disponibles: ${stockActual})`);
  }

  const nuevoStock = stockActual - cantidadEnvases;
  const litrosNuevos = Number((capacidad * cantidadEnvases).toFixed(3));
  const nuevoVolumen = Number((volumenActual + litrosNuevos).toFixed(3));

  const { data: productoActualizado, error: errUpdate } = await supabase
    .from('productos')
    .update({
      stock_actual: nuevoStock,
      volumen_en_uso: nuevoVolumen,
    })
    .eq('id', productoId)
    .select()
    .single();

  if (errUpdate || !productoActualizado) {
    throw errUpdate || new Error('Error al destapar envase');
  }

  // Registrar en Kardex la salida del envase sellado y el ingreso de litros al balde abierto
  const correlativo = `DES-${Date.now().toString().slice(-6)}`;

  await registrarMovimientoKardex({
    producto_id: productoId,
    tipo_operacion: 'DESTAPE',
    tipo_stock: 'CERRADO',
    comprobante_tipo: 'DESTAPE_TALLER',
    comprobante_numero: correlativo,
    cantidad_entrada: 0,
    cantidad_salida: cantidadEnvases,
    saldo_resultante: nuevoStock,
    costo_unitario: producto.costo_unitario,
    precio_venta: producto.precio_venta,
    usuario_nombre: usuarioNombre,
    motivo: `Destape de ${cantidadEnvases} ${producto.unidad_medida}(s) para despacho a granel (+${litrosNuevos} L)`,
  });

  await registrarMovimientoKardex({
    producto_id: productoId,
    tipo_operacion: 'DESTAPE',
    tipo_stock: 'GRANEL',
    comprobante_tipo: 'DESTAPE_TALLER',
    comprobante_numero: correlativo,
    cantidad_entrada: litrosNuevos,
    cantidad_salida: 0,
    saldo_resultante: nuevoVolumen,
    costo_unitario: producto.costo_unitario,
    precio_venta: producto.precio_venta,
    usuario_nombre: usuarioNombre,
    motivo: `Ingreso de +${litrosNuevos} L a granel por apertura de envase sellado`,
  });

  return productoActualizado as Producto;
}
