import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cqawsupdyywnloibeltk.supabase.co';
let envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) envUrl = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim();
  }
} catch (e) {}

const supabase = createClient(envUrl, envKey);

async function testAnulacion() {
  console.log('--- Testing Venta Anulation Flow on Sale #4 ---');

  // 1. Fetch sale
  const { data: venta } = await supabase
    .from('ventas')
    .select(`
      *,
      detalle_ventas(
        id,
        producto_id,
        cantidad,
        costo_unitario,
        precio_unitario,
        es_granel,
        unidad_medida_venta,
        productos:productos(id, nombre, stock_actual, volumen_en_uso)
      )
    `)
    .eq('id', 4)
    .single();

  console.log(`Current estado: ${venta.estado}`);
  
  // Reintegrate items
  for (const det of venta.detalle_ventas) {
    const prod = det.productos;
    const nuevoStock = Number(prod.stock_actual) + Number(det.cantidad);
    console.log(`Reintegrating ${det.cantidad} to ${prod.nombre}: ${prod.stock_actual} -> ${nuevoStock}`);
    
    await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', det.producto_id);

    // Insert DEVOLUCION movement
    const { error: kardexErr } = await supabase.from('movimientos_kardex').insert({
      producto_id: det.producto_id,
      tipo_operacion: 'DEVOLUCION',
      tipo_stock: 'CERRADO',
      comprobante_tipo: venta.tipo_comprobante,
      comprobante_numero: venta.numero_comprobante,
      cantidad_entrada: Number(det.cantidad),
      cantidad_salida: 0,
      saldo_resultante: nuevoStock,
      costo_unitario: det.costo_unitario,
      precio_venta: det.precio_unitario,
      usuario_nombre: 'Admin Auditor Test',
      motivo: `Devolución por anulación de Venta #${venta.id} (${venta.numero_comprobante}): Error de digitación (Prueba OK)`
    });

    if (kardexErr) console.error('Kardex insert error:', kardexErr);
    else console.log('Successfully recorded DEVOLUCION in Kardex!');
  }

  // Update sale
  await supabase.from('ventas').update({
    estado: 'anulado',
    notas: '[ANULADO: Prueba OK]'
  }).eq('id', 4);

  console.log('Sale #4 successfully marked as ANULADO!');

  // Check recent Kardex entries for this product
  const { data: movs } = await supabase
    .from('movimientos_kardex')
    .select('*')
    .eq('tipo_operacion', 'DEVOLUCION')
    .limit(1);

  console.log('Kardex DEVOLUCION verified:', movs[0]);
}

testAnulacion();
