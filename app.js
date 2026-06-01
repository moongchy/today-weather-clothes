let globalWeatherData = null;
let currentTab = 'today';

// 💡 [최적화] 기온 및 시간 조건에 맞는 아이콘/낮밤 감성 배경 매핑 테이블
const weatherVisualMap = {
    "sunny-day": { desc: "맑음", icon: "☀️", isRainy: false },
    "clear-night": { desc: "맑음", icon: "🌙", isRainy: false },
    "clouds-day": { desc: "흐림", icon: "⛅", isRainy: false },
    "clouds-night": { desc: "흐림", icon: "☁️", isRainy: false },
    "rain": { desc: "비", icon: "🌧️", isRainy: true },
    "snow": { desc: "눈", icon: "❄️", isRainy: true },
    "thunder": { desc: "뇌우", icon: "⛈️", isRainy: true }
};

// 💡 [핵심] 사용자가 옷차림 항목을 터치했을 때 해당 기온 가이드를 최상단으로 밀어 올리는 정밀 스크롤 함수
function highlightOutfitTable(temp) {
    const roundedTemp = Math.round(temp);
    let targetRow = null;

    // 1. 매체별 구조(테이블 행 or 모바일 블록 카드)에 맞춰 하이라이트 클래스 토글
    document.querySelectorAll('#outfit-rows tr').forEach(row => {
        const min = parseInt(row.getAttribute('data-min'));
        const max = parseInt(row.getAttribute('data-max'));
        
        if (roundedTemp >= min && roundedTemp <= max) {
            row.classList.add('highlight');
            targetRow = row;
        } else {
            row.classList.remove('highlight');
        }
    });

    // 2. [2번 피드백] 하이라이트된 카드를 무조건 스크롤 창의 '가장 위'로 밀착 정렬
    if (targetRow) {
        setTimeout(() => {
            const container = document.querySelector('.table-responsive');
            if (container) {
                // 부모 섹션의 상단 기준점과 타이틀 높이 등을 감안하여 타겟 요소의 절대 위치 계산
                const targetOffsetTop = targetRow.offsetTop;
                
                container.scrollTo({
                    top: targetOffsetTop, // 타겟 카드를 스크롤 영역 최상단으로 밀착
                    behavior: 'smooth'
                });
            }
        }, 150);
    }
}

// 💡 [추가] 사파리 위치 안내 모달 닫기
function closeLocationModal() {
    document.getElementById('ios-location-modal').style.display = 'none';
}

function initApp() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                getWeatherData(position.coords.latitude, position.coords.longitude);
            }, 
            error => {
                console.log("위치 권한 거부됨:", error);
                getWeatherData(37.5665, 126.9780); // 서울 기준 기본값
                
                // 💡 [아이폰 피드백] 사파리 유저를 위한 안내 팝업 노출
                document.getElementById('ios-location-modal').style.display = 'flex';
            }
        );
    } else {
        getWeatherData(37.5665, 126.9780);
    }
}

// app.js의 기존 getWeatherData 함수를 아래 코드로 완전히 교체해 주세요!
async function getWeatherData(lat, lon) {
    // 💡 오픈메테오 API 주소 (1시간 단위 기온, 강수확률, 날씨코드 및 주간 최고/최저기온 요청)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // 오픈메테오 데이터를 기존 One Call 3.0 변수 구조와 완벽히 호환되도록 리포맷팅(가공)
        const now = new Date();
        const nowHr = now.getHours();
        
        // 1. WMO 날씨 코드를 'Main 문자열(Clear, Rain 등)'로 변환하는 내부 매퍼 함수
        const parseWmoCode = (code) => {
            if (code <= 1) return { main: "Clear", icon: "01" }; // 맑음
            if (code <= 3) return { main: "Clouds", icon: "03" }; // 구름/흐림
            if (code >= 51 && code <= 67) return { main: "Rain", icon: "10" }; // 비
            if (code >= 71 && code <= 77) return { main: "Snow", icon: "13" }; // 눈
            if (code >= 80 && code <= 82) return { main: "Rain", icon: "09" }; // 소나기
            if (code >= 95) return { main: "Thunderstorm", icon: "11" }; // 뇌우
            return { main: "Clouds", icon: "03" }; // 기본값 흐림
        };

        const currentWmo = parseWmoCode(data.hourly.weathercode[nowHr]);

        globalWeatherData = {
            current: {
                temp: data.hourly.temperature_2m[nowHr],
                sunrise: 6,   // 그라디언트 배경 전환용 기본값 세팅 (오전 6시)
                sunset: 19,   // 그라디언트 배경 전환용 기본값 세팅 (오후 7시)
                weather: [{ 
                    main: currentWmo.main, 
                    icon: currentWmo.icon + (nowHr >= 6 && nowHr < 18 ? "d" : "n") // 낮밤 아이콘 처리
                }]
            },
            // 💡 1시간 단위 데이터를 그대로 살려 스크롤 연동 유지
            hourly: data.hourly.time.map((timeStr, idx) => {
                const itemDate = new Date(timeStr);
                const itemHr = itemDate.getHours();
                const wmo = parseWmoCode(data.hourly.weathercode[idx]);
                return {
                    dt: Math.floor(itemDate.getTime() / 1000),
                    temp: data.hourly.temperature_2m[idx],
                    pop: (data.hourly.precipitation_probability[idx] || 0) / 100, // 0~1 범위로 정규화
                    weather: [{ 
                        main: wmo.main, 
                        icon: wmo.icon + (itemHr >= 6 && itemHr < 18 ? "d" : "n") 
                    }]
                };
            }),
            // 📅 하단 주간 가로 횡 예보용 배열 매핑
            daily: data.daily.time.map((timeStr, idx) => {
                const wmo = parseWmoCode(data.daily.weathercode[idx]);
                return {
                    dt: Math.floor(new Date(timeStr).getTime() / 1000),
                    temp: {
                        min: data.daily.temperature_2m_min[idx],
                        max: data.daily.temperature_2m_max[idx]
                    },
                    pop: 0, // 오픈메테오 일별 기본 강수확률 예외 처리
                    weather: [{ main: wmo.main, icon: wmo.icon + "d" }]
                };
            })
        };
        
        // 행정구역 오픈 API 연동 전까지는 깔끔하게 내 위치 정보로 마킹
        document.getElementById('location').innerText = `📍 현재 내 위치`;
        
        // 기존에 만들어둔 렌더링 및 배경 전환 시스템 가동
        updateSiteBackground();
        renderPage();
        renderForecastList(globalWeatherData.daily);
        
    } catch (e) {
        console.error("오픈메테오 API 통신 에러:", e);
        document.getElementById('location').innerText = `❌ 날씨 데이터 로딩 실패`;
    }
}

// 🌤️ 날씨 조건 + 시간대를 조합한 동적 그라디언트 시스템
function updateSiteBackground() {
    if (!globalWeatherData) return;
    const now = new Date();
    const hr = now.getHours();
    
    const currentWeatherCode = globalWeatherData.current.weather[0].main;
    const isRainyOrBad = currentWeatherCode === "Rain" || currentWeatherCode === "Drizzle" || currentWeatherCode === "Thunderstorm";

    const sunriseHr = new Date(globalWeatherData.current.sunrise * 1000).getHours(); // OpenWeather는 초 단위이므로 1000을 곱함
    const sunsetHr = new Date(globalWeatherData.current.sunset * 1000).getHours();

    let bg = "";
    if (isRainyOrBad) {
        bg = "linear-gradient(180deg, #606c88 0%, #3f4c6b 100%)";
    } else if (hr >= sunriseHr && hr < sunriseHr + 2) {
        bg = "linear-gradient(180deg, #ffafbd 0%, #ffc3a0 100%)";
    } else if (hr >= sunriseHr + 2 && hr < sunsetHr - 1) {
        bg = "linear-gradient(180deg, #3a88e9 0%, #5ea4ff 100%)";
    } else if (hr >= sunsetHr - 1 && hr <= sunsetHr + 1) {
        bg = "linear-gradient(180deg, #e65c00 0%, #f9d423 100%)";
    } else {
        bg = "linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)";
    }
    document.body.style.background = bg;
}

// 💡 [근본적 문제 해결] 데이터를 가져오자마자 '지금' 이전의 배열은 필터링하여 버림
function renderPage() {
    if (!globalWeatherData) return;

    const hourly = globalWeatherData.hourly;
    const now = new Date();
    const nowHr = now.getHours();

    const targetDate = new Date();
    if (currentTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
    const targetStr = targetDate.toLocaleDateString('sv');

    // 데이터를 가져와 시간 반복문을 돌리기 직전에 필터링 로직 통과
    const 앞으로의날씨 = hourly.filter(item => {
        const itemDate = new Date(item.dt * 1000);
        // 내일 탭이면 날짜가 일치하는 것만, 오늘 탭이면 날짜가 같고 현재 시간 이후인 것만 필터링
        if (currentTab === 'tomorrow') {
            return itemDate.toLocaleDateString('sv') === targetStr;
        } else {
            return itemDate.toLocaleDateString('sv') === targetStr && itemDate.getHours() >= nowHr;
        }
    });

    if (앞으로의날씨.length === 0) return;

    const currentMatch = 앞으로의날씨[0]; // 필터링된 배열의 첫 번째가 언제나 '지금'이 됨

    // 메인 정보 스왑
    const codeMain = currentMatch.weather[0].main;
    const isNight = currentMatch.weather[0].icon.includes('n');
    const isClouds = codeMain === "Clouds";

    // 날씨 아이콘 매핑 전략 갱신 (OpenWeather에 맞춤)
    let iconLabel = isClouds ? "clouds-day" : "sunny-day";
    if (isNight && isClouds) iconLabel = "clouds-night";
    if (isNight && !isClouds) iconLabel = "clear-night";
    if (codeMain === "Rain" || codeMain === "Drizzle") iconLabel = "rain";
    if (codeMain === "Thunderstorm") iconLabel = "thunder";

    const codeObj = weatherVisualMap[iconLabel] || { desc: "맑음", icon: "☀️" };
    document.getElementById('temp-display').innerText = `${Math.round(currentMatch.temp)}°`;
    document.getElementById('weather-desc').innerText = codeObj.desc;
    
    // OpenWeather One Call daily[0]이 오늘 데이터를 제공
    const dailyDataIdx = currentTab === 'today' ? 0 : 1;
    const maxT = Math.round(globalWeatherData.daily[dailyDataIdx].temp.max);
    const minT = Math.round(globalWeatherData.daily[dailyDataIdx].temp.min);
    document.getElementById('range-display').innerText = `최고:${maxT}° 최저:${minT}°`;
    document.getElementById('weather-summary').innerText = `현재 기온은 ${Math.round(currentMatch.temp)}°이며 오늘 최고 기온은 ${maxT}°까지 올라갈 예정입니다.`;

    highlightOutfitTable(currentMatch.temp);

    // 가로 스크롤 리스트 생성
    const wrapper = document.getElementById('hourlyWrapper');
    wrapper.innerHTML = '';

    앞으로의날씨.forEach(d => {
        const itemDate = new Date(d.dt * 1000);
        const hr = itemDate.getHours();
        const isCurrentHour = (currentTab === 'today' && hr === nowHr);
        const timeLabel = isCurrentHour ? '지금' : `${hr}시`;
        
        // 시간별 아이콘 매핑
        const d_codeMain = d.weather[0].main;
        const d_isClouds = d_codeMain === "Clouds";
        let d_iconLabel = d_isClouds ? "clouds-day" : "sunny-day";
        if (d_isClouds) d_iconLabel = d.weather[0].icon.includes('n') ? "clouds-night" : "clouds-day";
        if (!d_isClouds) d_iconLabel = d.weather[0].icon.includes('n') ? "clear-night" : "sunny-day";
        if (d_codeMain === "Rain" || d_codeMain === "Drizzle") d_iconLabel = "rain";
        if (d_codeMain === "Thunderstorm") d_iconLabel = "thunder";
        const mapItem = weatherVisualMap[d_iconLabel] || { icon: "☀️" };

        // 💧 강수확률이 30% 이상일 때만 파란 글씨로 노출
        const popValue = Math.round(d.pop * 100);
        const popLabel = popValue >= 30 ? `${popValue}%` : '';
        const activeClass = isCurrentHour ? 'selected' : '';

        const itemHtml = `
            <div class="hourly-item ${activeClass}" onclick="selectHourlyTime(this, ${d.temp})">
                <div class="hourly-time">${timeLabel}</div>
                <div class="hourly-icon">${mapItem.icon}</div>
                <div class="hourly-pop">${popLabel}</div>
                <div class="hourly-temp">${Math.round(d.temp)}°</div>
            </div>
        `;
        wrapper.innerHTML += itemHtml;
    });
}

function selectHourlyTime(element, temp) {
    document.querySelectorAll('.hourly-item').forEach(item => item.classList.remove('selected'));
    element.classList.add('selected');
    highlightOutfitTable(temp);
}

function switchDay(day) {
    currentTab = day;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    renderPage();
}

// 📅 [웹/아이패드 피드백] 데스크톱 모드에서는 가로형 카드로 분할 배치하도록 로직 수정
function renderForecastList(daily) {
    const listContainer = document.getElementById('forecast-list');
    listContainer.innerHTML = '';

    // daily[0]은 오늘, daily[1~5]까지 5일 예보 배열 생성
    const forecastDays = daily.slice(1, 6);
    const allMaxs = forecastDays.map(d => d.temp.max);
    const allMins = forecastDays.map(d => d.temp.min);
    const absoluteMax = Math.max(...allMaxs);
    const absoluteMin = Math.min(...allMins);
    const totalRange = absoluteMax - absoluteMin;

    forecastDays.forEach((d, i) => {
        const date = new Date(d.dt * 1000);
        // 첫 번째 카드는 '오늘'로 표기
        const dayStr = i === 0 ? '오늘' : `${['일','월','화','수','목','금','토'][date.getDay()]}요일`;
        
        const popMax = Math.round(d.pop * 100);
        const popLabel = popMax >= 30 ? `${popMax}%` : '';

        const minT = Math.round(d.temp.min);
        const maxT = Math.round(d.temp.max);

        const leftPercent = ((minT - absoluteMin) / totalRange) * 100;
        const widthPercent = ((maxT - minT) / totalRange) * 100;

        const rowHtml = `
            <div class="forecast-row">
                <div class="fc-day">${dayStr}</div>
                <div class="fc-icon-box">
                    <span class="fc-icon">${d.weather[0].icon.includes('d') ? "☀️" : "🌙"}</span>
                    <span class="fc-pop">${popLabel}</span>
                </div>
                <div class="fc-temp-container">
                    <span class="fc-min-temp">${minT}°</span>
                    <div class="fc-bar-bg">
                        <div class="fc-bar-fill" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>
                    </div>
                    <span class="fc-max-temp">${maxT}°</span>
                </div>
            </div>
        `;
        listContainer.innerHTML += rowHtml;
    });
}

initApp();
