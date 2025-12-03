const socket = io();

socket.on('connected', (data) => {
    console.log(data.message);
});

// UI Elements
const runBtn = document.getElementById('run-btn');
const algoSelect = document.getElementById('algo-select');
const mapCanvas = document.getElementById('map-canvas');
const ctx = mapCanvas.getContext('2d');
const routeLengthSpan = document.getElementById('route-length');
const computationTimeSpan = document.getElementById('computation-time');
const stepBtn = document.getElementById('step-btn');
const resetBtn = document.getElementById('reset-btn');
const visitedCountSpan = document.getElementById('visited-count');

// Grid/map settings
const gridRows = 10;
const gridCols = 10;
const cellSize = mapCanvas.width / gridCols;

let obstacles = new Set();
let start = [0, 0];
let end = [gridRows-1, gridCols-1];
let currentPath = [];
let currentVisited = [];
let gridAnimating = false;

// Helper to encode cell as string
function cellKey(r, c) { return `${r},${c}`; }

// Draw grid with obstacles, start/end, etc., and optionally highlight current search position
function drawGrid(path = [], visited = [], highlightIdx = null) {
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    // Draw cells with soft background
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            ctx.fillStyle = "#f6fafd";
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            ctx.strokeStyle = "#e3eaf3";
            ctx.lineWidth = 1;
            ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
            // Obstacle
            if (obstacles.has(cellKey(r, c))) {
                ctx.fillStyle = "#616161";
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }
    }
    // Animate visited nodes
    visited.forEach(([r, c], idx) => {
        if (obstacles.has(cellKey(r, c))) return;
        // Animate the most recently visited cell
        if (highlightIdx !== null && idx === highlightIdx) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#0288d1";
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            ctx.restore();
        } else {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = "#b3e5fc";
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            ctx.restore();
        }
    });
    // Animate path reveal with glow
    path.forEach(([r, c], idx) => {
        if (obstacles.has(cellKey(r, c))) return;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#ffe082";
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        // Add glow for the whole path when revealed
        if (path.length > 1 && idx === 0) {
            ctx.shadowColor = "#ffe082";
            ctx.shadowBlur = 16;
        }
        ctx.restore();
    });
    // Draw start/end
    ctx.fillStyle = "#43a047";
    ctx.fillRect(start[1] * cellSize, start[0] * cellSize, cellSize, cellSize);
    ctx.fillStyle = "#e53935";
    ctx.fillRect(end[1] * cellSize, end[0] * cellSize, cellSize, cellSize);

    // Draw labels "A" and "B"
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", start[1] * cellSize + cellSize/2, start[0] * cellSize + cellSize/2);
    ctx.fillText("B", end[1] * cellSize + cellSize/2, end[0] * cellSize + cellSize/2);
}

// Animate the pathfinding process step by step, with sound and confetti
function animateSearch(path, visited) {
    gridAnimating = true;
    let i = 0;
    function step() {
        if (i <= visited.length) {
            drawGrid(path, visited, i-1);
            visitedCountSpan.textContent = `Visited: ${i}`;
            i++;
            setTimeout(step, 50);
        } else {
            drawGrid(path, visited);
            gridAnimating = false;
            if (path.length > 1) showConfetti();
        }
    }
    step();
}

// Confetti burst when path is found
function showConfetti() {
    // Simple confetti using canvas overlay
    const confettiCanvas = document.createElement('canvas');
    confettiCanvas.width = mapCanvas.width;
    confettiCanvas.height = mapCanvas.height;
    confettiCanvas.style.position = 'absolute';
    confettiCanvas.style.left = mapCanvas.offsetLeft + 'px';
    confettiCanvas.style.top = mapCanvas.offsetTop + 'px';
    confettiCanvas.style.pointerEvents = 'none';
    confettiCanvas.style.zIndex = 10;
    mapCanvas.parentNode.appendChild(confettiCanvas);
    const ctx2 = confettiCanvas.getContext('2d');
    let particles = Array.from({length: 60}, () => ({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * confettiCanvas.height / 2,
        r: Math.random() * 6 + 4,
        d: Math.random() * 360,
        color: `hsl(${Math.random()*360},90%,60%)`,
        tilt: Math.random() * 10 - 5
    }));
    let frame = 0;
    function drawConfetti() {
        ctx2.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        particles.forEach(p => {
            ctx2.beginPath();
            ctx2.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
            ctx2.fillStyle = p.color;
            ctx2.fill();
        });
        particles.forEach(p => {
            p.y += 2 + Math.random() * 2;
            p.x += Math.sin((frame + p.d) * Math.PI / 180) * 2;
        });
        frame++;
        if (frame < 40) {
            requestAnimationFrame(drawConfetti);
        } else {
            confettiCanvas.remove();
        }
    }
    drawConfetti();
}

// Canvas click: add/remove obstacles, move start/end
mapCanvas.addEventListener('click', (e) => {
    if (gridAnimating) return;
    const rect = mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);

    // If clicking on start or end, allow moving by next click
    if ((r === start[0] && c === start[1])) {
        let moveHandler = function(ev) {
            const rect2 = mapCanvas.getBoundingClientRect();
            const x2 = ev.clientX - rect2.left;
            const y2 = ev.clientY - rect2.top;
            const c2 = Math.floor(x2 / cellSize);
            const r2 = Math.floor(y2 / cellSize);
            if ((r2 !== end[0] || c2 !== end[1]) && !obstacles.has(cellKey(r2, c2))) {
                start = [r2, c2];
            }
            mapCanvas.removeEventListener('click', moveHandler);
            drawGrid(currentPath, currentVisited);
        };
        mapCanvas.addEventListener('click', moveHandler);
        return;
    } else if ((r === end[0] && c === end[1])) {
        let moveHandler = function(ev) {
            const rect2 = mapCanvas.getBoundingClientRect();
            const x2 = ev.clientX - rect2.left;
            const y2 = ev.clientY - rect2.top;
            const c2 = Math.floor(x2 / cellSize);
            const r2 = Math.floor(y2 / cellSize);
            if ((r2 !== start[0] || c2 !== start[1]) && !obstacles.has(cellKey(r2, c2))) {
                end = [r2, c2];
            }
            mapCanvas.removeEventListener('click', moveHandler);
            drawGrid(currentPath, currentVisited);
        };
        mapCanvas.addEventListener('click', moveHandler);
        return;
    } else {
        const key = cellKey(r, c);
        if (obstacles.has(key)) {
            obstacles.delete(key);
        } else if (!(r === start[0] && c === start[1]) && !(r === end[0] && c === end[1])) {
            obstacles.add(key);
        }
    }
    drawGrid(currentPath, currentVisited);
});

// Handle run button
runBtn.onclick = () => {
    gridAnimating = false;
    socket.emit('run_pathfinding', {
        algorithm: algoSelect.value,
        rows: gridRows,
        cols: gridCols,
        start: start,
        end: end,
        obstacles: Array.from(obstacles)
    });
};

// Handle step button (step-by-step animation)
stepBtn.onclick = () => {
    if (!currentVisited.length) return;
    animateSearch(currentPath, currentVisited);
};

// Handle reset button
resetBtn.onclick = () => {
    obstacles.clear();
    start = [0, 0];
    end = [gridRows-1, gridCols-1];
    currentPath = [];
    currentVisited = [];
    gridAnimating = false;
    routeLengthSpan.textContent = '';
    computationTimeSpan.textContent = '';
    visitedCountSpan.textContent = '';
    drawGrid();
};

// Receive pathfinding result
socket.on('pathfinding_result', (data) => {
    currentPath = data.path;
    currentVisited = data.visited;
    animateSearch(currentPath, currentVisited);
    routeLengthSpan.textContent = `Route Length: ${data.path.length}`;
    computationTimeSpan.textContent = `Computation Time: ${data.time_ms} ms`;
    visitedCountSpan.textContent = `Visited: ${data.visited.length}`;
});

// --- Leaflet Map Logic ---
let leafletPointA = [38.8951, -77.0364]; // Washington, DC
let leafletPointB = [38.9072, -77.0369]; // Nearby point in DC

let map, markerA, markerB;
let animLine = null;
let finalLine = null;
let mapAnimating = false;

// Remove grid animation speed slider logic
// let mapAnimSpeed = 3000;
let compareMapAnimSpeed1 = 3000;
let compareMapAnimSpeed2 = 3000;

document.addEventListener('DOMContentLoaded', () => {
    drawGrid();

    // Removed: Animation speed slider logic for grid
    // const mapSpeedSlider = document.getElementById('map-speed-slider');
    // const mapSpeedValue = document.getElementById('map-speed-value');
    // mapSpeedSlider.oninput = () => {
    //     mapAnimSpeed = parseInt(mapSpeedSlider.value, 10);
    //     mapSpeedValue.textContent = mapAnimSpeed;
    // };

    // Animation speed slider logic for comparison maps
    const compareMapSpeedSlider1 = document.getElementById('compare-map-speed-slider-1');
    const compareMapSpeedValue1 = document.getElementById('compare-map-speed-value-1');
    compareMapSpeedSlider1.oninput = () => {
        compareMapAnimSpeed1 = parseInt(compareMapSpeedSlider1.value, 10);
        compareMapSpeedValue1.textContent = compareMapAnimSpeed1;
    };

    const compareMapSpeedSlider2 = document.getElementById('compare-map-speed-slider-2');
    const compareMapSpeedValue2 = document.getElementById('compare-map-speed-value-2');
    compareMapSpeedSlider2.oninput = () => {
        compareMapAnimSpeed2 = parseInt(compareMapSpeedSlider2.value, 10);
        compareMapSpeedValue2.textContent = compareMapAnimSpeed2;
    };

    // --- Leaflet Map Logic ---
    if (document.getElementById('leaflet-map')) {
        initLeafletMap();
        document.getElementById('start-map-animation-btn').onclick = async () => {
            if (!mapAnimating) {
                const selectedAlgo = algoSelect.value;
                const route = await fetchRoadRoute(leafletPointA, leafletPointB, selectedAlgo);
                if (route && route.length > 1) {
                    animatePolylineRoute(route, 3000); // Use default speed for grid
                }
            }
        };
    }

    // --- Comparison Map 1 ---
    if (document.getElementById('compare-leaflet-map-1')) {
        initCompareLeafletMap(1);
        document.getElementById('compare-start-map-animation-btn-1').onclick = async () => {
            if (!compareMapAnimating1) {
                const selectedAlgo = document.getElementById('compare-algo-1').value;
                const route = await fetchRoadRoute(comparePointA, comparePointB, selectedAlgo);
                if (route && route.length > 1) {
                    animateComparePolylineRoute(1, route, compareMapAnimSpeed1);
                }
            }
        };
        document.getElementById('compare-run-btn-1').onclick = async () => {
            document.getElementById('compare-start-map-animation-btn-1').click();
        };
    }
    // --- Comparison Map 2 ---
    if (document.getElementById('compare-leaflet-map-2')) {
        initCompareLeafletMap(2);
        document.getElementById('compare-start-map-animation-btn-2').onclick = async () => {
            if (!compareMapAnimating2) {
                const selectedAlgo = document.getElementById('compare-algo-2').value;
                const route = await fetchRoadRoute(comparePointA, comparePointB, selectedAlgo);
                if (route && route.length > 1) {
                    animateComparePolylineRoute(2, route, compareMapAnimSpeed2);
                }
            }
        };
        document.getElementById('compare-run-btn-2').onclick = async () => {
            document.getElementById('compare-start-map-animation-btn-2').click();
        };
    }

    // Algorithm explanation hover logic
    const explanationIcon = document.getElementById('explanation-icon');
    const explanationBox = document.getElementById('explanation-box');
    const algoSelect = document.getElementById('algo-select');
    function updateExplanation() {
        const algo = algoSelect.value;
        explanationBox.textContent = algoExplanations[algo] || "";
    }
    if (explanationIcon && explanationBox && algoSelect) {
        updateExplanation();
        explanationIcon.onmouseenter = function() {
            updateExplanation();
            explanationBox.style.display = "block";
        };
        explanationIcon.onmouseleave = function() {
            explanationBox.style.display = "none";
        };
        explanationBox.onmouseenter = function() {
            explanationBox.style.display = "block";
        };
        explanationBox.onmouseleave = function() {
            explanationBox.style.display = "none";
        };
        algoSelect.onchange = updateExplanation;
    }

    // Map help icon hover logic
    const mapHelpIcon = document.getElementById('map-help-icon');
    const mapHelpBox = document.getElementById('map-help-box');
    if (mapHelpIcon && mapHelpBox) {
        mapHelpIcon.onmouseenter = function() {
            mapHelpBox.style.display = "block";
        };
        mapHelpIcon.onmouseleave = function() {
            mapHelpBox.style.display = "none";
        };
        mapHelpBox.onmouseenter = function() {
            mapHelpBox.style.display = "block";
        };
        mapHelpBox.onmouseleave = function() {
            mapHelpBox.style.display = "none";
        };
    }

    document.querySelectorAll('button, #map-canvas, #leaflet-map').forEach(el => {
        el.title = el.title || el.innerText || 'Interactive element';
    });
});

function initLeafletMap() {
    const mapDiv = document.getElementById('leaflet-map');
    if (!mapDiv) return;

    // Remove any previous map instance if present
    if (mapDiv._leaflet_id) {
        try {
            mapDiv._leaflet_id = null;
            mapDiv.innerHTML = "";
        } catch {}
    }
    if (window.map && window.map.remove) {
        try { window.map.remove(); } catch {}
        window.map = null;
    }

    mapDiv.style.width = "400px";
    mapDiv.style.height = "400px";
    mapDiv.style.overflow = "hidden";
    mapDiv.style.display = "block";
    mapDiv.style.position = "relative";

    map = L.map('leaflet-map', {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: false,
        dragging: true,
        tap: false,
        keyboard: true,
        inertia: true
    }).setView(leafletPointA, 14);

    window.map = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    if (markerA && map.hasLayer(markerA)) map.removeLayer(markerA);
    if (markerB && map.hasLayer(markerB)) map.removeLayer(markerB);

    markerA = L.marker(leafletPointA, { draggable: true, autoPan: true }).addTo(map).bindPopup('Point A').openPopup();
    markerB = L.marker(leafletPointB, { draggable: true, autoPan: true }).addTo(map).bindPopup('Point B');

    markerA.on('dragend', function(e) {
        leafletPointA = [e.target.getLatLng().lat, e.target.getLatLng().lng];
        markerA.setLatLng(leafletPointA);
    });
    markerB.on('dragend', function(e) {
        leafletPointB = [e.target.getLatLng().lat, e.target.getLatLng().lng];
        markerB.setLatLng(leafletPointB);
    });

    map.dragging.enable();
    markerA.dragging.enable();
    markerB.dragging.enable();

    // Allow instant move by clicking on map after clicking marker
    let moveMode = null;
    markerA.on('click', function() {
        moveMode = 'A';
        map.once('click', function(ev) {
            leafletPointA = [ev.latlng.lat, ev.latlng.lng];
            markerA.setLatLng(leafletPointA);
        });
    });
    markerB.on('click', function() {
        moveMode = 'B';
        map.once('click', function(ev) {
            leafletPointB = [ev.latlng.lat, ev.latlng.lng];
            markerB.setLatLng(leafletPointB);
        });
    });

    setTimeout(() => {
        map.invalidateSize();
        console.log("Leaflet map invalidated size");
    }, 200);
}

// Fetch road route from server (single route, with algorithm)
async function fetchRoadRoute(from, to, algorithm = "dijkstra") {
    try {
        const resp = await fetch('/api/road_route', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({start: from, end: to, algorithm})
        });
        const data = await resp.json();
        if (data.route && Array.isArray(data.route) && data.route.length > 1) return data.route;
        alert('Route error: ' + (data.error || 'No route found'));
        return null;
    } catch (err) {
        alert('Network error: ' + err);
        return null;
    }
}

// Add a status message area
function setMapStatus(msg) {
    let status = document.getElementById('map-status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'map-status';
        status.style.margin = '8px 0';
        status.style.fontWeight = 'bold';
        status.style.color = '#1976d2';
        document.getElementById('map-section').prepend(status);
    }
    status.textContent = msg;
}

// Animate a flowing solid line along a real road route, remove particle burst at end
function animatePolylineRoute(route, duration = 3000) {
    if (!map || !route || route.length < 2) return;
    // Remove previous lines before drawing new route
    if (animLine) { try { map.removeLayer(animLine); } catch {} }
    if (finalLine) { try { map.removeLayer(finalLine); } catch {} }
    animLine = null;
    finalLine = null;

    let current = 1;
    animLine = L.polyline([route[0]], {color: '#1976d2', weight: 6, dashArray: null}).addTo(map);

    mapAnimating = true;
    setMapStatus("Animating route...");
    const steps = route.length;
    function step() {
        if (current > steps) {
            if (animLine) { try { map.removeLayer(animLine); } catch {} }
            finalLine = L.polyline(route, {color: '#ff4081', weight: 7, opacity: 0.9, dashArray: null, className: 'final-path-glow'}).addTo(map);
            mapAnimating = false;
            setMapStatus("Route animation complete!");
            return;
        }
        animLine.setLatLngs(route.slice(0, current));
        current++;
        setTimeout(step, duration / steps);
    }
    step();
}

// --- Comparison Map Logic ---

let compareMap1, compareMarkerA1, compareMarkerB1, compareAnimLine1, compareFinalLine1, compareMapAnimating1 = false;
let compareMap2, compareMarkerA2, compareMarkerB2, compareAnimLine2, compareFinalLine2, compareMapAnimating2 = false;
let comparePointA = [38.8951, -77.0364];
let comparePointB = [38.9072, -77.0369];
let compareMapAnimSpeed = 3000;

document.addEventListener('DOMContentLoaded', () => {
    // Comparison Map 1
    if (document.getElementById('compare-leaflet-map-1')) {
        initCompareLeafletMap(1);
        document.getElementById('compare-start-map-animation-btn-1').onclick = async () => {
            if (!compareMapAnimating1) {
                const selectedAlgo = document.getElementById('compare-algo-1').value;
                const route = await fetchRoadRoute(comparePointA, comparePointB, selectedAlgo);
                if (route && route.length > 1) {
                    animateComparePolylineRoute(1, route, compareMapAnimSpeed);
                }
            }
        };
        document.getElementById('compare-run-btn-1').onclick = async () => {
            document.getElementById('compare-start-map-animation-btn-1').click();
        };
    }
    // Comparison Map 2
    if (document.getElementById('compare-leaflet-map-2')) {
        initCompareLeafletMap(2);
        document.getElementById('compare-start-map-animation-btn-2').onclick = async () => {
            if (!compareMapAnimating2) {
                const selectedAlgo = document.getElementById('compare-algo-2').value;
                const route = await fetchRoadRoute(comparePointA, comparePointB, selectedAlgo);
                if (route && route.length > 1) {
                    animateComparePolylineRoute(2, route, compareMapAnimSpeed);
                }
            }
        };
        document.getElementById('compare-run-btn-2').onclick = async () => {
            document.getElementById('compare-start-map-animation-btn-2').click();
        };
    }
});

// Comparison Map Initialization
function initCompareLeafletMap(idx) {
    const mapDiv = document.getElementById(`compare-leaflet-map-${idx}`);
    if (!mapDiv) return;

    // Remove any previous map instance if present
    if (mapDiv._leaflet_id) {
        try {
            mapDiv._leaflet_id = null;
            mapDiv.innerHTML = "";
        } catch {}
    }
    if (window[`compareMap${idx}`] && window[`compareMap${idx}`].remove) {
        try { window[`compareMap${idx}`].remove(); } catch {}
        window[`compareMap${idx}`] = null;
    }

    mapDiv.style.width = "400px";
    mapDiv.style.height = "400px";
    mapDiv.style.overflow = "hidden";
    mapDiv.style.display = "block";
    mapDiv.style.position = "relative";

    let map = L.map(mapDiv, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: false,
        dragging: true,
        tap: false,
        keyboard: true,
        inertia: true
    }).setView(comparePointA, 14);

    window[`compareMap${idx}`] = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Remove any previous markers
    if (window[`compareMarkerA${idx}`] && map.hasLayer(window[`compareMarkerA${idx}`])) map.removeLayer(window[`compareMarkerA${idx}`]);
    if (window[`compareMarkerB${idx}`] && map.hasLayer(window[`compareMarkerB${idx}`])) map.removeLayer(window[`compareMarkerB${idx}`]);

    window[`compareMarkerA${idx}`] = L.marker(comparePointA, { draggable: true, autoPan: true }).addTo(map).bindPopup('Point A').openPopup();
    window[`compareMarkerB${idx}`] = L.marker(comparePointB, { draggable: true, autoPan: true }).addTo(map).bindPopup('Point B');

    // Dragging functionality for markers (each map has its own points)
    window[`compareMarkerA${idx}`].on('dragend', function(e) {
        // Store the marker's position for this map only
        window[`comparePointA${idx}`] = [e.target.getLatLng().lat, e.target.getLatLng().lng];
        window[`compareMarkerA${idx}`].setLatLng(window[`comparePointA${idx}`]);
    });
    window[`compareMarkerB${idx}`].on('dragend', function(e) {
        window[`comparePointB${idx}`] = [e.target.getLatLng().lat, e.target.getLatLng().lng];
        window[`compareMarkerB${idx}`].setLatLng(window[`comparePointB${idx}`]);
    });

    map.dragging.enable();
    window[`compareMarkerA${idx}`].dragging.enable();
    window[`compareMarkerB${idx}`].dragging.enable();

    // Allow instant move by clicking on map after clicking marker
    window[`compareMarkerA${idx}`].on('click', function() {
        map.once('click', function(ev) {
            window[`comparePointA${idx}`] = [ev.latlng.lat, ev.latlng.lng];
            window[`compareMarkerA${idx}`].setLatLng(window[`comparePointA${idx}`]);
        });
    });
    window[`compareMarkerB${idx}`].on('click', function() {
        map.once('click', function(ev) {
            window[`comparePointB${idx}`] = [ev.latlng.lat, ev.latlng.lng];
            window[`compareMarkerB${idx}`].setLatLng(window[`comparePointB${idx}`]);
        });
    });

    setTimeout(() => {
        map.invalidateSize();
    }, 200);
}

// --- Comparison Map Animation ---
function animateComparePolylineRoute(idx, route, duration = 3000) {
    let map = window[`compareMap${idx}`];
    let animLine = window[`compareAnimLine${idx}`];
    let finalLine = window[`compareFinalLine${idx}`];
    let statusDiv = document.getElementById(`compare-map-status-${idx}`);

    if (animLine) { try { map.removeLayer(animLine); } catch {} }
    if (finalLine) { try { map.removeLayer(finalLine); } catch {} }
    window[`compareAnimLine${idx}`] = null;
    window[`compareFinalLine${idx}`] = null;

    let current = 1;
    animLine = L.polyline([route[0]], {color: idx === 1 ? '#1976d2' : '#ff4081', weight: 6, dashArray: null}).addTo(map);

    window[`compareAnimLine${idx}`] = animLine;
    if (idx === 1) compareMapAnimating1 = true;
    if (idx === 2) compareMapAnimating2 = true;
    if (statusDiv) statusDiv.textContent = "Animating route...";

    const steps = route.length;
    function step() {
        if (current > steps) {
            if (animLine) { try { map.removeLayer(animLine); } catch {} }
            finalLine = L.polyline(route, {color: idx === 1 ? '#1976d2' : '#ff4081', weight: 7, opacity: 0.9, dashArray: null, className: 'final-path-glow'}).addTo(map);
            window[`compareFinalLine${idx}`] = finalLine;
            if (idx === 1) compareMapAnimating1 = false;
            if (idx === 2) compareMapAnimating2 = false;
            if (statusDiv) statusDiv.textContent = "Route animation complete!";
            return;
        }
        animLine.setLatLngs(route.slice(0, current));
        current++;
        setTimeout(step, duration / steps);
    }
    step();
}

// --- Map selection logic for correct points ---
document.addEventListener('DOMContentLoaded', () => {
    // Comparison Map 1
    if (document.getElementById('compare-leaflet-map-1')) {
        initCompareLeafletMap(1);
        document.getElementById('compare-start-map-animation-btn-1').onclick = async () => {
            if (!compareMapAnimating1) {
                const selectedAlgo = document.getElementById('compare-algo-1').value;
                // Use the per-map marker positions if available, else fallback
                const pointA = window.comparePointA1 || comparePointA;
                const pointB = window.comparePointB1 || comparePointB;
                const route = await fetchRoadRoute(pointA, pointB, selectedAlgo);
                if (route && route.length > 1) {
                    animateComparePolylineRoute(1, route, compareMapAnimSpeed1);
                }
            }
        };
        document.getElementById('compare-run-btn-1').onclick = async () => {
            document.getElementById('compare-start-map-animation-btn-1').click();
        };
    }
    // Comparison Map 2
    if (document.getElementById('compare-leaflet-map-2')) {
        initCompareLeafletMap(2);
        document.getElementById('compare-start-map-animation-btn-2').onclick = async () => {
            if (!compareMapAnimating2) {
                const selectedAlgo = document.getElementById('compare-algo-2').value;
                const pointA = window.comparePointA2 || comparePointA;
                const pointB = window.comparePointB2 || comparePointB;
                const route = await fetchRoadRoute(pointA, pointB, selectedAlgo);
                if (route && route.length > 1) {
                    animateComparePolylineRoute(2, route, compareMapAnimSpeed2);
                }
            }
        };
        document.getElementById('compare-run-btn-2').onclick = async () => {
            document.getElementById('compare-start-map-animation-btn-2').click();
        };
    }
});

// --- Interactive Algorithm Switch for Grid ---
let currentAlgorithm = algoSelect.value;
algoSelect.addEventListener('change', () => {
    currentAlgorithm = algoSelect.value;
    // If animation is running, restart with new algorithm from current state
    if (gridAnimating) {
        gridAnimating = false;
        // Clear any running animation and immediately request new path
        socket.emit('run_pathfinding', {
            algorithm: currentAlgorithm,
            rows: gridRows,
            cols: gridCols,
            start: start,
            end: end,
            obstacles: Array.from(obstacles)
        });
    }
});

// --- Interactive Algorithm Switch for Comparison Maps ---
function setupCompareAlgoSwitch(idx) {
    const algoSelect = document.getElementById(`compare-algo-${idx}`);
    if (!algoSelect) return;
    algoSelect.addEventListener('change', async () => {
        // If animation is running, restart with new algorithm and current marker positions
        if ((idx === 1 && compareMapAnimating1) || (idx === 2 && compareMapAnimating2)) {
            // Stop current animation immediately
            if (window[`compareAnimLine${idx}`]) {
                try { window[`compareMap${idx}`].removeLayer(window[`compareAnimLine${idx}`]); } catch {}
                window[`compareAnimLine${idx}`] = null;
            }
            if (window[`compareFinalLine${idx}`]) {
                try { window[`compareMap${idx}`].removeLayer(window[`compareFinalLine${idx}`]); } catch {}
                window[`compareFinalLine${idx}`] = null;
            }
            if (idx === 1) compareMapAnimating1 = false;
            if (idx === 2) compareMapAnimating2 = false;
            const selectedAlgo = algoSelect.value;
            const pointA = window[`comparePointA${idx}`] || comparePointA;
            const pointB = window[`comparePointB${idx}`] || comparePointB;
            const speed = idx === 1 ? compareMapAnimSpeed1 : compareMapAnimSpeed2;
            const route = await fetchRoadRoute(pointA, pointB, selectedAlgo);
            if (route && route.length > 1) {
                animateComparePolylineRoute(idx, route, speed);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...

    // Setup interactive algorithm switch for both comparison maps
    setupCompareAlgoSwitch(1);
    setupCompareAlgoSwitch(2);

    // ...existing code...
});

// Algorithm explanations
const algoExplanations = {
    dijkstra: "Dijkstra's Algorithm explores all possible paths from the start, always expanding the node with the lowest total cost so far. It guarantees the shortest path in a weighted grid with non-negative weights.",
    astar: "A* Search combines the cost from the start and an estimate to the end (heuristic), always expanding the node with the lowest estimated total cost. It is efficient and guarantees the shortest path if the heuristic is admissible.",
    bfs: "Breadth-First Search explores all nodes at the current distance before moving further. In an unweighted grid, it finds the shortest path by expanding outward in all directions.",
    dfs: "Depth-First Search explores as far as possible along each branch before backtracking. It does not guarantee the shortest path, but can be fast for some layouts.",
    greedy: "Greedy Best-First Search always expands the node that appears closest to the goal (by heuristic), ignoring the cost so far. It is fast but does not guarantee the shortest path."
};
