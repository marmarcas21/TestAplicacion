export interface TrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: number;
}

export interface TrackSummary {
  name?: string;
  distanceKm: number;
  elevationM: number;
  durationSec: number;
  startedAt?: string;
  route: [number, number][];
  elevProfile?: number[];
}

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: TrackPoint, b: TrackPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Lee los puntos de un GPX sin depender del DOM (sirve también en tests). */
export function parseGpxPoints(xml: string): { name?: string; points: TrackPoint[] } {
  const points: TrackPoint[] = [];
  const re = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = /\blat="([^"]+)"/.exec(m[2]);
    const lon = /\blon="([^"]+)"/.exec(m[2]);
    if (!lat || !lon) continue;
    const body = m[3] ?? '';
    const ele = /<ele>([^<]+)<\/ele>/.exec(body);
    const time = /<time>([^<]+)<\/time>/.exec(body);
    const p: TrackPoint = { lat: parseFloat(lat[1]), lon: parseFloat(lon[1]) };
    if (!isFinite(p.lat) || !isFinite(p.lon)) continue;
    if (ele && isFinite(parseFloat(ele[1]))) p.ele = parseFloat(ele[1]);
    if (time && !isNaN(Date.parse(time[1]))) p.time = Date.parse(time[1]);
    points.push(p);
  }
  const name = /<trk>[\s\S]*?<name>(?:<!\[CDATA\[)?([^<\]]+)/.exec(xml)?.[1]?.trim();
  return { name, points };
}

function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  return out;
}

/** Encaja la traza en una caja 0-100 conservando su proporción real. */
export function normalizeRoute(points: TrackPoint[], maxPoints = 120): [number, number][] {
  if (points.length < 2) return [];
  const pts = sample(points, maxPoints);
  const midLat = rad(pts.reduce((s, p) => s + p.lat, 0) / pts.length);
  const xy = pts.map((p) => [p.lon * Math.cos(midLat), -p.lat] as [number, number]);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const offX = (span - (Math.max(...xs) - minX)) / 2;
  const offY = (span - (Math.max(...ys) - minY)) / 2;
  return xy.map(([x, y]) => [
    Math.round((8 + ((x - minX + offX) / span) * 84) * 10) / 10,
    Math.round((8 + ((y - minY + offY) / span) * 84) * 10) / 10,
  ]);
}

export function summarizeTrack(points: TrackPoint[], name?: string): TrackSummary {
  let dist = 0;
  let gain = 0;
  // Umbral de 2 m para no contar el ruido del GPS como subida
  let ref = points.find((p) => p.ele !== undefined)?.ele;
  for (let i = 1; i < points.length; i++) {
    dist += haversineKm(points[i - 1], points[i]);
    const e = points[i].ele;
    if (e !== undefined && ref !== undefined) {
      if (e - ref >= 2) {
        gain += e - ref;
        ref = e;
      } else if (ref - e >= 2) ref = e;
    }
  }
  const times = points.filter((p) => p.time !== undefined).map((p) => p.time!);
  const durationSec = times.length > 1 ? Math.round((times[times.length - 1] - times[0]) / 1000) : 0;
  const eles = points.filter((p) => p.ele !== undefined).map((p) => p.ele!);
  return {
    name,
    distanceKm: Math.round(dist * 100) / 100,
    elevationM: Math.round(gain),
    durationSec,
    startedAt: times.length ? new Date(times[0]).toISOString() : undefined,
    route: normalizeRoute(points),
    elevProfile: eles.length > 1 ? sample(eles, 60).map((e) => Math.round(e)) : undefined,
  };
}

export function parseGpx(xml: string): TrackSummary {
  const { name, points } = parseGpxPoints(xml);
  if (points.length < 2) throw new Error('El archivo no contiene una ruta GPX válida.');
  return summarizeTrack(points, name);
}
