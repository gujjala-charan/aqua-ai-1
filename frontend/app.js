const API_BASE = 'http://127.0.0.1:8080';

// Global State
let dbPonds = [];

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const target = e.currentTarget.getAttribute('data-view');
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${target}`).classList.add('active');
        
        const titles = {
            'dashboard': 'Farm Dashboard',
            'ponds': 'Pond Management',
            'ai': 'AI Deep Scan Diagnostic',
            'copilot': 'Farm Copilot Interface'
        };
        document.getElementById('page-title').innerText = titles[target];
    });
});

// --- App Init & Health Check ---
window.addEventListener('DOMContentLoaded', async () => {
    await checkApiStatus();
    setInterval(checkApiStatus, 10000); // Check every 10s
});

async function checkApiStatus() {
    const light = document.getElementById('api-status-light');
    const text = document.getElementById('api-status-text');
    try {
        const res = await fetch(`${API_BASE}/ponds/`);
        if (res.ok) {
            light.classList.add('online');
            text.innerText = "System Online";
            dbPonds = await res.json();
            updateDashboard();
            updatePondTable();
            updateAiDropdown();
        } else {
            throw new Error("Bad Response");
        }
    } catch(err) {
        light.classList.remove('online');
        text.innerText = "Backend Offline (Port 8080)";
        document.getElementById('dashboard-ponds').innerText = "ERROR";
    }
}

// --- Dashboard ---
async function updateDashboard() {
    document.getElementById('dash-ponds').innerText = dbPonds.length;
    
    const totalFish = dbPonds.reduce((acc, p) => acc + p.fish_count, 0);
    document.getElementById('dash-fish').innerText = totalFish.toLocaleString();
    
    // Fetch mock AI dashboard metrics
    try {
        const res = await fetch(`${API_BASE}/ai/dashboard`);
        const data = await res.json();
        document.getElementById('dash-biomass').innerText = data.total_biomass_kg.toLocaleString();
    } catch(err) {}
}

// --- Ponds Management ---
function updatePondTable() {
    const tbody = document.getElementById('pond-table-body');
    if (dbPonds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No ponds configured yet.</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    dbPonds.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td>#${p.id}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.species}</td>
                <td>${p.fish_count.toLocaleString()}</td>
                <td>
                    <button class="btn btn-danger" onclick="deletePond(${p.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

document.getElementById('add-pond-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('p-name').value,
        species: document.getElementById('p-species').value,
        fish_count: parseInt(document.getElementById('p-count').value)
    };
    
    try {
        await fetch(`${API_BASE}/ponds/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        closeModal('addPondModal');
        e.target.reset();
        await checkApiStatus(); // Refresh data
    } catch (err) {
        alert("Failed to save pond. Is the backend running?");
    }
});

async function deletePond(id) {
    if(confirm("Delete this pond?")) {
        try {
            await fetch(`${API_BASE}/ponds/${id}`, { method: 'DELETE' });
            await checkApiStatus();
        } catch(err) {
            alert("Error deleting pond.");
        }
    }
}

// --- AI Diagnostic View ---
function updateAiDropdown() {
    const select = document.getElementById('ai-pond-select');
    select.innerHTML = '<option value="" disabled selected>Select a pond...</option>';
    dbPonds.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name} (${p.species})</option>`;
    });
}

document.getElementById('ai-scan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pondId = document.getElementById('ai-pond-select').value;
    if(!pondId) return alert("Please select a pond.");
    
    const panel = document.getElementById('ai-result-panel');
    panel.style.display = 'block';
    
    document.getElementById('res-status').innerText = "Scanning...";
    document.getElementById('res-status').className = "badge";
    
    try {
        const res = await fetch(`${API_BASE}/ai/analyze?pond_id=${pondId}`, { method: 'POST' });
        const data = await res.json();
        
        document.getElementById('res-ph').innerText = `pH: ${data.ph}`;
        document.getElementById('res-temp').innerText = `Temp: ${data.temperature} °C`;
        document.getElementById('res-harvest').innerText = `${data.growth_prediction_days_to_harvest} Days left`;
        document.getElementById('res-feed').innerText = `${data.feed_recommendation_kg} kg`;
        document.getElementById('res-disease').innerText = data.disease_detected;
        
        const statusBadge = document.getElementById('res-status');
        statusBadge.innerText = data.water_quality;
        statusBadge.className = data.water_quality === 'Optimal' ? "badge badge-success" : "badge";
        statusBadge.style.backgroundColor = data.water_quality === 'Optimal' ? "var(--green)" : "var(--red)";
        
        const notesObj = document.getElementById('res-notes');
        if (data.notes && data.water_quality !== 'Optimal') {
            notesObj.innerText = `WARNING: ${data.notes}`;
            notesObj.style.display = 'block';
        } else {
            notesObj.style.display = 'none';
        }
        
    } catch(err) {
        document.getElementById('res-status').innerText = "API Error";
        document.getElementById('res-status').className = "badge";
        document.getElementById('res-status').style.backgroundColor = "var(--red)";
    }
});

// --- Chat Copilot ---
const chatHistory = document.getElementById('chat-history');
document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const query = input.value;
    if(!query) return;
    
    appendMessage('user', query);
    input.value = '';
    
    const typingId = appendMessage('ai', '<i class="fa-solid fa-spinner fa-spin"></i> Processing request...');
    
    try {
        // Query param usage because we wrote main.py to accept `query: str`
        const res = await fetch(`${API_BASE}/ai/chat?query=${encodeURIComponent(query)}`, { method: 'POST' });
        const data = await res.json();
        
        document.getElementById(typingId).innerHTML = data.reply;
    } catch(err) {
        document.getElementById(typingId).innerHTML = "Error reaching AI servers. Backend may be offline.";
    }
});

function appendMessage(role, text) {
    const id = 'msg-' + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `<div class="bubble" id="${id}">${text}</div>`;
    
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return id;
}

// --- Modals ---
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
