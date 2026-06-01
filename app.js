let globalWeatherData = null;
let currentTab = 'today';
let myChart = null;

// 순정 Chart.js 내부에서 직접 숫자를 그리도록 설계한 커스텀 플러그인 (외부 라이브러리 필요 없음!)
const customDatalabels = {
    id: 'customDatalabels',
    afterDatasetsDraw(chart) {
        const { ctx, data } = chart;
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        chart.metas.forEach((meta) => {
            meta.data.forEach((point, index) => {
                const value = data.datasets[0].data[index];
                ctx.fillText(`${value}°`, point.x, point.y - 6);
            });
        });
        ctx.restore();
    }
};

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

function highlightOutfitTable(temp) {
    const roundedTemp = Math.round(temp);
    const rows = document.querySelectorAll('#outfit-rows tr');
    
    rows.forEach(row => {
        const min = parseInt(row.getAttribute('data-min'));
        const max = parseInt(row.getAttribute('data-max'));
        
        if (roundedTemp >= min && roundedTemp <= max) {
            row.classList.add('highlight');
            setTimeout(() => {
                row.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            }, 300);
        } else {
            row.classList.remove('highlight');
        }
    });
}

function initApp() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            getWeatherData(position.coords.latitude, position.coords.longitude);
        }, () => {
            getWeatherData(37.5665, 126.9780); // GPS 거부 시 서울 기준
        });
    } else {
        getWeatherData(37.5665, 126.9780);
    }
}

async function getWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,precipitation&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&past_days=1`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API 응답 실패');
        globalWeatherData = await response.json();
        
        document.getElementById('location').innerText = `📍 현재 위치 기온`;
        
        updateSiteBackground();
        renderPage();
        renderForecastTable(globalWeatherData.daily);
    } catch (e) { 
        console.error("날씨 데이터 로드 오류:", e); 
        document.getElementById('location').innerText = `❌ 날씨 로드 실패`;
    }
}

function updateSiteBackground() {
    if (!globalWeatherData) return;
    const now = new Date();
    const currentHour = now.getHours();

    const sunriseStr = globalWeatherData.daily.sunrise[1];
    const sunsetStr = globalWeatherData.daily.sunset[1];
    const sunriseHour = sunriseStr ? new Date(sunriseStr).getHours() : 6;
    const sunsetHour = sunsetStr ? new Date(sunsetStr).getHours() : 19;

    let backgroundStyle = "";
    if (currentHour >= sunriseHour && currentHour < sunriseHour + 2) {
        backgroundStyle = "linear-gradient(180deg, #ffafbd 0%, #ffc3a0 100%)";
    } else if (currentHour >= sunriseHour + 2 && currentHour < sunsetHour - 1) {
        backgroundStyle = "linear-gradient(180deg, #5097e6 0%, #2f73c4 100%)";
    } else if (currentHour >= sunsetHour - 1 && currentHour <= sunsetHour + 1) {
        backgroundStyle = "linear-gradient(180deg, #ed4264 0%, #ffedbc 100%)";
    } else {
        backgroundStyle = "linear-gradient(180deg, #1a2a6c 0%, #275d8c 100%)";
    }
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

    document.getElementById('temp-display').innerText = `${Math.round(currentMatch.temp)}°`;
    document.getElementById('weather-desc').innerText = currentTab === 'today' ? "실시간 기온 정보" : "내일 예보 기온";
    document.getElementById('rain-display').innerText = `💧 강수확률: ${currentMatch.pop}%`;

    highlightOutfitTable(currentMatch.temp);
    
    document.getElementById('graph-title').innerText = `📈 시간대별 기온 변화 (${currentTab === 'today' ? '오늘' : '내일'})`;
    buildChart(dayDataList);
}

function switchDay(day) {
    currentTab = day;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    renderPage();
}

function buildChart(dayData) {
    const canvas = document.getElementById('tempChart');
    const ctx = canvas.getContext('2d');
    const chartWrapper = document.getElementById('chartWrapper');
    
    const labels = dayData.map(d => {
        const hr = d.time.getHours();
        return hr === new Date().getHours() && currentTab === 'today' ? '지금' : `${hr}시`;
    });
    const temps = dayData.map(d => Math.round(d.temp));

    if (myChart) myChart.destroy();

    try {
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: temps,
                    borderColor: '#ffffff',
                    borderWidth: 3,
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: 'transparent',
                    pointBorderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        display: false, 
                        min: Math.min(...temps) - 2, 
                        max: Math.max(...temps) + 2 
                    },
                    x: {
                        grid: { display: false },
                        ticks: { 
                            color: 'rgba(255, 255, 255, 0.85)',
                            font: { size: 12, weight: '500' }
                        }
                    }
                }
            },
            plugins: [customDatalabels] // 자체 제작한 커스텀 안전 플러그인 주입
        });
    } catch(err) {
        console.error("차트 빌드 실패:", err);
    }

    setTimeout(() => {
        chartWrapper.scrollLeft = 0; 
    }, 150);
}

function renderForecastTable(daily) {
    const tbody = document.getElementById('forecast-body');
    tbody.innerHTML = '';

    for (let i = 1; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]);
        const dayStr = i === 1 ? '오늘' : `${['일','월','화','수','목','금','토'][date.getDay()]}요일`;
        const row = `
            <tr>
                <td><strong>${dayStr}</strong></td>
                <td>☀️ ${getWeatherDesc(daily.weather_code[i])}</td>
                <td>${Math.round(daily.temperature_2m_min[i])}°</td>
                <td><strong>${Math.round(daily.temperature_2m_max[i])}°</strong></td>
            </tr>
        `;
        tbody.innerHTML += row;
    }
}

// 앱 실행
initApp();
