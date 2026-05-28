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
    
    // 타겟 날짜 계산 (로컬 시간 기준 자정 세팅)
    const targetDate = new Date();
    if (currentTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
    const targetStr = targetDate.toLocaleDateString('sv'); // YYYY-MM-DD 포맷 안전하게 추출

    // 1. 해당 날짜의 데이터만 정확히 필터링 (0시~24시 포괄)
    const dayDataList = list.filter(item => {
        const itemDateStr = new Date(item.dt * 1000).toLocaleDateString('sv');
        return itemDateStr === targetStr;
    });

    if(dayDataList.length === 0) return;

    const mainData = dayDataList[0];
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

// 3. 일출/일몰 그라데이션 배경을 입힌 시간대별 고정 그래프 생성
function buildChart(dayData) {
    const ctx = document.getElementById('tempChart').getContext('2d');
    const chartWrapper = document.getElementById('chartWrapper');
    
    const labels = dayData.map(item => `${new Date(item.dt * 1000).getHours()}시`);
    const temps = dayData.map(item => Math.round(item.main.temp));
    const rainInfos = dayData.map(item => {
        const pop = item.pop ? Math.round(item.pop * 100) : 0;
        return pop > 0 ? `☔${pop}%` : '';
    });

    // API에서 제공하는 오늘 기준 일출/일몰 시각 파악 (기본값 설정)
    const sunriseHour = globalWeatherData.city.sunrise ? new Date(globalWeatherData.city.sunrise * 1000).getHours() : 6;
    const sunsetHour = globalWeatherData.city.sunset ? new Date(globalWeatherData.city.sunset * 1000).getHours() : 19;

    // 그래프 배경 가로형 그라데이션 객체 생성 (0px부터 850px 끝까지)
    const backgroundGradient = ctx.createLinearGradient(0, 0, 850, 0);
    
    // 시간축 비율 계산용 (0시=0, 24시=1)
    const startHour = new Date(dayData[0].dt * 1000).getHours();
    const endHour = new Date(dayData[dayData.length - 1].dt * 1000).getHours();
    const totalDuration = endHour - startHour || 24;

    const getStopPosition = (hour) => {
        const pos = (hour - startHour) / totalDuration;
        return Math.max(0, Math.min(1, pos)); // 0과 1 사이로 패킹
    };

    const sunriseStop = getStopPosition(sunriseHour);
    const sunsetStop = getStopPosition(sunsetHour);

    // 일출 전 (어두운 새벽) -> 일출 후 (따뜻한 아침) -> 낮 (화창) -> 일몰 (노을) -> 일몰 후 (밤) 순격 매칭
    backgroundGradient.addColorStop(0, '#1e2530'); 
    if(sunriseStop > 0 && sunriseStop < 1) {
        backgroundGradient.addColorStop(Math.max(0, sunriseStop - 0.05), '#232d3d');
        backgroundGradient.addColorStop(sunriseStop, '#fef3c7'); // 일출 지점 가스펠 컬러
        backgroundGradient.addColorStop(Math.min(1, sunriseStop + 0.05), '#fff7ed');
    }
    if(sunsetStop > 0 && sunsetStop < 1) {
        backgroundGradient.addColorStop(Math.max(0, sunsetStop - 0.05), '#fff7ed');
        backgroundGradient.addColorStop(sunsetStop, '#ffedd5'); // 일몰 노을 빛
        backgroundGradient.addColorStop(Math.min(1, sunsetStop + 0.05), '#111827');
    }
    backgroundGradient.addColorStop(1, '#0f172a');

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                label: '기온',
                data: temps,
                borderColor: '#ffffff', // 배경 구분을 명확히 하기 위해 흰색 선 처리
                borderWidth: 3,
                backgroundColor: 'transparent', 
                fill: false,
                tension: 0.3,
                pointRadius: 6,
                pointBackgroundColor: '#4a90e2',
                pointBorderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // 일출/일몰 배경을 입히기 위해 플러그인 영역에 배경 주입
            plugins: {
                legend: { display: false },
                datalabels: {
                    align: 'top',
                    anchor: 'end',
                    offset: 4,
                    font: { weight: 'bold', size: 12 },
                    color: '#ffffff', // 어두운 배경 영역에서도 잘 보이게 화이트 텍스트
                    formatter: (value, context) => `${value}°C\n${rainInfos[context.dataIndex]}`
                }
            },
            scales: {
                y: { display: false },
                x: {
                    grid: { display: false },
                    ticks: { color: '#ffffff', font: { size: 12, weight: 'bold' } }
                }
            }
        },
        // 차트 뒤 백그라운드 색상 그라데이션 채우기 플러그인 커스텀 삽입
        plugins: [{
            id: 'custom_canvas_background_color',
            beforeDraw: (chart) => {
                const {ctx, canvas} = chart;
                ctx.save();
                ctx.fillStyle = backgroundGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }
        }]
    });

    // 8시 반 ~ 18시 반 정중앙 포커스용 정밀 스크롤 제어 수치
    setTimeout(() => {
        chartWrapper.scrollLeft = 245; 
    }, 100);
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
