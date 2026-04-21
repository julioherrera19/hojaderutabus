const paradas = require('../../paradas.json');

// Cache de rate limit en memoria
const rateLimitCache = {};

exports.handler = async (event, context) => {
  const { q, limit = 5 } = event.queryStringParameters || {};
  const clientIp = event.headers['client-ip'] || 'unknown';
  const now = Date.now();

  // 1. Rate Limit Check (100 req/min para Geocode)
  if (!rateLimitCache[clientIp]) rateLimitCache[clientIp] = [];
  rateLimitCache[clientIp] = rateLimitCache[clientIp].filter(t => now - t < 60000);

  if (rateLimitCache[clientIp].length >= 100) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Límite de peticiones excedido' })
    };
  }
  rateLimitCache[clientIp].push(now);

  const token = process.env.LOCATIONIQ_TOKEN || process.env.LOCATIONIQ_API_KEY;

  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'TOKEN de LocationIQ no configurado' }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  }

  if (!q) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Query parameter "q" is required' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }

  try {
    const localResults = searchLocalData(q, limit);
    if (localResults.length >= 3) {
      return {
        statusCode: 200,
        body: JSON.stringify(localResults),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      };
    }

    const fallbackResults = await geocodeWithLocationIQ(q, limit);
    const combinedResults = [...localResults, ...fallbackResults.filter(f => !localResults.some(l => l.nombre === f.nombre))].slice(0, limit);

    return {
      statusCode: 200,
      body: JSON.stringify(combinedResults),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  } catch (error) {
    console.error('✗ Geocode error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

function searchLocalData(query, limit) {
  const normalizedQuery = query.toLowerCase().trim();
  return paradas
    .filter(p => p.nombre.toLowerCase().includes(normalizedQuery))
    .slice(0, limit)
    .map(p => ({ ...p, tipo: 'local' }));
}

async function geocodeWithLocationIQ(query, limit) {
  const token = process.env.LOCATIONIQ_TOKEN || process.env.LOCATIONIQ_API_KEY;
  if (!token) return [];

  try {
    const url = `https://us1.locationiq.com/v1/search.php?key=${token}&q=${encodeURIComponent(query)}&limit=${limit}&format=json&countrycodes=es&accept-language=es`;
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.map(item => ({
      nombre: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      tipo: 'locationiq'
    }));
  } catch (error) {
    return [];
  }
}