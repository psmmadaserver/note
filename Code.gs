/**
 * CATAT HUTANG — Google Apps Script backend
 * Jalankan setupApp() sekali dari editor Apps Script, lalu deploy sebagai Web App.
 */
const APP = {
  sheets: {
    debts: "Transaksi",
    payments: "Pembayaran",
    users: "Pengguna"
  },
  folders: "Bukti Catat Hutang",
  sessionSeconds: 21600
};

function setupApp() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("DB_ID");
  let ss;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create("Database Catat Hutang");
    props.setProperty("DB_ID", ss.getId());
  }
  ensureSheet_(ss, APP.sheets.debts, [
    "Kode Unik","Tanggal Hutang","Tanggal Jatuh Tempo","Jenis","Nama Pihak",
    "Keterangan","Nominal Awal","Sisa Hutang","Status","Bukti URL","Dibuat Pada","Diperbarui Pada"
  ]);
  ensureSheet_(ss, APP.sheets.payments, [
    "ID Pembayaran","Kode Unik","Tanggal Bayar","Nominal Bayar","Catatan",
    "Bukti URL","Dibuat Pada"
  ]);
  ensureSheet_(ss, APP.sheets.users, ["Username","Salt","Password Hash","Dibuat Pada"]);
  if (!props.getProperty("DRIVE_FOLDER_ID")) {
    const folder = DriveApp.createFolder(APP.folders);
    props.setProperty("DRIVE_FOLDER_ID", folder.getId());
  }
  const users = ss.getSheetByName(APP.sheets.users);
  if (users.getLastRow() < 2) {
    const salt = Utilities.getUuid();
    users.appendRow(["admin", salt, hashPassword_("GantiPassword123!", salt), new Date()]);
  }
  [APP.sheets.debts, APP.sheets.payments, APP.sheets.users].forEach(n => {
    const sh = ss.getSheetByName(n);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight("bold").setBackground("#eaf1fb");
    sh.autoResizeColumns(1, sh.getLastColumn());
  });
  Logger.log("Database siap: " + ss.getUrl());
  Logger.log("Login awal: admin / GantiPassword123! — segera ubah password.");
  return {ok:true, spreadsheetUrl:ss.getUrl()};
}

function doGet() {
  return json_({ok:true, app:"Catat Hutang API", message:"API aktif. Gunakan POST melalui proxy Vercel."});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "");
    if (action === "login") return json_(login_(body));
    if (action === "health") return json_({ok:true});
    const user = verifySession_(body.token);
    if (!user) return json_({ok:false, error:"Sesi berakhir. Silakan login kembali."});
    let result;
    switch (action) {
      case "dashboard": result = dashboard_(); break;
      case "listDebts": result = listDebts_(body); break;
      case "lookupCode": result = lookupCode_(body.code); break;
      case "createDebt": result = createDebt_(body); break;
      case "pay": result = pay_(body); break;
      case "changePassword": result = changePassword_(user, body); break;
      case "logout": CacheService.getScriptCache().remove("sess_"+body.token); result = {ok:true}; break;
      default: result = {ok:false,error:"Aksi tidak dikenal."};
    }
    return json_(result);
  } catch (err) {
    return json_({ok:false,error:err && err.message ? err.message : String(err)});
  }
}

function login_(b) {
  const username = String(b.username || "").trim();
  const password = String(b.password || "");
  const sh = db_().getSheetByName(APP.sheets.users);
  const rows = sh.getDataRange().getValues();
  for (let i=1;i<rows.length;i++) {
    if (String(rows[i][0]) === username) {
      if (hashPassword_(password, String(rows[i][1])) !== String(rows[i][2])) break;
      const token = Utilities.getUuid() + Utilities.getUuid();
      CacheService.getScriptCache().put("sess_"+token, username, APP.sessionSeconds);
      return {ok:true,token,username};
    }
  }
  return {ok:false,error:"Username atau password salah."};
}
function verifySession_(token) {
  if (!token) return null;
  return CacheService.getScriptCache().get("sess_"+token);
}
function changePassword_(username,b) {
  const oldPass=String(b.oldPassword||""), newPass=String(b.newPassword||"");
  if (newPass.length < 10) return {ok:false,error:"Password baru minimal 10 karakter."};
  const sh=db_().getSheetByName(APP.sheets.users), rows=sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++) if(String(rows[i][0])===username) {
    if(hashPassword_(oldPass,String(rows[i][1]))!==String(rows[i][2])) return {ok:false,error:"Password lama tidak sesuai."};
    const salt=Utilities.getUuid();
    sh.getRange(i+1,2,1,2).setValues([[salt,hashPassword_(newPass,salt)]]);
    return {ok:true};
  }
  return {ok:false,error:"Pengguna tidak ditemukan."};
}
function hashPassword_(password,salt) {
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt+"::"+password, Utilities.Charset.UTF_8);
  return bytes.map(b=>("0"+((b+256)%256).toString(16)).slice(-2)).join("");
}
function createDebt_(b) {
  const type=String(b.type||"");
  const name=String(b.name||"").trim();
  const desc=String(b.description||"").trim();
  const amount=Number(b.amount);
  if(!["DEBT","RECEIVABLE"].includes(type)) throw new Error("Jenis transaksi tidak valid.");
  if(!name) throw new Error("Nama pihak wajib diisi.");
  if(!(amount>0) || !isFinite(amount)) throw new Error("Nominal harus lebih dari nol.");
  const code="CH-"+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyMMdd")+"-"+Utilities.getUuid().slice(0,8).toUpperCase();
  const now=new Date();
  let proofUrl="";
  if(b.proof && b.proof.data) proofUrl=saveProof_(b.proof,code);
  db_().getSheetByName(APP.sheets.debts).appendRow([
    code, parseDate_(b.date), b.dueDate?parseDate_(b.dueDate):"", type, name, desc,
    amount, amount, "BELUM LUNAS", proofUrl, now, now
  ]);
  return {ok:true,code,record:lookupCode_(code).record};
}
function lookupCode_(code) {
  code=String(code||"").trim().toUpperCase();
  if(!code) return {ok:false,error:"Masukkan kode unik."};
  const sh=db_().getSheetByName(APP.sheets.debts), rows=sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++) if(String(rows[i][0]).toUpperCase()===code) {
    const r=rows[i];
    return {ok:true,record:debtObj_(r),payments:paymentsFor_(code)};
  }
  return {ok:false,error:"Kode transaksi tidak ditemukan."};
}
function pay_(b) {
  const code=String(b.code||"").trim().toUpperCase();
  const amount=Number(b.amount);
  if(!(amount>0)||!isFinite(amount)) throw new Error("Nominal pembayaran harus lebih dari nol.");
  const found=lookupCode_(code);
  if(!found.ok) throw new Error(found.error);
  const rec=found.record;
  if(rec.status==="LUNAS" || rec.remaining<=0) throw new Error("Transaksi ini sudah lunas.");
  if(amount>rec.remaining) throw new Error("Pembayaran melebihi sisa hutang/piutang.");
  let proofUrl="";
  if(b.proof && b.proof.data) proofUrl=saveProof_(b.proof,code);
  const now=new Date(), paymentId="BYR-"+Utilities.getUuid().slice(0,10).toUpperCase();
  db_().getSheetByName(APP.sheets.payments).appendRow([
    paymentId,code,parseDate_(b.date),amount,String(b.note||""),proofUrl,now
  ]);
  const newRemaining=Math.max(0,rec.remaining-amount);
  const sh=db_().getSheetByName(APP.sheets.debts);
  const row=rec._row;
  sh.getRange(row,8).setValue(newRemaining);
  sh.getRange(row,9).setValue(newRemaining===0?"LUNAS":"BELUM LUNAS");
  sh.getRange(row,12).setValue(now);
  return {ok:true,remaining:newRemaining,status:newRemaining===0?"LUNAS":"BELUM LUNAS",proofUrl,paymentId,record:lookupCode_(code).record};
}
function saveProof_(proof,code) {
  const data=String(proof.data||"");
  const mime=String(proof.mimeType||"application/octet-stream");
  const name=String(proof.name||"bukti").replace(/[^\w.-]/g,"_");
  if(data.length>11500000) throw new Error("Ukuran bukti terlalu besar. Maksimal sekitar 8 MB.");
  const bytes=Utilities.base64Decode(data);
  const blob=Utilities.newBlob(bytes,mime,code+"_"+Date.now()+"_"+name);
  const folder=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID"));
  const file=folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  return file.getUrl();
}
function listDebts_(b) {
  const rows=db_().getSheetByName(APP.sheets.debts).getDataRange().getValues();
  const type=String(b.type||"ALL"), q=String(b.query||"").toLowerCase();
  const out=[];
  for(let i=rows.length-1;i>=1;i--) {
    const r=rows[i], o=debtObj_(r);
    if(type!=="ALL"&&o.type!==type) continue;
    if(q && ![o.code,o.name,o.description].join(" ").toLowerCase().includes(q)) continue;
    out.push(o);
  }
  return {ok:true,records:out};
}
function dashboard_() {
  const rows=db_().getSheetByName(APP.sheets.debts).getDataRange().getValues();
  let debt=0,receivable=0,openDebt=0,openReceivable=0;
  const recent=[];
  for(let i=1;i<rows.length;i++) {
    const o=debtObj_(rows[i]);
    if(o.type==="DEBT"){debt+=o.remaining;if(o.remaining>0)openDebt++;}
    else {receivable+=o.remaining;if(o.remaining>0)openReceivable++;}
    if(i>rows.length-8) recent.push(o);
  }
  const payRows=db_().getSheetByName(APP.sheets.payments).getDataRange().getValues();
  let paid=0;for(let i=1;i<payRows.length;i++)paid+=Number(payRows[i][3])||0;
  return {ok:true,summary:{debt,receivable,paid,openDebt,openReceivable,total:debt+receivable},recent:recent.reverse()};
}
function paymentsFor_(code) {
  const rows=db_().getSheetByName(APP.sheets.payments).getDataRange().getValues(),out=[];
  for(let i=1;i<rows.length;i++) if(String(rows[i][1])===code) out.push({
    id:rows[i][0],code:rows[i][1],date:dateOut_(rows[i][2]),amount:Number(rows[i][3])||0,
    note:rows[i][4],proofUrl:rows[i][5]
  });
  return out;
}
function debtObj_(r) {
  return {code:String(r[0]),date:dateOut_(r[1]),dueDate:dateOut_(r[2]),type:String(r[3]),
    name:String(r[4]),description:String(r[5]),amount:Number(r[6])||0,remaining:Number(r[7])||0,
    status:String(r[8]),proofUrl:String(r[9]||""),_row:findDebtRow_(String(r[0]))};
}
function findDebtRow_(code) {
  const sh=db_().getSheetByName(APP.sheets.debts), f=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),1).createTextFinder(code).matchEntireCell(true).findNext();
  return f?f.getRow():0;
}
function parseDate_(s) {
  if(!s) return "";
  const p=String(s).split("-");
  if(p.length!==3) throw new Error("Format tanggal tidak valid.");
  return new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
}
function dateOut_(d) {
  if(!d) return "";
  if(Object.prototype.toString.call(d)==="[object Date]"&&!isNaN(d)) return Utilities.formatDate(d,Session.getScriptTimeZone(),"yyyy-MM-dd");
  return String(d);
}
function ensureSheet_(ss,name,headers) {
  let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);
  if(sh.getLastRow()===0) sh.appendRow(headers);
  else {
    const existing=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getValues()[0];
    headers.forEach((h,i)=>{if(!existing[i])sh.getRange(1,i+1).setValue(h);});
  }
  return sh;
}
function db_() {
  const id=PropertiesService.getScriptProperties().getProperty("DB_ID");
  if(!id) throw new Error("Database belum dibuat. Jalankan setupApp() di Apps Script.");
  return SpreadsheetApp.openById(id);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
