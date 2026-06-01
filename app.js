let globalWeatherData = null;
let currentTab = 'today';

const weatherInfoMap = {
    0: { desc: "맑음", icon: "☀️", isRainy: false },
    1: { desc: "대체로 맑음", icon: "🌤️", isRainy: false },
    2: { desc: "구름 조금", icon: "⛅", isRainy: false },
    3: { desc: "흐림", icon: "☁️", isRainy: false },
    45: { desc: "안개", icon: "🌫️", isRainy: false },
    48: { desc: "침적 안개", icon: "🌫️", isRainy: false },
    51: { desc: "가벼운 이슬비", icon: "🌦️", isRainy: true },
    53: { desc: "이슬비", icon: "🌧️", isRainy: true },
    55: { desc: "짙은 이슬비", icon: "🌧️", isRainy: true },
    61: { desc: "약한 비", icon: "🌧️", isRainy: true },
    63: { desc: "보통 비", icon: "🌧️", isRainy: true },
    65: { desc: "강한 비", icon: "☔", isRainy: true },
    71: { desc: "약한 눈", icon: "🌨️", isRainy: true },
    73: { desc: "보통 눈", icon: "❄️", isRainy: true },
    75: { desc: "펑펑 눈", icon: "☃️", isRainy: true },
    80: { desc: "약한 소나기", icon: "🌦️", isRainy: true },
    81: { desc: "보통 소나기", icon: "🌧️", isRainy: true },
    82: { desc: "강한 소나기", icon: "☔", isRainy: true },
    95: { desc: "뇌우", icon: "⛈️", isRainy: true }
};

function highlightOutfitTable(temp) {
    const roundedTemp = Math.round(temp);
    let targetRow = null;

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

    // 💡 스크롤 대상을 .table-responsive 박스로 정밀 타겟팅하여 맨 위 정렬
    if (targetRow) {
        setTimeout(() => {
            const container = document.querySelector('.table-responsive');
            if (container) {
                const targetOffsetTop = targetRow.offsetTop;
                
                container.scrollTo({
                    top: targetOffsetTop, // 타겟 카드를 스크롤 영역 최상단으로 밀착
                    behavior: 'smooth'
                });
            }
        }, 150);
    }
}

// 1. app.js 내의 기존 initApp() 함수를 찾아서 이 코드로 교체해 주세요!
function initApp() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                getWeatherData(position.coords.latitude, position.coords.longitude);
            }, 
            error => {
                // 사용자가 위치 권한을 거부했거나 가져오지 못했을 때
                console.log("위치 권한 거부됨:", error);
                
                // 기본값으로 서울 날씨를 먼저 보여주고
                getWeatherData(37.5665, 126.9780); 
                
                // 💡 아이폰/사파리 유저를 위한 안내 팝업창을 띄웁니다.
                // 일반 PC나 안드로이드에서도 직관적인 가이드를 위해 통합 제공되도록 설계했습니다.
                document.getElementById('ios-location-modal').style.display = 'flex';
            }
        );
    } else {
        getWeatherData(37.5665, 126.9780);
    }
}

// 2. app.js 아무 데나 이 함수를 새로 추가해 주세요! (확인 후 닫기 버튼 기능)
function closeLocationModal() {
    document.getElementById('ios-location-modal').style.display = 'none';
}

async function getWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weather_code&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&past_days=1`;
    try {
        const response = await fetch(url);
        globalWeatherData = await response.json();
        
        document.getElementById('location').innerText = `📍 현재 내 위치`;
        updateSiteBackground();
        renderPage();
        renderForecastList(globalWeatherData.daily);
    } catch (e) {
        console.error(e);
        document.getElementById('location').innerText = `❌ 연결 실패`;
    }
}

function updateSiteBackground() {
    if (!globalWeatherData) return;
    const now = new Date();
    const hr = now.getHours();
    
    const todayWeatherCode = globalWeatherData.daily.weather_code[1];
    const isRainyOrBad = weatherInfoMap[todayWeatherCode]?.isRainy || todayWeatherCode >= 3; 

    const sunriseHr = new Date(globalWeatherData.daily.sunrise[1]).getHours();
    const sunsetHr = new Date(globalWeatherData.daily.sunset[1]).getHours();

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

function renderPage() {
    if (!globalWeatherData) return;

    const hourly = globalWeatherData.hourly;
    const targetDate = new Date();
    if (currentTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
    const targetStr = targetDate.toLocaleDateString('sv');

    const dayDataList = [];
    for (let i = 0; i < hourly.time.length; i++) {
        if (hourly.time[i].substring(0, 10) === targetStr) {
            dayDataList.push({
                time: new Date(hourly.time[i]),
                temp: hourly.temperature_2m[i],
                pop: hourly.precipitation_probability[i],
                code: hourly.weather_code[i]
            });
        }
    }

    const now = new Date();
    let currentMatch = dayDataList[0];
    if (currentTab === 'today') {
        currentMatch = dayDataList.find(d => d.time.getHours() === now.getHours()) || dayDataList[0];
    }

    const codeObj = weatherInfoMap[currentMatch.code] || { desc: "맑음", icon: "☀️" };
    document.getElementById('temp-display').innerText = `${Math.round(currentMatch.temp)}°`;
    document.getElementById('weather-desc').innerText = codeObj.desc;
    
    const maxT = Math.round(globalWeatherData.daily.temperature_2m_max[currentTab === 'today' ? 1 : 2]);
    const minT = Math.round(globalWeatherData.daily.temperature_2m_min[currentTab === 'today' ? 1 : 2]);
    document.getElementById('range-display').innerText = `최고:${maxT}° 최저:${minT}°`;
    document.getElementById('weather-summary').innerText = `현재 기온은 ${Math.round(currentMatch.temp)}°이며 오늘 최고 기온은 ${maxT}°까지 올라갈 예정입니다.`;

    highlightOutfitTable(currentMatch.temp);

    const wrapper = document.getElementById('hourlyWrapper');
    wrapper.innerHTML = '';

    dayDataList.forEach((d, index) => {
        const hr = d.time.getHours();
        const isCurrentHour = (currentTab === 'today' && hr === now.getHours());
        const timeLabel = isCurrentHour ? '지금' : `${hr}시`;
        const mapItem = weatherInfoMap[d.code] || { icon: "☀️" };
        const popLabel = d.pop >= 30 ? `${d.pop}%` : '';

        // 💡 [1, 3번 답변] 인스턴스 카드 생성 시 고유 클래스 및 클릭 리스너 설정 바인딩
        const activeClass = isCurrentHour ? 'selected' : '';
        const currentCheckId = isCurrentHour ? 'id="current-hour-focus"' : '';

        const itemHtml = `
            <div ${currentCheckId} class="hourly-item ${activeClass}" onclick="selectHourlyTime(this, ${d.temp})">
                <div class="hourly-time">${timeLabel}</div>
                <div class="hourly-icon">${mapItem.icon}</div>
                <div class="hourly-pop">${popLabel}</div>
                <div class="hourly-temp">${Math.round(d.temp)}°</div>
            </div>
        `;
        wrapper.innerHTML += itemHtml;
    });

// [수정 전] renderPage() 함수 맨 아래에 있던 setTimeout 부분을 찾아서...
    // [수정 후] 아래 코드로 완전히 교체해 주세요!
    setTimeout(() => {
        const wrapper = document.getElementById('hourlyWrapper');
        const focusTarget = document.getElementById('current-hour-focus');
        
        if (focusTarget && currentTab === 'today') {
            // 부모 컨테이너(wrapper)의 패딩과 스크롤 시작점을 계산하여 정확히 첫 번째에 배치
            const offsetLeft = focusTarget.offsetLeft - wrapper.offsetLeft;
            wrapper.scrollTo({
                left: offsetLeft,
                behavior: 'smooth'
            });
        } else {
            wrapper.scrollLeft = 0;
        }
    }, 200); // 브라우저가 완전히 렌더링할 시간을 0.2초 확보
}

// [수정 전] function selectHourlyTime(element, temp) { ... }
// [수정 후] 아래 코드로 함수 전체를 교체해 주세요!
function selectHourlyTime(element, temp) {
    // 1. 모든 시간 아이템에서 선택 효과 제거
    document.querySelectorAll('.hourly-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 2. 현재 클릭한 아이템에 선택 효과 적용
    if (element) {
        element.classList.add('selected');
    }
    
    // 3. 기온에 맞춰 옷차림 가이드 행 하이라이트 및 스크롤 이동
    const roundedTemp = Math.round(temp);
    let targetRow = null;

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

    // 4. 웹 브라우저 호환성을 고려한 옷차림 테이블 스크롤 이동
    if (targetRow) {
        setTimeout(() => {
            targetRow.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest', // 다른 화면 요소를 침범하지 않고 테이블 안에서만 부드럽게 이동
                inline: 'start'
            });
        }, 50);
    }
}

function switchDay(day) {
    currentTab = day;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    renderPage();
}

function renderForecastList(daily) {
    const listContainer = document.getElementById('forecast-list');
    listContainer.innerHTML = '';

    const allMaxs = daily.temperature_2m_max.slice(1, 6);
    const allMins = daily.temperature_2m_min.slice(1, 6);
    const absoluteMax = Math.max(...allMaxs);
    const absoluteMin = Math.min(...allMins);
    const totalRange = absoluteMax - absoluteMin;

    for (let i = 1; i < 6; i++) {
        const date = new Date(daily.time[i]);
        const dayStr = i === 1 ? '오늘' : `${['일','월','화','수','목','금','토'][date.getDay()]}요일`;
        const mapItem = weatherInfoMap[daily.weather_code[i]] || { icon: "☀️" };
        
        const popMax = daily.precipitation_probability_max[i];
        const popLabel = popMax >= 30 ? `${popMax}%` : '';

        const minT = Math.round(daily.temperature_2m_min[i]);
        const maxT = Math.round(daily.temperature_2m_max[i]);

        const leftPercent = ((minT - absoluteMin) / totalRange) * 100;
        const widthPercent = ((maxT - minT) / totalRange) * 100;

        const rowHtml = `
            <div class="forecast-row">
                <div class="fc-day">${dayStr}</div>
                <div class="fc-icon-box">
                    <span class="fc-icon">${mapItem.icon}</span>
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
    }
}

initApp();
