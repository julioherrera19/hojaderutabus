import pg from 'pg';

const { Client } = pg;

/**
 * Función central de Embeddings: gemini-embedding-2
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
    console.error("Gemini Error:", JSON.stringify(error, null, 2));
    throw new Error("Fallo al vectorizar la pregunta");
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Búsqueda Vectorial en Neon (Operador <=> de distancia coseno)
 */
async function buscarEnNeon(queryVector) {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  // Transformamos el vector de 3072D en el formato que pgvector entiende
  const vectorStr = `[${queryVector.join(',')}]`;

  // Magia SQL: Menor distancia <=> Mayor similitud
  const res = await client.query(
    `SELECT contenido, pagina, (embedding <=> $1::vector) as distancia 
     FROM documentos_convenio 
     ORDER BY distancia ASC 
     LIMIT 3`, 
    [vectorStr]
  );
  
  await client.end();
  return res.rows;
}

/**
 * Inferencia Final con Groq
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
        { role: 'system', content: 'Eres experto en convenios de transporte. Responde usando exclusivamente el contexto proporcionado. Sé profesional y directo.' },
        { role: 'user', content: `Contexto del Convenio:\n${contexto}\n\nDuda: ${pregunta}` }
      ],
      temperature: 0.1
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

/**
 * HANDLER PRINCIPAL
 */
export async function handler(event, context) {
  const user = context.clientContext?.user;
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Inicia sesión' }) };

  try {
    const { pregunta } = JSON.parse(event.body);
    if (!pregunta) return { statusCode: 400, body: JSON.stringify({ error: 'Falta pregunta' }) };

    // 1. Vectorizar la duda del usuario (3072D)
    const queryVector = await getQueryEmbedding(pregunta, process.env.GEMINI_API_KEY);

    // 2. Buscar fragmentos relevantes en Postgres (Neon)
    const fragmentos = await buscarEnNeon(queryVector);

    // 3. Generar respuesta
    const contextoStr = fragmentos.map(f => `[Pág. ${f.pagina}] ${f.contenido}`).join('\n\n');
    const respuesta = await callGroq(contextoStr, pregunta);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        respuesta,
        fuentes: fragmentos.map(f => ({ pagina: f.pagina, score: 1 - f.distancia }))
      })
    };

  } catch (error) {
    console.error("Error RAG Neon:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "El servicio de consulta está temporalmente inactivo." })
    };
  }
}