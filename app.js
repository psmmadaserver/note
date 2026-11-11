const $=id=>document.getElementById(id);
let token=localStorage.getItem("ch_token")||"", username=localStorage.getItem("ch_user")||"", currentRecord=null, lastReceipt=null, appLogoUrl=localStorage.getItem("ch_logo")||"", deferredInstallPrompt=null;
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const today=()=>new Date().toLocaleDateString("en-CA");
const compactMoney=n=>{n=Number(n)||0;if(n>=1000000)return "Rp"+new Intl.NumberFormat("id-ID",{maximumFractionDigits:1}).format(n/1000000)+" jt";if(n>=1000)return "Rp"+new Intl.NumberFormat("id-ID",{maximumFractionDigits:1}).format(n/1000)+" rb";return money(n)};
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
async function api(action,data={}){const r=await fetch("/api/gas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,token,...data})});const j=await r.json();if(!j.ok&&j.error&&j.error.toLowerCase().includes("sesi berakhir")){logout(false);throw Error(j.error)}return j}
function setLoading(show,caption="MENYIAPKAN APLIKASI..."){const el=$("loadingScreen");if(!el)return;$("loadingCaption").textContent=caption;el.classList.toggle("hidden",!show);if(show){let n=0;clearInterval(window.__loadTimer);window.__loadTimer=setInterval(()=>{n=Math.min(96,n+Math.ceil(Math.random()*8));$("loadingPercent").textContent=String(n).padStart(2,"0")+"%"},180)}else{clearInterval(window.__loadTimer);$("loadingPercent").textContent="100%"}}
function applyLogo(url){appLogoUrl=url||"";document.querySelectorAll(".app-logo").forEach(img=>{if(appLogoUrl){img.src=appLogoUrl;img.classList.add("visible");img.onerror=()=>img.classList.remove("visible")}else{img.removeAttribute("src");img.classList.remove("visible")}});document.querySelectorAll(".brand-logo,.avatar").forEach(el=>el.classList.toggle("has-logo",!!appLogoUrl));const preview=$("logoPreview"),fallback=$("logoPreviewFallback");if(preview){preview.src=appLogoUrl;preview.classList.toggle("visible",!!appLogoUrl);fallback.classList.toggle("hidden",!!appLogoUrl)}}
async function refreshLogo(){try{const r=await api("getLogo");if(r.ok){appLogoUrl=r.logoUrl||"";if(appLogoUrl)localStorage.setItem("ch_logo",appLogoUrl);else localStorage.removeItem("ch_logo");applyLogo(appLogoUrl)}}catch(e){applyLogo(appLogoUrl)}}
function showApp(){ $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("sideUser").textContent=username;$("topUser").textContent=username; $("debtDate").value=today();$("payDate").value=today();navigate("dashboard");loadDashboard(); }
function logout(call=true){if(call)api("logout").catch(()=>{});token="";username="";localStorage.removeItem("ch_token");localStorage.removeItem("ch_user");$("appView").classList.add("hidden");$("loginView").classList.remove("hidden")}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();setLoading(true,"MEMVERIFIKASI AKUN...");try{const r=await api("login",{username:$("username").value.trim(),password:$("password").value});if(!r.ok)throw Error(r.error);token=r.token;username=r.username;localStorage.setItem("ch_token",token);localStorage.setItem("ch_user",username);await refreshLogo();showApp()}catch(err){toast(err.message)}finally{setLoading(false)}});
function navigate(page){document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));$(page+"Page").classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("pageTitle").textContent=({dashboard:"Dashboard",debts:"Hutang / Piutang",payments:"Pembayaran",projects:"Project",settings:"Pengaturan akun"})[page];$("sidebar")?.classList.remove("open");if(page==="debts")loadDebts();if(page==="projects")loadProjects();window.scrollTo({top:0,behavior:"smooth"});}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.goto)));
$("menuToggle").onclick=()=>$("appView").querySelector(".sidebar").classList.toggle("open");$("logoutBtn").onclick=()=>logout();if($("settingsLogoutBtn"))$("settingsLogoutBtn").onclick=()=>logout();
async function loadDashboard(){try{const r=await api("dashboard");if(!r.ok)throw Error(r.error);const s=r.summary;$("statDebt").textContent=money(s.debt);$("statReceivable").textContent=money(s.receivable);$("statPaid").textContent=money(s.paid);$("statActive").textContent=s.openDebt+s.openReceivable;$("activeDetail").textContent=`${s.openDebt} hutang • ${s.openReceivable} piutang`;
  const debtPct=s.debt+s.receivable?Math.round(s.debt/(s.debt+s.receivable)*100):0,recPct=s.debt+s.receivable?100-debtPct:0;
  const paidPct=s.paid+s.debt+s.receivable?Math.round(s.paid/(s.paid+s.debt+s.receivable)*100):0;
  const activeTotal=s.openDebt+s.openReceivable;const activePct=s.totalTransactions?Math.round(activeTotal/s.totalTransactions*100):0;
  setRing("debtRing",debtPct,"#4f8fe8","#8d5cf6");setRing("receivableRing",recPct,"#1cc7b7","#4389ee");setRing("paidRing",paidPct,"#f7a34b","#ec6db6");setRing("activeRing",activePct,"#8c75ed","#36c7b5");
  $("chartDebtNow").textContent=money(s.debt);$("chartReceivableNow").textContent=money(s.receivable);renderBalanceChart(r.parties||[]);
  $("recentRows").innerHTML=r.recent.length?r.recent.map(row=>`<tr><td><strong>${esc(row.code)}</strong></td><td>${esc(row.name)}</td><td>${typeBadge(row.type)}</td><td>${money(row.amount)}</td><td>${money(row.remaining)}</td><td>${statusBadge(row.status)}</td></tr>`).join(""):`<tr><td colspan="6" class="empty">Belum ada transaksi.</td></tr>`
}catch(e){toast(e.message)}}
function setRing(id,pct,c1,c2){const el=$(id);if(el)el.style.setProperty("--ring-fill",`conic-gradient(from -90deg, ${c1}, ${c2} ${Math.max(0,Math.min(100,pct))}%, #edf1f7 ${Math.max(0,Math.min(100,pct))}% 100%)`);}
function renderBalanceChart(data){
  data=[...(data||[])].sort((a,b)=>String(a.name||"").trim().localeCompare(String(b.name||"").trim(),"id-ID",{sensitivity:"base",numeric:true}));
  const svgW=720,top=18,bottom=219,left=14,right=706,step=(right-left)/Math.max(1,data.length-1);
  const maxVal=Math.max(1,...data.map(x=>Math.max(Number(x.debt)||0,Number(x.receivable)||0)))*1.15;
  const y=v=>bottom-(Number(v||0)/maxVal)*(bottom-top);
  const points=(key)=>data.map((d,i)=>({x:left+i*step,y:y(d[key])}));
  const path=(pts)=>{if(!pts.length)return "";let d=`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;for(let i=0;i<pts.length-1;i++){const p0=pts[i],p1=pts[i+1],prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+2)];const c1x=p0.x+(p1.x-prev.x)/6,c1y=p0.y+(p1.y-prev.y)/6,c2x=p1.x-(next.x-p0.x)/6,c2y=p1.y-(next.y-p0.y)/6;d+=` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;}return d;};
  const area=(pts)=>pts.length?path(pts)+` L ${pts[pts.length-1].x} ${bottom} L ${pts[0].x} ${bottom} Z`:"";
  const debt=points("debt"),rec=points("receivable");
  $("debtLine").setAttribute("d",path(debt));$("receivableLine").setAttribute("d",path(rec));$("debtArea").setAttribute("d",area(debt));$("receivableArea").setAttribute("d",area(rec));
  $("chartDots").innerHTML=debt.map((p,i)=>`<circle class="chart-dot debt-chart-dot" cx="${p.x}" cy="${p.y}" r="4"/><circle class="chart-dot rec-chart-dot" cx="${rec[i].x}" cy="${rec[i].y}" r="4"/>`).join("");
  $("chartXLabels").innerHTML=data.map(d=>`<span title="${esc(d.name)}">${esc(d.name)}</span>`).join("");
  const maxLabel=compactMoney(maxVal);const mid=compactMoney(maxVal/2);$("chartYAxis").innerHTML=`<span>${esc(maxLabel)}</span><span>${esc(mid)}</span><span>Rp0</span>`;
  const totalDebt=data.reduce((sum,item)=>sum+(Number(item.debt)||0),0);
  const totalReceivable=data.reduce((sum,item)=>sum+(Number(item.receivable)||0),0);
  $("chartDebtNow").textContent=money(totalDebt);
  $("chartReceivableNow").textContent=money(totalReceivable);
  $("chartDebtNow").previousElementSibling.textContent="Total hutang kepada pihak";
  $("chartReceivableNow").previousElementSibling.textContent="Total piutang dari pihak";
}
function typeBadge(t){return `<span class="badge ${t==="DEBT"?"debt":"rec"}">${t==="DEBT"?"Hutang saya":"Piutang saya"}</span>`}
function statusBadge(s){return `<span class="badge ${s==="LUNAS"?"paid":"open"}">${s}</span>`}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

// Searchable dropdown presentation layered over original select controls.
// Original select elements remain the source of truth for existing app logic.
const fancySelectControls={};
function syncFancySelect(id){
  const select=$(id),control=fancySelectControls[id];if(!select||!control)return;
  const option=select.options[select.selectedIndex];
  control.input.value=option&&option.value?option.textContent.trim():"";
  control.input.placeholder=option&&option.value?"Pilih atau cari...":(select.options[0]?.textContent.trim()||"Pilih salah satu...");
  control.render();
}
function initFancySelect(id){
  const select=$(id);if(!select||fancySelectControls[id])return;
  const wrap=document.createElement("div");wrap.className="fancy-select";
  const input=document.createElement("input");input.type="text";input.className="fancy-select-input";input.autocomplete="off";input.setAttribute("role","combobox");input.setAttribute("aria-expanded","false");input.setAttribute("aria-autocomplete","list");
  const menu=document.createElement("div");menu.className="fancy-select-menu hidden";menu.setAttribute("role","listbox");
  select.insertAdjacentElement("afterend",wrap);wrap.append(input,menu);select.classList.add("fancy-native-select");
  if(select.required){input.required=true;select.required=false;}
  const control={select,wrap,input,menu,render(){
    const q=input.value.trim().toLocaleLowerCase("id-ID");
    const options=[...select.options].filter((o,i)=>i>0||o.value).filter(o=>!q||o.textContent.toLocaleLowerCase("id-ID").includes(q));
    menu.innerHTML=options.length?options.map(o=>`<button type="button" class="fancy-select-option" role="option" aria-selected="${o.value===select.value}" data-value="${esc(o.value)}">${esc(o.textContent.trim())}</button>`).join(""):'<div class="fancy-select-empty">Tidak ada pilihan yang cocok.</div>';
    menu.querySelectorAll("[data-value]").forEach(button=>button.addEventListener("click",()=>{
      select.value=button.dataset.value;select.dispatchEvent(new Event("change",{bubbles:true}));
      input.value=select.options[select.selectedIndex]?.textContent.trim()||"";close();
    }));
  }};
  fancySelectControls[id]=control;
  function open(){control.render();menu.classList.remove("hidden");wrap.classList.add("is-open");input.setAttribute("aria-expanded","true")}
  function close(){menu.classList.add("hidden");wrap.classList.remove("is-open");input.setAttribute("aria-expanded","false")}
  input.addEventListener("focus",()=>{input.value="";open()});
  input.addEventListener("blur",()=>{if(!wrap.contains(document.activeElement)){close();input.value=select.options[select.selectedIndex]?.textContent.trim()||""}});
  input.addEventListener("click",open);
  input.addEventListener("input",open);
  input.addEventListener("keydown",e=>{if(e.key==="Escape"){close();syncFancySelect(id)}else if(e.key==="Enter"){e.preventDefault();const first=menu.querySelector("[data-value]");if(first)first.click()}else if(e.key==="ArrowDown"){e.preventDefault();open();menu.querySelector("[data-value]")?.focus()}});
  select.addEventListener("change",()=>syncFancySelect(id));
  document.addEventListener("click",e=>{if(!wrap.contains(e.target)){close();if(document.activeElement!==input)input.value=select.options[select.selectedIndex]?.textContent.trim()||""}});
  syncFancySelect(id);
}
["debtType","payType","projectSource"].forEach(initFancySelect);
$("debtForm").addEventListener("submit",async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{let proof=null;const f=$("debtProof").files[0];if(f){if(f.size>8*1024*1024)throw Error("Ukuran file maksimal 8 MB.");proof={name:f.name,mimeType:f.type,data:await toBase64(f)}}const r=await api("createDebt",{type:$("debtType").value,name:$("debtName").value,date:$("debtDate").value,dueDate:$("dueDate").value,amount:$("debtAmount").value,description:$("debtDesc").value,proof});if(!r.ok)throw Error(r.error);lastReceipt={kind:"TRANSAKSI HUTANG / PIUTANG",record:r.record};$("savedCode").classList.remove("hidden");$("savedCode").innerHTML=`Transaksi tersimpan. Kode unik Anda: <b>${esc(r.code)}</b> — simpan kode ini untuk pembayaran berikutnya.`;$("printNew").disabled=false;toast("Transaksi berhasil disimpan.");$("debtForm").reset();$("debtDate").value=today();loadDebts();loadDashboard()}catch(err){toast(err.message)}finally{b.disabled=false}});
$("printNew").onclick=()=>printReceipt(lastReceipt);
async function loadDebts(){try{const r=await api("listDebts",{type:$("debtFilter").value,query:$("debtSearch").value});if(!r.ok)throw Error(r.error);$("debtRows").innerHTML=r.records.length?r.records.map(x=>`<tr><td><strong>${esc(x.code)}</strong></td><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${typeBadge(x.type)}</td><td>${money(x.amount)}</td><td>${money(x.remaining)}</td><td>${statusBadge(x.status)}</td><td><button class="text-btn" data-code="${esc(x.code)}">Kwitansi</button></td></tr>`).join(""):`<tr><td colspan="8" class="empty">Belum ada transaksi.</td></tr>`;$("debtRows").querySelectorAll("[data-code]").forEach(b=>b.onclick=async()=>{const d=await api("lookupCode",{code:b.dataset.code});if(d.ok)printReceipt({kind:"DETAIL TRANSAKSI",record:d.record,payments:d.payments})})}catch(e){toast(e.message)}}
$("debtFilter").onchange=loadDebts;let searchTimer;$("debtSearch").oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadDebts,250)};
$("lookupBtn").onclick=showDebtSuggestions;
$("payCode").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();const first=$("debtCodeDropdown").querySelector("[data-code]");if(first)selectDebtSuggestion(first.dataset.code);else lookup()}});
$("payCode").addEventListener("input",()=>{if(!$("debtCodeDropdown").classList.contains("hidden"))showDebtSuggestions()});
document.addEventListener("click",e=>{if(!e.target.closest("#payCode")&&!e.target.closest("#lookupBtn")&&!e.target.closest("#debtCodeDropdown"))$("debtCodeDropdown").classList.add("hidden")});
async function showDebtSuggestions(){
  const box=$("debtCodeDropdown"),q=$("payCode").value.trim();
  box.classList.remove("hidden");box.innerHTML='<div class="suggestion-empty">Memuat daftar transaksi...</div>';
  try{
    const r=await api("listDebts",{type:"ALL",query:q});
    if(!r.ok)throw Error(r.error);
    if(!r.records.length){box.innerHTML='<div class="suggestion-empty">Tidak ada transaksi yang cocok.</div>';return}
    box.innerHTML=r.records.slice(0,40).map(x=>`<button type="button" class="suggestion-item" data-code="${esc(x.code)}"><span><b>${esc(x.code)}</b><small>${esc(x.name)} · ${x.type==="DEBT"?"Hutang saya":"Piutang saya"}</small></span><strong>${money(x.remaining)}</strong></button>`).join("");
    box.querySelectorAll("[data-code]").forEach(b=>b.onclick=()=>selectDebtSuggestion(b.dataset.code));
  }catch(e){box.innerHTML=`<div class="suggestion-empty">${esc(e.message)}</div>`}
}
async function selectDebtSuggestion(code){$("payCode").value=code;$("debtCodeDropdown").classList.add("hidden");await lookup()}

async function lookup(){try{const r=await api("lookupCode",{code:$("payCode").value});if(!r.ok)throw Error(r.error);currentRecord=r.record;$("payType").value=r.record.type;syncFancySelect("payType");$("lookupResult").classList.remove("hidden");$("lookupResult").innerHTML=`<b>${esc(r.record.name)}</b> • ${typeBadge(r.record.type)}<br>Keterangan: ${esc(r.record.description||"-")}<br>Nominal awal: <b>${money(r.record.amount)}</b> &nbsp; Sisa: <b>${money(r.record.remaining)}</b> &nbsp; Status: ${statusBadge(r.record.status)}`;$("payAmount").max=r.record.remaining;$("payAmount").placeholder="Maksimal "+money(r.record.remaining);$("paymentRows").innerHTML=r.payments.length?r.payments.map(p=>`<tr><td>${esc(p.code)}</td><td>${esc(p.date)}</td><td>${esc(r.record.name)}</td><td>${money(p.amount)}</td><td>${money(r.record.remaining)}</td><td>${p.proofUrl?`<a class="proof-link" target="_blank" href="${esc(p.proofUrl)}">Lihat bukti ↗</a>`:"—"}</td></tr>`).join(""):`<tr><td colspan="6" class="empty">Belum ada pembayaran untuk kode ini.</td></tr>`;toast("Data transaksi ditemukan.")}catch(e){currentRecord=null;$("lookupResult").classList.remove("hidden");$("lookupResult").textContent=e.message}}
$("payForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentRecord||currentRecord.code!==$("payCode").value.trim().toUpperCase()){toast("Cari kode transaksi terlebih dahulu.");return}const b=e.submitter;b.disabled=true;try{let proof=null;const f=$("proofFile").files[0];if(f){if(f.size>8*1024*1024)throw Error("Ukuran file maksimal 8 MB.");proof={name:f.name,mimeType:f.type,data:await toBase64(f)}}const r=await api("pay",{code:currentRecord.code,date:$("payDate").value,amount:$("payAmount").value,note:$("payNote").value,proof});if(!r.ok)throw Error(r.error);lastReceipt={kind:"KWITANSI PEMBAYARAN",record:r.record,payment:{date:$("payDate").value,amount:Number($("payAmount").value),note:$("payNote").value,proofUrl:r.proofUrl,paymentId:r.paymentId}};$("printPay").disabled=false;toast(r.status==="LUNAS"?"Pembayaran berhasil. Transaksi LUNAS.":"Pembayaran angsuran berhasil.");$("payAmount").value="";$("payNote").value="";$("proofFile").value="";await lookup();loadDashboard()}catch(err){toast(err.message)}finally{b.disabled=false}});
function toBase64(file){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(String(rd.result).split(",")[1]);rd.onerror=reject;rd.readAsDataURL(file)})}
$("printPay").onclick=()=>printReceipt(lastReceipt);
function printReceipt(data){if(!data)return;const r=data.record,p=data.payment;const html=`<!doctype html><html><head><meta charset="utf-8"><title>Kwitansi ${esc(r.code)}</title><style>body{font:14px Arial;color:#24364b;padding:35px}.paper{max-width:700px;margin:auto;border:1px solid #dce4ed;padding:35px}.head{text-align:center;border-bottom:2px solid #234f7e;padding-bottom:18px}.head h1{font-size:22px;margin:0 0 5px}.muted{color:#78889b;font-size:12px}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e9eef3}.amount{font-size:23px;font-weight:bold;color:#204f83}.sign{display:flex;justify-content:space-between;margin-top:70px;text-align:center}.sign div{width:40%}.foot{text-align:center;margin-top:35px;color:#8996a6;font-size:10px}@media print{button{display:none}}</style></head><body><div class="paper"><div class="head"><h1>${esc(data.kind)}</h1><div class="muted">CATAT HUTANG • Bukti pencatatan pribadi</div></div><div class="row"><span>Kode transaksi</span><b>${esc(r.code)}</b></div><div class="row"><span>Nama pihak</span><b>${esc(r.name)}</b></div><div class="row"><span>Jenis</span><b>${r.type==="DEBT"?"Hutang saya":"Piutang saya"}</b></div><div class="row"><span>Tanggal transaksi</span><b>${esc(r.date)}</b></div><div class="row"><span>Keterangan</span><b>${esc(r.description||"-")}</b></div><div class="row"><span>Nominal awal</span><b>${money(r.amount)}</b></div>${p?`<div class="row"><span>Tanggal pembayaran</span><b>${esc(p.date)}</b></div><div class="row"><span>Nominal dibayarkan</span><b class="amount">${money(p.amount)}</b></div><div class="row"><span>Catatan pembayaran</span><b>${esc(p.note||"-")}</b></div>`:""}<div class="row"><span>Sisa setelah transaksi</span><b class="amount">${money(r.remaining)}</b></div><div class="row"><span>Status</span><b>${esc(r.status)}</b></div>${r.proofUrl?`<div class="row"><span>Bukti transaksi</span><a href="${esc(r.proofUrl)}" target="_blank">Lihat bukti digital</a></div>`:""}${p&&p.proofUrl?`<div class="row"><span>Bukti pembayaran</span><a href="${esc(p.proofUrl)}" target="_blank">Lihat bukti digital</a></div>`:""}<div class="sign"><div>Pihak terkait<br><br><br>(________________)</div><div>Pencatat<br><br><br>(________________)</div></div><div class="foot">Dokumen dibuat melalui aplikasi Catat Hutang • Simpan bersama bukti transaksi asli.</div></div><script>window.onload=()=>window.print()<\/script></body></html>`;const w=window.open("","_blank");if(!w){toast("Izinkan pop-up browser untuk mencetak kwitansi.");return}w.document.write(html);w.document.close()}
$("passwordForm").onsubmit=async e=>{e.preventDefault();if($("newPassword").value!==$("confirmPassword").value){toast("Konfirmasi password tidak sama.");return}try{const r=await api("changePassword",{oldPassword:$("oldPassword").value,newPassword:$("newPassword").value});if(!r.ok)throw Error(r.error);$("passwordForm").reset();toast("Password berhasil diubah.")}catch(err){toast(err.message)}};

// Logo aplikasi: penyimpanan terpusat melalui Google Drive dan Apps Script.
$("saveLogoBtn").onclick=async()=>{const f=$("logoFile").files[0];if(!f){toast("Pilih file logo terlebih dahulu.");return}if(f.size>1024*1024){toast("Ukuran logo maksimal 1 MB.");return}if(!["image/png","image/jpeg","image/webp"].includes(f.type)){toast("Format logo harus PNG, JPG, atau WebP.");return}const b=$("saveLogoBtn");b.disabled=true;setLoading(true,"MENYIMPAN LOGO...");try{const r=await api("setLogo",{logo:{name:f.name,mimeType:f.type,data:await toBase64(f)}});if(!r.ok)throw Error(r.error);localStorage.setItem("ch_logo",r.logoUrl||"");applyLogo(r.logoUrl||"");$("logoFile").value="";toast("Logo aplikasi berhasil disimpan.")}catch(e){toast(e.message)}finally{b.disabled=false;setLoading(false)}};
$("removeLogoBtn").onclick=async()=>{if(!confirm("Hapus logo aplikasi saat ini?"))return;try{const r=await api("removeLogo");if(!r.ok)throw Error(r.error);localStorage.removeItem("ch_logo");applyLogo("");toast("Logo aplikasi dihapus.")}catch(e){toast(e.message)}};

// PWA install flow (browser akan menentukan kapan prompt dapat ditampilkan).
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("pwaInstallBar").classList.remove("hidden")});
$("pwaInstallBtn").onclick=async()=>{if(!deferredInstallPrompt){alert("Untuk memasang aplikasi: buka menu browser (⋮ atau Bagikan), lalu pilih ‘Tambahkan ke layar utama’ atau ‘Install app’. Pada iPhone/iPad gunakan Safari > Bagikan > Add to Home Screen.");return}deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("pwaInstallBar").classList.add("hidden")};
$("pwaDismissBtn").onclick=()=>$("pwaInstallBar").classList.add("hidden");
window.addEventListener("appinstalled",()=>{$("pwaInstallBar").classList.add("hidden");toast("Catat Hutang berhasil dipasang.")});
if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!("standalone" in navigator&&navigator.standalone)){setTimeout(()=>{$("pwaInstallBtn").textContent="Cara instal";$("pwaInstallBar").classList.remove("hidden")},1800)}
if("serviceWorker" in navigator && location.protocol.startsWith("http")){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}

// ---------------- PROJECT MODULE ----------------
let selectedProjectIncome=null,lastProjectReceipt=null;
async function loadProjects(){
  $("projectInDate").value=today();$("projectOutDate").value=today();
  await Promise.all([loadProjectSummary(),loadProjectIncomeList()]);
  await refreshProjectSources();
}
async function loadProjectSummary(){
  try{const r=await api("projectSummary");if(!r.ok)throw Error(r.error);
    $("projectTotalIn").textContent=money(r.totalIn);$("projectTotalOut").textContent=money(r.totalOut);
    $("projectBalance").textContent=money(r.balance);$("projectActive").textContent=r.activeSources;
  }catch(e){toast(e.message)}
}
async function loadProjectIncomeList(){
  try{
    const r=await api("listProjectIncome",{query:$("projectSearch").value});
    if(!r.ok)throw Error(r.error);
    const all=r.records;
    $("projectIncomeRows").innerHTML=all.length?all.map(x=>{
      const spent=x.amount-x.remaining;
      return `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.date)}</td><td>${esc(x.projectName)}</td><td>${money(x.amount)}</td><td>${money(spent)}</td><td>${money(x.remaining)}</td><td><span class="badge ${x.remaining>0?"open":"paid"}">${x.remaining>0?"TERSEDIA":"HABIS"}</span></td><td><button class="text-btn" data-project-code="${esc(x.code)}">Detail / Kwitansi</button> <button class="text-btn" data-use-code="${esc(x.code)}">Uang keluar</button></td></tr>`
    }).join(""):`<tr><td colspan="8" class="empty">Belum ada uang masuk project.</td></tr>`;
    $("projectIncomeRows").querySelectorAll("[data-project-code]").forEach(b=>b.onclick=()=>showProjectDetail(b.dataset.projectCode));
    $("projectIncomeRows").querySelectorAll("[data-use-code]").forEach(b=>b.onclick=async()=>{$("projectSource").value=b.dataset.useCode;syncFancySelect("projectSource");await loadProjectSourceInfo();$("projectSource").scrollIntoView({behavior:"smooth",block:"center"})});
    let expenses=[];
    for(const x of all){const d=await api("projectLookup",{code:x.code});if(d.ok)expenses=expenses.concat(d.expenses||[])}
    expenses.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    $("projectExpenseRows").innerHTML=expenses.length?expenses.map(x=>`<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.code)}</td><td>${esc(x.date)}</td><td>${esc(x.projectName)}</td><td>${money(x.amount)}</td><td>${esc(x.note||"-")}</td><td>${x.proofUrl?`<a class="proof-link" target="_blank" href="${esc(x.proofUrl)}">Lihat ↗</a>`:"—"}</td></tr>`).join(""):`<tr><td colspan="7" class="empty">Belum ada uang keluar.</td></tr>`;
  }catch(e){toast(e.message)}
}
async function refreshProjectSources(){
  try{const r=await api("listProjectIncome",{availableOnly:true});if(!r.ok)throw Error(r.error);
    $("projectSource").innerHTML='<option value="">Pilih kode uang masuk...</option>'+r.records.map(x=>`<option value="${esc(x.code)}">${esc(x.code)} · ${esc(x.projectName)} · Sisa ${money(x.remaining)}</option>`).join("");
    syncFancySelect("projectSource");
  }catch(e){toast(e.message)}
}
$("projectSource").onchange=loadProjectSourceInfo;
async function loadProjectSourceInfo(){
  const code=$("projectSource").value,box=$("projectSourceInfo");selectedProjectIncome=null;
  if(!code){box.classList.add("hidden");return}
  try{const r=await api("projectLookup",{code});if(!r.ok)throw Error(r.error);
    selectedProjectIncome=r.record;box.classList.remove("hidden");
    box.innerHTML=`<b>${esc(r.record.projectName)}</b><br>Kode sumber: ${esc(r.record.code)}<br>Tanggal uang masuk: ${esc(r.record.date)}<br>Dana awal: <b>${money(r.record.amount)}</b> · Sisa tersedia: <b>${money(r.record.remaining)}</b>`;
    $("projectOutAmount").max=r.record.remaining;
  }catch(e){box.classList.remove("hidden");box.textContent=e.message}
}
$("projectIncomeForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=e.submitter;btn.disabled=true;
  try{
    let proof=null;const f=$("projectInProof").files[0];
    if(f){if(f.size>8*1024*1024)throw Error("Ukuran bukti maksimal 8 MB.");proof={name:f.name,mimeType:f.type,data:await toBase64(f)}}
    const r=await api("createProjectIncome",{date:$("projectInDate").value,projectName:$("projectInName").value,amount:$("projectInAmount").value,note:$("projectInNote").value,proof});
    if(!r.ok)throw Error(r.error);
    lastProjectReceipt={kind:"KWITANSI UANG MASUK PROJECT",record:r.record};
    $("projectIncomeSaved").classList.remove("hidden");$("projectIncomeSaved").innerHTML=`Uang masuk tersimpan. Kode sumber: <b>${esc(r.record.code)}</b> — gunakan kode ini saat mencatat uang keluar. <button type="button" class="text-btn" id="printProjectIncome">Cetak kwitansi</button>`;
    $("printProjectIncome").onclick=()=>printProjectReceipt(lastProjectReceipt);
    $("projectIncomeForm").reset();$("projectInDate").value=today();toast("Uang masuk project berhasil disimpan.");
    await loadProjectSummary();await loadProjectIncomeList();await refreshProjectSources();
  }catch(err){toast(err.message)}finally{btn.disabled=false}
});
$("projectExpenseForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!selectedProjectIncome||selectedProjectIncome.code!==$("projectSource").value){toast("Pilih sumber uang masuk terlebih dahulu.");return}
  const btn=e.submitter;btn.disabled=true;
  try{
    let proof=null;const f=$("projectOutProof").files[0];
    if(f){if(f.size>8*1024*1024)throw Error("Ukuran bukti maksimal 8 MB.");proof={name:f.name,mimeType:f.type,data:await toBase64(f)}}
    const r=await api("createProjectExpense",{code:selectedProjectIncome.code,date:$("projectOutDate").value,amount:$("projectOutAmount").value,note:$("projectOutNote").value,proof});
    if(!r.ok)throw Error(r.error);
    lastProjectReceipt={kind:"KWITANSI UANG KELUAR PROJECT",record:r.record,expense:r.expense};
    $("projectExpenseSaved").classList.remove("hidden");$("projectExpenseSaved").innerHTML=`Uang keluar tersimpan. Sisa dana sumber ini: <b>${money(r.record.remaining)}</b>. <button type="button" class="text-btn" id="printProjectExpense">Cetak kwitansi</button>`;
    $("printProjectExpense").onclick=()=>printProjectReceipt(lastProjectReceipt);
    $("projectOutAmount").value="";$("projectOutNote").value="";$("projectOutProof").value="";
    toast("Uang keluar berhasil disimpan.");await loadProjectSummary();await loadProjectIncomeList();await refreshProjectSources();await loadProjectSourceInfo();
  }catch(err){toast(err.message)}finally{btn.disabled=false}
});
let projectSearchTimer;$("projectSearch").oninput=()=>{clearTimeout(projectSearchTimer);projectSearchTimer=setTimeout(loadProjectIncomeList,250)};
async function showProjectDetail(code){
  try{const r=await api("projectLookup",{code});if(!r.ok)throw Error(r.error);
    printProjectReceipt({kind:"LAPORAN / KWITANSI PROJECT",record:r.record,expenses:r.expenses});
  }catch(e){toast(e.message)}
}
function printProjectReceipt(data){
  if(!data)return;const r=data.record,e=data.expense;
  const expenseRows=(data.expenses||[]).map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.id)}</td><td>${esc(x.note||"-")}</td><td>${money(x.amount)}</td></tr>`).join("");
  const body=e?`<div class="row"><span>Tanggal uang keluar</span><b>${esc(e.date)}</b></div><div class="row"><span>ID pengeluaran</span><b>${esc(e.id)}</b></div><div class="row"><span>Nominal uang keluar</span><b>${money(e.amount)}</b></div><div class="row"><span>Sisa dana sumber</span><b>${money(r.remaining)}</b></div>`:`<div class="row"><span>Tanggal uang masuk</span><b>${esc(r.date)}</b></div><div class="row"><span>Nominal uang masuk</span><b>${money(r.amount)}</b></div><div class="row"><span>Total uang keluar</span><b>${money(r.amount-r.remaining)}</b></div><div class="row"><span>Sisa dana</span><b class="amount">${money(r.remaining)}</b></div>`;
  const table=expenseRows?`<h3>Riwayat pengeluaran dari sumber dana ini</h3><table><thead><tr><th>Tanggal</th><th>ID</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>${expenseRows}</tbody></table>`:"";
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(data.kind)}</title><style>body{font:14px Arial;color:#24364b;padding:35px}.paper{max-width:760px;margin:auto;border:1px solid #dce4ed;padding:35px}.head{text-align:center;border-bottom:2px solid #234f7e;padding-bottom:18px}.head h1{font-size:22px}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e9eef3}.amount{font-size:23px;color:#204f83}table{width:100%;border-collapse:collapse;margin-top:15px}td,th{text-align:left;padding:10px;border-bottom:1px solid #e9eef3;font-size:11px}.sign{display:flex;justify-content:space-between;margin-top:65px;text-align:center}.sign div{width:40%}.foot{text-align:center;margin-top:30px;color:#8996a6;font-size:10px}@media print{button{display:none}}</style></head><body><div class="paper"><div class="head"><h1>${esc(data.kind)}</h1><p>CATAT HUTANG • Dokumen project</p></div><div class="row"><span>Nama project</span><b>${esc(r.projectName)}</b></div><div class="row"><span>Kode sumber uang masuk</span><b>${esc(r.code)}</b></div>${body}<div class="row"><span>Keterangan</span><b>${esc(e?e.note:r.note||"-")}</b></div>${table}<div class="sign"><div>Penerima / pihak terkait<br><br><br>(________________)</div><div>Admin / pencatat<br><br><br>(________________)</div></div><div class="foot">Dicetak melalui aplikasi Catat Hutang.</div></div><script>window.onload=()=>window.print()<\/script></body></html>`;
  const w=window.open("","_blank");if(!w){toast("Izinkan pop-up browser untuk mencetak.");return}w.document.write(html);w.document.close();
}

applyLogo(appLogoUrl);
(async()=>{await refreshLogo();if(token)showApp();setTimeout(()=>setLoading(false),650)})();
