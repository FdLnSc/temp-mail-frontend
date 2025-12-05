// --- KONFIGURASI ---
// Pastikan URL ini sesuai dengan Worker kamu!
const WORKER_URL = "https://tempmaildb.m-fadlanapalah123.workers.dev"; 
const DOMAIN = "fdlnstore.web.id";

let currentUser = "";
let refreshTimer = null;
let countdown = 10; // Detik refresh

// 1. SAAT WEBSITE DIBUKA
window.onload = () => {
    // Cek URL: apakah membuka fdlnstore.web.id/budi ?
    const path = window.location.pathname.replace("/", ""); 
    
    if (path && path !== "index.html") {
        currentUser = path;
        document.getElementById("usernameInput").value = currentUser;
        
        // Langsung cek inbox & jalankan timer
        checkInbox(); 
        startAutoRefresh();
    } else {
        // Jika halaman depan polos, buat acak
        generateRandom();
    }
};

// 2. GENERATE RANDOM
function generateRandom() {
    const randomName = Math.random().toString(36).substring(2, 8); // misal "x9k2m1"
    document.getElementById("usernameInput").value = randomName;
    openCustomEmail();
}

// 3. BUKA EMAIL CUSTOM (Pindah URL tanpa refresh)
function openCustomEmail() {
    const inputName = document.getElementById("usernameInput").value.trim();
    if (!inputName) return alert("Nama email tidak boleh kosong!");
    
    // Hanya izinkan huruf, angka, titik, strip
    const cleanName = inputName.replace(/[^a-zA-Z0-9.-]/g, ""); 
    
    currentUser = cleanName;
    document.getElementById("usernameInput").value = currentUser;

    // Ubah URL di Browser (Permalink)
    window.history.pushState({}, "", `/${currentUser}`);
    
    // Reset tampilan inbox jadi loading
    document.getElementById("emailList").innerHTML = `<div class="spinner"></div>`;
    
    checkInbox();      
    startAutoRefresh(); 
}

// 4. AUTO REFRESH LOGIC
function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    
    countdown = 10;
    updateTimerUI();

    refreshTimer = setInterval(() => {
        countdown--;
        updateTimerUI();

        if (countdown <= 0) {
            checkInbox(true); // Silent refresh (tanpa loading spinner)
            countdown = 10;
        }
    }, 1000);
}

function updateTimerUI() {
    const timerEl = document.getElementById("timerText");
    if(timerEl) timerEl.innerText = `Auto-refresh: ${countdown}s`;
}

// 5. FETCH DATA DARI WORKER
async function checkInbox(isAuto = false) {
    if(!currentUser) return;

    document.getElementById("inboxTitle").innerText = `Inbox: ${currentUser}`;
    const listDiv = document.getElementById("emailList");
    
    // Tampilkan spinner hanya kalau bukan auto-refresh
    if (!isAuto) {
        listDiv.innerHTML = `<div class="spinner"></div><p style="text-align:center">Memuat pesan...</p>`;
    }

    try {
        const response = await fetch(`${WORKER_URL}/api/inbox?user=${currentUser}`);
        const emails = await response.json();

        // Silent Refresh: Jika data kosong saat auto-refresh, jangan hapus tampilan lama
        if (isAuto && (!emails || emails.length === 0)) {
             if (listDiv.innerHTML.includes("spinner")) {
                 listDiv.innerHTML = `<div class="empty-state"><p>Belum ada pesan untuk <b>${currentUser}</b></p></div>`;
             }
             return;
        }

        if (emails.length === 0) {
            listDiv.innerHTML = `<div class="empty-state"><p>Belum ada pesan untuk <b>${currentUser}</b></p></div>`;
            return;
        }

        // Render Email
        listDiv.innerHTML = ""; 
        emails.forEach(email => {
            const item = document.createElement("div");
            item.className = "email-item";
            item.onclick = () => showEmailDetail(email);
            
            // Highlight OTP di Subject
            const subjectHTML = email.subject.includes("KODE:") 
                ? `<span style="color:#dc2626; font-weight:bold">${email.subject}</span>` 
                : email.subject;

            item.innerHTML = `
                <div class="email-top">
                    <span><i class="fa-regular fa-envelope"></i> ${email.from}</span> 
                    <span>${email.date}</span>
                </div>
                <div class="email-subject">${subjectHTML}</div>
                <div class="email-snippet">${email.snippet}...</div>
            `;
            listDiv.appendChild(item);
        });

    } catch (e) {
        console.error(e);
        if (!isAuto) listDiv.innerHTML = `<p style="color:red; text-align:center">Gagal terhubung ke server.</p>`;
    }
}

// 6. MODAL DETAIL PESAN
function showEmailDetail(email) {
    document.getElementById("modalSubject").innerText = email.subject;
    document.getElementById("modalFrom").innerText = email.from;
    document.getElementById("modalDate").innerText = email.date;
    document.getElementById("modalBody").innerText = email.body || "(Isi pesan kosong)";
    
    document.getElementById("emailModal").style.display = "block";
}

function closeModal() {
    document.getElementById("emailModal").style.display = "none";
}

window.onclick = function(event) {
    const modal = document.getElementById("emailModal");
    if (event.target == modal) modal.style.display = "none";
}

// 7. UTILS: COPY EMAIL & URL
function copyEmailAddress() {
    const user = document.getElementById("usernameInput").value;
    if (!user) return alert("Nama email belum ada!");
    
    const fullEmail = `${user}@${DOMAIN}`;
    navigator.clipboard.writeText(fullEmail);
    alert(`Email disalin: ${fullEmail}`);
}

function copyFullUrl() {
    navigator.clipboard.writeText(window.location.href);
    alert("Link halaman berhasil disalin!");
}