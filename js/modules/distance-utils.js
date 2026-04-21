/**
 * Utilidades matemáticas para geolocalización
 */

/**
 * Fórmula Haversine para distancia entre dos puntos
 */
export function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calcula la distancia de un punto a un segmento de línea
 */
export function distanceToLine(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
        [xx, yy] = [x1, y1];
    } else if (param > 1) {
        [xx, yy] = [x2, y2];
    } else {
        xx = x1 + param * C;
        yy = y2 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy) * 111; // 1 deg approx 111km
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
