const paradas = require('../../paradas.json');

// Objeto en memoria para rate limit (efímero pero útil contra ráfagas)
const rateLimitCache = {};

exports.handler = async (event, context) => {
  const { q, limit = 5 } = event.queryStringParameters || {};
  const clientIp = event.headers['client-ip'] || 'unknown';
  const now = Date.now();

  // 1. Validar Rate Limit (Máx 15 peticiones por minuto por IP)
  if (!rateLimitCache[clientIp]) rateLimitCache[clientIp] = [];
  
  // Limpiar peticiones antiguas (> 1 min)
  rateLimitCache[clientIp] = rateLimitCache[clientIp].filter(time => now - time < 60000);

  if (rateLimitCache[clientIp].length >= 15) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Demasiadas peticiones. Por favor, espera un minuto.' })
    };
  }

  // Registrar petición actual
  rateLimitCache[clientIp].push(now);

  if (!q) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Query parameter "q" is required' }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    };
  }

  try {
    const localResults = searchLocalData(q, limit);
    if (localResults.length >= 3) {
      return {
        statusCode: 200,
        body: JSON.stringify(localResults),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      };
    }

    const fallbackResults = await searchWithLocationIQ(q, limit);
    const combinedResults = [...localResults];
    const uniqueNames = new Set(localResults.map(item => item.nombre));
    
    for (const result of fallbackResults) {
      if (!uniqueNames.has(result.nombre) && combinedResults.length < limit) {
        combinedResults.push(result);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(combinedResults),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

function searchLocalData(query, limit) {
  const normalizedQuery = query.toLowerCase().trim();
  return paradas
    .filter(p => p.nombre.toLowerCase().includes(normalizedQuery))
    .slice(0, limit)
    .map(p => ({
      ...p,
      tipo: 'local'
    }));
}

async function searchWithLocationIQ(query, limit) {
  const token = process.env.LOCATIONIQ_TOKEN;
  if (!token) return [];

  try {
    const url = `https://us1.locationiq.com/v1/autocomplete.php?key=${token}&q=${encodeURIComponent(query)}&limit=${limit}&format=json&countrycodes=es&accept-language=es`;
    const response = await fetch(url);
    const data = await response.json();

    return data.map((item, index) => {
      // Simplificar dirección: "Calle, Numero, Ciudad"
      const parts = item.display_name.split(', ');
      let cleanName = item.display_name;

      if (parts.length > 3) {
        const road = parts[0];
        const num = !isNaN(parts[1]) ? parts[1] : '';
        // Intentar encontrar la ciudad (normalmente 2 o 3 posiciones antes del final)
        const city = parts[parts.length - 3] || parts[parts.length - 2];
        cleanName = `${road}${num ? ', ' + num : ''}, ${city}`;
      }

      return {
        id: `locationiq_${item.place_id || index}`,
        nombre: cleanName,
        full_name: item.display_name, // Guardamos la original por si acaso
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        tipo: 'locationiq'
      };
    });
  } catch (error) {
    return [];
  }
}