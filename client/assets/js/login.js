import { CONFIG } from "./config.js";

export function initializeLogin() {
    const form = document.getElementById('login-form');
    const errorMsg = document.getElementById('login-error');
    const btnSubmit = document.getElementById('btn-login');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const memberId = document.querySelector('input[name="memberId"]:checked').value;
        const password = document.getElementById('band-password').value;
        const memberName = document.querySelector(`input[name="memberId"]:checked`).dataset.name || memberId;

        // Estado de carga
        btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> COMPROBANDO...`;
        btnSubmit.disabled = true;
        errorMsg.classList.add('d-none');

        try {
            const response = await fetch(`${CONFIG.API_URL}/api/auth/verify`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Member-Id': memberId,
                    'X-Band-Pass': password
                }
            });

            if (!response.ok) {
                throw new Error("Credenciales inválidas");
            }

            // Si pasa el portero, guardamos las llaves en el navegador
            localStorage.setItem('pe_member_id', memberId);
            localStorage.setItem('pe_member_name', memberName);
            localStorage.setItem('pe_band_pass', password);

            // Recargamos la aplicación completa para que el main.js inyecte todo
            window.location.reload();

        } catch (error) {
            errorMsg.classList.remove('d-none');
            btnSubmit.innerHTML = `ACCEDER <i class="bi bi-arrow-right ms-2"></i>`;
            btnSubmit.disabled = false;
        }
    });
}