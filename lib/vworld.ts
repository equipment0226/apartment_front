// V-World 좌표 조회 (브라우저 JSONP).
// V-World REST API 는 CORS 헤더를 주지 않지만 callback(JSONP) 을 지원하므로,
// 국내 IP(사용자 브라우저)에서 <script> 주입으로 호출한다. (배포 서버=해외 IP 우회)

export interface LatLng {
  lat: number;
  lng: number;
}

const JSONP_TIMEOUT = 8000;

let _seq = 0;

/** V-World 엔드포인트에 JSONP 호출 후 파싱된 JSON 을 반환. */
function jsonp(base: string, params: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    const cb = `__vw_cb_${Date.now()}_${_seq++}`;
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      done = true;
      delete (window as any)[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (!done) {
        cleanup();
        reject(new Error("jsonp timeout"));
      }
    }, JSONP_TIMEOUT);

    (window as any)[cb] = (data: any) => {
      if (done) return;
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (done) return;
      cleanup();
      reject(new Error("jsonp error"));
    };

    const qs = new URLSearchParams({ ...params, format: "json", callback: cb }).toString();
    script.src = `${base}?${qs}`;
    document.body.appendChild(script);
  });
}

function pointFromSearch(data: any): LatLng | null {
  try {
    if (data?.response?.status === "OK") {
      const items = data.response.result?.items;
      if (items && items.length) {
        const p = items[0].point;
        return { lat: parseFloat(p.y), lng: parseFloat(p.x) };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function pointFromGetcoord(data: any): LatLng | null {
  try {
    if (data?.response?.status === "OK") {
      const p = data.response.result?.point;
      if (p) return { lat: parseFloat(p.y), lng: parseFloat(p.x) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 장소 검색(type=PLACE). */
export async function searchPlace(key: string, query: string): Promise<LatLng | null> {
  if (!query) return null;
  try {
    const data = await jsonp("https://api.vworld.kr/req/search", {
      service: "search",
      request: "search",
      version: "2.0",
      crs: "epsg:4326",
      size: "1",
      page: "1",
      query,
      type: "PLACE",
      key,
    });
    return pointFromSearch(data);
  } catch {
    return null;
  }
}

/** 주소 → 좌표(getcoord, PARCEL/ROAD). 동 중심 폴백용. */
export async function getCoord(key: string, address: string, type = "PARCEL"): Promise<LatLng | null> {
  if (!address) return null;
  try {
    const data = await jsonp("https://api.vworld.kr/req/address", {
      service: "address",
      request: "getcoord",
      version: "2.0",
      crs: "epsg:4326",
      address,
      type,
      key,
    });
    return pointFromGetcoord(data);
  } catch {
    return null;
  }
}

/** 단지 중심: '시 구 동 단지명' → '단지명' → 동 지번 중심(PARCEL) 순으로 폴백. */
export async function geocodeComplex(
  key: string,
  centerQuery: string,
  complexName: string,
  region: string
): Promise<LatLng | null> {
  return (
    (await searchPlace(key, centerQuery)) ||
    (await searchPlace(key, complexName)) ||
    (await getCoord(key, region, "PARCEL"))
  );
}

/** 간단한 이름 캐시(동일 세션 내 중복 호출 방지). */
const _cache = new Map<string, LatLng | null>();

export async function searchPlaceCached(key: string, query: string): Promise<LatLng | null> {
  if (_cache.has(query)) return _cache.get(query)!;
  const pt = await searchPlace(key, query);
  _cache.set(query, pt);
  return pt;
}
