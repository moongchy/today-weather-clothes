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


async function getWeatherData(lat, lon) {
    const url = `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `서버 오류 (${response.status})`);
        }

        const data = await response.json();

        // 기상청 날씨 코드를 기존 화면에서 사용하는 형식으로 변환
        function parseKmaWeather(pty, sky) {
            const rainType = Number(pty || 0);
            const skyType = Number(sky || 1);

            if ([1, 4, 5].includes(rainType)) {
                return { main: "Rain", icon: "10" };
            }

            if ([2, 6].includes(rainType)) {
                return { main: "Rain", icon: "13" };
            }

            if ([3, 7].includes(rainType)) {
                return { main: "Snow", icon: "13" };
            }

            if (skyType === 1) {
                return { main: "Clear", icon: "01" };
            }

            if (skyType === 3 || skyType === 4) {
                return { main: "Clouds", icon: "03" };
            }

            return { main: "Clouds", icon: "03" };
        }

        // 기상청 날짜와 시각을 한국 시간으로 변환
        function makeTimestamp(date, time) {
            const dateText = String(date);
            const timeText = String(time).padStart(4, "0");

            return Math.floor(
                new Date(
                    `${dateText.slice(0, 4)}-${dateText.slice(4, 6)}-${dateText.slice(6, 8)}T${timeText.slice(0, 2)}:${timeText.slice(2, 4)}:00+09:00`
                ).getTime() / 1000
            );
        }

        const now = new Date();
        const nowHour = now.getHours();

        // 시간별 예보 데이터 구성
        const hourly = data.hourly.map(item => {
            const weather = parseKmaWeather(item.PTY, item.SKY);
            const timestamp = makeTimestamp(item.date, item.time);

            const itemDate = new Date(timestamp * 1000);
            const hour = itemDate.getHours();

            return {
                dt: timestamp,
                temp: Number(item.TMP),
                pop: Number(item.POP || 0) / 100,
                weather: [{
                    main: weather.main,
                    icon: weather.icon + (hour >= 6 && hour < 18 ? "d" : "n")
                }]
            };
        }).filter(item => Number.isFinite(item.temp));

        if (hourly.length === 0) {
            throw new Error("시간별 예보 데이터가 없습니다.");
        }

        // 날짜별 예보 구성
        const daily = data.daily.map(day => {
            const dayItems = data.hourly.filter(
                item => item.date === day.date
            );

            const representative = dayItems[0] || {};
            const weather = parseKmaWeather(
                representative.PTY,
                representative.SKY
            );

            const dateTimestamp = makeTimestamp(day.date, "1200");

            return {
                dt: dateTimestamp,
                temp: {
                    min: Number(day.min),
                    max: Number(day.max)
                },
                pop: dayItems.length
                    ? Math.max(...dayItems.map(item => Number(item.POP || 0))) / 100
                    : 0,
                weather: [{
                    main: weather.main,
                    icon: weather.icon + "d"
                }]
            };
        }).filter(day =>
            Number.isFinite(day.temp.min) &&
            Number.isFinite(day.temp.max)
        );

        if (daily.length === 0) {
            throw new Error("일별 예보 데이터가 없습니다.");
        }

        // 현재 실황 데이터
        const currentWeather = parseKmaWeather(
            data.current.PTY,
            hourly[0].weather[0].main === "Clear" ? 1 :
            hourly[0].weather[0].main === "Clouds" ? 3 : 4
        );

        globalWeatherData = {
            current: {
                temp: Number(data.current.T1H),
                sunrise: 6,
                sunset: 19,
                weather: [{
                    main: currentWeather.main,
                    icon: currentWeather.icon +
                        (nowHour >= 6 && nowHour < 18 ? "d" : "n")
                }]
            },
            hourly,
            daily
        };

        document.getElementById('location').innerText =
            `📍 현재 내 위치`;

        updateSiteBackground();
        renderPage();
        renderForecastList(globalWeatherData.daily);

        console.log("기상청 날씨 데이터 로딩 완료", data);

    } catch (e) {
        console.error("기상청 API 통신 에러:", e);
        document.getElementById('location').innerText =
            `❌ 날씨 데이터 로딩 실패`;
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
