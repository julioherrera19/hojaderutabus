import { getStore } from '@netlify/blobs';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Configuración de Embeddings de Google (Query del usuario)
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "text-embedding-004",
});

let vectorStoreCache = null;

/**
 * Recupera el almacén de vectores desde Netlify Blobs.
 * Se asume que el almacén contiene los textos y sus embeddings generados con Gemini.
 */
async function getVectorStore() {
  if (vectorStoreCache) return vectorStoreCache;
  
  const store = getStore('vectorstore');
  const metadatosStr = await store.get('metadatos.json', { type: 'text' });
  
  if (!metadatosStr) {
    throw new Error("No se encontró el almacén de vectores en Blobs.");
  }
  
  vectorStoreCache = JSON.parse(metadatosStr);
  return vectorStoreCache;
}

/**
 * Cálculo manual de similitud de coseno para evitar dependencias nativas (FAISS) en Lambda.
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0; let normA = 0; let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- Proveedores de Inferencia ---

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
        { role: 'system', content: 'Eres experto en convenios de transporte. Responde de forma concisa usando solo el contexto proporcionado.' },
        { role: 'user', content: `Contexto:\n${contexto}\n\nPregunta: ${pregunta}` }
      ],
      max_tokens: 600
    })
  });
  if (!response.ok) throw new Error('Groq falló');
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callOpenRouter(contexto, pregunta) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openrouter/free', // O el modelo que prefieras de respaldo
      messages: [
        { role: 'system', content: 'Asistente experto en normativa de transporte.' },
        { role: 'user', content: `Contexto:\n${contexto}\n\nPregunta: ${pregunta}` }
      ]
    })
  });
  if (!response.ok) throw new Error('OpenRouter falló');
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

// --- Handler Principal ---

export async function handler(event, context) {
  const identityUser = context.clientContext?.user;
  if (!identityUser) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Auth requerida.' }) };
  }

  try {
    const { pregunta } = JSON.parse(event.body);
    if (!pregunta) return { statusCode: 400, body: JSON.stringify({ error: 'Falta pregunta' }) };

    // 1. Obtener Embedding de la pregunta vía API de Gemini (LIGERO)
    const queryEmbedding = await embeddings.embedQuery(pregunta);

    // 2. Cargar base de conocimientos (Vectores + Texto)
    const { textos, paginas, embeddings: docEmbeddings } = await getVectorStore();

    // 3. Búsqueda de similitud manual
    const results = docEmbeddings.map((emb, i) => ({
      index: i,
      score: cosineSimilarity(queryEmbedding, emb)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

    // 4. Construir contexto
    const chunksRelvantes = results.map(r => ({
      texto: textos[r.index],
      pagina: paginas[r.index],
      score: r.score
    }));
    
    const contextoStr = chunksRelvantes.map(c => `[Pág. ${c.pagina}] ${c.texto}`).join('\n\n');

    // 5. Inferencia con Fallback (GROQ -> OpenRouter)
    let respuesta;
    try {
      console.log('Intentando con GROQ...');
      respuesta = await callGroq(contextoStr, pregunta);
    } catch (err) {
      console.log('Fallo GROQ, intentando OpenRouter...');
      respuesta = await callOpenRouter(contextoStr, pregunta);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        respuesta,
        fuentes: chunksRelvantes.map(c => ({ pagina: c.pagina, score: c.score }))
      })
    };

  } catch (error) {
    console.error('Error RAG:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}