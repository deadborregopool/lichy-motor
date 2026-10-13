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

async function testKardex() {
  console.log('--- Testing Kardex Supabase Data ---');
  const { data: movimientos, error } = await supabase
    .from('movimientos_kardex')
    .select(`
      id,
      producto_id,
      tipo_operacion,
      tipo_stock,
      cantidad_entrada,
      cantidad_salida,
      saldo_resultante,
      motivo,
      fecha,
      producto:productos (
        id,
        nombre,
        codigo,
        stock_actual,
        volumen_en_uso
      )
    `)
    .order('fecha', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching Kardex:', error);
    return;
  }

  console.log(`Successfully fetched ${movimientos.length} recent Kardex records:`);
  movimientos.forEach(m => {
    const cant = m.cantidad_entrada > 0 ? `+${m.cantidad_entrada}` : `-${m.cantidad_salida}`;
    console.log(`- [${m.fecha.substring(0, 10)}] ${m.tipo_operacion.padEnd(8)} | Prod: ${(m.producto?.nombre || m.producto_id).substring(0, 25).padEnd(25)} | Cant: ${cant.padEnd(6)} | Saldo: ${m.saldo_resultante} | Tipo: ${m.tipo_stock} | Motivo: ${m.motivo || 'N/A'}`);
  });
}

testKardex();
