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
            getWeatherData(37.5665, 126.9780); // 서울 기본값
        });
    }
}

async function getWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,precipitation&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&past_days=1`;
    try {
        const response = await fetch(url);
        globalWeatherData = await response.json();
        document.getElementById('location').innerText = `📍 현재 위치 영역`;
        
        // 사이트 전체 배경 먼저 실시간으로 적용
        updateSiteBackground();
        
        renderPage();
        renderForecastTable(globalWeatherData.daily);
    } catch (e) { console.error(e); }
}

// 🌟 [추가] 실시간 일출/일몰 연동형 사이트 배경 전환 시스템
function updateSiteBackground() {
    if (!globalWeatherData) return;

    const now = new Date();
    const currentHour = now.getHours();

    // 오늘의 일출/일몰 시간 획득 (past_days=1 이므로 인덱스 1이 오늘)
    const sunriseStr = globalWeatherData.daily.sunrise[1];
    const sunsetStr = globalWeatherData.daily.sunset[1];
    const sunriseHour = sunriseStr ? new Date(sunriseStr).getHours() : 6;
    const sunsetHour = sunsetStr ? new Date(sunsetStr).getHours() : 19;

    let backgroundStyle = "";

    if (currentHour >= sunriseHour && currentHour < sunriseHour + 2) {
        // 1. 아침 일출 시점 (은은한 새벽 노을빛 연청보라)
        backgroundStyle = "linear-gradient(135deg, #ffafbd 0%, #ffc3a0 100%)";
    } else if (currentHour >= sunriseHour + 2 && currentHour < sunsetHour - 1) {
        // 2. 완전한 낮 (시원하고 화사한 스카이 블루)
        backgroundStyle = "linear-gradient(135deg, #74ebe7 0%, #4a90e2 100%)";
    } else if (currentHour >= sunsetHour - 1 && currentHour <= sunsetHour + 1) {
        // 3. 저녁 일몰 시점 (환상적인 핑크빛 보라 노을)
        backgroundStyle = "linear-gradient(135deg, #ed4264 0%, #ffedbc 100%)";
    } else {
        // 4. 깊은 밤 (시크하고 깊이감 있는 은하수 네이비)
        backgroundStyle = "linear-gradient(135deg, #1f4068 0%, #162447 50%, #101d42 100%)";
    }

    // 웹사이트 전체 body 배경에 주입
    document.body.style.background = backgroundStyle;
}

function renderPage() {
    if (!globalWeatherData) return;

    const hourly = globalWeatherData.hourly;
    const targetDate = new Date();
    if (currentTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
    const targetStr = targetDate.toLocaleDateString('sv');

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
    document.getElementById('graph-title').innerText = `📈 시간대별 기온 변화 (${currentTab === 'today' ? '오늘' : '내일'})`;
    
    buildChart(dayDataList);
}

function switchDay(day) {
    currentTab = day;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderPage();
}

// 📊 수치만 투명하고 깨끗하게 강조하는 차트 함수로 개편
function buildChart(dayData) {
    const canvas = document.getElementById('tempChart');
    const ctx = canvas.getContext('2d');
    const chartWrapper = document.getElementById('chartWrapper');
    
    // 그래프 뒷배경 색상(chartBg)은 더 이상 필요 없으므로 제거 또는 투명화 처리
    const bgLayer = document.getElementById('chartBg');
    if (bgLayer) bgLayer.style.background = "transparent";

    const labels = dayData.map(d => `${d.time.getHours()}시`);
    const temps = dayData.map(d => Math.round(d.temp));

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '기온',
                data: temps,
                borderColor: '#1d4ed8', // 짙고 뚜렷한 메인 블루 라인
                borderWidth: 4,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.2,
                pointRadius: 5,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#1d4ed8',
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
                    offset: 5,
                    font: { weight: 'bold', size: 13 },
                    color: '#1e293b', 
                    textStrokeColor: '#ffffff',
                    textStrokeWidth: 3,
                    formatter: (value) => `${value}°C` // ☔ 강수확률 표기 제거 완료!
                }
            },
            scales: {
                y: { 
                    display: false, 
                    min: Math.min(...temps) - 3, 
                    max: Math.max(...temps) + 3 
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: '#1e293b',
                        font: { size: 12, weight: 'bold' },
                        textStrokeColor: '#ffffff',
                        textStrokeWidth: 2
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    setTimeout(() => {
        chartWrapper.scrollLeft = 280; 
    }, 150);
}

function renderForecastTable(daily) {
    const tbody = document.getElementById('forecast-body');
    tbody.innerHTML = '';

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
