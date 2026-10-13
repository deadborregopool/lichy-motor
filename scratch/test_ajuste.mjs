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

async function testAjuste() {
  console.log('--- Testing Kardex Adjustment Flow ---');
  // 1. Get first product
  const { data: prods } = await supabase.from('productos').select('*').limit(1);
  const p = prods[0];
  console.log(`Testing with product: ${p.nombre} (ID: ${p.id}, Stock actual: ${p.stock_actual})`);

  // 2. Insert test adjustment movement
  const nuevoStock = Number(p.stock_actual); // Keep the same stock so we don't mess up real counts
  const { error: insErr } = await supabase.from('movimientos_kardex').insert({
    producto_id: p.id,
    fecha: new Date().toISOString(),
    tipo_operacion: 'AJUSTE',
    tipo_stock: 'CERRADO',
    cantidad_entrada: 0,
    cantidad_salida: 0,
    saldo_resultante: nuevoStock,
    usuario_nombre: 'Auditor Test',
    motivo: 'Verificación de inventario físico de rutina (Prueba OK)'
  });

  if (insErr) {
    console.error('Error inserting adjustment:', insErr);
  } else {
    console.log('Successfully recorded AJUSTE movement in Kardex!');
  }
}

testAjuste();
