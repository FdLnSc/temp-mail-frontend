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
        const data = await response.json();
        const emails = normalizeEmails(data);

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
    const modalBody = document.getElementById("modalBody");

    const renderBody = (htmlBody, textBody) => {
        if (htmlBody) {
            modalBody.innerHTML = DOMPurify.sanitize(htmlBody);
        } else if (textBody) {
            modalBody.innerText = textBody;
        } else {
            modalBody.innerText = "(Isi pesan kosong)";
        }
    };

    const htmlBody = getHtmlBody(email);
    const textBody = getTextBody(email);

    if (htmlBody || textBody) {
        renderBody(htmlBody, textBody);
    } else if (email.id) {
        modalBody.innerHTML = `<div class="spinner"></div><p style="text-align:center">Memuat isi pesan...</p>`;
        fetchEmailDetail(email.id)
            .then(detail => {
                const merged = { ...email, ...detail };
                renderBody(getHtmlBody(merged), getTextBody(merged));
            })
            .catch(() => {
                modalBody.innerText = "Isi pesan tidak tersedia dari server.";
            });
    } else {
        modalBody.innerText = "(Isi pesan kosong)";
    }
    
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

// Helpers: cari body di berbagai field yang mungkin dikirim worker
function decodeBase64Url(str = "") {
    try {
        const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = atob(normalized);
        // Ubah ke UTF-8 aman
        return decodeURIComponent(escape(decoded));
    } catch (e) {
        return "";
    }
}

function getHtmlBody(email = {}) {
    const direct = email.bodyHtml || email.html || email.body_html;
    if (direct) return direct;

    const encoded = email.bodyHtmlBase64 || email.htmlBase64 || email.body_html_base64 || email.rawHtml;
    if (encoded) return decodeBase64Url(encoded);

    // Kadang body dikirim di field "body" tapi masih HTML
    if (email.body && typeof email.body === "string" && email.body.includes("<")) return email.body;

    return "";
}

function getTextBody(email = {}) {
    const direct = email.bodyText || email.text || email.body_text;
    if (direct) return direct;

    const encoded = email.bodyTextBase64 || email.textBase64 || email.body_text_base64 || email.rawText;
    if (encoded) return decodeBase64Url(encoded);

    // Fallback: body biasa
    if (email.body) return email.body;
    if (email.snippet) return email.snippet;

    return "";
}

function normalizeEmails(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.value)) return data.value; // beberapa API membungkus di "value"
    return [];
}

async function fetchEmailDetail(id) {
    const res = await fetch(`${WORKER_URL}/api/email?id=${id}&user=${currentUser}`);
    if (!res.ok) throw new Error("Gagal ambil detail");
    const json = await res.json();
    return json;
}
// Helpers: cari body di berbagai field yang mungkin dikirim worker
function decodeBase64Url(str = "") {
    try {
        const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = atob(normalized);
        // Ubah ke UTF-8 aman
        return decodeURIComponent(escape(decoded));
    } catch (e) {
        return "";
    }
}

function getHtmlBody(email = {}) {
    const direct = email.bodyHtml || email.html || email.body_html;
    if (direct) return direct;

    const encoded = email.bodyHtmlBase64 || email.htmlBase64 || email.body_html_base64 || email.rawHtml;
    if (encoded) return decodeBase64Url(encoded);

    // Kadang body dikirim di field "body" tapi masih HTML
    if (email.body && email.body.includes("<")) return email.body;

    return "";
}

function getTextBody(email = {}) {
    const direct = email.bodyText || email.text || email.body_text;
    if (direct) return direct;

    const encoded = email.bodyTextBase64 || email.textBase64 || email.body_text_base64 || email.rawText;
    if (encoded) return decodeBase64Url(encoded);

    // Fallback: body biasa
    if (email.body) return email.body;
    if (email.snippet) return email.snippet;

    return "";
}
