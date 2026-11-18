const csrf=document.querySelector('meta[name="csrf-token"]')?.content||'';
const headers={'X-CSRF-Token':csrf};let adminMap=null,markers=[];

// Mobile admin drawer - scoped to the admin dashboard only.
const adminSidebar=document.querySelector('.dashboard-page .sidebar');
const sidebarToggle=document.querySelector('[data-sidebar-toggle]');
function setAdminSidebar(open){
  adminSidebar?.classList.toggle('open',open);
  document.querySelector('.dashboard-page .sidebar-overlay')?.classList.toggle('open',open);
  document.body.classList.toggle('sidebar-open',open);
  sidebarToggle?.setAttribute('aria-expanded',String(open));
  requestAnimationFrame(()=>adminMap?.invalidateSize());
}
sidebarToggle?.addEventListener('click',()=>setAdminSidebar(!adminSidebar?.classList.contains('open')));
document.querySelectorAll('[data-sidebar-close]').forEach(el=>el.addEventListener('click',()=>setAdminSidebar(false)));
document.querySelectorAll('.sidebar .side-link').forEach(link=>{
  if((link.getAttribute('href')||'').startsWith('#')) link.addEventListener('click',()=>setAdminSidebar(false));
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')setAdminSidebar(false);});
adminSidebar?.addEventListener('transitionend',()=>adminMap?.invalidateSize());
window.addEventListener('resize',()=>adminMap?.invalidateSize());
document.querySelectorAll('[data-logout]').forEach(button=>button.addEventListener('click',async()=>{
  await fetch('api.php?action=logout',{method:'POST',headers:headers});
  location.href='index.php';
}));
async function loadAdmin(){
 const msg=document.getElementById('adminMessage');
 try{
  const r=await fetch('api.php?action=admin_data',{cache:'no-store'});const d=await r.json();if(!d.success)throw Error(d.message);
  Object.entries({statRequests:d.stats.requests,statPending:d.stats.pending,statCompleted:d.stats.completed,statDrivers:d.stats.drivers,statVehicles:d.stats.vehicles,statReports:d.stats.reports}).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
  const tbody=document.getElementById('requestRows');
  if(tbody)tbody.innerHTML=d.requests.length?d.requests.map(x=>`<tr><td><strong>${esc(x.reference_code)}</strong></td><td>${esc(x.customer_name)}<small>${esc(x.phone)}</small></td><td>${esc(x.region)}</td><td>${esc(x.waste_category)}</td><td><span class="status-pill">${esc(x.status)}</span></td><td>${new Date(x.created_at.replace(' ','T')).toLocaleDateString()}</td><td>${['Completed','Cancelled'].includes(x.status)?'<span class="muted-cell">—</span>':`<button class="btn btn-outline btn-small" type="button" onclick="cancelRequest(${Number(x.id)},'${esc(x.reference_code)}')">Cancel</button>`}</td></tr>`).join(''):'<tr><td colspan="7">No collection requests yet.</td></tr>';
  if(document.getElementById('adminMap')){
   if(!adminMap){adminMap=L.map('adminMap').setView([5.6037,-0.187],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(adminMap);}
   markers.forEach(m=>adminMap.removeLayer(m));markers=[];
   d.vehicles.filter(v=>v.latitude&&v.longitude).forEach(v=>{const m=L.marker([v.latitude,v.longitude]).addTo(adminMap).bindPopup(`<strong>${esc(v.registration_number)}</strong><br>${esc(v.driver_name||'Driver')}<br>${esc(v.vehicle_type)}`);markers.push(m);});
  }
  loadCompleted();
  if(msg)msg.textContent='';
 }catch(e){if(msg){msg.textContent='Could not load dashboard data. '+e.message;msg.className='form-message error';}}
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// Manual refresh buttons: show loading state and confirm when the list was updated.
function bindRefresh(buttonId, loader, messageId, label){
  const button=document.getElementById(buttonId);
  if(!button)return;
  button.addEventListener('click',async()=>{
    const text=button.querySelector('span');
    const original=text?text.textContent:label;
    const target=messageId?document.getElementById(messageId):null;
    button.disabled=true;button.classList.add('is-loading');
    if(text)text.textContent='Refreshing…';
    if(target){target.textContent='Reloading '+label.toLowerCase()+'…';target.className='form-message';}
    try{
      await loader();
      if(target){target.textContent=label+' updated just now.';target.className='form-message success';}
    }catch(error){
      if(target){target.textContent='Could not refresh '+label.toLowerCase()+'. '+error.message;target.className='form-message error';}
    }finally{
      button.disabled=false;button.classList.remove('is-loading');
      if(text)text.textContent=original;
    }
  });
}

async function loadCompleted(){
 const body=document.getElementById('completedRows');if(!body)return;
 try{
  const r=await fetch('api.php?action=admin_completed',{cache:'no-store'});const d=await r.json();if(!d.success)throw Error(d.message);
  body.innerHTML=d.records.length?d.records.map(x=>{
   const finished=x.completed_at||x.cancelled_at;
   const when=finished?new Date(String(finished).replace(' ','T')).toLocaleString():'—';
   const email=x.status==='Cancelled'?'—':esc(x.email_status||'not logged');
   return `<tr><td><strong>${esc(x.reference_code)}</strong></td><td>${esc(x.customer_name)}<small>${esc(x.phone)}</small></td><td>${esc(x.registration_number||'—')}</td><td>${esc(x.driver_name||'—')}</td><td>${when}</td><td><span class="status-pill">${email}</span></td><td><span class="status-pill">${esc(x.status)}</span></td></tr>`;
  }).join(''):'<tr><td colspan="7">No completed or cancelled collections yet.</td></tr>';
 }catch(e){body.innerHTML=`<tr><td colspan="7">${esc(e.message)}</td></tr>`;}
}
async function loadReports(){
 const body=document.getElementById('reportRows');if(!body)return;
 const filter=document.getElementById('reportFilter');
 const status=filter?filter.value:'';
 try{
  const r=await fetch('api.php?action=admin_reports'+(status?'&status='+encodeURIComponent(status):''),{cache:'no-store'});
  const d=await r.json();if(!d.success)throw Error(d.message);
  body.innerHTML=d.reports.length?d.reports.map(x=>{
   const when=x.created_at?new Date(String(x.created_at).replace(' ','T')).toLocaleString():'—';
   const detail=String(x.description||'');
   const short=detail.length>120?detail.slice(0,120)+'…':detail;
   const evidence=x.has_evidence?`<a class="evidence-link" href="api.php?action=admin_report_evidence&id=${Number(x.id)}" target="_blank" rel="noopener"><i class="fa-solid fa-image"></i> View</a>`:'<span class="muted-cell">—</span>';
   return `<tr><td><strong>${esc(x.reference_code)}</strong></td><td>${esc(x.reporter_name)}<small>${esc(x.phone)}</small></td><td>${esc(x.location)}</td><td><span class="status-pill">${esc(x.category)}</span></td><td class="report-detail" title="${esc(detail)}">${esc(short)}</td><td>${evidence}</td><td>${when}</td><td><select class="report-status-select" data-report-id="${Number(x.id)}" onchange="updateReportStatus(${Number(x.id)},this.value)">${['Submitted','Under Review','Assigned','Resolved','Rejected'].map(s=>`<option${s===x.status?' selected':''}>${s}</option>`).join('')}</select></td></tr>`;
  }).join(''):'<tr><td colspan="8">No user reports found for this status.</td></tr>';
 }catch(e){body.innerHTML=`<tr><td colspan="8">${esc(e.message)}</td></tr>`;}
}
async function updateReportStatus(id,status){
 const target=document.getElementById('reportListMessage');
 try{
  const form=new FormData();form.append('report_id',id);form.append('status',status);
  const r=await fetch('api.php?action=admin_report_status',{method:'POST',headers:headers,body:form});
  const d=await r.json();
  if(target){target.textContent=d.message;target.className='form-message '+(d.success?'success':'error');}
  if(d.success)loadReports();
 }catch(e){if(target){target.textContent='Could not update report status. '+e.message;target.className='form-message error';}}
}
window.updateReportStatus=updateReportStatus;
document.getElementById('reportFilter')?.addEventListener('change',loadReports);


// Recycling hub submissions (administrator only). This page reviews public
// listings; it intentionally does not duplicate the public guide or forms.
const HUB_STATUSES=['Pending Review','Available','Reserved','Collected','Sold','Rejected'];
function hubStatusClass(status){
 if(status==='Pending Review')return 'listing-pending';
 if(status==='Rejected')return 'listing-rejected';
 return 'listing-approved';
}
async function loadHubListings(){
 const body=document.getElementById('hubListingRows');if(!body)return;
 const filter=document.getElementById('hubListingFilter');
 const status=filter?filter.value:'';
 try{
  const r=await fetch('api.php?action=admin_hub'+(status?'&status='+encodeURIComponent(status):''),{cache:'no-store'});
  const d=await r.json();if(!d.success)throw Error(d.message);
  const s=d.stats||{};
  [['hubStatTotal',s.total],['hubStatPendingReview',s['Pending Review']],['hubStatAvailable',s.Available],['hubStatReserved',s.Reserved],['hubStatCollected',s.Collected],['hubStatRejected',s.Rejected]].forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value??0;});
  body.innerHTML=d.listings.length?d.listings.map(x=>{
   const when=x.created_at?new Date(String(x.created_at).replace(' ','T')).toLocaleString():'—';
   const detail=String(x.description||'');
   const short=detail.length>100?detail.slice(0,100)+'…':detail;
   const digits=String(x.phone||'').replace(/[^+\d]/g,'');
   const qty=Number(x.quantity);
   const options=HUB_STATUSES.map(s=>`<option${s===x.status?' selected':''}>${s}</option>`).join('');
   return `<tr>
    <td><strong>${esc(x.seller_name)}</strong></td>
    <td>${digits?`<a href="tel:${esc(digits)}">${esc(x.phone)}</a>`:esc(x.phone||'—')}</td>
    <td><span class="status-pill">${esc(x.material)}</span></td>
    <td>${Number.isFinite(qty)?qty:'—'} ${esc(x.unit||'')}</td>
    <td>${esc(x.location)}</td>
    <td class="report-detail" title="${esc(detail)}">${esc(short)||'<span class="muted-cell">—</span>'}</td>
    <td>${when}</td>
    <td><select class="report-status-select ${hubStatusClass(x.status)}" data-listing-id="${Number(x.id)}" onchange="updateHubListingStatus(${Number(x.id)},this.value)">${options}</select></td>
   </tr>`;
  }).join(''):'<tr><td colspan="8">No user listings found for this status.</td></tr>';
 }catch(e){body.innerHTML=`<tr><td colspan="8">${esc(e.message)}</td></tr>`;}
}
async function updateHubListingStatus(id,status){
 const target=document.getElementById('hubListMessage');
 try{
  const form=new FormData();form.append('listing_id',id);form.append('status',status);
  const r=await fetch('api.php?action=admin_hub_status',{method:'POST',headers:headers,body:form});
  const d=await r.json();
  if(target){target.textContent=d.message;target.className='form-message '+(d.success?'success':'error');}
  if(d.success)loadHubListings();
 }catch(e){if(target){target.textContent='Could not update listing status. '+e.message;target.className='form-message error';}}
}
window.updateHubListingStatus=updateHubListingStatus;
document.getElementById('hubListingFilter')?.addEventListener('change',loadHubListings);
bindRefresh('refreshHubListings',loadHubListings,'hubListMessage','Listings');
loadHubListings();

async function cancelRequest(id,reference){
 if(!confirm(`Cancel collection ${reference}? Any active driver assignment will be stopped.`))return;
 const form=new FormData();form.append('request_id',id);
 const reason=prompt('Optional reason for cancelling this collection:');if(reason)form.append('reason',reason);
 const target=document.getElementById('requestListMessage');
 try{
  const r=await fetch('api.php?action=admin_cancel_request',{method:'POST',headers:headers,body:form});
  const d=await r.json();target.textContent=d.message;target.className='form-message '+(d.success?'success':'error');
  if(d.success){loadAdmin();loadOptions();loadCompleted();}
 }catch(e){target.textContent='Could not cancel this collection. '+e.message;target.className='form-message error';}
}
window.cancelRequest=cancelRequest;
async function loadOptions(){const r=await fetch('api.php?action=admin_options');const d=await r.json();if(!d.success)return;[['assignRequest',d.requests,x=>`${x.reference_code} — ${x.customer_name}`],['assignDriver',d.drivers,x=>x.full_name],['assignVehicle',d.vehicles,x=>x.registration_number]].forEach(([id,arr,label])=>{const el=document.getElementById(id);if(!el)return;el.innerHTML='<option value="">Choose…</option>'+arr.map(x=>`<option value="${x.id}">${esc(label(x))}</option>`).join('');});}
bindRefresh('refreshAdmin',loadAdmin,'requestListMessage','Requests');
bindRefresh('refreshCompleted',loadCompleted,'completedListMessage','History');
bindRefresh('refreshReports',loadReports,'reportListMessage','Reports');
document.getElementById('assignForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const r=await fetch('api.php?action=admin_assign',{method:'POST',headers:headers,body:new FormData(f)});const d=await r.json();const m=document.getElementById('assignMessage');m.textContent=d.message;m.className='form-message '+(d.success?'success':'error');if(d.success){f.reset();loadAdmin();loadOptions();}});
loadAdmin();loadOptions();loadReports();setInterval(loadAdmin,15000);


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
bindRefresh('refreshDrivers',loadDrivers,'driverListMessage','Drivers');
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

bindRefresh('refreshVehicles',loadVehicles,'vehicleListMessage','Vehicles');
loadVehicles();
