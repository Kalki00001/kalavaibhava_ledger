import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";

const config = window.APP_CONFIG || {};
const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.includes("PASTE_") && !config.SUPABASE_ANON_KEY.includes("PASTE_");
const $ = (id) => document.getElementById(id);
let supabase = null;
let transactions = [];
let currentType = "CREDIT";
let editingId = null;

function money(value) {
  return new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(Number(value || 0));
}
function setMessage(el, message, kind = "") {
  el.textContent = message;
  el.className = `message ${kind}`;
}
function todayLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10);
}
function setType(type) {
  currentType = type;
  $("transactionType").value = type;
  const credit = type === "CREDIT";
  $("creditTab").className = `type-button ${credit ? "active-credit" : ""}`;
  $("debitTab").className = `type-button ${!credit ? "active-debit" : ""}`;
  $("creditTab").setAttribute("aria-pressed", String(credit));
  $("debitTab").setAttribute("aria-pressed", String(!credit));
  $("descriptionLabel").textContent = credit ? "Member name" : "What did you spend on?";
  $("description").placeholder = credit ? "Who gave the money?" : "e.g. Decoration materials";
  if (!editingId) $("saveBtn").textContent = credit ? "Add money received" : "Record money spent";
}
function totalsFor(mode) {
  const received = transactions.filter(t => t.type === "CREDIT" && t.payment_mode === mode).reduce((s,t)=>s+Number(t.amount),0);
  const spent = transactions.filter(t => t.type === "DEBIT" && t.payment_mode === mode).reduce((s,t)=>s+Number(t.amount),0);
  return { received, spent, balance: received-spent };
}
function renderSummary() {
  const received = transactions.filter(t=>t.type==="CREDIT").reduce((s,t)=>s+Number(t.amount),0);
  const spent = transactions.filter(t=>t.type==="DEBIT").reduce((s,t)=>s+Number(t.amount),0);
  const cash = totalsFor("Cash");
  const upi = totalsFor("UPI");
  $("creditValue").textContent = money(received);
  $("debitValue").textContent = money(spent);
  $("balanceValue").textContent = money(received-spent);
  $("cashBalanceValue").textContent = money(cash.balance);
  $("upiBalanceValue").textContent = money(upi.balance);
  $("cashDetail").textContent = `Cash IN ${money(cash.received)} · OUT ${money(cash.spent)}`;
  $("upiDetail").textContent = `UPI IN ${money(upi.received)} · OUT ${money(upi.spent)}`;
}
function renderMemberReport() {
  const groups = new Map();
  for (const t of transactions) {
    if (t.type !== "CREDIT") continue;
    const display = String(t.description || "").trim();
    const key = display.toLocaleLowerCase("en-IN");
    if (!key) continue;
    const current = groups.get(key) || { name:display, total:0, count:0 };
    current.total += Number(t.amount);
    current.count += 1;
    groups.set(key,current);
  }
  const rows = [...groups.values()].sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
  $("memberCount").textContent = `${rows.length} ${rows.length===1?"member":"members"}`;
  const host = $("memberReport");
  host.replaceChildren();
  if (!rows.length) {
    const p=document.createElement("p"); p.className="empty-state"; p.textContent="No contributions recorded yet."; host.append(p); return;
  }
  for (const row of rows) {
    const item=document.createElement("article"); item.className="member-item";
    const main=document.createElement("div"); main.className="member-main";
    const name=document.createElement("div"); name.className="member-name"; name.textContent=row.name;
    const meta=document.createElement("div"); meta.className="member-meta"; meta.textContent=`${row.count} ${row.count===1?"contribution":"contributions"}`;
    main.append(name,meta);
    const total=document.createElement("div"); total.className="member-total"; total.textContent=money(row.total);
    item.append(main,total); host.append(item);
  }
}
function makeActionButton(label, className, handler, aria) {
  const b=document.createElement("button"); b.type="button"; b.className=className; b.textContent=label; b.setAttribute("aria-label",aria); b.addEventListener("click",handler); return b;
}
function renderTransactions() {
  const q=$("searchInput").value.trim().toLocaleLowerCase("en-IN");
  const filter=$("filterType").value;
  const list=transactions.filter(t=>(filter==="ALL"||t.type===filter) && String(t.description).toLocaleLowerCase("en-IN").includes(q));
  const host=$("transactionList"); host.replaceChildren();
  if (!list.length) {
    const p=document.createElement("p"); p.className="empty-state";
    p.textContent=transactions.length?"No matching transactions.":"No transactions yet. Add your first entry above.";
    host.append(p); return;
  }
  for (const t of list) {
    const item=document.createElement("article"); item.className="transaction-item";
    const main=document.createElement("div"); main.className="transaction-main";
    const name=document.createElement("div"); name.className="transaction-name"; name.textContent=t.description;
    const meta=document.createElement("div"); meta.className="transaction-meta";
    meta.textContent=`${t.type==="CREDIT"?"Money IN":"Money OUT"} · ${t.payment_mode} · ${new Date(`${t.transaction_date}T00:00:00`).toLocaleDateString("en-IN")}`;
    main.append(name,meta);
    const right=document.createElement("div"); right.className="transaction-right";
    const amount=document.createElement("div"); amount.className=`transaction-amount ${t.type==="CREDIT"?"credit":"debit"}`;
    amount.textContent=`${t.type==="CREDIT"?"+":"−"}${money(t.amount)}`;
    const actions=document.createElement("div"); actions.className="row-actions";
    actions.append(
      makeActionButton("Edit","small-action",()=>startEdit(t.id),`Edit ${t.description}`),
      makeActionButton("Delete","small-action delete",()=>deleteTransaction(t.id),`Delete ${t.description}`)
    );
    right.append(amount,actions); item.append(main,right); host.append(item);
  }
}
function renderAll() { renderSummary(); renderMemberReport(); renderTransactions(); }
async function loadTransactions() {
  $("transactionList").innerHTML='<p class="empty-state">Loading transactions…</p>';
  const {data,error}=await supabase.from("transactions")
    .select("id,type,description,amount,payment_mode,transaction_date,created_at")
    .order("transaction_date",{ascending:false}).order("created_at",{ascending:false});
  if(error) { $("transactionList").textContent=`Could not load records: ${error.message}`; return; }
  transactions=data||[]; renderAll();
}
function resetForm() {
  editingId=null; $("transactionForm").reset(); $("entryDate").value=todayLocal();
  $("formHeading").textContent="Add transaction"; $("editBadge").classList.add("hidden");
  $("cancelEditBtn").classList.add("hidden"); setType("CREDIT");
  $("saveBtn").textContent="Add money received"; setMessage($("entryMessage"),"");
}
function startEdit(id) {
  const t=transactions.find(x=>x.id===id); if(!t) return;
  editingId=id; setType(t.type);
  $("description").value=t.description; $("amount").value=String(t.amount);
  $("paymentMode").value=t.payment_mode; $("entryDate").value=t.transaction_date;
  $("formHeading").textContent="Edit transaction"; $("editBadge").classList.remove("hidden");
  $("cancelEditBtn").classList.remove("hidden"); $("saveBtn").textContent="Save changes";
  setMessage($("entryMessage"),"Editing an existing record. Save to update it.");
  $("entryPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
async function deleteTransaction(id) {
  const t=transactions.find(x=>x.id===id); if(!t) return;
  const ok=window.confirm(`Delete this transaction?\n\n${t.type==="CREDIT"?"Money IN":"Money OUT"}: ${t.description}\nAmount: ${money(t.amount)}\n\nThis will change your balance and cannot be undone from the website.`);
  if(!ok) return;
  const {error}=await supabase.from("transactions").delete().eq("id",id);
  if(error) { alert(`Could not delete transaction: ${error.message}`); return; }
  if(editingId===id) resetForm();
  await loadTransactions();
}
function exportRows() {
  return transactions.map(t=>({
    Date:t.transaction_date,
    Type:t.type==="CREDIT"?"Money IN":"Money OUT",
    Name_or_Purpose:t.description,
    Amount_INR:Number(t.amount),
    Payment_Mode:t.payment_mode,
    Recorded_At:t.created_at
  }));
}
function downloadJsonBackup() {
  const payload={exported_at:new Date().toISOString(),event:"Kannada Kalavaibhava",format_version:1,transactions};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=`kannada-kalavaibhava-backup-${todayLocal()}.json`; a.click(); URL.revokeObjectURL(url);
}
function exportExcel() {
  const rows=exportRows();
  const received=transactions.filter(t=>t.type==="CREDIT").reduce((s,t)=>s+Number(t.amount),0);
  const spent=transactions.filter(t=>t.type==="DEBIT").reduce((s,t)=>s+Number(t.amount),0);
  const cash=totalsFor("Cash"), upi=totalsFor("UPI");
  const summaryRows=[
    {Metric:"Total received",Amount_INR:received},
    {Metric:"Total spent",Amount_INR:spent},
    {Metric:"Overall balance",Amount_INR:received-spent},
    {Metric:"Cash received",Amount_INR:cash.received},
    {Metric:"Cash spent",Amount_INR:cash.spent},
    {Metric:"Cash balance",Amount_INR:cash.balance},
    {Metric:"UPI received",Amount_INR:upi.received},
    {Metric:"UPI spent",Amount_INR:upi.spent},
    {Metric:"UPI balance",Amount_INR:upi.balance}
  ];
  const memberMap=new Map();
  for(const t of transactions) if(t.type==="CREDIT") {
    const name=String(t.description||"").trim(); const key=name.toLocaleLowerCase("en-IN");
    const item=memberMap.get(key)||{Member:name,Contributions:0,Transactions:0};
    item.Contributions+=Number(t.amount); item.Transactions+=1; memberMap.set(key,item);
  }
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summaryRows),"Summary");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Transactions");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([...memberMap.values()].sort((a,b)=>b.Contributions-a.Contributions)),"Member Report");
  XLSX.writeFile(wb,`Kannada-Kalavaibhava-${todayLocal()}.xlsx`);
}
let bulkType = "CREDIT";
function setBulkType(type) {
  bulkType = type;
  const credit = type === "CREDIT";
  $("bulkCreditTab").className = `type-button ${credit ? "active-credit" : ""}`;
  $("bulkDebitTab").className = `type-button ${!credit ? "active-debit" : ""}`;
  $("bulkCreditTab").setAttribute("aria-pressed", String(credit));
  $("bulkDebitTab").setAttribute("aria-pressed", String(!credit));
  document.querySelectorAll(".bulk-row").forEach(row => {
    const label = row.querySelector(".bulk-description")?.parentElement;
    const input = row.querySelector(".bulk-description");
    if (label && input) {
      label.firstChild.textContent = credit ? "Member name" : "Purpose";
      input.placeholder = credit ? "Member name" : "Expense purpose";
      input.setAttribute("aria-label", credit ? "Member name" : "Expense purpose");
    }
  });
}
function addBulkRow(description = "", amount = "", mode = "") {
  const row = document.createElement("div");
  row.className = "bulk-row";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = bulkType === "CREDIT" ? "Member name" : "Purpose";
  const name = document.createElement("input");
  name.className = "bulk-description"; name.maxLength = 100; name.required = true;
  name.placeholder = bulkType === "CREDIT" ? "Member name" : "Expense purpose";
  name.value = description;
  nameLabel.append(name);
  const amountLabel = document.createElement("label"); amountLabel.textContent = "Amount (₹)";
  const amountInput = document.createElement("input"); amountInput.className = "bulk-amount";
  amountInput.type = "number"; amountInput.min = "0.01"; amountInput.max = "10000000";
  amountInput.step = "0.01"; amountInput.inputMode = "decimal"; amountInput.placeholder = "0";
  amountInput.value = amount; amountLabel.append(amountInput);
  const modeLabel = document.createElement("label"); modeLabel.className = "bulk-mode"; modeLabel.textContent = "Mode";
  const modeSelect = document.createElement("select"); modeSelect.className = "bulk-payment-mode";
  for (const optionValue of ["UPI", "Cash"]) {
    const option = document.createElement("option"); option.value = optionValue; option.textContent = optionValue;
    modeSelect.append(option);
  }
  modeSelect.value = mode || $("bulkDefaultMode").value; modeLabel.append(modeSelect);
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-row";
  remove.textContent = "×"; remove.setAttribute("aria-label", "Remove this row");
  remove.addEventListener("click", () => { if ($("bulkRows").children.length > 1) row.remove(); else { name.value=""; amountInput.value=""; } updateBulkTotal(); });
  amountInput.addEventListener("input", updateBulkTotal);
  row.append(nameLabel, amountLabel, modeLabel, remove);
  $("bulkRows").append(row);
  updateBulkTotal();
}
function updateBulkTotal() {
  const total = [...document.querySelectorAll(".bulk-amount")].reduce((sum, el) => sum + (Number(el.value) || 0), 0);
  $("bulkTotal").textContent = money(total);
}
async function saveBulkEntries() {
  if (!supabase) return;
  const rows = [...document.querySelectorAll("#bulkRows .bulk-row")];
  const payload = [];
  for (let i = 0; i < rows.length; i++) {
    const description = rows[i].querySelector(".bulk-description").value.trim();
    const amount = Number(rows[i].querySelector(".bulk-amount").value);
    const payment_mode = rows[i].querySelector(".bulk-payment-mode").value;
    if (!description && !rows[i].querySelector(".bulk-amount").value) continue;
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      setMessage($("bulkMessage"), `Please complete the name/purpose and a valid amount in row ${i + 1}.`, "error");
      return;
    }
    payload.push({ type: bulkType, description, amount, payment_mode, transaction_date: $("bulkDate").value || todayLocal() });
  }
  if (!payload.length) { setMessage($("bulkMessage"), "Add at least one complete entry first.", "error"); return; }
  const button = $("saveBulkBtn"); button.disabled = true;
  setMessage($("bulkMessage"), `Saving ${payload.length} entries…`);
  const { error } = await supabase.from("transactions").insert(payload);
  button.disabled = false;
  if (error) { setMessage($("bulkMessage"), `Nothing was confirmed saved. Please check the error: ${error.message}`, "error"); return; }
  $("bulkRows").replaceChildren(); addBulkRow();
  setMessage($("bulkMessage"), `${payload.length} ${bulkType === "CREDIT" ? "contributions" : "expenses"} saved successfully.`, "success");
  await loadTransactions();
}

async function showSession(session) {
  const signedIn=Boolean(session);
  $("authPanel").classList.toggle("hidden",signedIn);
  $("cashbookPanel").classList.toggle("hidden",!signedIn);
  $("signOutBtn").classList.toggle("hidden",!signedIn);
  if(signedIn) await loadTransactions();
}
async function init() {
  $("entryDate").value=todayLocal(); setType("CREDIT");
  if(!configured) {
    $("setupNotice").classList.remove("hidden");
    $("authForm").querySelectorAll("input,button").forEach(el=>el.disabled=true);
    return;
  }
  supabase=createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY);
  const {data:{session}}=await supabase.auth.getSession();
  await showSession(session);
  supabase.auth.onAuthStateChange((_event,session)=>{ setTimeout(()=>showSession(session),0); });
}
$("creditTab").addEventListener("click",()=>setType("CREDIT"));
$("debitTab").addEventListener("click",()=>setType("DEBIT"));
$("cancelEditBtn").addEventListener("click",resetForm);
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!supabase)return;
  setMessage($("authMessage"),"Signing in…");
  const {error}=await supabase.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  setMessage($("authMessage"),error?error.message:"Signed in.",error?"error":"success");
});
$("signUpBtn").addEventListener("click",async()=>{
  if(!supabase)return;
  setMessage($("authMessage"),"Creating account…");
  const {data,error}=await supabase.auth.signUp({email:$("email").value.trim(),password:$("password").value});
  if(error)setMessage($("authMessage"),error.message,"error");
  else if(!data.session)setMessage($("authMessage"),"Account created. Check your email to confirm, then sign in.","success");
  else setMessage($("authMessage"),"Account created. You can start recording transactions.","success");
});
$("signOutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();transactions=[];renderAll();});
$("transactionForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!supabase)return;
  const description=$("description").value.trim(); const amount=Number($("amount").value);
  if(!description||!Number.isFinite(amount)||amount<=0){setMessage($("entryMessage"),"Enter a name/purpose and a valid amount.","error");return;}
  const payload={type:currentType,description,amount,payment_mode:$("paymentMode").value,transaction_date:$("entryDate").value||todayLocal()};
  $("saveBtn").disabled=true; setMessage($("entryMessage"),editingId?"Updating record…":"Saving transaction…");
  const wasEditing = Boolean(editingId);
  const result=wasEditing
    ? await supabase.from("transactions").update(payload).eq("id",editingId)
    : await supabase.from("transactions").insert(payload);
  $("saveBtn").disabled=false;
  if(result.error){setMessage($("entryMessage"),`Not saved: ${result.error.message}`,"error");return;}
  resetForm(); setMessage($("entryMessage"),wasEditing?"Transaction updated.":"Transaction saved.","success");
  await loadTransactions();
});
$("refreshBtn").addEventListener("click",loadTransactions);
$("searchInput").addEventListener("input",renderTransactions);
$("filterType").addEventListener("change",renderTransactions);
$("exportExcelBtn").addEventListener("click",exportExcel);
$("backupJsonBtn").addEventListener("click",downloadJsonBackup);

$("bulkCreditTab").addEventListener("click", () => setBulkType("CREDIT"));
$("bulkDebitTab").addEventListener("click", () => setBulkType("DEBIT"));
$("addBulkRowBtn").addEventListener("click", () => addBulkRow());
$("saveBulkBtn").addEventListener("click", saveBulkEntries);

init();
addBulkRow();
$("bulkDate").value = todayLocal();
if("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
