import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Función de Embeddings con Gemini (3072D)
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

  if (!response.ok) {
    const error = await response.json();
    throw new Error("Fallo al vectorizar pregunta con Gemini");
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Inferencia con Groq
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
        { role: 'system', content: 'Eres un experto en convenios de transporte. Responde usando exclusivamente el contexto. Sé conciso.' },
        { role: 'user', content: `Contexto:\n${contexto}\n\nPregunta: ${pregunta}` }
      ],
      temperature: 0.1
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

/**
 * HANDLER PRINCIPAL (NEON VERSION)
 */
export async function handler(event, context) {
  const user = context.clientContext?.user;
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Auth requerida' }) };

  try {
    const { pregunta } = JSON.parse(event.body);
    if (!pregunta) return { statusCode: 400, body: JSON.stringify({ error: 'Pregunta vacía' }) };

    // 1. Vectorizar duda del usuario
    const queryVector = await getQueryEmbedding(pregunta, process.env.GEMINI_API_KEY);
    const vectorString = `[${queryVector.join(',')}]`;

    // 2. Búsqueda Vectorial en Neon (pgvector)
    // El operador <=> calcula la distancia coseno. 1 - distancia = similitud.
    const query = `
      SELECT contenido, pagina, 1 - (embedding <=> $1::vector) as similarity
      FROM documentos_convenio
      ORDER BY similarity DESC
      LIMIT 3;
    `;
    
    const { rows } = await pool.query(query, [vectorString]);

    // 3. Generar respuesta con el contexto recuperado
    const contexto = rows.map(r => `[Pág. ${r.pagina}] ${r.contenido}`).join('\n\n');
    const respuesta = await callGroq(contexto, pregunta);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        respuesta,
        fuentes: rows.map(r => ({ pagina: r.pagina, score: r.similarity }))
      })
    };

  } catch (error) {
    console.error("Neon RAG Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error en la consulta. Verifica la base de datos." })
    };
  }
}