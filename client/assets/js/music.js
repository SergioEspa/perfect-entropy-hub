import { CONFIG } from "./config.js"; 
// FIX 1: Añadidos deleteAlbum, createSong y updateSong que faltaban en el import
import { 
    createAlbum, 
    createSection, 
    createSong, 
    deleteAlbum, 
    deleteSection, 
    deleteSong, 
    getAlbumSongsDetailed, 
    getAlbums, 
    getSectionsForSong, 
    updateAlbum, 
    updateSection, 
    updateSong,
    uploadRecordingFile,
    createRecording
} from "./service.js";

export const initializeMusic = async () => {
    // --- 1. ESTADO GLOBAL ---
    const state = {
        albums: [],
        currentAlbumId: null,
        songs: [],
        currentSongId: null,
        currentSectionId: null
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
    if (deleteAlbumModalEl.parentNode !== document.body) {
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
    if (deleteSongModalEl.parentNode !== document.body) {
        document.body.appendChild(deleteSongModalEl);
    }
    const deleteSongModal = new bootstrap.Modal(deleteSongModalEl);

    // SECCIONES
    const sectionModalEl = document.getElementById('modalSection');
    if (sectionModalEl.parentNode !== document.body) {
        document.body.appendChild(sectionModalEl);
    }
    const sectionModal = new bootstrap.Modal(sectionModalEl);

    const deleteSectionModalEl = document.getElementById('confirmDeleteSection');
    if (deleteSectionModalEl.parentNode !== document.body) {
        document.body.appendChild(deleteSectionModalEl);
    }
    const deleteSectionModal = new bootstrap.Modal(deleteSectionModalEl);

    // --- 4. RENDERIZADORES ---
    const renderAlbums = () => {
        // Inicializamos el contenedor como un acordeón oscuro
        DOM.albumList.innerHTML = '<div class="accordion accordion-flush" id="albumsAccordion" data-bs-theme="dark">' + 
            state.albums.map(a => {
                const isActive = a.id === state.currentAlbumId;
                
                return `
                <div class="accordion-item bg-transparent border-secondary border-bottom album-item" data-id="${a.id}">
                    
                    <h2 class="accordion-header d-flex align-items-center ${isActive ? 'bg-info bg-opacity-10 border-start border-2 border-info' : ''}">
                        <!-- El botón actúa como expansor Y como zona de selección -->
                        <button class="accordion-button collapsed bg-transparent text-light shadow-none p-3 select-album-zone" type="button" data-bs-toggle="collapse" data-bs-target="#album-${a.id}">
                            <span class="fw-bold">${a.title}</span>
                        </button>
                        
                        <!-- Botón de edición protegido de solapamientos -->
                        <button class="btn btn-sm btn-link text-info p-2 me-2 edit-album-trigger position-relative" style="z-index: 3;" title="Editar Álbum">
                            <i class="bi bi-gear-fill"></i>
                        </button>
                    </h2>
                    
                    <!-- Contenedor colapsable para la descripción -->
                    <div id="album-${a.id}" class="accordion-collapse collapse" data-bs-parent="#albumsAccordion">
                        <div class="accordion-body text-secondary small pt-1 pb-3 px-3">
                            ${a.description ? `${a.description}` : '<i class="fst-italic opacity-50">Sin descripción</i>'}
                        </div>
                    </div>
                    
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

        // 1. Cabecera mejorada: Incluye el estado de la canción.
        DOM.detailTitle.innerHTML = `
            <div class="d-flex align-items-center justify-content-between w-100">
                <span><i class="bi bi-music-note-beamed me-2 text-warning"></i>${song.title}</span>
                <span class="badge bg-secondary ms-2 text-uppercase" style="font-size: 0.5em; letter-spacing: 1px;">${song.status}</span>
            </div>
        `;
        
        // 2. Renderizador de Secciones (Ahora expone Key, Time Signature y estados vacíos)
        const sectionsHTML = (song.sections && song.sections.length > 0) 
            ? song.sections.map((sec) => `
                <div class="accordion-item bg-transparent border-secondary mb-2 rounded">
                    <h2 class="accordion-header d-flex align-items-center bg-dark rounded">
                        <button class="accordion-button collapsed bg-transparent text-light shadow-none p-3" type="button" data-bs-toggle="collapse" data-bs-target="#sec-${sec.id}">
                            <span class="badge bg-dark border border-secondary me-3" style="min-width: 80px;">${sec.type}</span>
                            
                            <div class="d-flex gap-2 ms-auto me-2 small">
                                ${sec.key ? `<span class="badge bg-dark border border-secondary text-secondary" title="Tonalidad"><i class="bi bi-music-note me-1"></i>${sec.key}</span>` : ''}
                                ${sec.time_signature ? `<span class="badge bg-dark border border-secondary text-secondary" title="Compás"><i class="bi bi-clock me-1"></i>${sec.time_signature}</span>` : ''}
                                ${sec.bpm ? `<span class="badge bg-dark border border-secondary text-secondary" title="BPM"><i class="bi bi-speedometer2 me-1"></i>${sec.bpm} bpm</span>` : ''}
                            </div>
                        </button>
                        <button class="btn btn-sm btn-link text-warning p-2 me-2 edit-section-trigger position-relative" style="z-index: 3;" data-id="${sec.id}" title="Editar Sección">
                            <i class="bi bi-gear-fill"></i>
                        </button>
                    </h2>
                    <div id="sec-${sec.id}" class="accordion-collapse collapse">
                        <div class="accordion-body text-light small border-top border-secondary bg-dark bg-opacity-25 rounded-bottom">
                            
                            ${sec.chords ? `
                                <div class="mb-3">
                                    <div class="text-info mb-1 fw-bold" style="font-size: 11px; text-transform: uppercase;"><i class="bi bi-music-note-list me-1"></i>Acordes</div>
                                    <div class="p-2 bg-dark rounded font-monospace border border-secondary border-opacity-50 text-warning fs-6 tracking-wide">${sec.chords}</div>
                                </div>` : ''}
                            
                            ${sec.lyrics ? `
                                <div>
                                    <div class="text-info mb-1 fw-bold" style="font-size: 11px; text-transform: uppercase;"><i class="bi bi-mic me-1"></i>Letra</div>
                                    <div class="p-2 bg-dark bg-opacity-50 rounded border border-secondary border-opacity-25">
                                        <pre class="text-light mb-0" style="white-space: pre-wrap; font-family: inherit; line-height: 1.5;">${sec.lyrics}</pre>
                                    </div>
                                </div>` : ''}
                                
                            ${!sec.chords && !sec.lyrics ? `<div class="text-secondary text-center fst-italic py-2">Sección sin acordes ni letra</div>` : ''}
                        </div>
                    </div>
                </div>
            `).join('') 
            : '<div class="text-center text-secondary my-4 small fst-italic">No hay secciones definidas en la estructura.</div>';

        // 3. Renderizador de Grabaciones Multiformato
        const recordingsHTML = (song.recordings && song.recordings.length > 0)
            ? song.recordings.map(rec => {
                let mediaContent = '';
                const url = rec.url;

                // 1. Archivo Local (Subido a tu propio servidor)
                if (url.startsWith('/uploads/')) {
                    
                    // LA CLAVE: Concatenar el dominio del backend
                    const fullUrl = `${CONFIG.API_URL}${url}`;
                    
                    const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
                    
                    if (isVideo) {
                        mediaContent = `
                            <video controls class="w-100 rounded mt-2 border border-secondary" style="max-height: 250px; background: #000;">
                                <source src="${fullUrl}">Tu navegador no soporta vídeo.
                            </video>`;
                    } else {
                        mediaContent = `
                            <audio controls class="w-100 mt-2" style="height: 40px; outline: none;">
                                <source src="${fullUrl}">Tu navegador no soporta audio.
                            </audio>`;
                    }
                }
                // 2. Enlace de YouTube
                else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                    // Extraer ID de YouTube para poder incrustarlo
                    const videoId = url.includes('youtu.be') ? url.split('/').pop().split('?')[0] : new URLSearchParams(new URL(url).search).get('v');
                    if (videoId) {
                        mediaContent = `
                            <div class="ratio ratio-16x9 mt-2 border border-secondary rounded overflow-hidden">
                                <iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>
                            </div>`;
                    }
                }
                // 3. Enlace de Google Drive
                else if (url.includes('drive.google.com')) {
                    // Captura el ID de los dos formatos estándar de Drive
                    const match = url.match(/(?:file\/d\/|id=)([\w-]+)/);
                    
                    if (match && match[1]) {
                        const fileId = match[1];
                        mediaContent = `
                            <div class="ratio ratio-16x9 mt-2 border border-secondary rounded overflow-hidden">
                                <iframe src="https://drive.google.com/file/d/${fileId}/preview" allowfullscreen></iframe>
                            </div>`;
                    } else {
                        // Fallback si es un enlace de Drive rarísimo o de carpeta
                        mediaContent = `
                            <a href="${url}" target="_blank" class="btn btn-sm btn-outline-info w-100 mt-2">
                                <i class="bi bi-google"></i> Abrir en Google Drive
                            </a>`;
                    }
                }
                // 4. Fallback: URL genérica (Soundcloud, Dropbox, etc)
                else {
                    mediaContent = `
                        <a href="${url}" target="_blank" class="btn btn-sm btn-outline-info w-100 mt-2">
                            <i class="bi bi-box-arrow-up-right me-2"></i>Abrir Enlace Externo
                        </a>`;
                }

                // Formatear fecha (aprovechando que ahora la devolvemos en el Schema)
                const dateStr = rec.date_creation ? new Date(rec.date_creation).toLocaleDateString() : '';

                let referenceBadge = '<span class="badge bg-dark border border-secondary text-info ms-2 fw-normal" style="font-size: 10px; letter-spacing: 0.5px;">Tema Completo</span>';
                
                if (rec.id_section && song.sections) {
                    const linkedSection = song.sections.find(s => s.id === rec.id_section);
                    if (linkedSection) {
                        // Si es una sección, le damos un tono amarillo (warning) para diferenciarlo
                        referenceBadge = `<span class="badge bg-dark border border-secondary text-warning ms-2 fw-normal" style="font-size: 10px; letter-spacing: 0.5px;">${linkedSection.type}</span>`;
                    }
                }

                // Tarjeta final de la grabación
                return `
                <div class="p-3 bg-dark bg-opacity-50 border border-secondary rounded mb-3">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <div class="text-light fw-bold flex-grow-1 pe-2 d-flex align-items-center text-truncate">
                            <i class="bi bi-play-circle text-info me-2"></i>
                            <span class="text-truncate">${rec.title || 'Grabación'}</span>
                            ${referenceBadge}
                        </div>
                        
                        ${dateStr ? `<span class="badge bg-secondary text-dark flex-shrink-0" style="font-size: 10px;">${dateStr}</span>` : ''}
                    </div>
                    ${mediaContent}
                </div>`;
            }).join('')
            : '<div class="text-center text-secondary my-4 small fst-italic">No hay grabaciones vinculadas.</div>';

        // 4. Inyección Final en el DOM
        DOM.songDetails.innerHTML = `
            ${song.description ? `
                <div class="mb-4 p-3 bg-info bg-opacity-10 rounded border border-info border-opacity-25">
                    <p class="text-light small mb-0">${song.description}</p>
                </div>` : ''}
            
            <div class="d-flex justify-content-between align-items-center border-bottom border-secondary pb-2 mb-3 mt-4">
                <h6 class="text-light mb-0"><i class="bi bi-layers me-2 text-secondary"></i>Estructura</h6>
                <button class="btn btn-sm btn-outline-warning rounded-pill px-3 transition-all" id="btn-add-section" style="font-size: 11px; font-weight: 600;">
                    <i class="bi bi-plus-lg me-1"></i>Sección
                </button>
            </div>
            <div class="accordion accordion-flush mb-4 text-warning" id="sectionsAccordion" data-bs-theme="dark">
                ${sectionsHTML}
            </div>

            <div class="d-flex justify-content-between align-items-center border-bottom border-secondary pb-2 mb-3 mt-4">
                <h6 class="text-light mb-0"><i class="bi bi-cassette me-2 text-secondary"></i>Referencias / Demos</h6>
                <button class="btn btn-sm btn-outline-light rounded-circle" id="btn-add-recording"><i class="bi bi-plus"></i></button>
            </div>
            <div id="recordings-list">
                ${recordingsHTML}
            </div>
        `;
        DOM.btnAddRecording = document.getElementById('btn-add-recording');
        DOM.btnAddRecording.addEventListener('click', openRecordingModal);
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
        console.log("SONG MODAL");
        state.currentSongId = song ? song.id : null;
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

    const openSectionModal = (section = null) => {
        const form = document.getElementById('section-form');
        form.reset();

        const deleteTrigger = document.getElementById('btn-delete-section-trigger');
        const titleEl = document.getElementById('section-modal-title');

        if (section) {
            console.log("SECTION:",section);
            titleEl.innerHTML = `<i class="bi bi-pencil-square px-2"></i>Editar Sección`;
            document.getElementById('section-type').value = section.type;
            document.getElementById('section-key').value = section.key?.split(" ")[0] || '';
            document.getElementById('section-mode').value = section.key?.split(" ")[1] || '';
            document.getElementById('section-time-signature').value = section.time_signature || '';
            document.getElementById('section-bpm').value = section.bpm || '';
            document.getElementById('section-chords').value = section.chords || '';
            document.getElementById('section-lyrics').value = section.lyrics || '';
            state.currentSectionId = section.id;
            deleteTrigger.style.display = 'block';
        } else {
            titleEl.innerHTML = `<i class="bi bi-layout-text-window px-2"></i>Nueva Sección`;
            state.currentSectionId = null;
            deleteTrigger.style.display = 'none';
        }
        sectionModal.show();
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
            
            state.songs = await getAlbumSongsDetailed(state.currentAlbumId);
            console.log("DETAILED SONGS:",state.songs);
            renderSongs();
            DOM.songDetails.innerHTML = '<div class="text-center text-secondary mt-5 small">Selecciona una canción</div>';
        }
    });

    DOM.songList.addEventListener('click', async (e) => {
        const card = e.target.closest('.song-item');
        if (!card) return;

        const id = parseInt(card.dataset.id);

        if (e.target.closest('.edit-song-trigger')) {
            const songObj = state.songs.find(a => a.id === id);
            openSongModal(songObj);
            return;
        }

        state.currentSongId = id;
        await refreshSectionsForCurrentSong();
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
    // Ahora usa getAlbumSongsDetailed para que state.songs siempre incluya sections/recordings,
    // evitando inconsistencias de schema entre distintos puntos de recarga.
    const loadSongs = async () => {
        if (!state.currentAlbumId) return;
        try {
            state.songs = await getAlbumSongsDetailed(state.currentAlbumId);
            renderSongs();
            if (state.currentSongId) {
                renderSongDetails();
            }
        } catch (error) {
            console.error("Error al cargar las canciones desde la API:", error);
        }
    };

    const refreshSectionsForCurrentSong = async () => {
        if (!state.currentSongId) return;
        try {
            const sections = await getSectionsForSong(state.currentSongId);
            const song = state.songs.find(s => s.id === state.currentSongId);
            if (song) {
                song.sections = sections;
            }
            renderSongDetails();
        } catch (error) {
            console.error("Error al refrescar las secciones de la canción:", error);
        }
    };

    DOM.songDetails.addEventListener('click', (e) => {
        if (e.target.closest('#btn-add-section')) {
            openSectionModal(null);
            return;
        }
        const editBtn = e.target.closest('.edit-section-trigger');
        if (editBtn) {
            console.log(state.currentSongId);
            const song = state.songs.find(s => s.id === state.currentSongId);
            const sectionObj = (song?.sections || []).find(s => s.id === parseInt(editBtn.dataset.id));
            if (sectionObj) openSectionModal(sectionObj);
        }
    });

    document.getElementById('btn-save-section').addEventListener('click', async () => {
        const form = document.getElementById('section-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const bpmValue = document.getElementById('section-bpm').value;
        const key = document.getElementById('section-key').value
        const mode = document.getElementById('section-mode').value

        const payload = {
            type: document.getElementById('section-type').value,
            time_signature: document.getElementById('section-time-signature').value || null,
            key: (key && mode) ? `${key} ${mode}` : null,
            bpm: bpmValue ? parseInt(bpmValue) : null,
            chords: document.getElementById('section-chords').value || null,
            lyrics: document.getElementById('section-lyrics').value || null,
            id_song: state.currentSongId
        };

        try {
            if (state.currentSectionId) {
                await updateSection(state.currentSectionId, payload);
            } else {
                await createSection(payload);
            }
            await refreshSectionsForCurrentSong();
        } catch (error) {
            alert("Hubo un error al guardar la sección.");
            console.error(error);
        }

        sectionModal.hide();
    });

    document.getElementById('btn-delete-section-trigger').addEventListener('click', () => {
        sectionModalEl.addEventListener('hidden.bs.modal', () => {
            deleteSectionModal.show();
        }, { once: true });
        sectionModal.hide();
    });

    document.getElementById('btn-confirm-delete-section').addEventListener('click', async () => {
        if (!state.currentSectionId) return;

        try {
            await deleteSection(state.currentSectionId);
            deleteSectionModal.hide();
            state.currentSectionId = null;
            await refreshSectionsForCurrentSong();
        } catch (error) {
            alert("No se pudo eliminar la sección.");
            console.error(error);
        }
    });

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

    // --- 7. GRABACIONES ---
    const recordingModalEl = document.getElementById('modalRecording');
    if (recordingModalEl.parentNode !== document.body) document.body.appendChild(recordingModalEl);
    const recordingModal = new bootstrap.Modal(recordingModalEl);

    const dropzone = document.getElementById('dropzone-area');
    const fileInput = document.getElementById('recording-file');
    const feedbackEl = document.getElementById('dropzone-feedback');
    const filenameEl = document.getElementById('dropzone-filename');
    let currentFile = null;

    const openRecordingModal = () => {
        const form = document.getElementById('recording-form');
        form.reset();
        currentFile = null;
        feedbackEl.classList.add('d-none');
        dropzone.classList.remove('border-info', 'bg-info', 'bg-opacity-10');

        // Recuperar canción actual y sus secciones
        const song = state.songs.find(s => s.id === state.currentSongId);
        const select = document.getElementById('recording-association');
        
        // Limpiar y repoblar el select
        select.innerHTML = '<option value="song">Toda la Canción (Demo/Ensayo)</option>';
        
        if (song && song.sections && song.sections.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = "Secciones Específicas";
            
            song.sections.forEach(sec => {
                const option = document.createElement('option');
                option.value = `section_${sec.id}`; // Formato para diferenciar
                option.textContent = `${sec.type} ${sec.bpm ? '('+sec.bpm+' bpm)' : ''}`;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.add('border-info', 'bg-info', 'bg-opacity-10');
            }, false);
        });
    
        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.remove('border-info', 'bg-info', 'bg-opacity-10');
            }, false);
        });

        // Captura de archivo
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                handleFileSelection(this.files[0]);
            }
        });
        
        const handleFileSelection = (file) => {
            // Definimos las extensiones multimedia permitidas para el local/maquetas
            const allowedExtensions = /(\.mp3|\.wav|\.m4a|\.flac)$/i;
            
            if (!allowedExtensions.exec(file.name)) {
                alert("¡Formato no soportado! Por favor, sube solo archivos de audio (mp3, wav, m4a, flac).");
                fileInput.value = '';
                currentFile = null;
                feedbackEl.classList.add('d-none');
                return;
            }

            // Si pasa el filtro, guardamos en el estado del componente
            currentFile = file;
            feedbackEl.classList.remove('d-none');
            filenameEl.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        };

        // 6. Manejador de guardado
        document.getElementById('btn-save-recording').addEventListener('click', async () => {
            const title = document.getElementById('recording-title').value;
            const association = document.getElementById('recording-association').value;
            const isFileTabActive = document.getElementById('tab-upload').classList.contains('active');
            const externalUrl = document.getElementById('recording-url').value;

            if (!title) return alert("El título es obligatorio.");

            let finalUrl = null;

            try {
                // Bloquear UI mientras sube (opcional pero recomendado)
                const btn = document.getElementById('btn-save-recording');
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Subiendo...`;
                btn.disabled = true;

                if (isFileTabActive) {
                    if (!currentFile) throw new Error("Debes seleccionar un archivo.");
                    const uploadResponse = await uploadRecordingFile(currentFile);
                    finalUrl = uploadResponse.url; 
                } else {
                    if (!externalUrl) throw new Error("Debes introducir un enlace válido.");
                    finalUrl = externalUrl;
                }

                const payload = {
                    title: title,
                    url: finalUrl,
                    id_song: state.currentSongId,
                    id_section: association.startsWith('section_') ? parseInt(association.split('_')[1]) : null
                };

                // Guardar en la base de datos
                await createRecording(payload);
                
                // Limpiar y actualizar UI
                recordingModal.hide();
                await refreshSectionsForCurrentSong(); 

            } catch (error) {
                console.error(error);
                alert(error.message || "Hubo un error en el proceso.");
            } finally {
                // Restaurar botón
                const btn = document.getElementById('btn-save-recording');
                btn.innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-1"></i> Guardar`;
                btn.disabled = false;
            }
        });

        recordingModal.show();
    };

    // --- 8. ARRANQUE ---
    loadAlbums();
};