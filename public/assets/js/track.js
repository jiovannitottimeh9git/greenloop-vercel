const csrfToken=document.querySelector('meta[name="csrf-token"]')?.content||'';
let map=null,truckMarker=null,destinationMarker=null,trailLine=null,routeLine=null;
let refreshTimer=null,lastRef='',lastPhone='',lastCenter=null,lastPollMs=0;
const form=document.getElementById('trackForm'),msg=document.getElementById('trackMessage'),result=document.getElementById('trackResult');

function statusClass(s){return 'status-pill status-'+String(s).toLowerCase().replaceAll(' ','-');}
function parseTime(value){return value?new Date(String(value).replace(' ','T')):null;}
function fmtTime(value){const d=parseTime(value);return d&&!Number.isNaN(d.getTime())?d.toLocaleString():'Waiting for driver GPS';}
function latlng(point){
  if(!point||point.latitude===null||point.latitude===undefined||point.longitude===null||point.longitude===undefined)return null;
  const lat=Number(point.latitude),lng=Number(point.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lng)?[lat,lng]:null;
}
function metresBetween(a,b){
  if(!a||!b)return Infinity;
  const R=6371000,rad=d=>d*Math.PI/180;
  const dLat=rad(b[0]-a[0]),dLon=rad(b[1]-a[1]);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));
}
function setPolling(ms){
  if(lastPollMs===ms&&refreshTimer)return;
  clearInterval(refreshTimer);refreshTimer=setInterval(loadTrack,ms);lastPollMs=ms;
}
function resetMap(){
  if(map){map.remove();map=null;}
  truckMarker=null;destinationMarker=null;trailLine=null;routeLine=null;lastCenter=null;lastPollMs=0;
}
function truckIcon(){
  return L.divIcon({
    className:'gl-truck-icon-wrap',
    html:'<div class="gl-truck-pulse"></div><div class="gl-truck-body"><i class="fa-solid fa-truck"></i></div>',
    iconSize:[44,44],iconAnchor:[22,22]
  });
}
function destinationIcon(){
  return L.divIcon({
    className:'gl-destination-icon-wrap',
    html:'<div class="gl-destination-pin"><i class="fa-solid fa-location-dot"></i></div>',
    iconSize:[36,36],iconAnchor:[18,32]
  });
}
function initMap(center){
  map=L.map('trackingMap',{zoomControl:true}).setView(center,13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
}
function updateLivePanel(data){
  const panel=document.getElementById('livePanel');
  if(!panel)return;
  const q=data.request,live=data.live||{},status=String(q.status||'');
  if(!live.active){
    panel.classList.add('hidden');return;
  }
  panel.classList.remove('hidden');
  const headline=document.getElementById('liveHeadline');
  const subline=document.getElementById('liveSubline');
  const distanceEl=document.getElementById('liveDistance');
  const etaEl=document.getElementById('liveEta');
  if(/completed/i.test(status))headline.textContent='Pickup completed';
  else if(/arrived/i.test(status))headline.textContent='Driver has arrived';
  else if(/progress/i.test(status))headline.textContent='Pickup in progress';
  else if(/en route/i.test(status))headline.textContent='Driver is on the way';
  else headline.textContent='Live tracking active';
  subline.textContent=(live.driver_name?live.driver_name+' · ':'')+(live.age_label||'Waiting for driver GPS');
  if(live.distance_km===null||live.distance_km===undefined){
    distanceEl.textContent=data.location?'Calculating…':'—';
  }else if(live.distance_km<1){
    distanceEl.textContent=Math.round(live.distance_km*1000)+' m';
  }else{
    distanceEl.textContent=Number(live.distance_km).toFixed(1)+' km';
  }
  etaEl.textContent=live.eta_minutes?('~'+live.eta_minutes+' min'):(data.location?'Calculating…':'—');
}
function drawMap(data){
  const here=latlng(data.location);
  const destination=latlng({
    latitude:data.request.customer_latitude,
    longitude:data.request.customer_longitude
  });
  const trail=(data.live&&data.live.trail||[]).map(latlng).filter(Boolean);
  const fallback=[-0.187,5.6037];
  if(!map)initMap(here||destination||fallback);

  if(destination){
    if(!destinationMarker){
      destinationMarker=L.marker(destination,{icon:destinationIcon()}).addTo(map).bindPopup('Your pickup location');
    }else if(!destinationMarker.getLatLng().equals(L.latLng(destination))){
      destinationMarker.setLatLng(destination);
    }
  }

  if(trail.length>1){
    if(!trailLine)trailLine=L.polyline(trail,{color:'#1f8a52',weight:5,opacity:.45}).addTo(map);
    else trailLine.setLatLngs(trail);
  }

  if(here){
    if(!truckMarker){
      truckMarker=L.marker(here,{icon:truckIcon(),zIndexOffset:1000}).addTo(map)
        .bindPopup('GreenLoop collection vehicle'+(data.vehicle?' · '+data.vehicle.registration_number:''));
    }else if(!truckMarker.getLatLng().equals(L.latLng(here))){
      truckMarker.setLatLng(here);
    }
    if(destination){
      if(!routeLine)routeLine=L.polyline([here,destination],{color:'#0d6efd',weight:3,opacity:.7,dashArray:'8 9'}).addTo(map);
      else routeLine.setLatLngs([here,destination]);
    }
  }

  const boundsPoints=[...trail];
  if(destination)boundsPoints.push(destination);
  if(here)boundsPoints.push(here);
  if(boundsPoints.length>1&&!map._glFitted){
    map.fitBounds(L.latLngBounds(boundsPoints),{padding:[45,45],maxZoom:15});
    map._glFitted=true;lastCenter=here||lastCenter;
  }else if(here&&(!lastCenter||metresBetween(lastCenter,here)>50)){
    map.panTo(here);lastCenter=here;
  }else if(!here&&destination&&!trail.length){
    map.setView(destination,15);
  }
}
async function loadTrack(){
  if(!lastRef||!lastPhone)return;
  const params=new URLSearchParams({reference:lastRef,phone:lastPhone});
  try{
    const r=await fetch('api.php?action=track&'+params.toString());
    const d=await r.json();
    if(!d.success){
      msg.textContent=d.message;msg.className='form-message error';
      clearInterval(refreshTimer);refreshTimer=null;lastPollMs=0;return;
    }
    msg.textContent='';result.classList.remove('hidden');
    const q=d.request;
    document.getElementById('trackRef').textContent=q.reference_code;
    document.getElementById('trackAddress').textContent=q.address+', '+q.region;
    const st=document.getElementById('trackStatus');st.textContent=q.status;st.className=statusClass(q.status);
    document.getElementById('trackCategory').textContent=q.waste_category;
    document.getElementById('trackDate').textContent=q.preferred_date||'To be confirmed';
    document.getElementById('trackVehicle').textContent=d.vehicle?d.vehicle.registration_number+' · '+d.vehicle.vehicle_type:'Not assigned yet';
    document.getElementById('trackUpdated').textContent=d.location?fmtTime(d.location.recorded_at):'Waiting for driver GPS';
    document.getElementById('trackDriver').textContent=(d.live&&d.live.driver_name)?d.live.driver_name:'—';
    updateLivePanel(d);
    drawMap(d);
    setTimeout(()=>map?.invalidateSize(),0);
    if(/completed|cancelled/i.test(q.status)){
      clearInterval(refreshTimer);refreshTimer=null;lastPollMs=0;
    }else{
      setPolling(d.live&&d.live.active?3000:15000);
    }
  }catch(e){
    msg.textContent='Unable to refresh live location. Retrying…';msg.className='form-message error';
  }
}
if(form)form.addEventListener('submit',e=>{
  e.preventDefault();
  const fd=new FormData(form);
  lastRef=String(fd.get('reference')||'').trim();
  lastPhone=String(fd.get('phone')||'').trim();
  clearInterval(refreshTimer);refreshTimer=null;
  resetMap();
  loadTrack();
});
