import pg from 'pg';
import fs from 'fs';
import 'dotenv/config';

const { Client } = pg;
const data = JSON.parse(fs.readFileSync('./metadatos.json', 'utf8'));

const client = new Client({
  connectionString: process.env.DATABASE_URL 
});

async function migrar() {
  try {
    await client.connect();
    console.log("🐘 Conectado a Neon. Reconstruyendo tabla vectorial...");

    // Limpieza total para asegurar el esquema correcto
    await client.query('DROP TABLE IF EXISTS documentos_convenio;');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    await client.query(`
      CREATE TABLE documentos_convenio (
        id SERIAL PRIMARY KEY,
        contenido TEXT,
        pagina INTEGER,
        embedding vector(3072)
      );
    `);
    
    console.log("✅ Tabla documentos_convenio creada desde cero.");

    for (const item of data) {
      // Usamos item.texto o item.content dependiendo de lo que venga en metadatos.json
      const texto = item.texto || item.content;
      const pagina = item.pagina || 0;
      
      console.log(`Insertando página ${pagina}...`);
      const embeddingString = `[${item.embedding.join(',')}]`;

      await client.query(
        'INSERT INTO documentos_convenio (contenido, pagina, embedding) VALUES ($1, $2, $3)',
        [texto, pagina, embeddingString]
      );
    }

    console.log("\n🚀 ¡MIGARCIÓN COMPLETADA CON ÉXITO EN NEON!");
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
  } finally {
    await client.end();
  }
}

migrar();
