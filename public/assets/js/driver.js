const csrf=document.querySelector('meta[name="csrf-token"]')?.content||'';
const headers={'X-CSRF-Token':csrf};
const holder=document.getElementById('driverAssignments'),message=document.getElementById('driverMessage');
let assignments=[],watchId=null,activeAssignment=null,activeDestination=null;
let lastPos=null,lastSentAt=0,heartbeatTimer=null;
let map=null,myMarker=null,destMarker=null,routeLine=null;

function statusClass(s){return 'status-pill status-'+String(s).toLowerCase().replaceAll(' ','-');}
function gpsState(title,detail,mode){
  const dot=document.getElementById('gpsDot'),head=document.getElementById('gpsState'),text=document.getElementById('gpsDetail');
  if(head)head.textContent=title;
  if(text)text.textContent=detail;
  if(dot)dot.className='gps-state-dot '+(mode||'idle');
}
function ll(point){
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
function initMap(center){
  map=L.map('driverMap',{zoomControl:false}).setView(center,14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; OpenStreetMap'
  }).addTo(map);
}
function updateMap(fix,destination){
  const here=fix?[fix.latitude,fix.longitude]:null;
  const dest=ll(destination);
  if(!here&&!dest)return;
  if(!map)initMap(here||dest);
  if(dest){
    if(!destMarker)destMarker=L.marker(dest).addTo(map).bindPopup('Pickup location');
    else if(!destMarker.getLatLng().equals(L.latLng(dest)))destMarker.setLatLng(dest);
  }
  if(here){
    if(!myMarker)myMarker=L.circleMarker(here,{radius:9,color:'#fff',weight:3,fillColor:'#103f2e',fillOpacity:1}).addTo(map).bindPopup('Your live position');
    else if(!myMarker.getLatLng().equals(L.latLng(here)))myMarker.setLatLng(here);
    if(dest){
      if(!routeLine)routeLine=L.polyline([here,dest],{color:'#1f8a52',weight:3,dashArray:'8 9'}).addTo(map);
      else routeLine.setLatLngs([here,dest]);
    }
    map.panTo(here);
  }
  setTimeout(()=>map?.invalidateSize(),0);
}
async function sendFix(fix){
  lastSentAt=Date.now();
  const body=new FormData();
  body.append('assignment_id',activeAssignment);
  body.append('latitude',fix.latitude);
  body.append('longitude',fix.longitude);
  body.append('accuracy',fix.accuracy||0);
  try{
    const res=await fetch('api.php?action=location_update',{method:'POST',headers:headers,body:body});
    const out=await res.json();
    if(out.success)gpsState('Sharing live location','Last sent '+new Date().toLocaleTimeString(),'live');
    else gpsState('Location not saved',out.message||'Could not save your location.','error');
  }catch(e){
    gpsState('Connection problem','Location will retry automatically.','error');
  }
}
function onPosition(pos){
  const fix={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy};
  const now=Date.now();
  if(lastPos&&now-lastSentAt<3000&&metresBetween([lastPos.latitude,lastPos.longitude],[fix.latitude,fix.longitude])<5)return;
  lastPos=fix;
  updateMap(fix,activeDestination);
  sendFix(fix);
}
function onPositionError(err){
  gpsState('Location unavailable',(err.message||'GPS permission denied')+'. Allow location access and use HTTPS or localhost.','error');
}
function stopSharing(){
  if(watchId!==null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId);
  clearInterval(heartbeatTimer);
  watchId=null;heartbeatTimer=null;activeAssignment=null;activeDestination=null;lastPos=null;lastSentAt=0;
  gpsState('Not sharing','Start a collection to begin sharing your location.','idle');
}
async function loadAssignments(){
  try{
    const r=await fetch('api.php?action=driver_assignments');
    const d=await r.json();if(!d.success)throw Error(d.message);
    assignments=(d.assignments||[]).map(a=>({...a,id:Number(a.id)}));
    if(activeAssignment&&!assignments.some(a=>a.id===activeAssignment))stopSharing();
    holder.innerHTML=assignments.length?assignments.map(a=>`<article class="assignment-card"><div class="assignment-head"><div><span class="form-step">${a.reference_code}</span><h2>${a.customer_name}</h2></div><span class="${statusClass(a.status)}">${a.status}</span></div><div class="assignment-info"><div><small>Destination</small><strong>${a.address}, ${a.region}</strong></div><div><small>Waste category</small><strong>${a.waste_category}</strong></div><div><small>Contact</small><strong>${a.phone}</strong></div><div><small>Vehicle</small><strong>${a.registration_number}</strong></div></div><div class="driver-actions"><button class="btn btn-primary" onclick="startCollection(${a.id})"><i class="fa-solid fa-play"></i> Start & share GPS</button><button class="btn btn-outline" onclick="completeCollection(${a.id})"><i class="fa-solid fa-check"></i> Complete pickup</button></div></article>`).join(''):'<div class="loading-card">No active collection assignments yet. Your administrator will assign jobs here.</div>';
  }catch(e){holder.textContent='Unable to load assignments. '+e.message;}
}
async function startCollection(id){
  id=Number(id);
  if(!navigator.geolocation){message.textContent='This browser does not support GPS location.';message.className='form-message error';return;}
  const fd=new FormData();fd.append('assignment_id',id);
  const r=await fetch('api.php?action=driver_start',{method:'POST',headers:headers,body:fd});
  const d=await r.json();
  if(!d.success){message.textContent=d.message;message.className='form-message error';return;}
  const job=assignments.find(a=>a.id===id);
  activeAssignment=id;
  activeDestination=job?{latitude:job.customer_latitude,longitude:job.customer_longitude}:null;
  updateMap(null,activeDestination);
  if(watchId!==null)navigator.geolocation.clearWatch(watchId);
  gpsState('Requesting GPS permission…','Allow location access so the customer can see your vehicle moving.','pending');
  watchId=navigator.geolocation.watchPosition(onPosition,onPositionError,{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
  clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{if(activeAssignment&&lastPos&&Date.now()-lastSentAt>=10000)sendFix(lastPos);},5000);
  message.textContent='Collection started. Keep this page open while the vehicle is moving.';
  message.className='form-message success';
}
async function completeCollection(id){
  id=Number(id);
  if(!confirm('Mark this collection as completed? GPS sharing for this assignment will stop.'))return;
  const fd=new FormData();fd.append('assignment_id',id);
  const r=await fetch('api.php?action=driver_complete',{method:'POST',headers:headers,body:fd});
  const d=await r.json();
  if(d.success){
    if(activeAssignment===id)stopSharing();
    message.textContent=d.message;message.className='form-message success';
    loadAssignments();
  }else{
    message.textContent=d.message;message.className='form-message error';
  }
}
loadAssignments();setInterval(loadAssignments,30000);
