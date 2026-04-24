import { getStore } from '@netlify/blobs';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function upload() {
  console.log('🚀 Iniciando subida de vectores a Netlify Blobs...');
  
  try {
    const data = await readFile(join(process.cwd(), 'metadatos.json'), 'utf8');
    const store = getStore({
      name: 'vectorstore',
      // En local, estas variables las inyecta Netlify CLI
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    await store.set('metadatos.json', data);
    console.log('✅ ¡Éxito! metadatos.json ya está en la nube de Netlify.');
  } catch (err) {
    console.error('❌ Error al subir:', err.message);
    console.log('\n💡 Tip: Asegúrate de correr este script con "netlify dev" o tener el token configurado.');
  }
}

upload();
