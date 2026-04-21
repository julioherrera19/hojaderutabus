// Cache de rate limit en memoria
const rateLimitCache = {};

exports.handler = async (event, context) => {
  const { lat, lon } = event.queryStringParameters || {};
  const clientIp = event.headers['client-ip'] || 'unknown';
  const now = Date.now();

  // 1. Rate Limit
  if (!rateLimitCache[clientIp]) rateLimitCache[clientIp] = [];
  rateLimitCache[clientIp] = rateLimitCache[clientIp].filter(t => now - t < 60000);

  if (rateLimitCache[clientIp].length >= 10) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Límite de ubicación excedido' })
    };
  }
  rateLimitCache[clientIp].push(now);

  if (!lat || !lon) return { statusCode: 400, body: 'Missing lat/lon' };

  try {
    const token = process.env.LOCATIONIQ_TOKEN;
    const url = `https://us1.locationiq.com/v1/reverse.php?key=${token}&lat=${lat}&lon=${lon}&format=json&accept-language=es`;
    
    const response = await fetch(url);
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  } catch (error) {
    return { statusCode: 500, body: 'Error' };
  }
};