import { CONFIG } from "./config.js";

export function initializeLogin() {
    const form = document.getElementById('login-form');
    const errorMsg = document.getElementById('login-error');
    const btnSubmit = document.getElementById('btn-login');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const memberId = document.querySelector('input[name="memberId"]:checked').value;
        const password = document.getElementById('band-password').value;

        btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> COMPROBANDO...`;
        btnSubmit.disabled = true;
        errorMsg.classList.add('d-none');

        try {
            const response = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    member_id: parseInt(memberId),
                    password: password
                })
            });

            if (!response.ok) throw new Error("Credenciales inválidas");

            const data = await response.json();

            localStorage.setItem('pe_hub_token', data.access_token);
            localStorage.setItem('pe_member_name', data.member_name);
            localStorage.setItem('pe_member_id', memberId); 

            window.location.reload();

        } catch (error) {
            errorMsg.classList.remove('d-none');
            btnSubmit.innerHTML = `ACCEDER <i class="bi bi-arrow-right ms-2"></i>`;
            btnSubmit.disabled = false;
        }
    });
}