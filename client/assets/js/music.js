import { CONFIG } from "./config.js"; 
// FIX 1: Añadidos deleteAlbum, createSong y updateSong que faltaban en el import
import { createAlbum, createSong, deleteAlbum, deleteSong, getAlbums, getSongsByAlbum, updateAlbum, updateSong } from "./service.js";

export const initializeMusic = async () => {
    // --- 1. ESTADO GLOBAL ---
    const state = {
        albums: [],
        currentAlbumId: null,
        songs: [],
        currentSongId: null
    };

    // --- 2. NODOS DEL DOM ---
    const DOM = {
        albumList: document.getElementById('album-list'),
        songList: document.getElementById('song-list'),
        songDetails: document.getElementById('song-details'),
        btnAddSong: document.getElementById('btn-add-song'),
        detailTitle: document.getElementById('detail-title')
    };

    // --- 3. INICIALIZACIÓN DE MODALES ---
    // ALBUMES
    const albumModalEl = document.getElementById('modalAlbum');
    if (albumModalEl.parentNode !== document.body) {
        document.body.appendChild(albumModalEl);
    }
    const albumModal = new bootstrap.Modal(albumModalEl);

    const deleteAlbumModalEl = document.getElementById('confirmDeleteAlbum');
    if (!document.body.contains(deleteAlbumModalEl)) {
        document.body.appendChild(deleteAlbumModalEl);
    }
    const deleteAlbumModal = new bootstrap.Modal(deleteAlbumModalEl);

    // CANCIONES
    const songModalEl = document.getElementById('modalSong');
    if (songModalEl.parentNode !== document.body) {
        document.body.appendChild(songModalEl);
    }
    const songModal = new bootstrap.Modal(songModalEl);

    const deleteSongModalEl = document.getElementById('confirmDeleteSong');
    if (!document.body.contains(deleteSongModalEl)) {
        document.body.appendChild(deleteSongModalEl);
    }
    const deleteSongModal = new bootstrap.Modal(deleteSongModalEl);

    // --- 4. RENDERIZADORES ---
    const renderAlbums = () => {
        DOM.albumList.innerHTML = '<div class="list-group list-group-flush">' + 
            state.albums.map(a => {
                const isActive = a.id === state.currentAlbumId;
                return `
                <div class="list-group-item list-group-item-action bg-transparent text-light border-secondary py-3 album-item d-flex justify-content-between align-items-center ${isActive ? 'active bg-info bg-opacity-10 border-start border-1 border-info' : ''}" data-id="${a.id}">
                    
                    <div class="cursor-pointer flex-grow-1 select-album-zone">
                        <div class="fw-bold">${a.title}</div>
                        <small class="text-secondary text-truncate d-block" style="max-width: 200px;">${a.description || 'Sin descripción'}</small>
                    </div>

                    <button class="btn btn-sm btn-link text-info p-0 edit-album-trigger" title="Editar Configuración">
                        <i class="bi bi-gear-fill"></i>
                    </button>
                    
                </div>`;
            }).join('') + '</div>';
    };

    const renderSongs = () => {
        if (!state.currentAlbumId) return;
        
        DOM.songList.innerHTML = state.songs.length === 0 
            ? '<div class="text-center text-secondary mt-3 small">No hay canciones todavía</div>'
            : state.songs.map(s => `
                <div class="card bg-dark border-secondary mb-2 song-item cursor-pointer ${s.id === state.currentSongId ? 'border-light' : ''}" data-id="${s.id}">
                    <div class="card-body p-2 d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-bold text-light">${s.title}</div>
                            <span class="badge bg-secondary" style="font-size: 10px;">${s.status}</span>
                        </div>
                        <button class="btn btn-sm btn-link text-info p-0 edit-song-trigger" title="Editar Configuración">
                            <i class="bi bi-gear-fill"></i>
                        </button>
                    </div>
                </div>
            `).join('');
    };

    const renderSongDetails = () => {
        const song = state.songs.find(s => s.id === state.currentSongId);
        if (!song) return;

        DOM.detailTitle.innerHTML = `<i class="bi bi-music-note-beamed me-2"></i>${song.title}`;
        
        DOM.songDetails.innerHTML = `
            <div class="mb-4">
                <p class="text-light small">${song.description || ''}</p>
            </div>
            
            <div class="d-flex justify-content-between align-items-center border-bottom border-secondary pb-2 mb-3">
                <h6 class="text-light mb-0">Estructura</h6>
                <button class="btn btn-sm btn-outline-warning rounded-pill" style="font-size: 10px;">+ Sección</button>
            </div>
            
            <div class="accordion accordion-flush" id="sectionsAccordion">
                ${(song.sections || []).map((sec) => `
                    <div class="accordion-item bg-transparent border-secondary">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed bg-dark text-light border-secondary p-2" type="button" data-bs-toggle="collapse" data-bs-target="#sec-${sec.id}">
                                <span class="badge bg-dark border border-secondary text-secondary me-2">${sec.type}</span> 
                                <span class="ms-auto small text-secondary">${sec.bpm ? sec.bpm + ' BPM' : ''}</span>
                            </button>
                        </h2>
                        <div id="sec-${sec.id}" class="accordion-collapse collapse" data-bs-parent="#sectionsAccordion">
                            <div class="accordion-body text-light small">
                                ${sec.chords ? `<div class="mb-2"><strong class="text-info">Acordes:</strong> <span class="font-monospace">${sec.chords}</span></div>` : ''}
                                ${sec.lyrics ? `<div><strong class="text-info">Letra:</strong><br><pre class="text-light" style="white-space: pre-wrap; font-family: inherit;">${sec.lyrics}</pre></div>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    // --- 5. LÓGICA DE MODALES ---
    const openAlbumModal = (album = null) => {
        const form = document.getElementById('album-form');
        form.reset();

        const deleteTrigger = document.getElementById('btn-delete-album-trigger');
        const titleEl = document.getElementById('album-modal-title');

        if (album) {
            titleEl.innerHTML = `<i class="bi bi-pencil-square px-2"></i>Editar Álbum`;
            document.getElementById('album-title').value = album.title;
            document.getElementById('album-desc').value = album.description || '';
            deleteTrigger.style.display = 'block'; 
        } else {
            titleEl.innerHTML = `<i class="bi bi-disc px-2"></i>Nuevo Álbum`;
            deleteTrigger.style.display = 'none';
        }
        albumModal.show();
    };

    const openSongModal = (song = null) => {
        console.log("SONG MODAL")
        const form = document.getElementById('song-form');
        form.reset();

        const deleteTrigger = document.getElementById('btn-delete-song-trigger');
        const titleEl = document.getElementById('song-modal-title');

        if (song) {
            titleEl.innerHTML = `<i class="bi bi-pencil-square px-2"></i>Editar Canción`;
            document.getElementById('song-title').value = song.title;
            document.getElementById('song-status').value = song.status;
            document.getElementById('song-desc').value = song.description || '';
            deleteTrigger.style.display = 'block'; 
        } else {
            titleEl.innerHTML = `<i class="bi bi-music-note-beamed px-2"></i>Nueva Canción`;
            deleteTrigger.style.display = 'none';
        }
        songModal.show();
    };

    // --- 6. DELEGACIÓN DE EVENTOS ---
    
    document.getElementById('btn-new-album').addEventListener('click', () => {
        openAlbumModal(null);
    });

    document.getElementById('btn-add-song').addEventListener('click', () => {
        if (state.currentAlbumId) {
            openSongModal(null);
        }
    });

    DOM.albumList.addEventListener('click', async (e) => {
        const item = e.target.closest('.album-item');
        if (!item) return;
        
        const id = parseInt(item.dataset.id);

        if (e.target.closest('.edit-album-trigger')) {
            const albumObj = state.albums.find(a => a.id === id);
            openAlbumModal(albumObj);
            return;
        }

        if (e.target.closest('.select-album-zone')) {
            state.currentAlbumId = id;
            DOM.btnAddSong.disabled = false;
            
            state.songs = await getSongsByAlbum(state.currentAlbumId);
            renderSongs();
            DOM.songDetails.innerHTML = '<div class="text-center text-secondary mt-5 small">Selecciona una canción</div>';
        }
    });

    DOM.songList.addEventListener('click', (e) => {
        const card = e.target.closest('.song-item');
        if (!card) return;

        const id = parseInt(card.dataset.id);

        if (e.target.closest('.edit-song-trigger')) {
            const songObj = state.songs.find(a => a.id === id);
            openSongModal(songObj);
            return;
        }


        state.currentSongId = parseInt(card.dataset.id);
        renderSongDetails();
    });

    const loadAlbums = async () => {
        try {
            state.albums = await getAlbums();
            renderAlbums();
        } catch (error) {
            console.error("Error al cargar los álbumes desde la API:", error);
        }
    };

    // FIX 2: Función loadSongs añadida — se llamaba en varios handlers pero no existía
    const loadSongs = async () => {
        if (!state.currentAlbumId) return;
        try {
            state.songs = await getSongsByAlbum(state.currentAlbumId);
            renderSongs();
        } catch (error) {
            console.error("Error al cargar las canciones desde la API:", error);
        }
    };

    document.getElementById('btn-delete-album-trigger').addEventListener('click', () => {
        albumModalEl.addEventListener('hidden.bs.modal', () => {
            deleteAlbumModal.show();
        }, { once: true });
        albumModal.hide();
    });

    document.getElementById('btn-save-album').addEventListener('click', async () => {
        const form = document.getElementById('album-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            title: document.getElementById('album-title').value,
            description: document.getElementById('album-desc').value
        };

        try {
            const isEdit = document.getElementById('album-modal-title').textContent.includes('Editar');
            if (isEdit && state.currentAlbumId) {
                await updateAlbum(state.currentAlbumId, payload);
            } else {
                await createAlbum(payload);
            }
            await loadAlbums();
        } catch(error) {
            alert("Hubo un error al guardar el álbum.");
            console.error(error);
        }

        albumModal.hide();
    });

    document.getElementById('btn-confirm-delete-album').addEventListener('click', async () => {
        if (!state.currentAlbumId) return;
        
        try {
            await deleteAlbum(state.currentAlbumId);
            deleteAlbumModal.hide();
            
            state.currentAlbumId = null;
            state.songs = [];
            state.currentSongId = null;
            
            DOM.songList.innerHTML = '<div class="text-center text-secondary mt-5 small">Selecciona un álbum primero</div>';
            DOM.songDetails.innerHTML = '<div class="text-center text-secondary mt-5 small">Selecciona una canción para ver sus secciones y grabaciones</div>';
            DOM.detailTitle.innerHTML = `<i class="bi bi-sliders me-2"></i>Laboratorio`;
            DOM.btnAddSong.disabled = true;

            await loadAlbums();
        } catch (error) {
            alert("No se pudo eliminar el álbum.");
            console.error(error);
        }
    });

    document.getElementById('btn-save-song').addEventListener('click', async () => {
        const form = document.getElementById('song-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // FIX 3: Añadidos status e id_album al payload — antes solo se enviaban title y description
        const payload = {
            title: document.getElementById('song-title').value,
            description: document.getElementById('song-desc').value,
            status: document.getElementById('song-status').value,
            id_album: state.currentAlbumId
        };

        try {
            const isEdit = document.getElementById('song-modal-title').textContent.includes('Editar');
            console.log("ISEDIT:",isEdit);
            console.log("SONG ID:",state.currentSongId)
            if (isEdit && state.currentSongId) {
                await updateSong(state.currentSongId, payload);
            } else {
                await createSong(payload);
            }
            await loadSongs();
        } catch(error) {
            alert("Hubo un error al guardar la canción.");
            console.error(error);
        }

        songModal.hide();
    });

    document.getElementById('btn-delete-song-trigger').addEventListener('click', () => {
        songModalEl.addEventListener('hidden.bs.modal', () => {
            deleteSongModal.show();
        }, { once: true });
        songModal.hide();
    });

    document.getElementById('btn-confirm-delete-song').addEventListener('click', async () => {
        if (!state.currentSongId) return;
        
        try {
            await deleteSong(state.currentSongId);
            deleteSongModal.hide();
            
            state.currentSongId = null;

            // FIX 4a: DOM.sectionList y DOM.sectionDetails no existen → corregido a songDetails y detailTitle
            // FIX 4b: No deshabilitamos btnAddSong porque el álbum sigue seleccionado
            // FIX 4c: Mensaje de error corregido de "álbum" a "canción"
            DOM.songDetails.innerHTML = '<div class="text-center text-secondary mt-5 small">Selecciona una canción para ver sus secciones y grabaciones</div>';
            DOM.detailTitle.innerHTML = `<i class="bi bi-sliders me-2"></i>Laboratorio`;

            await loadSongs();
        } catch (error) {
            alert("No se pudo eliminar la canción.");
            console.error(error);
        }
    });

    // --- 7. ARRANQUE ---
    loadAlbums();
};