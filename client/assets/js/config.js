// Detectamos el entorno automáticamente
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const CONFIG = {
    API_URL: isLocalhost 
        ? 'http://127.0.0.1:8001' 
        : 'https://api.tudominio.com' 
};