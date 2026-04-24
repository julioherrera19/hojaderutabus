import pg from 'pg';

const { Pool } = pg;
// Usamos Pool para gestionar mejor las conexiones en Netlify
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Imprescindible para Neon en Node.js
});

/**
 * Motor de Embeddings: Gemini 2 (3072D)
 */
async function getQueryEmbedding(text, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: "models/gemini-embedding-2",
      content: { parts: [{ text: text }] },
      task_type: "RETRIEVAL_QUERY"
    })
  });

  const data = await response.json();
  if (!data.embedding) {
    console.error("Gemini Error Detail:", JSON.stringify(data));
    throw new Error("Gemini no devolvió embeddings");
  }
  return data.embedding.values;
}

/**
 * Inferencia con Groq (Llama 3.1)
 */
async function callGroq(contexto, pregunta) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Eres experto en el convenio de transporte de Madrid. Responde de forma útil y profesional basándote en el contexto.' },
        { role: 'user', content: `Contexto:\n${contexto}\n\nPregunta: ${pregunta}` }
      ],
      temperature: 0.1
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error("Groq API Error:", JSON.stringify(data));
    return `Error de Groq (${response.status}): ${data.error?.message || "Error desconocido"}`;
  }

  return data.choices?.[0]?.message?.content || "El modelo no devolvió contenido.";
}

/**
 * HANDLER PRINCIPAL
 */
export async function handler(event, context) {
  // Validación de Auth
  const user = context.clientContext?.user;
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Sesión requerida' }) };

  try {
    const { pregunta } = JSON.parse(event.body);
    if (!pregunta) return { statusCode: 400, body: JSON.stringify({ error: 'Mensaje vacío' }) };

    // 1. Vectorización
    const vector = await getQueryEmbedding(pregunta, process.env.GEMINI_API_KEY);
    const vectorStr = `[${vector.join(',')}]`;

    // 2. Búsqueda en Neon (Ajustado a nuestro esquema real: contenido, pagina)
    const { rows } = await pool.query(
      `SELECT contenido, pagina, (embedding <=> $1::vector) as distance 
       FROM documentos_convenio 
       ORDER BY distance ASC 
       LIMIT 3`,
      [vectorStr]
    );

    if (rows.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ respuesta: "No encontré información específica en el convenio sobre eso.", fuentes: [] })
      };
    }

    // 3. Construcción de Contexto
    const contexto = rows.map(r => `[Pág. ${r.pagina}] ${r.contenido}`).join("\n---\n");
    
    // 4. Inferencia
    const respuesta = await callGroq(contexto, pregunta);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        respuesta,
        fuentes: rows.map(r => ({ pagina: r.pagina, score: 1 - r.distance }))
      })
    };

  } catch (error) {
    console.error("RAG Critical Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        respuesta: "Lo siento, el asistente ha tenido un error interno al conectar con la base de datos.",
        debug: error.message 
      })
    };
  }
}