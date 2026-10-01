const coordinates = window.appCoordinates;

const modeIcons = {
    "START": { class: "fa-solid fa-location-crosshairs", emoji: "📍" },
    "Bus": { class: "fa-solid fa-bus-simple", emoji: "🚌" },
    "Metro": { class: "fa-solid fa-train-subway", emoji: "🚇" },
    "Cab": { class: "fa-solid fa-taxi", emoji: "🚕" },
    "Auto": { class: "fa-solid fa-truck-pickup", emoji: "🛺" },
    "Train": { class: "fa-solid fa-train", emoji: "🚂" }
};

const map = L.map('map').setView([18.5204, 73.8567], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

let currentRouteLayer = null;
let currentMarkers = [];
let clickState = 0; 

const corridor1 = ["PCMC", "Sant Tukaram Nagar", "Nashik Phata", "Kasarwadi", "Phugewadi", "Dapodi", "Bopodi", "Khadki", "Range Hill", "Shivaji Nagar", "District Court", "Kasba Peth", "Mahatma Phule Mandai", "Swargate"];
const corridor2 = ["Vanaz", "Anand Nagar", "Paud Phata", "S.N.D.T College", "Garware College", "Deccan Gymkhana", "Chhatrapati Sambhaji Udyan", "PMC", "R.T.O Pune", "Pune Railway Station", "Ruby Hall Clinic", "Bund Garden", "Yerawada", "Kalyani Nagar", "Ramwadi"];

function createCustomIcon(mode, isStart, isEnd, locationName) {
    let extraClass = '';
    let emoji = '';
    
    if (isStart) extraClass = 'marker-start';
    else if (isEnd) extraClass = 'marker-end';
    else if (mode === 'Metro') {
        extraClass = 'marker-metro-logo';
        emoji = '<i class="fa-solid fa-train-subway" style="color:#9b59b6; font-size: 11px;"></i>';
    } else {
        emoji = modeIcons[mode] ? modeIcons[mode].emoji : "";
    }
    
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-marker ${extraClass}"><span class="custom-marker-icon">${emoji}</span></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

map.on('click', async (e) => {
    try {
        const response = await fetch('/api/nearest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: e.latlng.lat, lon: e.latlng.lng })
        });
        const data = await response.json();
        
        if (data.nearest && data.nearest !== "Unknown") {
            if (clickState === 0) {
                document.getElementById('source').value = data.nearest;
                clickState = 1;
                L.popup().setLatLng(e.latlng).setContent(`Set Source: <b>${data.nearest}</b><br><i>(Click again for Destination)</i>`).openOn(map);
            } else {
                document.getElementById('destination').value = data.nearest;
                clickState = 0;
                L.popup().setLatLng(e.latlng).setContent(`Set Destination: <b>${data.nearest}</b>`).openOn(map);
            }
        }
    } catch(err) {
        console.error("KD-Tree Lookup Failed", err);
    }
});

document.getElementById('route-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const source = document.getElementById('source').value;
    const dest = document.getElementById('destination').value;
    const pref = document.getElementById('preference').value;
    const traffic = document.getElementById('traffic-toggle').checked;
    
    const resultsDiv = document.getElementById('results');
    const errorDiv = document.getElementById('error-msg');
    const loaderDiv = document.getElementById('loader');
    const submitBtn = document.getElementById('submit-btn');
    const trafficAlert = document.getElementById('traffic-alert');
    
    resultsDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    trafficAlert.classList.add('hidden');
    loaderDiv.classList.remove('hidden');
    submitBtn.disabled = true;
    
    if (currentRouteLayer) map.removeLayer(currentRouteLayer);
    currentMarkers.forEach(m => map.removeLayer(m));
    currentMarkers = [];
    document.getElementById('path-list').innerHTML = '';

    if (source === dest) {
        showError("Source and Destination cannot be the same.");
        return;
    }

    try {
        const response = await fetch('/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, destination: dest, preference: pref, traffic })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }

        loaderDiv.classList.add('hidden');
        submitBtn.disabled = false;

        document.getElementById('total-cost').innerHTML = `<i class="fa-solid fa-indian-rupee-sign"></i> ${data.totalCost}`;
        document.getElementById('total-time').innerHTML = `<i class="fa-regular fa-clock"></i> ${data.totalTime} mins`;
        document.getElementById('total-carbon').innerHTML = `<i class="fa-solid fa-leaf"></i> ${data.totalCarbon} units`;
        
        if (data.trafficAlert) {
            trafficAlert.classList.remove('hidden');
        }
        
        const latlngs = [];
        const pathList = document.getElementById('path-list');

        data.path.forEach((step, index) => {
            const isStart = index === 0;
            const isEnd = index === data.path.length - 1;
            
            const li = document.createElement('li');
            li.className = `mode-${step.mode}`;
            
            const iconData = modeIcons[step.mode] || { class: "fa-solid fa-arrow-right" };
            
            if (isStart) {
                li.innerHTML = `<i class="transport-icon ${modeIcons['START'].class}"></i> 
                                <div><strong>Start your journey at:</strong> <br> ${step.location}</div>`;
            } else {
                li.innerHTML = `<i class="transport-icon ${iconData.class}"></i> 
                                <div>Take <strong>${step.mode}</strong> to <br> <strong>${step.location}</strong></div>`;
            }
            pathList.appendChild(li);

            const coords = coordinates[step.location];
            if (coords) {
                latlngs.push(coords);
                const icon = createCustomIcon(step.mode, isStart, isEnd, step.location);
                const marker = L.marker(coords, { icon: icon })
                    .bindPopup(`<b>${step.location}</b><br>${isStart ? 'Start Point' : `Arrive via ${step.mode}`}`)
                    .addTo(map);
                
                li.addEventListener('mouseenter', () => {
                    marker.openPopup();
                    map.setView(coords, 14, { animate: true });
                });
                li.addEventListener('mouseleave', () => {
                    marker.closePopup();
                });
                currentMarkers.push(marker);
            }
        });

        if (latlngs.length > 0) {
            let pathColor = '#3498db'; 
            if (pref === 'cost') pathColor = '#2ecc71';
            if (pref === 'time') pathColor = '#e74c3c';
            if (pref === 'eco') pathColor = '#27ae60';
            
            // Draw segment by segment
            for (let i = 0; i < data.path.length - 1; i++) {
                const startNode = data.path[i];
                const endNode = data.path[i+1];
                
                const startCoord = coordinates[startNode.location];
                const endCoord = coordinates[endNode.location];
                const mode = endNode.mode;
                
                if (!startCoord || !endCoord) continue;
                
                let segmentLatLngs = [startCoord, endCoord];
                let isRoadVehicle = (mode === 'Bus' || mode === 'Cab' || mode === 'Auto');
                let isMetro = (mode === 'Metro');
                
                // OSRM ROAD SNAPPING LOGIC (Strictly for Road Vehicles)
                // We do NOT use OSRM for Metro because OSRM maps to one-way streets, 
                // roundabouts, and legal driving lanes, which makes the Metro look like a car.
                if (isRoadVehicle) {
                    try {
                        const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${startCoord[1]},${startCoord[0]};${endCoord[1]},${endCoord[0]}?overview=full&geometries=geojson`);
                        const osrmData = await osrmRes.json();
                        
                        if (osrmData.code === 'Ok' && osrmData.routes.length > 0) {
                            segmentLatLngs = osrmData.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        }
                    } catch(e) {
                        console.log("OSRM failed for segment, falling back to direct line.");
                    }
                }
                
                // Style Metro tracks uniquely (Purple or Aqua depending on the route)
                let segmentColor = pathColor;
                if (isMetro) {
                    if (corridor1.includes(startNode.location) && corridor1.includes(endNode.location)) segmentColor = '#8e44ad';
                    else if (corridor2.includes(startNode.location) && corridor2.includes(endNode.location)) segmentColor = '#00bcd4';
                    else segmentColor = '#8e44ad';
                }
                
                if (isMetro) {
                    // Draw actual railway track style (Solid background, dashed white foreground)
                    const bgTrack = L.polyline(segmentLatLngs, {
                        color: segmentColor,
                        weight: 8,
                        opacity: 1
                    }).addTo(map);
                    
                    const fgTrack = L.polyline(segmentLatLngs, {
                        color: '#ffffff',
                        weight: 4,
                        dashArray: '10, 15',
                        opacity: 1
                    }).addTo(map);
                    
                    currentMarkers.push(bgTrack);
                    currentMarkers.push(fgTrack);
                } else {
                    // Draw the segment as animated road path
                    const segmentLayer = L.polyline.antPath(segmentLatLngs, {
                        delay: 400,
                        dashArray: [10, 20],
                        weight: 5, 
                        color: pathColor,
                        pulseColor: '#ffffff',
                        paused: false, 
                        reverse: false, 
                        hardwareAccelerated: true
                    }).addTo(map);
                    currentMarkers.push(segmentLayer);
                }
            }
            
            map.fitBounds(L.polyline(latlngs).getBounds(), { padding: [50, 50] });
        }
        resultsDiv.classList.remove('hidden');

    } catch (err) {
        showError("Failed to connect to Python backend.");
    }
});

function showError(msg) {
    const errorDiv = document.getElementById('error-msg');
    const loaderDiv = document.getElementById('loader');
    const submitBtn = document.getElementById('submit-btn');
    
    loaderDiv.classList.add('hidden');
    submitBtn.disabled = false;
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
}
