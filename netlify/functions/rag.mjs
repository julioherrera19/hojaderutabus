import { getStore } from '@netlify/blobs';

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
 * Similitud del Coseno (Máxima eficiencia en JS)
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i]; normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Inferencia Final con Groq (Llama 3)
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
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

let vectorStoreCache = null;

/**
 * EXPORT HANDLER (Netlify)
 */
export async function handler(event, context) {
  // 1. Bloqueo de seguridad: Identity
  const user = context.clientContext?.user;
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Inicia sesión.' }) };

  try {
    const { pregunta } = JSON.parse(event.body);
    if (!pregunta) return { statusCode: 400, body: JSON.stringify({ error: 'Pregunta vacía' }) };

    // 2. Cargador de Blobs Blindado (Plan B incluido)
    if (!vectorStoreCache) {
      const store = getStore({
        name: 'vectorstore', // Nombre consistente con tu script de subida
        siteID: process.env.NETLIFY_SITE_ID || process.env.SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_API_TOKEN
      });
      
      // Obtenemos el JSON directamente parseado
      vectorStoreCache = await store.get('metadatos.json', { type: 'json' });
      
      if (!vectorStoreCache) {
        throw new Error("Base de datos metadatos.json no encontrada en Blobs");
      }
    }

    // 3. Vectorización de la duda
    const queryVector = await getQueryEmbedding(pregunta, process.env.GEMINI_API_KEY);

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
    console.error("RAG Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "El asistente está fuera de servicio temporalmente." })
    };
  }
}