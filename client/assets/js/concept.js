import { getAlbums, getAlbumSongsDetailed, getConceptsByAlbum, getConceptsBySong, getGlobalConcepts, createConcept, updateConcept, deleteConcept } from "./service.js";

export const initializeConcept = async () => {
    
    const state = {
        albums: [],
        albumCache: {}, 
        concepts: [],
        context: { type: null, id: null, name: '' },
        currentConceptId: null
    };

    const DOM = {
        treeContainer: document.getElementById('tree-container-concept'),
        conceptsContainer: document.getElementById('concepts-container'),
        headerTitle: document.getElementById('concept-header-title'),
        btnAddConcept: document.getElementById('btn-add-concept')
    };

    const conceptModalEl = document.getElementById('modalConcept');
    if (conceptModalEl.parentNode !== document.body) document.body.appendChild(conceptModalEl);
    const conceptModal = new bootstrap.Modal(conceptModalEl);

    const deleteModalEl = document.getElementById('confirmDeleteConcept');
    if (deleteModalEl.parentNode !== document.body) document.body.appendChild(deleteModalEl);
    const deleteModal = new bootstrap.Modal(deleteModalEl);

    const renderTree = () => {
        // Bloque hardcodeado de la banda
        const globalItem = `
            <div class="accordion-item bg-transparent border-0 border-bottom border-secondary">
                <div class="accordion-header d-flex align-items-stretch">
                    <button class="btn btn-link text-decoration-none text-light flex-grow-1 text-start p-3 fw-bold rounded-0 select-target ${state.context.type === 'band' ? 'bg-info bg-opacity-10 text-info border-start border-3 border-info' : ''}" data-type="band" data-id="global" data-name="Perfect Entropy">
                        <i class="bi bi-stars me-2 text-warning"></i>Perfect Entropy
                    </button>
                </div>
            </div>
        `;

        // Bucle de álbumes (el que ya tenías)
        const albumsHTML = state.albums.map(a => `
            <div class="accordion-item bg-transparent border-0 border-bottom border-secondary">
                <div class="accordion-header d-flex align-items-stretch">
                    <button class="btn btn-link text-decoration-none text-light flex-grow-1 text-start p-3 fw-bold rounded-0 select-target ${state.context.type === 'album' && state.context.id === a.id ? 'bg-info bg-opacity-10 text-info border-start border-3 border-info' : ''}" data-type="album" data-id="${a.id}" data-name="${a.title}">
                        <i class="bi bi-disc me-2 text-secondary"></i>${a.title}
                    </button>
                    <button class="accordion-button collapsed bg-transparent shadow-none w-auto px-3 border-start border-secondary rounded-0 toggle-songs" type="button" data-bs-toggle="collapse" data-bs-target="#concept-album-songs-${a.id}" data-id="${a.id}"></button>
                </div>
                <div id="concept-album-songs-${a.id}" class="accordion-collapse collapse" data-bs-parent="#tree-container-concept">
                    <div class="accordion-body p-0 bg-black bg-opacity-25" id="concept-song-list-${a.id}">
                        <div class="text-center small text-secondary py-3"><span class="spinner-border spinner-border-sm"></span></div>
                    </div>
                </div>
            </div>
        `).join('');

        DOM.treeContainer.innerHTML = globalItem + albumsHTML;
    };

    const renderSongsForAlbum = (albumId, songs) => {
        const container = document.getElementById(`concept-song-list-${albumId}`);
        if (!container) return;

        if (songs.length === 0) {
            container.innerHTML = `<div class="text-secondary text-center small py-3 fst-italic">Sin canciones</div>`;
            return;
        }

        container.innerHTML = '<div class="list-group list-group-flush">' + songs.map(s => `
            <button class="list-group-item list-group-item-action bg-transparent text-light border-0 py-2 ps-5 select-target ${state.context.type === 'song' && state.context.id === s.id ? 'bg-info bg-opacity-10 text-info border-start border-3 border-info' : ''}" data-type="song" data-id="${s.id}" data-name="${s.title}">
                <i class="bi bi-music-note me-2 text-secondary"></i>${s.title}
            </button>
        `).join('') + '</div>';
    };

    const renderConcepts = () => {
        DOM.headerTitle.innerHTML = `<span class="text-info">${state.context.name}</span> <span class="text-secondary fs-6 ms-2">/ Lore & Concepto</span>`;
        DOM.btnAddConcept.disabled = false;

        if (state.concepts.length === 0) {
            DOM.conceptsContainer.innerHTML = '<div class="text-center text-secondary mt-5 small fst-italic">No hay conceptos vinculados a este objetivo.</div>';
            return;
        }

        const statusColors = {
            'BORRADOR': 'bg-secondary',
            'EN_DESARROLLO': 'bg-warning text-dark',
            'APROBADO': 'bg-success'
        };

        DOM.conceptsContainer.innerHTML = `<div class="row g-3">` + state.concepts.map(c => `
            <div class="col-12 col-xl-6">
                <div class="card h-100 bg-dark border-secondary shadow-sm">
                    <div class="card-header border-secondary d-flex justify-content-between align-items-start pt-3">
                        <div class="fw-bold text-light lh-sm flex-grow-1 pe-2">${c.title}</div>
                        <span class="badge ${statusColors[c.status]} shadow-sm flex-shrink-0" style="font-size: 10px;">${c.status.replace('_', ' ')}</span>
                    </div>
                    <div class="card-body py-3">
                        <p class="card-text text-light small mb-0" style="white-space: pre-wrap;">${c.description || '<i class="text-secondary">Sin descripción</i>'}</p>
                    </div>
                    <div class="card-footer bg-transparent border-secondary text-end p-2">
                        <button class="btn btn-sm btn-link text-secondary p-1 edit-concept-trigger" data-id="${c.id}"><i class="bi bi-pencil-square fs-6"></i> Editar</button>
                    </div>
                </div>
            </div>
        `).join('') + `</div>`;
    };

    DOM.treeContainer.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.toggle-songs');
        if (toggleBtn) {
            const albumId = parseInt(toggleBtn.dataset.id);
            if (!state.albumCache[albumId]) {
                const songs = await getAlbumSongsDetailed(albumId);
                state.albumCache[albumId] = songs;
                renderSongsForAlbum(albumId, songs);
            }
            return;
        }

        const selectBtn = e.target.closest('.select-target');
        if (selectBtn) {
            document.querySelectorAll('.select-target').forEach(btn => {
                btn.classList.remove('bg-info', 'bg-opacity-10', 'text-info', 'border-start', 'border-3', 'border-info');
                btn.classList.add('text-light');
            });
            selectBtn.classList.remove('text-light');
            selectBtn.classList.add('bg-info', 'bg-opacity-10', 'text-info', 'border-start', 'border-3', 'border-info');

            state.context.type = selectBtn.dataset.type;
            // Evitar el parseInt(NaN) si el id es "global"
            state.context.id = selectBtn.dataset.id === 'global' ? null : parseInt(selectBtn.dataset.id);
            state.context.name = selectBtn.dataset.name;

            DOM.conceptsContainer.innerHTML = '<div class="text-center text-secondary mt-5"><span class="spinner-border"></span></div>';
            
            try {
                // Selector triple para enrutar la petición
                if (state.context.type === 'album') {
                    state.concepts = await getConceptsByAlbum(state.context.id);
                } else if (state.context.type === 'song') {
                    state.concepts = await getConceptsBySong(state.context.id);
                } else if (state.context.type === 'band') {
                    state.concepts = await getGlobalConcepts();
                }
                
                renderConcepts();
            } catch(err) {
                console.error(err);
                DOM.conceptsContainer.innerHTML = '<div class="text-center text-danger mt-5">Error cargando conceptos.</div>';
            }
        }
    });

    const openConceptModal = (concept = null) => {
        const form = document.getElementById('concept-form');
        form.reset();
        
        const deleteTrigger = document.getElementById('btn-delete-concept-trigger');
        const titleEl = document.getElementById('concept-modal-title');

        if (concept) {
            state.currentConceptId = concept.id;
            titleEl.innerHTML = `<i class="bi bi-pencil-square px-2"></i>Editar Lore`;
            document.getElementById('concept-title').value = concept.title;
            document.getElementById('concept-status').value = concept.status;
            document.getElementById('concept-desc').value = concept.description || '';
            deleteTrigger.style.display = 'block';
        } else {
            state.currentConceptId = null;
            titleEl.innerHTML = `<i class="bi bi-hexagon px-2"></i>Nuevo Lore`;
            deleteTrigger.style.display = 'none';
        }
        conceptModal.show();
    };

    DOM.btnAddConcept.addEventListener('click', () => openConceptModal());

    DOM.conceptsContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-concept-trigger');
        if (editBtn) {
            const conceptObj = state.concepts.find(c => c.id === parseInt(editBtn.dataset.id));
            if (conceptObj) openConceptModal(conceptObj);
        }
    });

    document.getElementById('btn-save-concept').addEventListener('click', async () => {
        const form = document.getElementById('concept-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            title: document.getElementById('concept-title').value,
            description: document.getElementById('concept-desc').value || null,
            status: document.getElementById('concept-status').value,
            id_album: state.context.type === 'album' ? state.context.id : null,
            id_song: state.context.type === 'song' ? state.context.id : null
        };

        try {
            if (state.currentConceptId) await updateConcept(state.currentConceptId, payload);
            else await createConcept(payload);
            
            conceptModal.hide();
            if (state.context.type === 'album') state.concepts = await getConceptsByAlbum(state.context.id);
            else state.concepts = await getConceptsBySong(state.context.id);
            
            renderConcepts();
        } catch (error) {
            alert("Error al guardar la idea.");
            console.error(error);
        }
    });

    document.getElementById('btn-delete-concept-trigger').addEventListener('click', () => {
        conceptModalEl.addEventListener('hidden.bs.modal', () => {
            deleteModal.show();
        }, { once: true });
        conceptModal.hide();
    });

    document.getElementById('btn-confirm-delete-concept').addEventListener('click', async () => {
        if (!state.currentConceptId) return;

        try {
            await deleteConcept(state.currentConceptId);
            deleteModal.hide();
            
            if (state.context.type === 'album') state.concepts = await getConceptsByAlbum(state.context.id);
            else state.concepts = await getConceptsBySong(state.context.id);
            
            renderConcepts();
        } catch(error) {
            alert("Error al eliminar.");
            console.error(error);
        }
    });

    try {
        state.albums = await getAlbums();
        renderTree();
    } catch (err) {
        console.error("Error inicializando Conceptos:", err);
    }
};