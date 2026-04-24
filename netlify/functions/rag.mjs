import { getStore } from '@netlify/blobs';

/**
 * CONFIGURACIÓN DE AI
 * Usamos fetch directo para minimizar el tamaño del paquete y dependencias.
 */
const EMBEDDING_MODEL = "text-embedding-004"; // El modelo de 3072 dimensiones de Google
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`;

let vectorStoreCache = null;

/**
 * Obtiene el embedding de la pregunta usando el modelo de 3072 dimensiones.
 */
async function getGeminiEmbedding(text) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini Embedding Error: ${error}`);
  }
  
  const data = await response.json();
  return data.embedding.values;
}

/**
 * Similitud del coseno para comparar la duda con el convenio.
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
 * Inferencia con Groq (Respuesta final).
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
        { role: 'system', content: 'Eres experto en convenios de transporte. Responde usando exclusivamente el contexto. Sé conciso y profesional.' },
        { role: 'user', content: `Contexto del Convenio:\n${contexto}\n\nDuda del trabajador: ${pregunta}` }
      ],
      temperature: 0.1
    })
  });
  
  if (!response.ok) throw new Error('Groq Offline');
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

/**
 * HANDLER PRINCIPAL
 */
export async function handler(event, context) {
  // 1. Seguridad: Validar usuario de Netlify Identity
  const user = context.clientContext?.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Identificación requerida' }) };
  }

  try {
    const { pregunta } = JSON.parse(event.body);
    if (!pregunta) return { statusCode: 400, body: JSON.stringify({ error: 'Pregunta vacía' }) };

    // 2. Obtener Embeddings de la duda (3072 dims)
    const queryVector = await getGeminiEmbedding(pregunta);

    // 3. Cargar base de datos desde Netlify Blobs (metadatos.json)
    if (!vectorStoreCache) {
      const store = getStore('vectorstore');
      const data = await store.get('metadatos.json', { type: 'text' });
      if (!data) throw new Error("Base de datos vectorial no encontrada en Blobs");
      vectorStoreCache = JSON.parse(data);
    }

    // 4. Búsqueda de similitud manual (Top 3)
    const results = vectorStoreCache.map((doc, i) => ({
      ...doc,
      similarity: cosineSimilarity(queryVector, doc.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

    // 5. Generar respuesta
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
      body: JSON.stringify({ error: "El asistente ha tenido un problema técnico. Inténtalo de nuevo." })
    };
  }
}