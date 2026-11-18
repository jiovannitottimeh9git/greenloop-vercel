const csrf=document.querySelector('meta[name="csrf-token"]')?.content||'';const headers={'X-CSRF-Token':csrf};
const holder=document.getElementById('driverAssignments'),message=document.getElementById('driverMessage');
let watchId=null,activeAssignment=null;
async function loadAssignments(){
 try{const r=await fetch('api.php?action=driver_assignments');const d=await r.json();if(!d.success)throw Error(d.message);
  holder.innerHTML=d.assignments.length?d.assignments.map(a=>`<article class="assignment-card"><div class="assignment-head"><div><span class="form-step">${a.reference_code}</span><h2>${a.customer_name}</h2></div><span class="status-pill">${a.status}</span></div><div class="assignment-info"><div><small>Destination</small><strong>${a.address}, ${a.region}</strong></div><div><small>Waste category</small><strong>${a.waste_category}</strong></div><div><small>Contact</small><strong>${a.phone}</strong></div><div><small>Vehicle</small><strong>${a.registration_number}</strong></div></div><div class="driver-actions"><button class="btn btn-primary" onclick="startCollection(${a.id})"><i class="fa-solid fa-play"></i> Start & share GPS</button><button class="btn btn-outline" onclick="completeCollection(${a.id})"><i class="fa-solid fa-check"></i> Complete pickup</button></div><p class="gps-hint" id="gps-${a.id}">GPS is not active for this assignment.</p></article>`).join(''):'<div class="loading-card">No active collection assignments yet. Your administrator will assign jobs here.</div>';
 }catch(e){holder.textContent='Unable to load assignments. '+e.message;}
}
async function startCollection(id){
 if(!navigator.geolocation){message.textContent='This browser does not support GPS location.';message.className='form-message error';return;}
 const fd=new FormData();fd.append('assignment_id',id);
 const r=await fetch('api.php?action=driver_start',{method:'POST',headers:headers,body:fd});const d=await r.json();
 if(!d.success){message.textContent=d.message;message.className='form-message error';return;}
 activeAssignment=id;const hint=document.getElementById('gps-'+id);hint.textContent='Requesting device location permission…';
 if(watchId!==null)navigator.geolocation.clearWatch(watchId);
 watchId=navigator.geolocation.watchPosition(async pos=>{
  const p=new FormData();p.append('assignment_id',id);p.append('latitude',pos.coords.latitude);p.append('longitude',pos.coords.longitude);p.append('accuracy',pos.coords.accuracy);
  const saved=await fetch('api.php?action=location_update',{method:'POST',headers:headers,body:p});const out=await saved.json();
  hint.textContent=out.success?'GPS active · Last sent '+new Date().toLocaleTimeString():'GPS update failed: '+out.message;
 },err=>{hint.textContent='Location error: '+err.message+'. Check GPS permission and use HTTPS or localhost.';},{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
 message.textContent='Collection started. Keep this page open while the vehicle is moving.';message.className='form-message success';
}
async function completeCollection(id){
 if(!confirm('Mark this collection as completed? GPS sharing for this assignment will stop.'))return;
 const fd=new FormData();fd.append('assignment_id',id);const r=await fetch('api.php?action=driver_complete',{method:'POST',headers:headers,body:fd});const d=await r.json();
 if(d.success){if(activeAssignment===id&&watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;activeAssignment=null;}message.textContent=d.message;message.className='form-message success';loadAssignments();}
 else{message.textContent=d.message;message.className='form-message error';}
}
loadAssignments();setInterval(loadAssignments,30000);
