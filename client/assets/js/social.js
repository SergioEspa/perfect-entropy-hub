import { getAlbums, getAlbumSongsDetailed, getPostsByAlbum, getPostsBySong, getGlobalPosts, createPost, updatePost, deletePost } from "./service.js";

export const initializeSocial = async () => {
    
    // --- 1. ESTADO GLOBAL ---
    const state = {
        albums: [],
        albumCache: {}, // Para no pedir las canciones de un álbum 2 veces
        posts: [],
        context: { type: null, id: null, name: '' }, // 'album' o 'song'
        currentPostId: null
    };

    // --- 2. NODOS DEL DOM ---
    const DOM = {
        treeContainer: document.getElementById('tree-container'),
        postsContainer: document.getElementById('posts-container'),
        headerTitle: document.getElementById('social-header-title'),
        btnAddPost: document.getElementById('btn-add-post')
    };

    // --- 3. MODALES ---
    const postModalEl = document.getElementById('modalPost');
    if (postModalEl.parentNode !== document.body) document.body.appendChild(postModalEl);
    const postModal = new bootstrap.Modal(postModalEl);

    const deleteModalEl = document.getElementById('confirmDeletePost');
    if (deleteModalEl.parentNode !== document.body) document.body.appendChild(deleteModalEl);
    const deleteModal = new bootstrap.Modal(deleteModalEl);

    // --- 4. RENDERIZADORES ---
    
    // Pinta la lista maestra de Álbumes
    const renderTree = () => {
        const globalItem = `
            <div class="accordion-item bg-transparent border-0 border-bottom border-secondary">
                <div class="accordion-header d-flex align-items-stretch">
                    <button class="btn btn-link text-decoration-none text-light flex-grow-1 text-start p-3 fw-bold rounded-0 select-target ${state.context.type === 'band' ? 'bg-info bg-opacity-10 text-info border-start border-3 border-info' : ''}" data-type="band" data-id="global" data-name="Perfect Entropy">
                        Perfect Entropy
                    </button>
                </div>
            </div>
        `;

        const albumsHTML = state.albums.map(a => `
            <div class="accordion-item bg-transparent border-0 border-bottom border-secondary">
                <div class="accordion-header d-flex align-items-stretch">
                    
                    <button class="btn btn-link text-decoration-none text-light flex-grow-1 text-start p-3 fw-bold rounded-0 select-target ${state.context.type === 'album' && state.context.id === a.id ? 'bg-info bg-opacity-10 text-info border-start border-3 border-info' : ''}" data-type="album" data-id="${a.id}" data-name="${a.title}">
                        <i class="bi bi-disc me-2 text-secondary"></i>${a.title}
                    </button>
                    
                    <button class="accordion-button collapsed bg-transparent shadow-none w-auto px-3 border-start border-secondary rounded-0 toggle-songs" type="button" data-bs-toggle="collapse" data-bs-target="#album-songs-${a.id}" data-id="${a.id}">
                    </button>

                </div>
                
                <div id="album-songs-${a.id}" class="accordion-collapse collapse" data-bs-parent="#tree-container">
                    <div class="accordion-body p-0 bg-black bg-opacity-25" id="song-list-${a.id}">
                        <div class="text-center small text-secondary py-3"><span class="spinner-border spinner-border-sm"></span></div>
                    </div>
                </div>
            </div>
        `).join('');

        DOM.treeContainer.innerHTML = globalItem + albumsHTML;
    };

    // Pinta las canciones de un álbum (se inyecta on-demand)
    const renderSongsForAlbum = (albumId, songs) => {
        const container = document.getElementById(`song-list-${albumId}`);
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

    // Pinta los posts en la columna derecha
    const renderPosts = () => {
        DOM.headerTitle.innerHTML = `<span class="text-info">${state.context.name}</span> <span class="text-secondary fs-6 ms-2">/ Promoción</span>`;
        DOM.btnAddPost.disabled = false;

        if (state.posts.length === 0) {
            DOM.postsContainer.innerHTML = '<div class="text-center text-secondary mt-5 small fst-italic">No hay ideas vinculadas a este objetivo.</div>';
            return;
        }

        const statusColors = {
            'PENDIENTE': 'bg-secondary',
            'PROGRAMADO': 'bg-warning text-dark',
            'PUBLICADO': 'bg-success'
        };

        DOM.postsContainer.innerHTML = `<div class="row g-3">` + state.posts.map(p => `
            <div class="col-12 col-xl-6">
                <div class="card h-100 bg-dark border-secondary shadow-sm">
                    <div class="card-header border-secondary d-flex justify-content-between align-items-start pt-3">
                        <div class="fw-bold text-light lh-sm flex-grow-1 pe-2">${p.title}</div>
                        <span class="badge ${statusColors[p.status]} shadow-sm flex-shrink-0" style="font-size: 10px;">${p.status}</span>
                    </div>
                    <div class="card-body py-3">
                        <p class="card-text text-light small mb-0" style="white-space: pre-wrap;">${p.description || '<i class="text-secondary">Sin descripción</i>'}</p>
                        ${p.template_url ? `
                            <div class="mt-3">
                                <a href="${p.template_url}" target="_blank" class="btn btn-sm btn-outline-info w-100">
                                    <i class="bi bi-link-45deg me-1"></i>Ver Referencia
                                </a>
                            </div>
                        ` : ''}
                    </div>
                    <div class="card-footer bg-transparent border-secondary text-end p-2">
                        <button class="btn btn-sm btn-link text-secondary p-1 edit-post-trigger" data-id="${p.id}"><i class="bi bi-pencil-square fs-6"></i> Editar</button>
                    </div>
                </div>
            </div>
        `).join('') + `</div>`;
    };

    // --- 5. DELEGACIÓN DE EVENTOS (Navegación Izquierda) ---
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
            // ParseInt condicional para no romper el id si es 'global'
            state.context.id = selectBtn.dataset.id === 'global' ? null : parseInt(selectBtn.dataset.id);
            state.context.name = selectBtn.dataset.name;

            DOM.postsContainer.innerHTML = '<div class="text-center text-secondary mt-5"><span class="spinner-border"></span></div>';
            
            try {
                // Enrutador de peticiones basado en el tipo
                if (state.context.type === 'album') {
                    state.posts = await getPostsByAlbum(state.context.id);
                } else if (state.context.type === 'song') {
                    state.posts = await getPostsBySong(state.context.id);
                } else if (state.context.type === 'band') {
                    state.posts = await getGlobalPosts();
                }
                renderPosts();
            } catch(err) {
                console.error(err);
                DOM.postsContainer.innerHTML = '<div class="text-center text-danger mt-5">Error cargando ideas.</div>';
            }
        }
    });

    // --- 6. GESTIÓN DE MODALES (Añadir/Editar) ---
    const openPostModal = (post = null) => {
        const form = document.getElementById('post-form');
        form.reset();
        
        const deleteTrigger = document.getElementById('btn-delete-post-trigger');
        const titleEl = document.getElementById('post-modal-title');

        if (post) {
            state.currentPostId = post.id;
            titleEl.innerHTML = `<i class="bi bi-pencil-square px-2"></i>Editar Idea`;
            document.getElementById('post-title').value = post.title;
            document.getElementById('post-status').value = post.status;
            document.getElementById('post-desc').value = post.description || '';
            document.getElementById('post-template').value = post.template_url || '';
            deleteTrigger.style.display = 'block';
        } else {
            state.currentPostId = null;
            titleEl.innerHTML = `<i class="bi bi-lightbulb px-2"></i>Nueva Idea`;
            deleteTrigger.style.display = 'none';
        }
        
        postModal.show();
    };

    DOM.btnAddPost.addEventListener('click', () => openPostModal());

    DOM.postsContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-post-trigger');
        if (editBtn) {
            const postObj = state.posts.find(p => p.id === parseInt(editBtn.dataset.id));
            if (postObj) openPostModal(postObj);
        }
    });

    document.getElementById('btn-save-post').addEventListener('click', async () => {
        const form = document.getElementById('post-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // El payload ya funciona perfectamente sin cambios, porque si es 'band', evaluará a null en ambos.
        const payload = {
            title: document.getElementById('post-title').value,
            description: document.getElementById('post-desc').value || null,
            status: document.getElementById('post-status').value,
            template_url: document.getElementById('post-template').value || null,
            id_album: state.context.type === 'album' ? state.context.id : null,
            id_song: state.context.type === 'song' ? state.context.id : null
        };

        try {
            if (state.currentPostId) {
                await updatePost(state.currentPostId, payload);
            } else {
                await createPost(payload);
            }
            
            postModal.hide();
            
            // Recargar vista con las 3 vías
            if (state.context.type === 'album') state.posts = await getPostsByAlbum(state.context.id);
            else if (state.context.type === 'song') state.posts = await getPostsBySong(state.context.id);
            else if (state.context.type === 'band') state.posts = await getGlobalPosts();
            
            renderPosts();

        } catch (error) {
            alert("Error al guardar la idea.");
            console.error(error);
        }
    });

    // --- 7. BORRADO ---
    document.getElementById('btn-delete-post-trigger').addEventListener('click', () => {
        postModalEl.addEventListener('hidden.bs.modal', () => {
            deleteModal.show();
        }, { once: true });
        postModal.hide();
    });

    document.getElementById('btn-confirm-delete-post').addEventListener('click', async () => {
        if (!state.currentPostId) return;

        try {
            await deletePost(state.currentPostId);
            deleteModal.hide();
            
            // Recargar vista con las 3 vías
            if (state.context.type === 'album') state.posts = await getPostsByAlbum(state.context.id);
            else if (state.context.type === 'song') state.posts = await getPostsBySong(state.context.id);
            else if (state.context.type === 'band') state.posts = await getGlobalPosts();
            
            renderPosts();
        } catch(error) {
            alert("Error al eliminar.");
            console.error(error);
        }
    });

    // --- 8. ARRANQUE ---
    try {
        state.albums = await getAlbums();
        renderTree();
    } catch (err) {
        console.error("Error inicializando Social:", err);
    }
};