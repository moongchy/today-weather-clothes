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

async function initApp() {
    try {
        const responseText = await fetch('api.txt');
        const apiKey = (await responseText.text()).trim();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                getWeatherData(position.coords.latitude, position.coords.longitude, apiKey);
            }, () => alert("위치 권한을 허용해 주세요."));
        }
    } catch (e) { console.error(e); }
}

async function getWeatherData(lat, lon, apiKey) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;
    try {
        const response = await fetch(url);
        globalWeatherData = await response.json();
        document.getElementById('location').innerText = `📍 ${globalWeatherData.city.name}`;
        renderPage();
        renderForecastTable(globalWeatherData.list);
    } catch (e) { console.error(e); }
}

function renderPage() {
    if (!globalWeatherData) return;

    const list = globalWeatherData.list;
    const today = new Date();
    
    const targetDate = new Date();
    if (currentTab === 'tomorrow') targetDate.setDate(today.getDate() + 1);
    const targetStr = targetDate.toLocaleDateString('sv'); 

    let dayDataList = list.filter(item => {
        const itemDateStr = new Date(item.dt * 1000).toLocaleDateString('sv');
        return itemDateStr === targetStr;
    });

    if (currentTab === 'today' && dayDataList.length < 8) {
        const remainingNeeded = 8 - dayDataList.length;
        const previousData = list.filter(item => {
            const itemDateStr = new Date(item.dt * 1000).toLocaleDateString('sv');
            return itemDateStr < targetStr;
        }).slice(-remainingNeeded);
        dayDataList = [...previousData, ...dayDataList];
    }

    if (dayDataList.length === 0) return;

    const mainData = currentTab === 'today' ? list[0] : dayDataList[0];
    document.getElementById('temp-display').innerText = `${Math.round(mainData.main.temp)}°C`;
    document.getElementById('weather-desc').innerText = mainData.weather[0].description;
    
    const pop = mainData.pop ? Math.round(mainData.pop * 100) : 0;
    const rain = mainData.rain ? (mainData.rain['3h'] || 0) : (mainData.snow ? (mainData.snow['3h'] || 0) : 0);
    document.getElementById('rain-display').innerText = `💧 강수확률: ${pop}% ${rain > 0 ? `(예상 강수량: ${rain}mm)` : ''}`;

    recommendOutfit(mainData.main.temp);
    document.getElementById('graph-title').innerText = `📈 시간대별 기온 변화 (${currentTab === 'today' ? '오늘' : '내일'})`;
    
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
    
    const labels = dayData.map(item => `${new Date(item.dt * 1000).getHours()}시`);
    const temps = dayData.map(item => Math.round(item.main.temp));
    const rainInfos = dayData.map(item => {
        const pop = item.pop ? Math.round(item.pop * 100) : 0;
        return pop > 0 ? `☔${pop}%` : '';
    });

    // 1. CSS 그라데이션 동적 생성 (DOM 직접 제어하여 충돌 원천 차단)
    const startHour = new Date(dayData[0].dt * 1000).getHours();
    const endHour = new Date(dayData[dayData.length - 1].dt * 1000).getHours();
    let totalDuration = endHour - startHour;
    if (totalDuration <= 0) totalDuration = 24;

    const sunriseHour = globalWeatherData.city.sunrise ? new Date(globalWeatherData.city.sunrise * 1000).getHours() : 6;
    const sunsetHour = globalWeatherData.city.sunset ? new Date(globalWeatherData.city.sunset * 1000).getHours() : 19;

    const getStopPercent = (hour) => {
        let pos = (hour - startHour) / totalDuration;
        if (pos < 0) pos += 1;
        return Math.round(Math.max(0, Math.min(1, pos)) * 100);
    };

    const sunrisePct = getStopPercent(sunriseHour);
    const sunsetPct = getStopPercent(sunsetHour);

    // CSS 리니어 그라데이션 문장 조립
    let cssGradient = `linear-gradient(to right, #1e2530 0%`;
    if (sunrisePct > 0 && sunrisePct < 100) {
        cssGradient += `, #232d3d ${Math.max(0, sunrisePct - 5)}%, #fef3c7 ${sunrisePct}%, #fff7ed ${Math.min(100, sunrisePct + 5)}%`;
    }
    if (sunsetPct > 0 && sunsetPct < 100) {
        cssGradient += `, #fff7ed ${Math.max(0, sunsetPct - 5)}%, #ffedd5 ${sunsetPct}%, #111827 ${Math.min(100, sunsetPct + 5)}%`;
    }
    cssGradient += `, #0f172a 100%)`;
    
    // 배경 레이어에 그라데이션 적용
    if (bgLayer) bgLayer.style.background = cssGradient;

    // 2. 순수 Chart.js 설정 구성 (오버라이드 없음)
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '기온',
                data: temps,
                borderColor: '#2563eb', // 선명한 블루 라인
                borderWidth: 4,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.3,
                pointRadius: 6,
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
                    font: { weight: 'bold', size: 13 },
                    color: '#0f172a', 
                    textStrokeColor: '#ffffff',
                    textStrokeWidth: 3,
                    formatter: function(value, context) {
                        return `${value}°C\n${rainInfos[context.dataIndex] || ''}`;
                    }
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
                        font: { size: 12, weight: 'bold' },
                        textStrokeColor: '#ffffff',
                        textStrokeWidth: 2
                    }
                }
            }
        },
        plugins: [ChartDataLabels] // 플러그인 정상 결합
    });

    setTimeout(() => {
        chartWrapper.scrollLeft = 245; 
    }, 150);
}

function renderForecastTable(allData) {
    const tbody = document.getElementById('forecast-body');
    tbody.innerHTML = '';
    const dailyData = allData.filter((item, index) => index % 8 === 0);

    dailyData.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayStr = `${date.getMonth() + 1}/${date.getDate()}(${['일','월','화','수','목','금','토'][date.getDay()]})`;
        const row = `
            <tr>
                <td><strong>${dayStr}</strong></td>
                <td>${item.weather[0].description}</td>
                <td style="color: #4a90e2">${Math.round(item.main.temp_min)}°C</td>
                <td style="color: #e24a4a">${Math.round(item.main.temp_max)}°C</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

initApp();
