const outfitData = [
    { max: Infinity, min: 28, outer: "-", top: "민소매, 반팔 티셔츠", bottom: "반바지(핫팬츠), 짧은 치마", etc: "민소매 원피스, 린넨 재질 옷" },
    { max: 27, min: 23, outer: "-", top: "반팔 티셔츠, 얇은 셔츠, 얇은 긴팔 티셔츠", bottom: "반바지, 면바지", etc: "-" },
    { max: 22, min: 20, outer: "얇은 가디건", top: "긴팔 티셔츠, 셔츠, 블라우스, 후드티", bottom: "면바지, 슬랙스, 7부 바지, 청바지", etc: "-" },
    { max: 19, min: 17, outer: "얇은 니트, 얇은 가디건, 얇은 재킷, 바람막이", top: "후드티, 스웨트셔츠(맨투맨)", bottom: "긴바지, 청바지, 슬랙스, 스키니진", etc: "-" },
    { max: 16, min: 12, outer: "재킷, 가디건, 야상", top: "스웨트셔츠(맨투맨), 셔츠, 기모 후드티", bottom: "청바지, 면바지", etc: "스타킹, 니트" },
    { max: 11, min: 9, outer: "재킷, 야상, 점퍼, 트렌치 코트", top: "-", bottom: "청바지, 면바지, 검은색 스타킹, 기모 바지, 레이어드", etc: "니트" },
    { max: 8, min: 5, outer: "(울)코트, 가죽 재킷", top: "-", bottom: "레깅스, 청바지, 두꺼운 바지, 기모", etc: "스카프, 플리스, 내복, 니트" },
    { max: 4, min: -Infinity, outer: "패딩, 두꺼운 코트", top: "-", bottom: "-", etc: "누빔, 내복, 목도리, 장갑, 기모, 방한용품" }
];

let globalWeatherData = null;
let currentTab = 'today';
let myChart = null;

// 날씨 코드를 한국어 텍스트로 변환 (WMO Code 표준 적용)
function getWeatherDesc(code) {
    const codes = {
        0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
        45: "안개", 48: "침적 안개",
        51: "가벼운 이슬비", 53: "이슬비", 55: "짙은 이슬비",
        61: "약한 비", 63: "보통 비", 65: "강한 비",
        71: "약한 눈", 73: "보통 눈", 75: "강한 눈",
        80: "약한 소나기", 81: "보통 소나기", 82: "강한 소나기",
        95: "뇌우"
    };
    return codes[code] || "흐림";
}

function recommendOutfit(temp) {
    const roundedTemp = Math.round(temp);
    const recommendation = outfitData.find(item => roundedTemp >= item.min && roundedTemp <= item.max);
    if (recommendation) {
        document.getElementById('outfit-outer').innerText = recommendation.outer;
        document.getElementById('outfit-top').innerText = recommendation.top;
        document.getElementById('outfit-bottom').innerText = recommendation.bottom;
        document.getElementById('outfit-etc').innerText = recommendation.etc;
    }
}

function initApp() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            getWeatherData(position.coords.latitude, position.coords.longitude);
        }, () => {
            // 위치 권한 거부 시 기본값 (서울 주포 좌표 설정)
            getWeatherData(37.5665, 126.9780);
        });
    }
}

async function getWeatherData(lat, lon) {
    // past_days=1 옵션으로 어제/오늘 새벽 과거 데이터 확보 + 일출/일몰(daily=sunrise,sunset) 동시 호출
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,precipitation&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&past_days=1`;
    
    try {
        const response = await fetch(url);
        globalWeatherData = await response.json();
        
        // 역지오코딩 없이 간결하게 좌표 표시 처리
        document.getElementById('location').innerText = `📍 현재 위치 영역`;
        renderPage();
        renderForecastTable(globalWeatherData.daily);
    } catch (e) { console.error(e); }
}

function renderPage() {
    if (!globalWeatherData) return;

    const hourly = globalWeatherData.hourly;
    const targetDate = new Date();
    if (currentTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
    const targetStr = targetDate.toLocaleDateString('sv'); // YYYY-MM-DD 포맷 안전 추출

    // 0시부터 24시까지 시간대별로 쪼개진 배열 생성
    const dayDataList = [];
    for (let i = 0; i < hourly.time.length; i++) {
        const itemDateStr = hourly.time[i].substring(0, 10);
        if (itemDateStr === targetStr) {
            dayDataList.push({
                time: new Date(hourly.time[i]),
                temp: hourly.temperature_2m[i],
                pop: hourly.precipitation_probability[i],
                rain: hourly.precipitation[i]
            });
        }
    }

    if (dayDataList.length === 0) return;

    // 현재 실시간 온도 표출을 위해 현재 시간과 가장 가까운 인덱스 매칭
    const now = new Date();
    let currentMatch = dayDataList[0];
    if (currentTab === 'today') {
        const currentHour = now.getHours();
        currentMatch = dayDataList.find(d => d.time.getHours() === currentHour) || dayDataList[0];
    }

    document.getElementById('temp-display').innerText = `${Math.round(currentMatch.temp)}°C`;
    document.getElementById('weather-desc').innerText = currentTab === 'today' ? "실시간 기온 정보" : "내일 예보 기온";
    
    document.getElementById('rain-display').innerText = `💧 강수확률: ${currentMatch.pop}% ${currentMatch.rain > 0 ? `(예상 강수량: ${currentMatch.rain}mm)` : ''}`;

    recommendOutfit(currentMatch.temp);
    document.getElementById('graph-title').innerText = `📈 시간대별 기온 변화 (${currentTab === 'today' ? '오늘 00시 ~ 24시 고정' : '내일 00시 ~ 24시 고정'})`;
    
    buildChart(dayDataList);
}

function switchDay(day) {
    currentTab = day;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderPage();
}

function buildChart(dayData) {
    const canvas = document.getElementById('tempChart');
    const ctx = canvas.getContext('2d');
    const chartWrapper = document.getElementById('chartWrapper');
    const bgLayer = document.getElementById('chartBg');
    
    const labels = dayData.map(d => `${d.time.getHours()}시`);
    const temps = dayData.map(d => Math.round(d.temp));
    const rainInfos = dayData.map(d => d.pop > 0 ? `☔${d.pop}%` : '');

    // 일출/일몰 인덱스 파악
    const dailyIndex = currentTab === 'today' ? 1 : 2; // past_days=1이라 오늘 인덱스는 1, 내일은 2
    const sunriseStr = globalWeatherData.daily.sunrise[dailyIndex];
    const sunsetStr = globalWeatherData.daily.sunset[dailyIndex];

    const sunriseHour = sunriseStr ? new Date(sunriseStr).getHours() : 6;
    const sunsetHour = sunsetStr ? new Date(sunsetStr).getHours() : 19;

    // 0시부터 23시 고정폭 비율 그라데이션 배치 (전체 23시간 기준)
    const totalDuration = 23; 
    const getStopPercent = (hour) => Math.round((hour / totalDuration) * 100);

    const sunrisePct = getStopPercent(sunriseHour);
    const sunsetPct = getStopPercent(sunsetHour);

    let cssGradient = `linear-gradient(to right, #1e2530 0%`;
    if (sunrisePct > 0 && sunrisePct < 100) {
        cssGradient += `, #232d3d ${Math.max(0, sunrisePct - 8)}%, #fef3c7 ${sunrisePct}%, #fff7ed ${Math.min(100, sunrisePct + 8)}%`;
    }
    if (sunsetPct > 0 && sunsetPct < 100) {
        cssGradient += `, #fff7ed ${Math.max(0, sunsetPct - 8)}%, #ffedd5 ${sunsetPct}%, #111827 ${Math.min(100, sunsetPct + 8)}%`;
    }
    cssGradient += `, #0f172a 100%)`;
    
    if (bgLayer) bgLayer.style.background = cssGradient;

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '기온',
                data: temps,
                borderColor: '#2563eb', 
                borderWidth: 4,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.2,
                pointRadius: 5,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#2563eb',
                pointBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'end',
                    offset: 4,
                    font: { weight: 'bold', size: 12 },
                    color: '#0f172a', 
                    textStrokeColor: '#ffffff',
                    textStrokeWidth: 3,
                    formatter: (value, context) => `${value}°C\n${rainInfos[context.dataIndex] || ''}`
                }
            },
            scales: {
                y: { 
                    display: false, 
                    min: Math.min(...temps) - 4, 
                    max: Math.max(...temps) + 5 
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: '#0f172a',
                        font: { size: 11, weight: 'bold' },
                        textStrokeColor: '#ffffff',
                        textStrokeWidth: 2
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    // 오전 9시와 오후 6시(18시) 구간이 정중앙에 편안하게 포함되도록 기본 스크롤값 포커싱
    setTimeout(() => {
        chartWrapper.scrollLeft = 280; 
    }, 150);
}

function renderForecastTable(daily) {
    const tbody = document.getElementById('forecast-body');
    tbody.innerHTML = '';

    // 인덱스 1번(오늘)부터 하단 리스트 주간 예보 매칭
    for (let i = 1; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]);
        const dayStr = `${date.getMonth() + 1}/${date.getDate()}(${['일','월','화','수','목','금','토'][date.getDay()]})`;
        const row = `
            <tr>
                <td><strong>${dayStr}</strong></td>
                <td>${getWeatherDesc(daily.weather_code[i])}</td>
                <td style="color: #4a90e2">${Math.round(daily.temperature_2m_min[i])}°C</td>
                <td style="color: #e24a4a">${Math.round(daily.temperature_2m_max[i])}°C</td>
            </tr>
        `;
        tbody.innerHTML += row;
    }
}

initApp();
