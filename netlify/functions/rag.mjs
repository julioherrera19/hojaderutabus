import { getStore } from '@netlify/blobs';
import { pipeline, env } from '@xenova/transformers';

// Configuración para entorno serverless (Evita error de path/fileURLToPath)
env.allowLocalModels = false;
env.useBrowserCache = false;

let vectorStoreCache = null;
let embedder = null;

async function getVectorStore() {
  if (vectorStoreCache) return vectorStoreCache;
  
  const store = getStore('vectorstore');
  
  // Leer el índice FAISS (lo usaremos más tarde)
  const indexBuffer = await store.get('faiss.index', { type: 'arrayBuffer' });
  const metadatosStr = await store.get('metadatos.json', { type: 'text' });
  const metadatos = JSON.parse(metadatosStr);
  
  vectorStoreCache = { indexBuffer, metadatos };
  return vectorStoreCache;
}

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

async function generateEmbedding(text) {
  const embed = await getEmbedder();
  const result = await embed(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

// Búsqueda por similitud de coseno (sin FAISS-node)
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchSimilarChunks(queryEmbedding, metadatos, topK = 3) {
  // Generar embeddings para todos los chunks (solo la primera vez)
  if (!metadatos.embeddings) {
    console.log('Generando embeddings para los chunks...');
    const embedder = await getEmbedder();
    const embeddings = [];
    for (const texto of metadatos.textos) {
      const result = await embedder(texto, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(result.data));
    }
    metadatos.embeddings = embeddings;
  }
  
  // Calcular similitud con cada chunk
  const scores = [];
  for (let i = 0; i < metadatos.textos.length; i++) {
    const sim = cosineSimilarity(queryEmbedding, metadatos.embeddings[i]);
    scores.push({ index: i, score: sim });
  }
  
  // Ordenar por similitud (mayor primero)
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

// Proveedores LLM
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
        { role: 'system', content: 'Eres experto en convenios colectivos de transporte. Compara y recomienda la mejor opción. Responde en español.' },
        { role: 'user', content: `Contexto:\n${contexto}\n\nPregunta: ${pregunta}` }
      ],
      max_tokens: 500
    })
  });
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
      model: 'openrouter/free',
      messages: [{ role: 'user', content: `Contexto:\n${contexto}\n\nPregunta: ${pregunta}` }],
      max_tokens: 500
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callGemini(contexto, pregunta) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Contexto:\n${contexto}\n\nPregunta: ${pregunta}` }] }]
    })
  });
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

export async function handler(event, context) {
  // Auth obligatoria
  const user = context.clientContext?.user;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'No autorizado. Inicia sesión.' })
    };
  }
  
  try {
    const { pregunta } = JSON.parse(event.body);
    if (!pregunta) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Falta la pregunta' }) };
    }
    
    // 1. Generar embedding de la pregunta
    const queryEmbedding = await generateEmbedding(pregunta);
    
    // 2. Buscar chunks similares
    const { metadatos } = await getVectorStore();
    const results = await searchSimilarChunks(queryEmbedding, metadatos, 3);
    
    // 3. Construir contexto
    const contextos = results.map(r => ({
      texto: metadatos.textos[r.index],
      pagina: metadatos.paginas[r.index],
      score: r.score
    }));
    
    const contexto = contextos.map(c => `[Pág. ${c.pagina}] ${c.texto.slice(0, 500)}`).join('\n\n');
    
    // 4. Llamar a LLM con triple fallback
    let respuesta = null;
    const providers = [
      { name: 'Groq', fn: () => callGroq(contexto, pregunta) },
      { name: 'OpenRouter', fn: () => callOpenRouter(contexto, pregunta) },
      { name: 'Gemini', fn: () => callGemini(contexto, pregunta) }
    ];
    
    for (const provider of providers) {
      try {
        respuesta = await provider.fn();
        if (respuesta && !respuesta.includes('error')) break;
      } catch (e) {
        console.log(`${provider.name} falló:`, e.message);
      }
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        respuesta: respuesta || "No se pudo generar respuesta",
        fuentes: contextos.map(c => ({ pagina: c.pagina, score: c.score }))
      })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}