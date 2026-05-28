// 기온별 복장 데이터 구조
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

// 복장 테이블 갱신 함수
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

// 초기 로드
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

// API 호출
async function getWeatherData(lat, lon, apiKey) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;
    try {
        const response = await fetch(url);
        globalWeatherData = await response.json();
        
        document.getElementById('location').innerText = `📍 ${globalWeatherData.city.name}`;
        
        // 데이터 파싱 후 화면 그리기
        renderPage();
        renderForecastTable(globalWeatherData.list);
    } catch (e) { console.error(e); }
}

// 오늘 vs 내일 데이터 필터링 기능 및 UI 업데이트 핵심
function renderPage() {
    if (!globalWeatherData) return;

    const list = globalWeatherData.list;
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    const targetDateStr = (currentTab === 'today') ? todayStr : tomorrowStr;
    
    // 해당 날짜에 속하는 3시간 단위 데이터들 추출 (0시 ~ 24시 포괄)
    const dayDataList = list.filter(item => {
        const itemDateStr = new Date(item.dt * 1000).toISOString().split('T')[0];
        return itemDateStr === targetDateStr;
    });

    if(dayDataList.length === 0) return;

    // 대표 메인 날씨 세팅 (가장 첫 시간대 기준)
    const mainData = dayDataList[0];
    document.getElementById('temp-display').innerText = `${Math.round(mainData.main.temp)}°C`;
    document.getElementById('weather-desc').innerText = mainData.weather[0].description;
    
    // 강수량 및 강수확률 파악
    const pop = mainData.pop ? Math.round(mainData.pop * 100) : 0; // 강수확률 (0~1)
    const rain = mainData.rain ? (mainData.rain['3h'] || 0) : (mainData.snow ? (mainData.snow['3h'] || 0) : 0);
    document.getElementById('rain-display').innerText = `💧 강수확률: ${pop}% ${rain > 0 ? `(예상 강수량: ${rain}mm)` : ''}`;

    // 복장 추천 표 업데이트
    recommendOutfit(mainData.main.temp);

    // 제목 업데이트 및 그래프 빌드
    document.getElementById('graph-title').innerText = `📈 시간대별 기온 변화 (${currentTab === 'today' ? '오늘' : '내일'})`;
    buildChart(dayDataList);
}

// 탭 전환 처리
function switchDay(day) {
    currentTab = day;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderPage();
}

// Chart.js 그래프 생성 및 스크롤 제어
function buildChart(dayData) {
    const ctx = document.getElementById('tempChart').getContext('2d');
    
    const labels = dayData.map(item => {
        const date = new Date(item.dt * 1000);
        return `${date.getHours()}시`;
    });
    const temps = dayData.map(item => Math.round(item.main.temp));
    
    // 툴팁이나 축 정보에 보여줄 강수 표기용 어레이
    const rainInfos = dayData.map(item => {
        const pop = item.pop ? Math.round(item.pop * 100) : 0;
        return pop > 0 ? `☔${pop}%` : '';
    });

    if (myChart) myChart.destroy(); // 기존 차트가 있다면 초기화

    myChart = new Chart(ctx, {
        type: 'line',
        plugins: [ChartDataLabels], // 데이터 레이블 플러그인 장착
        data: {
            labels: labels,
            datasets: [{
                label: '기온 (°C)',
                data: temps,
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74, 144, 226, 0.08)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 25, bottom: 10, left: 15, right: 15 } },
            scales: {
                y: { display: false, grid: { display: false } }, // 숫자가 보이니까 y축선 과감히 생략
                x: { grid: { display: false }, ticks: { font: { size: 12, weight: 'bold' } } }
            },
            plugins: {
                legend: { display: false },
                // 수치 표기 플러그인 상세 설정
                datalabels: {
                    align: 'top',
                    anchor: 'end',
                    offset: 4,
                    font: { weight: 'bold', size: 12 },
                    color: '#333',
                    formatter: function(value, context) {
                        const rainText = rainInfos[context.dataIndex];
                        return `${value}°C\n${rainText}`; // 온도가 나오고 그 아래 강수 정보 노출
                    }
                }
            }
        }
    });

    // 9시~18시가 화면 중앙 부근에 오도록 가로 스크롤 포커스 자동 조절
    setTimeout(() => {
        const wrapper = document.getElementById('chartWrapper');
        // 전체 850px 기온 그래프 레이아웃 중 대략 9시 지점(중간 앞쪽)으로 스크롤 이동
        wrapper.scrollLeft = 220; 
    }, 100);
}

// 하단 주간 예보 표 생성
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
