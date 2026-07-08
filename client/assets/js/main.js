document.addEventListener("DOMContentLoaded", async () => {
    checkAuthAndLoad();
});

function checkAuthAndLoad() {
    const memberId = localStorage.getItem('pe_member_id');
    const bandToken = localStorage.getItem('pe_hub_token');

    const sidebar = document.getElementById('sidebar-container');
    const header = document.querySelector('header');

    if (!memberId || !bandToken) {
        // Bloquear UI principal
        sidebar.classList.add('d-none');
        header.classList.add('d-none');
        loadPage('login.html', 'Acceso al Laboratorio');
    } else {
        // Desbloquear UI principal
        sidebar.classList.remove('d-none');
        header.classList.remove('d-none');
        loadSidebar();
        loadPage('calendar.html', 'Calendario');
    }
}

async function loadPage(pageName, title) {
    const contentArea = document.getElementById('content');
    
    try {
        contentArea.classList.remove('page-fade-in');
        
        const response = await fetch(`pages/${pageName}`);
        if (!response.ok) throw new Error('Módulo no disponible de momento.');
        
        const html = await response.text();
        contentArea.innerHTML = html;
        
        void contentArea.offsetWidth; 
        contentArea.classList.add('page-fade-in');
        
        // 🚨 AQUÍ ESTÁ LA MAGIA: Añadimos el if del login junto al resto
        if (pageName === 'login.html') {
            const { initializeLogin } = await import('./login.js');
            initializeLogin();
        }
        else if (pageName === 'calendar.html') {
            document.getElementById('page-title').innerHTML = `<i class="bi bi-calendar-week-fill me-2 text-info"></i> Agenda Perfect Entropy`;
            const { initializeCalendar } = await import('./calendar.js');
            initializeCalendar();
        }
        else if (pageName === 'concept.html') {
            document.getElementById('page-title').innerHTML = `<i class="bi bi-lightbulb-fill me-2 text-info"></i> Conceptos`;
            const { initializeConcept } = await import('./concept.js');
            initializeConcept();
        }
        else if (pageName === 'music.html') {
            document.getElementById('page-title').innerHTML = `<i class="bi bi-music-note-beamed me-2 text-info"></i> Nuestra música`;
            const { initializeMusic } = await import('./music.js');
            initializeMusic();
        }
        else if (pageName === 'social.html') {
            document.getElementById('page-title').innerHTML = `<i class="bi bi-people-fill me-2 text-info"></i> Redes Sociales`;
            const { initializeSocial } = await import('./social.js');
            initializeSocial();
        }
    } catch (error) {
        contentArea.innerHTML = `
            <div class="d-flex justify-content-center align-items-center h-100">
                <div class="text-center p-5 card">
                    <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3"></i>
                    <p class="text-secondary">${error.message}</p>
                </div>
            </div>
        `;
    }
}

async function loadSidebar() {
    const response = await fetch('components/sidebar.html');
    const html = await response.text();
    const container = document.getElementById('sidebar-container');
    container.innerHTML = html;

    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        container.classList.toggle('expanded');
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('pe_member_id');
        localStorage.removeItem('pe_band_pass');
        localStorage.removeItem('pe_member_name');
        window.location.reload();
    });

    document.getElementById('user-name').textContent = `${localStorage.getItem('pe_member_name') || 'Miembro'}`;

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            loadPage(link.getAttribute('data-page'), link.getAttribute('data-title'));
        });
    });
}
