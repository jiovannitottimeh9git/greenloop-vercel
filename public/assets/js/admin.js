const csrf=document.querySelector('meta[name="csrf-token"]')?.content||'';
const headers={'X-CSRF-Token':csrf};let adminMap=null,markers=[];
async function loadAdmin(){
 const msg=document.getElementById('adminMessage');
 try{
  const r=await fetch('api.php?action=admin_data');const d=await r.json();if(!d.success)throw Error(d.message);
  Object.entries({statRequests:d.stats.requests,statPending:d.stats.pending,statCompleted:d.stats.completed,statDrivers:d.stats.drivers,statVehicles:d.stats.vehicles,statReports:d.stats.reports}).forEach(([id,v])=>document.getElementById(id).textContent=v);
  const tbody=document.getElementById('requestRows');tbody.innerHTML=d.requests.length?d.requests.map(x=>`<tr><td><strong>${esc(x.reference_code)}</strong></td><td>${esc(x.customer_name)}<small>${esc(x.phone)}</small></td><td>${esc(x.region)}</td><td>${esc(x.waste_category)}</td><td><span class="status-pill">${esc(x.status)}</span></td><td>${new Date(x.created_at.replace(' ','T')).toLocaleDateString()}</td></tr>`).join(''):'<tr><td colspan="6">No collection requests yet.</td></tr>';
  if(!adminMap){adminMap=L.map('adminMap').setView([5.6037,-0.187],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(adminMap);}
  markers.forEach(m=>adminMap.removeLayer(m));markers=[];
  d.vehicles.filter(v=>v.latitude&&v.longitude).forEach(v=>{const m=L.marker([v.latitude,v.longitude]).addTo(adminMap).bindPopup(`<strong>${esc(v.registration_number)}</strong><br>${esc(v.driver_name||'Driver')}<br>${esc(v.vehicle_type)}`);markers.push(m);});
  msg.textContent='';
 }catch(e){msg.textContent='Could not load dashboard data. '+e.message;msg.className='form-message error';}
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function loadOptions(){const r=await fetch('api.php?action=admin_options');const d=await r.json();if(!d.success)return;[['assignRequest',d.requests,x=>`${x.reference_code} — ${x.customer_name}`],['assignDriver',d.drivers,x=>x.full_name],['assignVehicle',d.vehicles,x=>x.registration_number]].forEach(([id,arr,label])=>{const el=document.getElementById(id);el.innerHTML='<option value="">Choose…</option>'+arr.map(x=>`<option value="${x.id}">${esc(label(x))}</option>`).join('');});}
document.getElementById('refreshAdmin')?.addEventListener('click',loadAdmin);
document.getElementById('assignForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const r=await fetch('api.php?action=admin_assign',{method:'POST',headers:headers,body:new FormData(f)});const d=await r.json();const m=document.getElementById('assignMessage');m.textContent=d.message;m.className='form-message '+(d.success?'success':'error');if(d.success){f.reset();loadAdmin();loadOptions();}});
loadAdmin();loadOptions();setInterval(loadAdmin,15000);


// Driver account management (administrator only)
const driverForm=document.getElementById('createDriverForm');
const driverCreateMessage=document.getElementById('driverCreateMessage');
const driverRows=document.getElementById('driverRows');
async function loadDrivers(){
 if(!driverRows)return;
 try{
  const response=await fetch('api.php?action=admin_drivers',{cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.success)throw new Error(data.message||'Could not load drivers.');
  driverRows.innerHTML=data.drivers.length?data.drivers.map(d=>`<tr>
   <td><strong>${esc(d.full_name)}</strong><small>${esc(d.email)}</small></td>
   <td>${esc(d.phone)}</td><td>${esc(d.licence_number||'Not provided')}</td>
   <td>${Number(d.active_assignments)}</td>
   <td><span class="status-pill ${d.status==='Active'?'driver-active':'driver-inactive'}">${esc(d.status)}</span></td>
   <td><button class="btn btn-outline btn-small" type="button" onclick="toggleDriver(${Number(d.id)})">${d.status==='Active'?'Deactivate':'Activate'}</button></td>
  </tr>`).join(''):'<tr><td colspan="6">No driver accounts yet. Use the form above to add your first driver.</td></tr>';
 }catch(error){driverRows.innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;}
}
driverForm?.addEventListener('submit',async event=>{
 event.preventDefault();
 const button=driverForm.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Creating account…';
 try{
  const response=await fetch('api.php?action=admin_create_driver',{method:'POST',headers,body:new FormData(driverForm)});
  const data=await response.json();
  driverCreateMessage.textContent=data.message;
  driverCreateMessage.className='form-message '+(data.success?'success':'error');
  if(data.success){driverForm.reset();loadDrivers();loadOptions();}
 }catch(error){driverCreateMessage.textContent='Could not create driver account. '+error.message;driverCreateMessage.className='form-message error';}
 finally{button.disabled=false;button.innerHTML='Create driver account <i class="fa-solid fa-user-plus"></i>';}
});
async function toggleDriver(id){
 if(!confirm('Change this driver account status?'))return;
 const form=new FormData();form.append('driver_id',id);
 try{
  const response=await fetch('api.php?action=admin_toggle_driver',{method:'POST',headers,body:form});
  const data=await response.json();
  const target=document.getElementById('driverListMessage');target.textContent=data.message;target.className='form-message '+(data.success?'success':'error');
  if(data.success){loadDrivers();loadOptions();}
 }catch(error){const target=document.getElementById('driverListMessage');target.textContent=error.message;target.className='form-message error';}
}
window.toggleDriver=toggleDriver;
document.getElementById('refreshDrivers')?.addEventListener('click',loadDrivers);
loadDrivers();


// Vehicle management (administrator only)
const vehicleForm=document.getElementById('createVehicleForm');
const vehicleCreateMessage=document.getElementById('vehicleCreateMessage');
const vehicleRows=document.getElementById('vehicleRows');

async function loadVehicles(){
 if(!vehicleRows)return;
 try{
  const response=await fetch('api.php?action=admin_vehicles',{cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.success)throw new Error(data.message||'Could not load vehicles.');
  vehicleRows.innerHTML=data.vehicles.length?data.vehicles.map(v=>`<tr>
   <td><strong>${esc(v.registration_number)}</strong></td>
   <td>${esc(v.vehicle_type)}</td>
   <td>${esc(v.vehicle_model||'—')}</td>
   <td>${esc(v.capacity||'—')}</td>
   <td>${esc(v.driver_name||'Not assigned')}</td>
   <td><span class="status-pill">${esc(v.status)}</span></td>
  </tr>`).join(''):'<tr><td colspan="6">No vehicles registered yet. Use the form above to add your first vehicle.</td></tr>';
 }catch(error){
  vehicleRows.innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;
 }
}

vehicleForm?.addEventListener('submit',async event=>{
 event.preventDefault();
 const button=vehicleForm.querySelector('button[type="submit"]');
 button.disabled=true;button.textContent='Saving vehicle…';
 try{
  const response=await fetch('api.php?action=admin_create_vehicle',{method:'POST',headers,body:new FormData(vehicleForm)});
  const data=await response.json();
  vehicleCreateMessage.textContent=data.message||'Request completed.';
  vehicleCreateMessage.className='form-message '+(data.success?'success':'error');
  if(data.success){
   vehicleForm.reset();
   await loadVehicles();
   await loadOptions();
   await loadAdmin();
  }
 }catch(error){
  vehicleCreateMessage.textContent='Could not register vehicle. '+error.message;
  vehicleCreateMessage.className='form-message error';
 }finally{
  button.disabled=false;
  button.innerHTML='Add vehicle <i class="fa-solid fa-truck"></i>';
 }
});

document.getElementById('refreshVehicles')?.addEventListener('click',loadVehicles);
loadVehicles();
