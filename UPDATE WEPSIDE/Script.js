/* CONFIG */
const firebaseConfig = {
    apiKey: "AIzaSyAaigk1DTs7rHRSMGGAjnZ9DjeUc9s9AKI",
    authDomain: "ajayacademyonline.firebaseapp.com",
    projectId: "ajayacademyonline",
    storageBucket: "ajayacademyonline.firebasestorage.app",
    messagingSenderId: "178607233248",
    appId: "1:178607233248:web:e94ff41b8b259917061885",
    measurementId: "G-B2MBPVFWTH"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

/* DATA */
const DATA = {
    "SSC": { color:"c-ssc", icon:"fa-briefcase", subjects:["Maths", "Reasoning", "English", "GS"] },
    "Computer Science": { color:"c-cs", icon:"fa-laptop-code", subjects:["Python","javascript", "Java", "C++", "DSA"] },
    "GATE": { color:"c-gate", icon:"fa-cogs", subjects:["CS & IT", "Mechanical", "Electrical", "Civil"] },
    "NEET": { color:"c-neet", icon:"fa-user-md", subjects:["Physics", "Chemistry", "Botany", "Zoology"] },
    "JEE": { color:"c-jee", icon:"fa-atom", subjects:["Physics", "Maths", "Chemistry"] },
    "UPSC": { color:"c-upsc", icon:"fa-landmark", subjects:["History", "Polity", "Geography"] }
};

let currentUser="", isAdmin=false, currentCat="", currentSub="", currentSec="", currentLang="";
let examQuestions=[], userResponses=[], currentQIndex=0, timerInterval, pendingExamData=null;
let globalDataMap = {}; 
let isPracticeMode = false;
let currentPlaylist = [], currentPlayIndex = 0;

// TOAST SYSTEM
function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('hidden');
    setTimeout(() => { t.classList.add('hidden'); }, 3300);
}

/* INIT */
window.onload = function() { 
    const u = localStorage.getItem("ajay_user"); 
    const r = localStorage.getItem("ajay_role"); 
    if(u && r) startApp(u, r === 'admin', true); 
    
    // BACK BUTTON LOGIC
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = function() {
        if(!document.getElementById('tool-view').classList.contains('hidden')){ closeTool(true); }
        else if(!document.getElementById('search-view').classList.contains('hidden')){ closeSearch(true); }
        else if(!document.getElementById('player-view').classList.contains('hidden')){ closePlayer(); }
        else if(!document.getElementById('quiz-view').classList.contains('hidden')){ if(confirm("Exit Exam?")) closeQuiz(); else window.history.pushState(null, null, window.location.href); }
        else if(!document.getElementById('list-view').classList.contains('hidden')){ showMed(); }
        else if(!document.getElementById('medium-view').classList.contains('hidden')){ goBackFromMedium(); }
        else if(!document.getElementById('section-view').classList.contains('hidden')){ showSub(); }
        else if(!document.getElementById('sub-view').classList.contains('hidden')){ showCat(); }
    };
};

/* SMART EMBED (VIDEO & PDF) */
function getVideoEmbed(url, type) {
    if(!url) return "";
    
    // In-App PDF Viewer (Google Docs Viewer / Native Iframe)
    if(type === 'Notes' || url.endsWith('.pdf')) {
        document.getElementById('player-wrapper').classList.add('pdf-mode');
        return `<iframe src="${url}#toolbar=0" style="width:100%; height:100%; border:none;" allowfullscreen></iframe>`;
    }

    document.getElementById('player-wrapper').classList.remove('pdf-mode');

    // YouTube
    if(url.includes("youtu")) {
        let id = "";
        if (url.includes("v=")) id = url.split("v=")[1].split("&")[0];
        else if (url.includes("youtu.be/")) id = url.split("youtu.be/")[1].split("?")[0];
        return `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    }
    // Direct Video (MP4 / Drive)
    if(url.endsWith(".mp4") || url.includes("drive.google")) {
        return `<video src="${url}" controls autoplay style="width:100%; height:100%; background:black;"></video>`;
    }
    // Fallback
    return `<div style="color:white;text-align:center;padding:50px;"><h3>External Content</h3><a href="${url}" target="_blank" class="btn-grad">Open Link</a></div>`;
}

/* AUTH & ADMIN */
function toggleAuth(m){document.getElementById('login-form').classList.toggle('hidden',m!=='login');document.getElementById('reg-form').classList.toggle('hidden',m!=='reg');}
function register(){const u=document.getElementById('r-user').value,p=document.getElementById('r-pass').value; if(u&&p) db.collection("users").doc(u).set({username:u,password:p,isPremium:false}).then(()=>{showToast("Account Created!");toggleAuth('login');});}
function login(){ const u=document.getElementById('l-user').value, p=document.getElementById('l-pass').value; if(u==="Ajay" && p==="12345"){ localStorage.setItem("ajay_user","Ajay"); localStorage.setItem("ajay_role","admin"); startApp("Ajay",true,true); return; } db.collection("users").doc(u).get().then(d=>{ if(d.exists && d.data().password===p){localStorage.setItem("ajay_user",u); localStorage.setItem("ajay_role","student"); startApp(u,false,d.data().isPremium);} else showToast("Invalid Credentials!"); }); }
function startApp(n,a,p){ currentUser=n; isAdmin=a; document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('dashboard').classList.remove('hidden'); if(a)document.getElementById('admin-panel').classList.remove('hidden'); renderCategories(); }
function logout(){ localStorage.removeItem("ajay_user"); localStorage.removeItem("ajay_role"); location.reload(); } // clear() hata diya taaki NEET Attendance ka data delete na ho

/* ADMIN UPLOADS */
function loadAdminSubjects(){const c=document.getElementById('u-cat').value, s=document.getElementById('u-sub');s.innerHTML='<option value="">Subject...</option>';if(c&&DATA[c])DATA[c].subjects.forEach(x=>s.innerHTML+=`<option value="${x}">${x}</option>`);}
function toggleAdminInputs(){
    const sec = document.getElementById('u-sec').value; 
    const isQ = (sec === 'Mock' || sec === 'PYQ' || sec === 'FullTest'); 
    document.getElementById('video-inputs').classList.toggle('hidden', isQ); 
    document.getElementById('quiz-inputs').classList.toggle('hidden', !isQ);
    
    // Change Placeholder JSON text to help admin
    if(isQ) document.getElementById('json-format-hint').innerText = `[{"q":"Question?","a":"Opt A","b":"Opt B","c":"Opt C","d":"Opt D","ans":"a","expl":"Solution"}]`;
    else document.getElementById('json-format-hint').innerText = `[{"title":"Lec 1", "link":"vid_or_pdf_url"}]`;
}

// Single Upload
function uploadContent(){ 
    const c=document.getElementById('u-cat').value, s=document.getElementById('u-sub').value, se=document.getElementById('u-sec').value, ch=document.getElementById('u-chap').value, lg=document.getElementById('u-lang').value; 
    if(!c||!s||!se||!ch) return showToast("Please fill Goal, Subject, Type, and Chapter!"); 
    const d = { cat:c, sub:s, sec:se, chap:ch, lang:lg, order:Date.now() }; 
    if(se==='Mock'||se==='PYQ'||se==='FullTest'){ 
        d.q=document.getElementById('q-text').value; d.a=document.getElementById('opt-a').value; d.b=document.getElementById('opt-b').value; d.c=document.getElementById('opt-c').value; d.d=document.getElementById('opt-d').value; d.ans=document.getElementById('q-ans').value; d.expl=document.getElementById('q-expl').value; d.title="Question"; 
    } else { 
        d.title=document.getElementById('u-title').value; d.link=document.getElementById('u-link').value; d.notes=document.getElementById('u-notes').value; d.dpp=document.getElementById('u-dpp').value; 
    } 
    db.collection("content").add(d).then(()=>{ showToast("Content Uploaded!"); if(currentCat===c && currentSub===s) openFinalList(lg); }); 
}

// Fixed Bulk Upload (Supports Mock & Video)
async function uploadBulk(){ 
    const c=document.getElementById('u-cat').value, s=document.getElementById('u-sub').value, se=document.getElementById('u-sec').value, ch=document.getElementById('u-chap').value, lg=document.getElementById('u-lang').value, txt=document.getElementById('bulk-text').value; 
    if(!txt || !c || !s || !se || !ch) return showToast("Fill all upper fields & Paste JSON!"); 
    
    try { 
        const arr = JSON.parse(txt); 
        const batch = db.batch(); 
        arr.forEach((i, idx) => { 
            const r = db.collection("content").doc(); 
            let docData = { cat:c, sub:s, sec:se, chap:ch, lang:lg, order: idx };
            if(se==='Mock' || se==='PYQ' || se==='FullTest'){
                docData = { ...docData, q:i.q, a:i.a, b:i.b, c:i.c, d:i.d, ans:i.ans, expl:i.expl||"", title:"Question" };
            } else {
                docData = { ...docData, title:i.title||"Item", link:i.link||"", notes:i.notes||"", dpp:i.dpp||"" };
            }
            batch.set(r, docData); 
        }); 
        await batch.commit(); 
        showToast("Bulk JSON Uploaded Successfully!"); 
        if(currentCat===c && currentSub===s) openFinalList(lg); 
    } catch(e){ showToast("JSON Error: " + e.message); } 
}

// 🔴 NEW: YOUTUBE PLAYLIST FETCHER
async function fetchAndUploadPlaylist() {
    const c=document.getElementById('u-cat').value, s=document.getElementById('u-sub').value, se=document.getElementById('u-sec').value, ch=document.getElementById('u-chap').value, lg=document.getElementById('u-lang').value;
    const pUrl = document.getElementById('yt-playlist-url').value;
    const apiKey = document.getElementById('yt-api-key').value;

    if(!c || !s || !se || !ch || !pUrl || !apiKey) return showToast("Fill all upper fields, Playlist URL, and API Key!");

    // Extract Playlist ID from URL
    let playlistId = pUrl;
    if (pUrl.includes('list=')) { playlistId = pUrl.split('list=')[1].split('&')[0]; }

    try {
        showToast("Fetching playlist from YouTube...");
        const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}`);
        const data = await response.json();
        
        if(data.error) throw new Error(data.error.message);
        if(!data.items || data.items.length === 0) throw new Error("No videos found in playlist.");

        const batch = db.batch();
        data.items.forEach((item, idx) => {
            const videoId = item.snippet.resourceId.videoId;
            const r = db.collection("content").doc();
            batch.set(r, {
                cat: c, sub: s, sec: se, chap: ch, lang: lg,
                title: item.snippet.title,
                link: `https://www.youtube.com/watch?v=${videoId}`,
                notes: "", dpp: "", order: idx
            });
        });

        await batch.commit();
        showToast(`Success! ${data.items.length} Videos Uploaded 🚀`);
        if(currentCat===c && currentSub===s) openFinalList(lg);
        
    } catch(err) {
        showToast("API Error: " + err.message);
    }
}

async function deleteChapter(chapterName, event) { event.stopPropagation(); if(!confirm(`Delete ALL in "${chapterName}"?`)) return; const snap = await db.collection("content").where("cat","==",currentCat).where("sub","==",currentSub).where("sec","==",currentSec).where("chap","==",chapterName).get(); const batch = db.batch(); snap.docs.forEach(d=>batch.delete(d.ref)); await batch.commit(); showToast("Deleted successfully!"); openFinalList(currentLang); }

/* NAVIGATION */
function hideAll(){ ['cat-view','sub-view','section-view','medium-view','list-view','player-view','quiz-view','result-view','setup-view','search-view','tool-view'].forEach(x=>document.getElementById(x).classList.add('hidden')); }
function renderCategories(){ hideAll(); document.getElementById('cat-view').classList.remove('hidden'); const g=document.getElementById('cat-grid'); g.innerHTML=""; for(let k in DATA)g.innerHTML+=`<div class='card ${DATA[k].color}' onclick='openSub("${k}")'><i class='fas ${DATA[k].icon}'></i><h3>${k}</h3></div>`; g.innerHTML+=`<div class='card c-neetatt' onclick='openTool()' style='border-top:5px solid #0ea5e9'><i class='fas fa-user-check'></i><h3>NEET Attendance</h3><p>Daily Study Mentor</p></div>`; }
function openSub(k){ currentCat=k; hideAll(); document.getElementById('sub-view').classList.remove('hidden'); const g=document.getElementById('sub-grid'); g.innerHTML=""; g.innerHTML += `<div class='card c-full' onclick='openSec("FullTest")' style='border-top:5px solid #EF4444'><i class='fas fa-clipboard-check'></i><h3>Full Syllabus Test</h3></div>`; DATA[k].subjects.forEach(s=>g.innerHTML+=`<div class='card' style='border-top:5px solid #5B4DFF' onclick='openSec("${s}")'><h3>${s}</h3></div>`); g.innerHTML+=`<div class='card c-att' onclick='openTool("${k}")' style='border-top:5px solid #0ea5e9'><i class='fas fa-user-check'></i><h3>Attendance & Mentor</h3><p>${k} Study Tracker</p></div>`; window.history.pushState(null, null, window.location.href); }
function openSec(s){ currentSub=s; hideAll(); document.getElementById('section-view').classList.remove('hidden'); window.history.pushState(null, null, window.location.href); }
function selectMedium(s){ currentSec=s; hideAll(); document.getElementById('medium-view').classList.remove('hidden'); window.history.pushState(null, null, window.location.href); }
function goBackFromMedium(){ if(currentSub === "FullTest") openSub(currentCat); else showSec(); }
function goBack() { window.history.back(); }

function openFinalList(lang){ 
    currentLang=lang; hideAll(); document.getElementById('list-view').classList.remove('hidden'); document.getElementById('list-head').innerText=`${currentSec} (${lang})`; 
    window.history.pushState(null, null, window.location.href);
    let qSec = currentSec, qSub = currentSub;
    if(currentSub === "FullTest") { qSec = "Mock"; } 
    globalDataMap={}; 
    db.collection("content").where("cat","==",currentCat).where("sub","==",qSub).get().then(snap=>{ 
        const g=document.getElementById('pl-grid'); g.innerHTML=""; const map={}; 
        snap.forEach(doc=>{ const d=doc.data(); let l=d.lang||"English"; if(d.sec===qSec && l===currentLang){ if(!map[d.chap])map[d.chap]=[]; map[d.chap].push(d); } }); 
        
        // Sort items inside map by order
        for(let k in map) { map[k].sort((a,b) => (a.order||0) - (b.order||0)); }
        
        globalDataMap=map; 
        if(Object.keys(map).length===0){ g.innerHTML="<p style='text-align:center; padding:20px; color:#666;'>No content added yet.</p>"; return; } 
        for(let c in map){ 
            let ico='fa-play-circle', css=`type-${qSec}`; 
            if(qSec==='Mock'){ico='fa-clock';} if(qSec==='PYQ'){ico='fa-check-double';} if(qSec==='Notes'){ico='fa-file-pdf';}
            let delBtn = isAdmin ? `<div class="del-btn-floating" onclick="deleteChapter('${c}', event)"><i class="fas fa-trash-alt"></i></div>` : ''; 
            g.innerHTML+=`<div class='yt-card ${css}' onclick='handleC("${c}")'>${delBtn}<div class='yt-icon'><i class='fas ${ico}'></i></div><div class='yt-info'><div class='yt-title'>${c}</div><div class='yt-meta'>${map[c].length} Items</div></div></div>`; 
        } 
    }); 
}

window.handleC=(c)=>{ 
    const items = globalDataMap[c]; 
    if(!items || items.length === 0) { showToast("No items found."); return; }
    if(currentSub === "FullTest") { isPracticeMode=false; startExam(items, 180); } 
    else if(currentSec==='Mock') { isPracticeMode=false; openTestSetup(items); } 
    else if(currentSec==='PYQ') { isPracticeMode=true; startPractice(items); } 
    else openPlayer(items, 0); // Video & Notes both use the player now
};
function showCat(){renderCategories();} function showSub(){openSub(currentCat);} function showSec(){openSec(currentSub);} function showMed(){selectMedium(currentSec);}

/* EXAM ENGINE */
function openTestSetup(data){ pendingExamData = data; document.getElementById('setup-view').classList.remove('hidden'); }
function startExamWithTime(m){ document.getElementById('setup-view').classList.add('hidden'); startExam(pendingExamData, m); }
function closeSetup(){ document.getElementById('setup-view').classList.add('hidden'); }
function startExam(q, m){ 
    if(!q || q.length===0){ showToast("No questions available!"); return; }
    examQuestions = q; userResponses = new Array(q.length).fill().map(() => ({ status: 'not-visited', selected: null })); currentQIndex = 0; 
    hideAll(); document.getElementById('quiz-view').classList.remove('hidden'); document.getElementById('btn-submit').classList.remove('hidden'); document.getElementById('btn-exit').classList.add('hidden'); document.getElementById('timer-area').classList.remove('hidden');
    window.history.pushState(null, null, window.location.href); startTimer(m * 60); loadQuestion(0); updatePalette(); 
}
function startPractice(q){ 
    if(!q || q.length===0){ showToast("No questions available!"); return; }
    examQuestions = q; userResponses = new Array(q.length).fill().map(() => ({ status: 'not-visited', selected: null })); currentQIndex = 0; 
    hideAll(); document.getElementById('quiz-view').classList.remove('hidden'); document.getElementById('btn-submit').classList.add('hidden'); document.getElementById('btn-exit').classList.remove('hidden'); document.getElementById('timer-area').classList.add('hidden');
    window.history.pushState(null, null, window.location.href); loadQuestion(0); 
}
function startTimer(d){
    let t = d; clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        let m = parseInt(t / 60, 10), s = parseInt(t % 60, 10), h = parseInt(m / 60, 10); m = m % 60;
        document.getElementById('quiz-timer').innerText = `${h}:${m<10?'0'+m:m}:${s<10?'0'+s:s}`;
        if (--t < 0) submitExam();
    }, 1000);
}
function loadQuestion(i){ 
    currentQIndex = i; const q = examQuestions[i]; 
    document.getElementById('current-q-num').innerText = i + 1; 
    document.getElementById('q-display').innerText = q.q; 
    document.getElementById('practice-expl').classList.add('hidden'); 
    ['a','b','c','d'].forEach(o => { 
        const row = document.getElementById(`opt-row-${o}`); document.getElementById(`txt-${o}`).innerText = q[o] || ""; 
        row.className = "opt-row"; row.style.pointerEvents = "auto"; 
    }); 
    if(!isPracticeMode){ 
        if(userResponses[i].status === 'not-visited') { userResponses[i].status = 'not-ans'; updatePalette(); }
        if(userResponses[i].selected) document.getElementById(`opt-row-${userResponses[i].selected}`).classList.add('selected'); 
    } else if(userResponses[i].selected){ handleOptionClick(userResponses[i].selected); } 
}
function handleOptionClick(opt){
    const q = examQuestions[currentQIndex];
    if(!isPracticeMode){ 
        ['a','b','c','d'].forEach(x=>document.getElementById(`opt-row-${x}`).classList.remove('selected'));
        document.getElementById(`opt-row-${opt}`).classList.add('selected'); 
        userResponses[currentQIndex].selected = opt; userResponses[currentQIndex].status = 'answered'; updatePalette(); return; 
    }
    userResponses[currentQIndex].selected = opt; const correctOpt = q.ans.toLowerCase();
    ['a','b','c','d'].forEach(x=>document.getElementById(`opt-row-${x}`).style.pointerEvents="none");
    if(opt === correctOpt){ document.getElementById(`opt-row-${opt}`).style.background = "#D1FAE5"; document.getElementById(`opt-row-${opt}`).style.border = "1px solid #10B981"; } 
    else { document.getElementById(`opt-row-${opt}`).style.background = "#FEE2E2"; document.getElementById(`opt-row-${opt}`).style.border = "1px solid #EF4444"; document.getElementById(`opt-row-${correctOpt}`).style.background = "#D1FAE5"; document.getElementById(`opt-row-${correctOpt}`).style.border = "1px solid #10B981"; }
    document.getElementById('practice-expl').classList.remove('hidden');
    document.getElementById('ans-label').innerText = `(${correctOpt.toUpperCase()})`; 
    document.getElementById('p-expl-text').innerText = q.expl || "No explanation attached.";
}
function saveAndNext(){ 
    if(!isPracticeMode){ if(userResponses[currentQIndex].selected) userResponses[currentQIndex].status='answered'; else if(userResponses[currentQIndex].status !== 'review') userResponses[currentQIndex].status='not-ans'; updatePalette(); } 
    if(currentQIndex < examQuestions.length - 1) loadQuestion(currentQIndex + 1); 
}
function clearResponse(){ if(isPracticeMode) return; userResponses[currentQIndex].selected = null; userResponses[currentQIndex].status = 'not-ans'; loadQuestion(currentQIndex); updatePalette(); }
function submitExam(){ 
    clearInterval(timerInterval); if(!confirm("Submit Exam?")) return; 
    let s=0, c=0, w=0, html=""; 
    examQuestions.forEach((q,i)=>{
        const u = userResponses[i].selected; 
        let st="gray", txt="Skipped", col="#6b7280";
        if(u){
            txt = u.toUpperCase();
            if(u.toLowerCase() === q.ans.toLowerCase()){ s+=4; c++; st="#dcfce7"; col="#15803d"; }
            else{ s-=1; w++; st="#fee2e2"; col="#b91c1c"; }
        } 
        html+=`<div class='sol-item' style='background:${st}'><b>Q${i+1}:</b> ${q.q}<br><br>You: <b style='color:${col}'>${txt}</b> | Correct: <b style='color:#15803d'>${q.ans.toUpperCase()}</b><br><small>${q.expl||""}</small></div>`;
    }); 
    hideAll(); document.getElementById('result-view').classList.remove('hidden'); 
    document.getElementById('res-score').innerText = s; document.getElementById('res-correct').innerText = c; document.getElementById('res-wrong').innerText = w; 
    document.getElementById('solution-list').innerHTML = html; 
}
function updatePalette(){ 
    const g = document.getElementById('palette-grid'); g.innerHTML = ""; 
    userResponses.forEach((r,i)=>{
        const b = document.createElement('button'); b.className = `pal-btn ${r.status}`;
        if(i === currentQIndex) b.classList.add('current');
        b.innerText = i + 1; b.onclick = () => loadQuestion(i); g.appendChild(b);
    }); 
}
function closeQuiz(){ hideAll(); document.getElementById('list-view').classList.remove('hidden'); }

/* NEW PLAYER (SUPPORTS EMBEDDED PDF & VIDEO) */
function openPlayer(items, index){ 
    currentPlaylist = items; currentPlayIndex = index; let item = items[index];
    hideAll(); document.getElementById('player-view').classList.remove('hidden'); 
    
    // Inject the PDF or Video
    const viewUrl = item.sec === 'Notes' ? (item.link || item.notes) : item.link;
    document.getElementById('video-frame').innerHTML = getVideoEmbed(viewUrl, item.sec);
    document.getElementById('v-title').innerText = item.title;
    
    // Resource Buttons (Hide if viewing Notes directly)
    document.getElementById('btn-notes').style.display = (item.notes && item.sec !== 'Notes') ? 'flex' : 'none';
    document.getElementById('btn-dpp').style.display = item.dpp ? 'flex' : 'none';
    document.getElementById('btn-next-vid').style.display = (index < items.length - 1) ? 'flex' : 'none';

    // Build side Playlist
    const pList = document.getElementById('playlist-list'); pList.innerHTML = "";
    items.forEach((it, idx) => {
        let activeClass = idx === index ? 'active' : '';
        let icon = it.sec === 'Notes' ? 'fa-file-pdf' : (idx === index ? 'fa-play' : 'fa-play-circle');
        pList.innerHTML += `<div class="pl-item ${activeClass}" onclick='openPlayer(currentPlaylist, ${idx})'><div class="pl-index">${idx + 1}</div><div class="pl-info"><h4>${it.title}</h4></div><div class="pl-icon"><i class="fas ${icon}"></i></div></div>`;
    });
}

function openResource(type){
    let item = currentPlaylist[currentPlayIndex];
    if(type === 'notes' && item.notes) window.open(item.notes, '_blank');
    if(type === 'dpp' && item.dpp) window.open(item.dpp, '_blank');
}

function playNextVideo(){
    if(currentPlayIndex < currentPlaylist.length - 1) openPlayer(currentPlaylist, currentPlayIndex + 1);
    else showToast("You have finished this chapter!");
}

function closePlayer(){ hideAll(); document.getElementById('list-view').classList.remove('hidden'); document.getElementById('video-frame').innerHTML=""; }

/* =========================================================
   NEET ATTENDANCE TOOL (NEET_ATTENDENCE.html as-it-is)
   ========================================================= */
function openTool(exam){
    const ex = (typeof exam === 'string' && exam) ? exam : 'NEET';
    const src = (ex === 'NEET') ? 'NEET_ATTENDENCE.html' : 'EXAM_MENTOR.html?exam=' + encodeURIComponent(ex);
    const f = document.getElementById('tool-frame');
    if(f.getAttribute('src') !== src) f.setAttribute('src', src);   // same exam dobara kholne par timer chalta rehta hai
    document.getElementById('tool-title').innerText = ex + ' Attendance & Mentor';
    document.getElementById('tool-newtab').setAttribute('href', src);
    document.getElementById('tool-view').classList.remove('hidden');
    window.history.pushState(null, null, window.location.href);
}
function closeTool(fromBack){
    document.getElementById('tool-view').classList.add('hidden');
}

/* =========================================================
   GLOBAL SEARCH
   ========================================================= */
const SEC_INFO = {
    Lecture: { label:"Lectures", icon:"fa-chalkboard-teacher", words:"lecture lectures class classes video videos batch course" },
    Notes:   { label:"Notes Only", icon:"fa-file-pdf", words:"notes note pdf library" },
    Mock:    { label:"Mock Test", icon:"fa-clock", words:"mock mocktest test tests exam nta timed" },
    PYQ:     { label:"PYQ Bank", icon:"fa-check-double", words:"pyq pyqs previous year question questions practice bank" },
    OneShot: { label:"OneShot", icon:"fa-fire", words:"oneshot one shot marathon revision" }
};
let searchCache = null, searchCacheTime = 0, searchLoading = null;

function normS(t){ return (t==null?"":String(t)).toLowerCase().replace(/[^a-z0-9\u0900-\u097f+#&\s]/g," ").replace(/\s+/g," ").trim(); }
function escS(t){ return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function invalidateSearchCache(){ searchCache = null; searchCacheTime = 0; }

// Upload/delete ke baad search data refresh ho (purana code same hai, bas wrap kiya)
['uploadContent','uploadBulk','fetchAndUploadPlaylist','deleteChapter'].forEach(fn=>{
    const orig = window[fn];
    if(typeof orig !== 'function') return;
    window[fn] = function(){ invalidateSearchCache(); const r = orig.apply(this, arguments); setTimeout(invalidateSearchCache, 4000); return r; };
});

function openSearch(){
    const v = document.getElementById('search-view');
    const wasHidden = v.classList.contains('hidden');
    v.classList.remove('hidden');
    if(wasHidden) window.history.pushState(null, null, window.location.href);
    setTimeout(()=>document.getElementById('search-input').focus(), 50);
    renderSearchChips();
    runSearch();
}
function closeSearch(fromBack){
    document.getElementById('search-view').classList.add('hidden');
}
function clearSearch(){
    const i = document.getElementById('search-input'); i.value = ""; i.focus(); runSearch();
}
function setSearch(t){
    document.getElementById('search-input').value = t; runSearch();
}
function renderSearchChips(){
    const c = document.getElementById('search-chips');
    if(c.dataset.ready) return;
    c.dataset.ready = "1";
    const chips = Object.keys(DATA).concat(["Mock Test","Lectures","PYQ","Notes","OneShot","Hindi","English","Full Syllabus Test","NEET Attendance"]);
    c.innerHTML = chips.map(x=>`<button type="button" class="s-chip" data-q="${escS(x)}">${escS(x)}</button>`).join("");
    c.querySelectorAll('.s-chip').forEach(b=>b.onclick=()=>setSearch(b.dataset.q));
}

function loadSearchData(){
    if(searchCache && (Date.now()-searchCacheTime) < 120000) return Promise.resolve();
    if(searchLoading) return searchLoading;
    searchLoading = db.collection("content").get().then(snap=>{
        const arr = []; snap.forEach(d=>arr.push(d.data()));
        searchCache = arr; searchCacheTime = Date.now();
    }).catch(e=>{
        searchCache = searchCache || [];
        showToast("Search load error: " + e.message);
    }).then(()=>{ searchLoading = null; });
    return searchLoading;
}

function buildSearchIndex(){
    const groups = {};
    (searchCache||[]).forEach(d=>{
        const lang = d.lang || "English";
        const key = [d.cat,d.sub,d.sec,lang,d.chap].join("||");
        if(!groups[key]) groups[key] = { type:"chapter", cat:d.cat, sub:d.sub, sec:d.sec, lang:lang, chap:d.chap, items:[] };
        groups[key].items.push(d);
    });
    const list = [];
    Object.values(groups).forEach(g=>{
        g.items.sort((a,b)=>(a.order||0)-(b.order||0));
        const isQ = (g.sec==='Mock'||g.sec==='PYQ'||g.sec==='FullTest');
        const secKey = (g.sub==="FullTest") ? "Mock" : g.sec;
        const info = SEC_INFO[secKey] || {label:g.sec, icon:"fa-folder", words:""};
        const subName = g.sub==="FullTest" ? "Full Syllabus Test full test syllabus" : g.sub;
        let hay = [g.cat, subName, info.label, info.words, g.sec, g.lang, (g.lang==="Hindi"?"hindi medium":"english medium"), g.chap].join(" ");
        hay += " " + g.items.map(i=>i.title||"").join(" ");
        if(isQ) hay += " " + g.items.map(i=>i.q||"").join(" ");
        g.isQ = isQ; g.info = info; g.hay = normS(hay);
        g.chapNorm = normS(g.chap);
        g.titlesNorm = g.items.map(i=>normS(i.title||""));
        list.push(g);
    });
    Object.keys(DATA).forEach(k=>{
        list.push({ type:"exam", cat:k, icon:DATA[k].icon, hay:normS(k+" exam goal "+DATA[k].subjects.join(" ")) });
        DATA[k].subjects.forEach(sb=>list.push({ type:"subject", cat:k, sub:sb, hay:normS(k+" "+sb+" subject") }));
        list.push({ type:"fulltest", cat:k, hay:normS(k+" full syllabus test full test mock exam") });
    });
    list.push({ type:"tool", hay:normS("neet attendance attendence tracker daily study mentor timetable schedule roadmap revision tests planner 2027 ai mentor tool") });
    return list;
}

function runSearch(){
    const inp = document.getElementById('search-input');
    document.getElementById('search-clear').classList.toggle('hidden', !inp.value);
    const out = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    if(!searchCache){
        status.innerText = "Loading content...";
        loadSearchData().then(()=>runSearch());
        return;
    }
    // cache purana ho gaya ho to peeche se refresh
    if((Date.now()-searchCacheTime) >= 120000) loadSearchData().then(()=>{ if(!document.getElementById('search-view').classList.contains('hidden')) runSearch(); });

    const q = normS(inp.value);
    const index = buildSearchIndex();
    const toks = q ? q.split(" ").filter(Boolean) : [];
    let res = [];
    if(!toks.length){
        res = index.map(x=>({x, score:0}));
        const order = {tool:0, exam:1, subject:2, fulltest:3, chapter:4};
        res.sort((a,b)=>order[a.x.type]-order[b.x.type]);
        status.innerText = "Sab kuch yahan hai - type karke filter karein";
    } else {
        index.forEach(x=>{
            let score = 0;
            for(const t of toks){
                if(!x.hay.includes(t)){ score = -1; break; }
                score += 1;
                if(x.type==="chapter" && x.chapNorm.includes(t)) score += 3;
                if(x.type==="chapter" && x.titlesNorm.some(tt=>tt.includes(t))) score += 2;
                if(x.type==="exam" && normS(x.cat)===t) score += 5;
                if(x.type==="subject" && normS(x.sub)===t) score += 4;
            }
            if(score>0) res.push({x, score});
        });
        res.sort((a,b)=>b.score-a.score);
        status.innerText = res.length ? (res.length + " result mile") : "";
    }
    const shown = res.slice(0, 100);
    window._searchList = shown.map(r=>r.x);
    if(!shown.length){
        out.innerHTML = `<div class="s-empty"><i class="fas fa-search"></i><p>"${escS(inp.value)}" ke liye kuch nahi mila</p><small>Dusra word try karein, jaise: ssc, mock, physics, hindi</small></div>`;
        return;
    }
    const hl = (t)=>{
        let e = escS(t);
        toks.forEach(k=>{ const safe = k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); e = e.replace(new RegExp("("+safe+")","ig"), "<mark>$1</mark>"); });
        return e;
    };
    out.innerHTML = window._searchList.map((x,i)=>{
        if(x.type==="tool") return `<div class="s-card s-tool" onclick="searchGo(${i})"><div class="s-ico"><i class="fas fa-user-check"></i></div><div class="s-info"><div class="s-title">NEET Attendance</div><div class="s-meta">Daily study mentor &bull; Tool</div></div><span class="s-tag">TOOL</span></div>`;
        if(x.type==="exam") return `<div class="s-card" onclick="searchGo(${i})"><div class="s-ico"><i class="fas ${x.icon}"></i></div><div class="s-info"><div class="s-title">${hl(x.cat)}</div><div class="s-meta">Exam / Goal</div></div><span class="s-tag">EXAM</span></div>`;
        if(x.type==="subject") return `<div class="s-card" onclick="searchGo(${i})"><div class="s-ico"><i class="fas fa-book"></i></div><div class="s-info"><div class="s-title">${hl(x.sub)}</div><div class="s-meta">${hl(x.cat)} &bull; Subject</div></div><span class="s-tag">SUBJECT</span></div>`;
        if(x.type==="fulltest") return `<div class="s-card" onclick="searchGo(${i})"><div class="s-ico"><i class="fas fa-clipboard-check"></i></div><div class="s-info"><div class="s-title">${hl(x.cat)} Full Syllabus Test</div><div class="s-meta">Mock tests</div></div><span class="s-tag">FULL TEST</span></div>`;
        const subShown = x.sub==="FullTest" ? "Full Syllabus Test" : x.sub;
        let matchLines = "";
        if(!x.isQ && toks.length){
            const hits = [];
            x.items.forEach((it,ix)=>{ const tn = normS(it.title||""); if(toks.some(t=>tn.includes(t))) hits.push(ix); });
            matchLines = hits.slice(0,3).map(ix=>`<div class="s-sub" onclick="event.stopPropagation(); searchGo(${i}, ${ix})"><i class="fas fa-play-circle"></i> ${hl(x.items[ix].title||"Item")}</div>`).join("");
        }
        const count = x.isQ ? (x.items.length + " Questions") : (x.items.length + " Items");
        return `<div class="s-card" onclick="searchGo(${i})"><div class="s-ico"><i class="fas ${x.info.icon}"></i></div><div class="s-info"><div class="s-title">${hl(x.chap)}</div><div class="s-meta">${hl(x.cat)} &bull; ${hl(subShown)} &bull; ${hl(x.info.label)} &bull; ${hl(x.lang)} &bull; ${count}</div>${matchLines}</div><span class="s-tag">${escS(x.info.label.toUpperCase())}</span></div>`;
    }).join("");
}

function searchGo(i, itemIdx){
    const x = (window._searchList||[])[i];
    if(!x) return;
    if(x.type==="tool"){ openTool(); return; }
    if(x.type==="exam"){ openSub(x.cat); return; }
    if(x.type==="subject"){ openSub(x.cat); openSec(x.sub); return; }
    if(x.type==="fulltest"){ openSub(x.cat); openSec("FullTest"); return; }
    currentCat = x.cat; currentSub = x.sub; currentLang = x.lang;
    currentSec = (x.sub==="FullTest") ? "Mock" : x.sec;
    openFinalList(x.lang);                       // back dabane par list par wapas aayega
    globalDataMap = {}; globalDataMap[x.chap] = x.items;
    if(typeof itemIdx === "number" && !x.isQ) openPlayer(x.items, itemIdx);
    else handleC(x.chap);
}