let currentTimeZone = 'local';
let alarms = JSON.parse(localStorage.getItem("alarms")) || [];
let editingAlarmIndex = null;
let currentRingingAlarm = null;
let currentNotificationType = null;

function getClientLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation not supported');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                reject(error.message);
            },
            { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
        );
    });
}

async function autoDetectLocation() {
    document.getElementById('weatherLoading').style.display = 'block';
    document.getElementById('weatherLoading').textContent = 'Getting your location...';
    document.getElementById('weatherError').style.display = 'none';
    document.getElementById('weatherCurrent').style.display = 'none';
    document.getElementById('weatherForecast').style.display = 'none';
    document.getElementById('forecastTitle').style.display = 'none';
    document.getElementById('weatherLocation').textContent = 'Detecting...';
    
    try {
        const clientLoc = await getClientLocation();
        console.log('Client location:', clientLoc.lat, clientLoc.lon, 'Accuracy:', clientLoc.accuracy, 'meters');
        
        document.getElementById('weatherLoading').textContent = 'Fetching weather data...';
        
        const locationName = await reverseGeocode(clientLoc.lat, clientLoc.lon);
        console.log('Location name:', locationName);
        fetchWeather(clientLoc.lat, clientLoc.lon, locationName);
    } catch (error) {
        console.log('GPS error, trying IP location:', error);
        fetchIPLocation();
    }
}

function reverseGeocode(lat, lon) {
    return fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
        .then(res => res.json())
        .then(data => {
            console.log('BigDataCloud response:', data);
            
            const parts = [];
            
            if (data.locality) parts.push(data.locality);
            if (data.city) parts.push(data.city);
            if (data.principalSubdivision) parts.push(data.principalSubdivision);
            if (data.countryName) parts.push(data.countryName);
            
            if (parts.length >= 2) {
                return parts.join(', ');
            }
            
            const fallbackParts = [];
            if (data.principalSubdivision) fallbackParts.push(data.principalSubdivision);
            if (data.countryName) fallbackParts.push(data.countryName);
            
            if (fallbackParts.length > 0) {
                return fallbackParts.join(', ');
            }
            if (data.countryName) {
                return data.countryName;
            }
            
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        })
        .catch(err => {
            console.error('Reverse geocode error:', err);
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        });
}

function fetchIPLocation() {
    fetch('http://ip-api.com/json/?fields=status,lat,lon,city,region,country,countryCode')
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success' && data.lat && data.lon) {
                const locationName = (data.city || data.region || data.country) + (data.countryCode ? ', ' + data.countryCode : '');
                fetchWeather(data.lat, data.lon, locationName);
            } else {
                throw new Error('IP location failed');
            }
        })
        .catch(() => {
            document.getElementById('weatherLoading').style.display = 'none';
            showWeatherError('Unable to get your location.');
        });
}

/* ---------- SECTION NAVIGATION ---------- */
function showSection(sectionId, event) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  if (event && event.target) event.target.classList.add('active');
  
  if (sectionId === 'weather' && !weatherLoaded) {
    autoDetectLocation();
  }
  if (sectionId === 'map' && !mapLoaded) {
    getMapLocation();
  }
}

/* ---------- ANALOG CLOCK ---------- */
function updateAnalogClock() {
  // Disabled - using 3D Earth instead
}

function setClockNumbers() {
  // Clock numbers removed - using globe instead
}

/* ---------- DIGITAL CLOCK ---------- */
function updateClockDisplay() {
  const now = new Date();
  const options = currentTimeZone === 'local' ? {} : { timeZone: currentTimeZone };
  const time = now.toLocaleTimeString([], options);
  const date = now.toLocaleDateString([], options);

  document.getElementById('clock').innerText = time;
  document.getElementById('dateDisplay').innerText = date;
}

const timeZoneCoords = {
    'local': null,
    'America/New_York': { lat: 40.7128, lon: -74.0060 },
    'America/Chicago': { lat: 41.8781, lon: -87.6298 },
    'America/Denver': { lat: 39.7392, lon: -104.9903 },
    'America/Los_Angeles': { lat: 34.0522, lon: -118.2437 },
    'Europe/London': { lat: 51.5074, lon: -0.1278 },
    'Europe/Paris': { lat: 48.8566, lon: 2.3522 },
    'Asia/Tokyo': { lat: 35.6762, lon: 139.6503 },
    'UTC': { lat: 51.4772, lon: 0.0 }
};

function updateTimeZone() {
    currentTimeZone = document.getElementById('timeZoneSelect').value;
    updateClockDisplay();
    
    const coords = timeZoneCoords[currentTimeZone];
    if (coords && earthScene) {
        zoomToLocation(coords.lat, coords.lon);
    }
}

function zoomToLocation(lat, lon) {
    if (!earthMesh || !earthCamera) return;
    
    // Hide auto rotate
    autoRotate = false;
    
    // Calculate target rotation
    const targetLon = -lon * (Math.PI / 180);
    const targetLat = lat * (Math.PI / 180);
    
    // Animate rotation
    const startRotation = { x: earthMesh.rotation.x, y: earthMesh.rotation.y };
    let progress = 0;
    
    const animateRotation = setInterval(() => {
        progress += 0.03;
        if (progress >= 1) {
            clearInterval(animateRotation);
            return;
        }
        const eased = 1 - Math.pow(1 - progress, 3);
        earthMesh.rotation.y = startRotation.y + (targetLon - startRotation.y) * eased;
        earthMesh.rotation.x = startRotation.x + (targetLat * 0.5 - startRotation.x) * eased;
    }, 16);
    
    // Update marker
    if (earthMarker) {
        earthMarker.visible = true;
        const position = latLonToVector3(lat, lon, 1.55);
        earthMarker.position.copy(position);
        earthMarker.lookAt(0, 0, 0);
    }
    
    // Zoom in effect
    animateZoom(5, 3);
}

function zoomIn() {
    if (earthCamera) {
        earthCamera.position.z = Math.max(2, earthCamera.position.z - 0.8);
    }
}

function zoomOut() {
    if (earthCamera) {
        earthCamera.position.z = Math.min(10, earthCamera.position.z + 0.8);
    }
}

function animateZoom(from, to) {
    let progress = 0;
    const zoomInterval = setInterval(() => {
        progress += 0.03;
        if (progress >= 1) {
            clearInterval(zoomInterval);
            return;
        }
        const eased = 1 - Math.pow(1 - progress, 3);
        earthCamera.position.z = from + (to - from) * eased;
    }, 16);
}

/* ---------- ALARM ---------- */
function renderAlarms() {
  const list = document.getElementById("alarmList");
  list.innerHTML = "";
  alarms.forEach((alarm, i) => {
    const li = document.createElement("li");
    li.innerHTML = `${alarm.label || "Alarm"} - ${convertTo12Hour(alarm.time)} ` +
      `<button onclick="editAlarm(${i})">Edit</button> ` +
      `<button onclick="removeAlarm(${i})">Delete</button>`;
    list.appendChild(li);
  });
}

function convertTo12Hour(time24) {
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${minutes} ${ampm}`;
}

function showAlarmForm() {
  document.getElementById("alarmForm").style.display = 'block';
  document.getElementById("showAlarmFormButton").style.display = 'none';
}

function hideAlarmForm() {
  document.getElementById("alarmForm").style.display = 'none';
  document.getElementById("showAlarmFormButton").style.display = 'inline-block';
  clearAlarmForm();
}

function clearAlarmForm() {
  document.getElementById("alarmInput").value = "";
  document.getElementById("alarmLabel").value = "";
  document.getElementById("alarmSoundChoice").value = "audio/iPhone-Alarm-Original.mp3";
  document.getElementById("alarmRepeat").checked = false;
  document.getElementById("weekdayBoxes").style.display = 'none';
  document.getElementById("alarmSnooze").value = 5;
  editingAlarmIndex = null;
  document.getElementById("alarmSaveBtn").innerText = 'Add Alarm';
  document.getElementById("alarmCancelBtn").style.display = 'none';
}

function saveAlarm() {
  const time = document.getElementById("alarmInput").value;
  if (!time) return alert("Set a time for the alarm.");
  const newAlarm = {
    time,
    label: document.getElementById("alarmLabel").value.trim() || "Alarm",
    sound: document.getElementById("alarmSoundChoice").value,
    repeat: document.getElementById("alarmRepeat").checked,
    weekdays: [],
    snooze: Number(document.getElementById("alarmSnooze").value) || 5,
    enabled: true,
    lastTriggered: null,
    snoozeUntil: null
  };
  if (editingAlarmIndex !== null) alarms[editingAlarmIndex] = newAlarm;
  else alarms.push(newAlarm);

  localStorage.setItem("alarms", JSON.stringify(alarms));
  renderAlarms();
  hideAlarmForm();
}

function editAlarm(i) {
  const alarm = alarms[i];
  editingAlarmIndex = i;
  document.getElementById("alarmInput").value = alarm.time;
  document.getElementById("alarmLabel").value = alarm.label;
  document.getElementById("alarmSoundChoice").value = alarm.sound;
  document.getElementById("alarmRepeat").checked = alarm.repeat;
  document.getElementById("alarmSnooze").value = alarm.snooze;
  document.getElementById("alarmSaveBtn").innerText = 'Update Alarm';
  document.getElementById("alarmCancelBtn").style.display = 'inline-block';
  document.getElementById("alarmForm").style.display = 'block';
  document.getElementById("showAlarmFormButton").style.display = 'none';
}

function removeAlarm(i) {
  alarms.splice(i, 1);
  localStorage.setItem("alarms", JSON.stringify(alarms));
  renderAlarms();
}

function showFullScreenAlarm(alarm) {
  const overlay = document.getElementById("alarmOverlay");
  document.getElementById('alarmOverlayMessage').innerText = `${alarm.label} is ringing!`;
  overlay.style.display = 'flex';
  currentRingingAlarm = alarm;
  currentNotificationType = 'alarm';
  updateOverlayButtons();
}

function hideAlarmNotification(){
  document.getElementById("alarmOverlay").style.display = 'none';
  currentRingingAlarm = null;
  currentNotificationType = null;
}

function stopAlarm() {
  const soundEl = document.getElementById("alarmSound");
  soundEl.pause();
  soundEl.currentTime = 0;
  soundEl.loop = false;
  hideAlarmNotification();
}

function snoozeCurrentAlarm() {
  if (!currentRingingAlarm) return;
  const minutes = Number(document.getElementById('alarmSnooze').value) || 5;
  console.log('Snoozing for ' + minutes + ' minutes');
  setTimeout(() => {
    console.log('Snooze timeout triggered, ringing alarm');
    const soundEl = document.getElementById("alarmSound");
    soundEl.src = currentRingingAlarm.sound;
    soundEl.loop = true;
    soundEl.play().catch(() => {});
    showFullScreenAlarm(currentRingingAlarm);
  }, minutes * 60000);
  localStorage.setItem("alarms", JSON.stringify(alarms));
  stopAlarm();
}

/* ---------- TIMER ---------- */
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;

function startTimer() {
  const hours = parseInt(document.getElementById('timerHours').value) || 0;
  const minutes = parseInt(document.getElementById('timerMin').value) || 0;
  const seconds = parseInt(document.getElementById('timerSec').value) || 0;

  if (hours === 0 && minutes === 0 && seconds === 0) {
    alert('Please set a time');
    return;
  }

  if (!timerRunning) {
    timerSeconds = hours * 3600 + minutes * 60 + seconds;
    timerRunning = true;
    timerInterval = setInterval(decrementTimer, 1000);
  }
}

function decrementTimer() {
  if (timerSeconds > 0) {
    timerSeconds--;
    updateTimerDisplay();
  } else {
    stopTimer();
    playTimerSound();
  }
}

function updateTimerDisplay() {
  const hours = Math.floor(timerSeconds / 3600);
  const minutes = Math.floor((timerSeconds % 3600) / 60);
  const seconds = timerSeconds % 60;
  document.getElementById('timerDisplay').textContent =
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
}

function playTimerSound() {
  const soundEl = document.getElementById("alarmSound");
  soundEl.src = document.getElementById("timerSoundChoice").value;
  soundEl.loop = true;
  soundEl.play().catch(() => {});
  showTimerFinished();
}

function showTimerFinished() {
  const overlay = document.getElementById("alarmOverlay");
  document.getElementById('alarmOverlayMessage').innerText = 'Timer finished!';
  overlay.style.display = 'flex';
  currentNotificationType = 'timer';
  updateOverlayButtons();
}

function updateOverlayButtons() {
  const stopButton = document.querySelector('#alarmOverlay button.stop-button');
  const secondButton = document.querySelector('#alarmOverlay button:not(.stop-button)');
  
  if (currentNotificationType === 'alarm') {
    stopButton.textContent = 'Stop';
    stopButton.onclick = stopAlarm;
    secondButton.textContent = 'Snooze';
    secondButton.onclick = snoozeCurrentAlarm;
    secondButton.style.display = 'inline-block';
  } else if (currentNotificationType === 'timer') {
    stopButton.textContent = 'Stop';
    stopButton.onclick = stopTimerSound;
    secondButton.style.display = 'none'; // Hide snooze button for timer
  }
}

/* ---------- STOPWATCH ---------- */
let swInterval = null;
let swMilliseconds = 0;
let swRunning = false;

function startSW() {
  if (!swRunning) {
    swRunning = true;
    swInterval = setInterval(incrementSW, 10);
  }
}

function incrementSW() {
  swMilliseconds += 10;
  updateSWDisplay();
}

function updateSWDisplay() {
  const totalSeconds = Math.floor(swMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((swMilliseconds % 1000) / 10);

  document.getElementById('swDisplay').textContent =
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function stopSW() {
  swRunning = false;
  clearInterval(swInterval);
}

function resetSW() {
  stopSW();
  swMilliseconds = 0;
  document.getElementById('lapList').innerHTML = '';
  updateSWDisplay();
}

function lapSW() {
  if (!swRunning) return;
  const totalSeconds = Math.floor(swMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((swMilliseconds % 1000) / 10);
  const lapTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

  const lapList = document.getElementById('lapList');
  const li = document.createElement('li');
  li.textContent = `Lap ${lapList.children.length + 1}: ${lapTime}`;
  lapList.appendChild(li);
}

/* ---------- CLOCK UPDATES ---------- */
updateClockDisplay();
hideAlarmNotification();
setInterval(updateClockDisplay, 1000);

// 3D Earth renderer - initialize after DOM loads
document.addEventListener('DOMContentLoaded', init3DEarth);

// Cleanup stray text nodes under body (fixes random text appearing under page)
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const strayNodes = Array.from(body.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  strayNodes.forEach(node => node.remove());
});

renderAlarms();

/* ---------- WEATHER ---------- */
let weatherData = null;
let weatherLoaded = false;

function getWeatherLocation() {
    if (!navigator.geolocation) {
        showWeatherError('Geolocation is not supported by your browser');
        return;
    }
    
    if (weatherLoaded) return;
    
    document.getElementById('weatherLoading').style.display = 'block';
    document.getElementById('weatherError').style.display = 'none';
    document.getElementById('weatherCurrent').style.display = 'none';
    document.getElementById('weatherForecast').style.display = 'none';
    document.getElementById('forecastTitle').style.display = 'none';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            document.getElementById('weatherLoading').style.display = 'none';
            showWeatherError('Unable to get your location. Please enable location services.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function showWeatherError(msg) {
    const errorEl = document.getElementById('weatherError');
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
}

async function fetchWeather(lat, lon, locationName = null) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather API error');
        
        weatherData = await response.json();
        displayWeather(weatherData, locationName);
    } catch (error) {
        document.getElementById('weatherLoading').style.display = 'none';
        showWeatherError('Failed to fetch weather data. Please try again.');
    }
}

function displayWeather(data, locationName = null) {
    weatherLoaded = true;
    document.getElementById('weatherLoading').style.display = 'none';
    document.getElementById('weatherError').style.display = 'none';
    document.getElementById('weatherCurrent').style.display = 'block';
    document.getElementById('forecastTitle').style.display = 'block';
    document.getElementById('weatherForecast').style.display = 'flex';
    
    const current = data.current;
    const daily = data.daily;
    
    document.getElementById('weatherTemp').textContent = Math.round(current.temperature_2m);
    document.getElementById('weatherDesc').textContent = getWeatherDescription(current.weather_code);
    document.getElementById('weatherHumidity').textContent = current.relative_humidity_2m;
    document.getElementById('weatherWind').textContent = Math.round(current.wind_speed_10m);
    
    if (locationName) {
        document.getElementById('weatherLocation').textContent = locationName;
    } else {
        document.getElementById('weatherLocation').textContent = data.latitude.toFixed(2) + ', ' + data.longitude.toFixed(2);
    }
    
    const forecastEl = document.getElementById('weatherForecast');
    forecastEl.innerHTML = '';
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const dayName = i === 0 ? 'Today' : days[date.getDay()];
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'forecast-day';
        dayDiv.innerHTML = `
            <div class="forecast-day-name">${dayName}</div>
            <div class="forecast-day-icon">${getWeatherIcon(daily.weather_code[i])}</div>
            <div class="forecast-day-temp">${Math.round(daily.temperature_2m_max[i])}°</div>
            <div style="font-size: 12px; color: var(--muted);">${Math.round(daily.temperature_2m_min[i])}°</div>
        `;
        forecastEl.appendChild(dayDiv);
    }
}

function getWeatherDescription(code) {
    const weatherCodes = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
        99: 'Thunderstorm with heavy hail'
    };
    return weatherCodes[code] || 'Unknown';
}

function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '⛅';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌧️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 71 && code <= 75) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '🌤️';
}

/* ---------- MAP ---------- */
let map = null;
let marker = null;
let mapLoaded = false;

function getMapLocation() {
    if (!navigator.geolocation) {
        showMapError('Geolocation is not supported by your browser');
        return;
    }
    
    if (mapLoaded) return;
    
    document.getElementById('mapLoading').style.display = 'block';
    document.getElementById('mapError').style.display = 'none';
    document.getElementById('mapContainer').style.display = 'none';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            initMap(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
            document.getElementById('mapLoading').style.display = 'none';
            showMapError('Unable to get your location. Please enable location services.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function showMapError(msg) {
    const errorEl = document.getElementById('mapError');
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
}

function initMap(lat, lon) {
    mapLoaded = true;
    document.getElementById('mapLoading').style.display = 'none';
    document.getElementById('mapError').style.display = 'none';
    document.getElementById('mapContainer').style.display = 'block';
    
    if (map) {
        map.remove();
    }
    
    map = L.map('map').setView([lat, lon], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    if (marker) {
        map.removeLayer(marker);
    }
    
    marker = L.marker([lat, lon]).addTo(map)
        .bindPopup('You are here')
        .openPopup();
}

/* ---------- CHECK ALARMS ---------- */
setInterval(() => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0,5);
  console.log('Checking alarms at ' + currentTime);
  alarms.forEach(alarm => {
    let shouldRing = false;
    if (alarm.time === currentTime) {
      shouldRing = true;
      console.log('Ringing due to time match: ' + alarm.time);
    }
    if (shouldRing && alarm.lastTriggered !== currentTime) {
      console.log('Triggering alarm ring');
      alarm.lastTriggered = currentTime;
      localStorage.setItem("alarms", JSON.stringify(alarms));
      const soundEl = document.getElementById("alarmSound");
      soundEl.src = alarm.sound;
      soundEl.loop = true;
      soundEl.play().catch(()=>{});
      showFullScreenAlarm(alarm);
    }
  });
}, 1000);

/* ---------- 3D EARTH MAP ---------- */
let earthScene, earthCamera, earthRenderer, earthMesh, earthAtmosphere, earthMarker;
let isDragging = false, previousMousePosition = { x: 0, y: 0 };
let autoRotate = false; // Default to no auto rotation
let currentLat = 0, currentLon = 0;

function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
}

function init3DEarth() {
    const canvas = document.getElementById('earthCanvas');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    earthScene = new THREE.Scene();
    earthCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    earthCamera.position.z = 5;
    
    earthRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    earthRenderer.setSize(width, height);
    earthRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Earth sphere with day/night texture
    const earthGeometry = new THREE.SphereGeometry(1.5, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'),
        bumpMap: new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-topology.png'),
        bumpScale: 0.05,
        specular: new THREE.Color(0x333333),
        shininess: 5
    });
    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthScene.add(earthMesh);
    
    // Atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(1.6, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
    });
    earthAtmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthScene.add(earthAtmosphere);
    
    // Location marker
    const markerGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    earthMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    earthMarker.visible = false;
    earthScene.add(earthMarker);
    
    // Marker ring
    const ringGeometry = new THREE.RingGeometry(0.05, 0.07, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const markerRing = new THREE.Mesh(ringGeometry, ringMaterial);
    earthMarker.add(markerRing);
    
    // Marker label
    const labelDiv = document.createElement('div');
    labelDiv.id = 'mapLabel';
    labelDiv.style.cssText = 'position:absolute;background:rgba(0,0,0,0.7);color:white;padding:4px 8px;border-radius:4px;font-size:12px;pointer-events:none;display:none;';
    container.appendChild(labelDiv);
    
    // Lights
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(5, 3, 5);
    earthScene.add(sunLight);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    earthScene.add(ambientLight);
    
    // Stars
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 2000; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        starPositions.push(x, y, z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    earthScene.add(stars);
    
    // Get user location and place marker
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            currentLat = position.coords.latitude;
            currentLon = position.coords.longitude;
            updateMarker(currentLat, currentLon);
        }, () => {
            // Default to NYC if location denied
            currentLat = 40.7128;
            currentLon = -74.0060;
            updateMarker(currentLat, currentLon);
        });
    }
    
    // Mouse controls
    canvas.addEventListener('mousedown', (e) => { isDragging = true; });
    canvas.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            earthMesh.rotation.y += deltaX * 0.005;
            earthMesh.rotation.x += deltaY * 0.005;
        }
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    // Click to get coordinates
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), earthCamera);
        const intersects = raycaster.intersectObject(earthMesh);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const latLon = vector3ToLatLon(point);
            currentLat = latLon.lat;
            currentLon = latLon.lon;
            updateMarker(currentLat, currentLon);
            showCoordinates(currentLat, currentLon);
        }
    });
    
    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.5;
        earthCamera.position.z = Math.max(2, Math.min(10, earthCamera.position.z + (e.deltaY > 0 ? zoomSpeed : -zoomSpeed)));
    }, { passive: false });
    
    // Touch controls
    canvas.addEventListener('touchstart', (e) => { isDragging = true; });
    canvas.addEventListener('touchend', () => { isDragging = false; });
    canvas.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - previousMousePosition.x;
            const deltaY = e.touches[0].clientY - previousMousePosition.y;
            earthMesh.rotation.y += deltaX * 0.005;
            earthMesh.rotation.x += deltaY * 0.005;
        }
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });
    
    animateEarth();
}

function vector3ToLatLon(vector3) {
    const radius = 1.5;
    const lat = 90 - (Math.acos(vector3.y / radius) * 180 / Math.PI);
    let lon = ((Math.atan2(vector3.x, vector3.z) * 180 / Math.PI) + 180) % 360 - 180;
    return { lat, lon };
}

function updateMarker(lat, lon) {
    if (!earthMarker) return;
    earthMarker.visible = true;
    const position = latLonToVector3(lat, lon, 1.55);
    earthMarker.position.copy(position);
    earthMarker.lookAt(0, 0, 0);
    
    // Rotate Earth to show location
    const targetLon = -lon;
    const targetLat = lat;
    
    // Animate to location
    const startRotation = { x: earthMesh.rotation.x, y: earthMesh.rotation.y };
    const targetRotation = { x: targetLat * 0.01, y: targetLon * (Math.PI / 180) };
    
    let progress = 0;
    const animateToLocation = setInterval(() => {
        progress += 0.05;
        if (progress >= 1) {
            clearInterval(animateToLocation);
            return;
        }
        earthMesh.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * progress;
        earthMesh.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * progress;
    }, 16);
    
    autoRotate = false;
    setTimeout(() => autoRotate = true, 5000);
}

function showCoordinates(lat, lon) {
    const label = document.getElementById('mapLabel');
    if (label) {
        label.style.display = 'block';
        label.textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
        setTimeout(() => { label.style.display = 'none'; }, 3000);
    }
}

function animateEarth() {
    requestAnimationFrame(animateEarth);
    if (earthRenderer && earthScene && earthCamera) {
        earthRenderer.render(earthScene, earthCamera);
    }
}
