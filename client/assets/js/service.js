import { CONFIG } from './config.js';

// Función auxiliar: recupera el token del almacén del navegador
function getAuthHeaders() {
    const token = localStorage.getItem('pe_hub_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

export async function createEvent(payload) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/events/create`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        // [Probable] Interceptar el 401: El token caducó o es falso.
        if (response.status === 401) {
            localStorage.removeItem('pe_hub_token');
            window.location.reload();
            throw new Error('Sesión expirada');
        }

        if (!response.ok) throw new Error("Error en la petición al backend");

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating event:', error);
        throw error;
    }
}

export async function deleteEvent(eventId, deleteAll) {
    try {
        const suffix = deleteAll ? '-all' : '';
        const response = await fetch(`${CONFIG.API_URL}/api/events/delete${suffix}/${eventId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            localStorage.removeItem('pe_hub_token');
            window.location.reload();
            throw new Error('Sesión expirada');
        }
        if (!response.ok) throw new Error("Error en la petición al backend");
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
    }
}

export async function getEvents(from, until) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/events?fromdate=${from}&untildate=${until}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            localStorage.removeItem('pe_hub_token');
            window.location.reload();
            throw new Error('Sesión expirada');
        }
        if (!response.ok) throw new Error("Error en la petición al backend");
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
    }
}

export async function voteEvent(eventId, canAttend) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/events/${eventId}/vote`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ can_attend: canAttend })
        });

        if (response.status === 401) {
            localStorage.removeItem('pe_hub_token');
            window.location.reload();
            throw new Error('Sesión expirada');
        }

        if (!response.ok) throw new Error("Error registrando el voto");

        return await response.json();
    } catch (error) {
        console.error('Error al votar:', error);
        throw error;
    }
}

export async function updateEvent(eventId, payload, updateAll = false) {
    try {
        const suffix = updateAll ? '-all' : '';
        const response = await fetch(`${CONFIG.API_URL}/api/events/update${suffix}/${eventId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            localStorage.removeItem('pe_hub_token');
            window.location.reload();
            throw new Error('Sesión expirada');
        }

        if (!response.ok) throw new Error("Error en la petición al backend");
        return await response.json();
    } catch (error) {
        console.error('Error updating event:', error);
        throw error;
    }
}

export async function createAlbum(payload) {
    const response = await fetch(`${CONFIG.API_URL}/api/albums/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Error creando álbum");
    return await response.json();
}

export async function updateAlbum(albumId, payload) {
    const response = await fetch(`${CONFIG.API_URL}/api/albums/update/${albumId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Error actualizando álbum");
    return await response.json();
}

export async function deleteAlbum(albumId) {
    const response = await fetch(`${CONFIG.API_URL}/api/albums/delete/${albumId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error eliminando álbum");
    return await response.json();
}

export async function getAlbums() {
    const response = await fetch(`${CONFIG.API_URL}/api/albums`, {
        method: 'GET',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error obteniendo álbumes");
    return await response.json();
}

export async function createSong(payload) {
    const response = await fetch(`${CONFIG.API_URL}/api/songs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Error creando canción");
    return await response.json();
}

export async function getSongsByAlbum(albumId) {
    const response = await fetch(`${CONFIG.API_URL}/api/songs/album/${albumId}`, {
        method: 'GET',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error obteniendo canciones");
    return await response.json();
}

export async function updateSong(songId, payload) {
    const response = await fetch(`${CONFIG.API_URL}/api/songs/${songId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Error actualizando canción");
    return await response.json();
}

export async function deleteSong(songId) {
    console.log("EYEYEYEYEYEY")
    const response = await fetch(`${CONFIG.API_URL}/api/songs/${songId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error eliminando canción");
    return await response.json();
}

export async function createSection(payload) {
    const response = await fetch(`${CONFIG.API_URL}/api/sections`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Error creando sección");
    return await response.json();
}

export async function updateSection(sectionId, payload) {
    console.log("PAYLOAD:",payload)
    const response = await fetch(`${CONFIG.API_URL}/api/sections/${sectionId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Error actualizando sección");
    return await response.json();
}

export async function deleteSection(sectionId) {
    const response = await fetch(`${CONFIG.API_URL}/api/sections/${sectionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error eliminando sección");
    return await response.json();
}

export async function getAlbumSongsDetailed(albumId) {
    const response = await fetch(`${CONFIG.API_URL}/api/albums/${albumId}/songs`, {
        method: 'GET',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error obteniendo el detalle de las canciones");
    return await response.json();
}

export async function getSectionsForSong(songId) {
    const response = await fetch(`${CONFIG.API_URL}/api/sections/song/${songId}`, {
        method: 'GET',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error obteniendo las secciones de la canción");
    return await response.json();
}

// 1. Sube el archivo físico y devuelve la URL local
export async function uploadRecordingFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${CONFIG.API_URL}/api/recordings/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('pe_hub_token')}`
            // NOTA: NO envíes 'Content-Type': 'application/json' ni 'multipart/form-data'. 
            // El navegador debe calcular el boundary automáticamente al usar FormData.
        },
        body: formData
    });

    if (!response.ok) throw new Error("Error subiendo el archivo al servidor");
    return await response.json();
}

// 2. Crea el registro en PostgreSQL
export async function createRecording(payload) {
    const response = await fetch(`${CONFIG.API_URL}/api/recordings`, {
        method: 'POST',
        headers: getAuthHeaders(), // Utiliza la función que ya tienes en service.js
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error("Error guardando el registro de la grabación");
    return await response.json();
}