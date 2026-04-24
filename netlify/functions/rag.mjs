import { getStore } from '@netlify/blobs';

/**
 * Función para vectorizar la duda del usuario usando Gemini.
 * Usamos task_type: "RETRIEVAL_QUERY" para optimizar la búsqueda.
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
    console.error("Gemini Embedding Error:", JSON.stringify(error, null, 2));
    throw new Error("Fallo al vectorizar la pregunta");
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Similitud del coseno (Puro JS - Máximo rendimiento en Lambda)
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Inferencia final con Groq
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
        { role: 'system', content: 'Eres un experto en convenios de transporte. Responde usando exclusivamente el contexto. Sé conciso y profesional.' },
        { role: 'user', content: `Contexto del Convenio:\n${contexto}\n\nDuda del trabajador: ${pregunta}` }
      ],
      temperature: 0.1
    })
  });
  
  if (!response.ok) throw new Error('Groq Offline');
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

let vectorStoreCache = null;

/**
 * HANDLER PRINCIPAL
 */
export async function handler(event, context) {
  // 1. Auth check
  const user = context.clientContext?.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Identificación requerida' }) };
  }

  try {
    const { pregunta } = JSON.parse(event.body);
    if (!pregunta) return { statusCode: 400, body: JSON.stringify({ error: 'Pregunta vacía' }) };

    // 2. Vectorizar la query con Gemini (3072D)
    const queryVector = await getQueryEmbedding(pregunta, process.env.GEMINI_API_KEY);

    // 3. Cargar la DB vectorial desde Blobs
    if (!vectorStoreCache) {
      const store = getStore({
        name: 'vectorstore',
        siteID: process.env.NETLIFY_SITE_ID || process.env.SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_API_TOKEN
      });
      const data = await store.get('metadatos.json', { type: 'text' });
      if (!data) throw new Error("Base de datos vectorial no encontrada en Blobs");
      vectorStoreCache = JSON.parse(data);
    }

    // 4. Búsqueda de similitud top 3
    const results = vectorStoreCache.map(doc => ({
      ...doc,
      similarity: cosineSimilarity(queryVector, doc.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

    // 5. Inferencia Final
    const contexto = results.map(r => `[Pág. ${r.pagina}] ${r.texto}`).join('\n\n');
    const respuesta = await callGroq(contexto, pregunta);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        respuesta,
        fuentes: results.map(r => ({ pagina: r.pagina, score: r.similarity }))
      })
    };

  } catch (error) {
    console.error("Error RAG:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "El asistente está descansando. Inténtalo de nuevo." })
    };
  }
}