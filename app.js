// 1. 제공해주신 기온별 복장 데이터 세팅
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

// 복장 추천 함수
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
        // Vercel 환경변수에서 API Key를 가져옵니다. 
        // 만약 환경변수가 없다면(로컬 테스트용) 기존처럼 api.txt를 찾습니다.
        let apiKey = window.env?.WEATHER_API_KEY; 

        if (!apiKey) {
            const responseText = await fetch('api.txt');
            apiKey = (await responseText.text()).trim();
        }

        if (!apiKey) throw new Error("API Key를 찾을 수 없습니다.");

        // GPS 위치 가져오기
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                getWeatherData(lat, lon, apiKey);
            }, () => {
                alert("위치 정보 권한을 허용해 주셔야 현재 위치의 날씨 기반 복장 추천이 가능합니다.");
            });
        } else {
            alert("이 브라우저에서는 GPS를 지원하지 않습니다.");
        }
    } catch (error) {
        console.error("초기화 실패:", error);
        document.getElementById('weather-desc').innerText = "API 로드 실패";
    }
}

// 3. OpenWeatherMap API 호출 (현재날씨 및 5일 예보 모두 수집 가능한 5 day/3 hour 예보 API 사용)
async function getWeatherData(lat, lon, apiKey) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // 현재 지역명 및 현재 기온 설정 (가장 첫 번째 예보 데이터를 현재 데이터 대용으로 활용)
        const currentData = data.list[0];
        document.getElementById('location').innerText = `📍 ${data.city.name}`;
        document.getElementById('temp-display').innerText = `${Math.round(currentData.main.temp)}°C`;
        document.getElementById('weather-desc').innerText = currentData.weather[0].description;

        // 복장 추천 실행
        recommendOutfit(currentData.main.temp);

        // 그래프 및 주간 표 그리기
        renderChart(data.list.slice(0, 8)); // 향후 24시간 (3시간 단위 8개)
        renderForecastTable(data.list);

    } catch (error) {
        console.error("날씨 불러오기 실패:", error);
    }
}

// 4. Chart.js 그래프 그리기
function renderChart(hourlyData) {
    const ctx = document.getElementById('tempChart').getContext('2d');
    
    const labels = hourlyData.map(item => {
        const date = new Date(item.dt * 1000);
        return `${date.getHours()}시`;
    });
    const temps = hourlyData.map(item => Math.round(item.main.temp));

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '기온 (°C)',
                data: temps,
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { display: true } }
        }
    });
}

// 5. 주간 날씨 표 채우기 (하루에 한 개씩 대표 데이터만 추출)
function renderForecastTable(allData) {
    const tbody = document.getElementById('forecast-body');
    tbody.innerHTML = '';

    // 일별 최고/최저 기온 그룹화 생략 후 간단히 24시간 간격(8개마다)으로 추출하는 방식
    const dailyData = allData.filter((item, index) => index % 8 === 0);

    dailyData.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayStr = `${date.getMonth() + 1}/${date.getDate()}(${['일','월','화','수','목','금','토'][date.getDay()]})`;
        
        const row = `
            <tr>
                <td>${dayStr}</td>
                <td>${item.weather[0].description}</td>
                <td>${Math.round(item.main.temp_min)}°C</td>
                <td>${Math.round(item.main.temp_max)}°C</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// 앱 실행
initApp();
