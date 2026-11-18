
const KMA_BASE = "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0";

function toGrid(lat, lon) {
    const RE = 6371.00877;
    const GRID = 5;
    const SLAT1 = 30;
    const SLAT2 = 60;
    const OLON = 126;
    const OLAT = 38;
    const XO = 43;
    const YO = 136;

    const rad = Math.PI / 180;
    const re = RE / GRID;
    const slat1 = SLAT1 * rad;
    const slat2 = SLAT2 * rad;
    const olon = OLON * rad;
    const olat = OLAT * rad;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
             Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;

    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);

    let ra = Math.tan(Math.PI * 0.25 + lat * rad * 0.5);
    ra = re * sf / Math.pow(ra, sn);

    let theta = lon * rad - olon;
    if (theta > Math.PI) theta -= 2 * Math.PI;
    if (theta < -Math.PI) theta += 2 * Math.PI;
    theta *= sn;

    return {
        nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
        ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
    };
}

function kstDate(date) {
    return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function dateString(date) {
    const d = kstDate(date);
    return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function timeString(date) {
    const d = kstDate(date);
    return String(d.getUTCHours()).padStart(2, "0") +
           String(d.getUTCMinutes()).padStart(2, "0");
}


function getBaseTime(now = new Date()) {
    // Vercel 서버 시간에 관계없이 한국 시간으로 계산
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    let year = kst.getUTCFullYear();
    let month = kst.getUTCMonth();
    let day = kst.getUTCDate();
    let hour = kst.getUTCHours();
    const minute = kst.getUTCMinutes();

    // 실황 자료는 매시 10분 이후부터 사용 가능
    if (minute < 10) {
        hour -= 1;
    }

    // 날짜가 전날로 넘어가는 경우 처리
    const baseDate = new Date(Date.UTC(year, month, day, hour));

    const date = [
        baseDate.getUTCFullYear(),
        String(baseDate.getUTCMonth() + 1).padStart(2, "0"),
        String(baseDate.getUTCDate()).padStart(2, "0")
    ].join("");

    const time = String(baseDate.getUTCHours()).padStart(2, "0") + "00";

    return { date, time };
}


function getForecastBase(now) {
    const d = kstDate(now);
    const hour = d.getUTCHours();
    const bases = [2, 5, 8, 11, 14, 17, 20, 23];

    let baseHour = bases.filter(h => h <= hour - 1).pop();
    let date = new Date(Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate()
    ));

    if (baseHour === undefined) {
        baseHour = 23;
        date.setUTCDate(date.getUTCDate() - 1);
    }

    return {
        date: dateString(date),
        time: String(baseHour).padStart(2, "0") + "00"
    };
}

async function getItems(endpoint, params, key) {
    const url = new URL(`${KMA_BASE}/${endpoint}`);

    Object.entries({
        pageNo: 1,
        numOfRows: 1000,
        dataType: "JSON",
        ...params,
        authKey: key
    }).forEach(([k, v]) => url.searchParams.set(k, v));

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`기상청 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    const header = data.response?.header;

    if (header && header.resultCode !== "00") {
        throw new Error(header.resultMsg || "기상청 API 오류");
    }

    return data.response?.body?.items?.item || [];
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "GET only" });
    }

    try {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ error: "위치 좌표가 올바르지 않습니다." });
        }

        // api.txt 두 번째 줄에서 기상청 인증키 읽기
        const keyResponse = await fetch(
            `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api.txt`
        );

        if (!keyResponse.ok) {
            throw new Error("api.txt 파일을 읽을 수 없습니다.");
        }

        const keys = (await keyResponse.text())
            .split(/\r?\n/)
            .map(v => v.trim())
            .filter(Boolean);

        const key = keys[1];

        if (!key) {
            throw new Error("api.txt 두 번째 줄에 기상청 인증키가 없습니다.");
        }

        const { nx, ny } = toGrid(lat, lon);
        const now = new Date();

        const ncstBase = getBaseTime(now);
        const fcstBase = getForecastBase(now);

        const [ncst, fcst] = await Promise.all([
            getItems("getUltraSrtNcst", {
                base_date: ncstBase.date,
                base_time: ncstBase.time,
                nx,
                ny
            }, key),
            getItems("getVilageFcst", {
                base_date: fcstBase.date,
                base_time: fcstBase.time,
                nx,
                ny
            }, key)
        ]);

        const current = {};
        ncst.forEach(item => {
            current[item.category] = Number(item.obsrValue);
        });

        const hourlyMap = {};

        fcst.forEach(item => {
            const key = `${item.fcstDate}${item.fcstTime}`;
            if (!hourlyMap[key]) {
                hourlyMap[key] = {
                    date: item.fcstDate,
                    time: item.fcstTime
                };
            }
            hourlyMap[key][item.category] = item.fcstValue;
        });

        const hourly = Object.values(hourlyMap)
            .sort((a, b) =>
                (a.date + a.time).localeCompare(b.date + b.time)
            )
            .filter(item => {
                const forecastTime = new Date(
                    `${item.date.slice(0,4)}-${item.date.slice(4,6)}-${item.date.slice(6,8)}T${item.time.slice(0,2)}:${item.time.slice(2,4)}:00+09:00`
                );
                return forecastTime >= new Date(now.getTime() - 60 * 60 * 1000);
            });

        const dailyMap = {};

        hourly.forEach(item => {
            if (!dailyMap[item.date]) {
                dailyMap[item.date] = {
                    date: item.date,
                    min: Infinity,
                    max: -Infinity,
                    items: []
                };
            }

            const day = dailyMap[item.date];
            const temp = Number(item.TMP);

            if (Number.isFinite(temp)) {
                day.min = Math.min(day.min, temp);
                day.max = Math.max(day.max, temp);
            }

            day.items.push(item);
        });

        const daily = Object.values(dailyMap).map(day => ({
            date: day.date,
            min: day.min === Infinity ? null : day.min,
            max: day.max === -Infinity ? null : day.max
        }));

        return res.status(200).json({
            current,
            hourly,
            daily,
            grid: { nx, ny },
            updatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("Weather API error:", error);
        return res.status(500).json({
            error: error.message || "날씨 데이터를 가져오지 못했습니다."
        });
    }
}
