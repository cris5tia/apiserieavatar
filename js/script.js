
/* ID de Avatar: La Leyenda de Aang en TMDB */
const AVATAR_ID = 246;
/* DB */
const BASE_URL = 'https://api.themoviedb.org/3';

const IMG_W185 = 'https://image.tmdb.org/t/p/w185';
const IMG_W342 = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIG = 'https://image.tmdb.org/t/p/original';

const state = {
  apiKey: '',   
  cache: {}     
};



function showLoading(msg = 'Consultando la API de TMDB...') {
  document.getElementById('results').innerHTML = `
    <div class="loading-indicator">
      <div class="spinner"></div>
      <p>${msg}</p>
    </div>`;
}


function showError(msg) {
  document.getElementById('results').innerHTML = `
    <div class="error-box">
      <div class="error-icon">🌪️</div>
      <strong>Ha ocurrido un error</strong>
      <p style="margin-top:8px;font-size:0.9rem">${msg}</p>
    </div>`;
}


/**
 * Realiza una petición GET a la API de TMDB.
 * Incluye caché en memoria para evitar repetir peticiones.
 *
 * @param {string} endpoint - Ruta del endpoint (ej: /tv/246)
 * @param {Object} params   - Parámetros adicionales de la URL
 * @returns {Promise<Object>} JSON de respuesta
 */
async function apiGet(endpoint, params = {}) {
  if (!state.apiKey) throw new Error('Configura tu API Key primero.');

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', state.apiKey);
  url.searchParams.set('language', 'es-ES');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const cacheKey = url.toString();
  if (state.cache[cacheKey]) return state.cache[cacheKey];

  const response = await fetch(url.toString());

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('API Key inválida o sin autorización.');
    if (response.status === 404) throw new Error('Recurso no encontrado en TMDB.');
    if (response.status === 429) throw new Error('Límite de peticiones excedido. Espera un momento.');
    throw new Error(err.status_message || `Error HTTP ${response.status}`);
  }

  const data = await response.json();
  state.cache[cacheKey] = data;
  return data;
}


/**
 * Valida y guarda la API Key ingresada por el usuario.
 * Realiza una petición de prueba para verificar que funciona.
 */
async function setApiKey() {
  const input = document.getElementById('api-key-input').value.trim();
  const status = document.getElementById('api-status');

  if (!input || input.length < 10) {
    status.className = 'status-err';
    status.textContent = 'API Key inválida';
    return;
  }

  state.apiKey = input;
  status.className = 'status-idle';
  status.textContent = 'Verificando...';

  try {
    await apiGet('/configuration');
    status.className = 'status-ok';
    status.textContent = '✓ Conectado';
  } catch (err) {
    state.apiKey = '';
    status.className = 'status-err';
    status.textContent = '✗ ' + err.message;
  }
}


function clearApiKey() {
  state.apiKey = '';
  state.cache = {};
  state.currentSection = '';
  document.getElementById('api-key-input').value = '';
  document.getElementById('api-status').className = 'status-idle';
  document.getElementById('api-status').textContent = 'Sin conectar';
  document.getElementById('results').innerHTML = `
    <div class="welcome">
      <span class="welcome-icon">🌀</span>
      <h2>Bienvenido, Maestro Avatar</h2>
      <p>Ingresa tu API Key de TMDB y selecciona una sección del menú para comenzar.</p>
    </div>`;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
}


/**
 * Enruta al usuario a la sección seleccionada del menú.
 * @param {string} section - ID de la sección
 */
async function navigate(section) {
  if (!state.apiKey) {
    showError('Por favor ingresa y verifica tu API Key de TMDB antes de explorar.');
    return;
  }

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === section);
  });

  const routes = {
    info:     loadInfo,
    seasons:  loadSeasons,
    cast:     loadCast,
    genres:   loadGenres,
    videos:   loadVideos,
    similar:  loadSimilar,
    discover: loadDiscover,
  };

  if (routes[section]) await routes[section]();
}

// ============================================================
// ENDPOINT 1 — GET /tv/{id}  →  Información General
// ============================================================
async function loadInfo() {
  showLoading('Cargando información de Avatar...');
  try {
    const data = await apiGet(`/tv/${AVATAR_ID}`);
    renderInfo(data);
  } catch (err) {
    showError(err.message);
  }
}

// ============================================================
// ENDPOINT 2 — GET /tv/{id}/season/{n}  →  Temporadas
// ============================================================
async function loadSeasons() {
  showLoading('Cargando temporadas...');
  try {
    const show = await apiGet(`/tv/${AVATAR_ID}`);
    const seasonPromises = show.seasons
      .filter(s => s.season_number > 0)
      .map(s => apiGet(`/tv/${AVATAR_ID}/season/${s.season_number}`));
    const seasons = await Promise.all(seasonPromises);
    renderSeasons(show, seasons);
  } catch (err) {
    showError(err.message);
  }
}

// ============================================================
// ENDPOINT 3 — GET /tv/{id}/credits  →  Reparto y Crew
// ============================================================
async function loadCast() {
  showLoading('Cargando reparto...');
  try {
    const data = await apiGet(`/tv/${AVATAR_ID}/credits`);
    renderCast(data);
  } catch (err) {
    showError(err.message);
  }
}

// ============================================================
// ENDPOINT 4 — GET /genre/tv/list  →  Géneros de TV
// ============================================================
async function loadGenres() {
  showLoading('Cargando géneros...');
  try {
    const data = await apiGet('/genre/tv/list');
    renderGenres(data.genres);
  } catch (err) {
    showError(err.message);
  }
}

// ============================================================
// ENDPOINT 5 — GET /tv/{id}/videos  →  Videos y Trailers
// ============================================================
async function loadVideos() {
  showLoading('Cargando videos...');
  try {
    const data = await apiGet(`/tv/${AVATAR_ID}/videos`);
    if (!data.results || data.results.length === 0) {
      const dataEn = await apiGet(`/tv/${AVATAR_ID}/videos`, { language: 'en-US' });
      renderVideos(dataEn.results);
    } else {
      renderVideos(data.results);
    }
  } catch (err) {
    showError(err.message);
  }
}

// ============================================================
// ENDPOINT 6 — GET /tv/{id}/similar  →  Series Similares
// ============================================================
async function loadSimilar() {
  showLoading('Buscando series similares...');
  try {
    const data = await apiGet(`/tv/${AVATAR_ID}/similar`);
    renderSimilar(data.results);
  } catch (err) {
    showError(err.message);
  }
}

// ============================================================
// ENDPOINT 7 — GET /discover/tv  →  Descubrimiento
// ============================================================
async function loadDiscover(genreId = '', year = '') {
  showLoading('Descubriendo series...');
  try {
    const params = { sort_by: 'vote_average.desc', 'vote_count.gte': 100 };
    if (genreId) params.with_genres = genreId;
    if (year)    params.first_air_date_year = year;
    const data = await apiGet('/discover/tv', params);
    renderDiscover(data.results, genreId, year);
  } catch (err) {
    showError(err.message);
  }
}


function renderInfo(d) {
  const poster = d.poster_path
    ? `<div class="poster-wrap"><img src="${IMG_W342}${d.poster_path}" alt="Poster" /></div>`
    : `<div class="poster-placeholder">📺</div>`;

  const genres  = d.genres.map(g => `<span class="badge badge-water">${g.name}</span>`).join('');
  const networks = d.networks?.map(n => n.name).join(', ') || 'N/A';
  const creators = d.created_by?.map(c => c.name).join(', ') || 'N/A';

  document.getElementById('results').innerHTML = `
    <div class="section-title">📺 Información General</div>
    <div class="info-grid">
      ${poster}
      <div class="info-details">
        <h2>${d.name}</h2>
        <p class="tagline">${d.tagline || '"El Avatar debe dominar los cuatro elementos"'}</p>
        <div class="meta-badges">
          ${genres}
          <span class="badge badge-earth">⭐ ${d.vote_average?.toFixed(1)}/10</span>
          <span class="badge badge-fire">${d.number_of_seasons} Temporadas</span>
          <span class="badge badge-air">${d.number_of_episodes} Episodios</span>
        </div>
        <p class="overview">${d.overview || 'Sin descripción disponible.'}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.85rem">
          <div><span style="color:var(--text-dim)">Estado:</span> <strong>${d.status}</strong></div>
          <div><span style="color:var(--text-dim)">Estreno:</span> <strong>${d.first_air_date}</strong></div>
          <div><span style="color:var(--text-dim)">Finale:</span> <strong>${d.last_air_date || 'N/A'}</strong></div>
          <div><span style="color:var(--text-dim)">Duración ep.:</span> <strong>${d.episode_run_time?.[0] || 'N/A'} min</strong></div>
          <div><span style="color:var(--text-dim)">Cadena:</span> <strong>${networks}</strong></div>
          <div><span style="color:var(--text-dim)">Creado por:</span> <strong>${creators}</strong></div>
        </div>
      </div>
    </div>
    ${d.backdrop_path ? `
    <div style="margin-top:24px;border-radius:var(--radius);overflow:hidden;max-height:280px">
      <img src="${IMG_ORIG}${d.backdrop_path}" alt="Backdrop" style="width:100%;object-fit:cover;object-position:center 30%" />
    </div>` : ''}
    <div style="margin-top:28px">
      <div class="section-title">⚔️ Comparador de Datos</div>
      <div class="compare-grid">
        <div class="compare-card">
          <h3>🌀 Avatar: La Leyenda de Aang</h3>
          <div class="compare-row"><span class="compare-label">Puntuación</span><span class="compare-value">${d.vote_average?.toFixed(2)}/10</span></div>
          <div class="compare-row"><span class="compare-label">Votos</span><span class="compare-value">${d.vote_count?.toLocaleString()}</span></div>
          <div class="compare-row"><span class="compare-label">Episodios</span><span class="compare-value">${d.number_of_episodes}</span></div>
          <div class="compare-row"><span class="compare-label">Temporadas</span><span class="compare-value">${d.number_of_seasons}</span></div>
          <div class="compare-row"><span class="compare-label">Popularidad</span><span class="compare-value">${d.popularity?.toFixed(1)}</span></div>
        </div>
        <div class="compare-card" style="border-color:rgba(201,169,110,0.3)">
          <h3 style="color:var(--air-dark)">📊 Datos de Producción</h3>
          <div class="compare-row"><span class="compare-label">Idioma original</span><span class="compare-value">${d.original_language?.toUpperCase()}</span></div>
          <div class="compare-row"><span class="compare-label">Nombre original</span><span class="compare-value">${d.original_name}</span></div>
          <div class="compare-row"><span class="compare-label">En producción</span><span class="compare-value">${d.in_production ? 'Sí' : 'No'}</span></div>
          <div class="compare-row"><span class="compare-label">País</span><span class="compare-value">${d.origin_country?.join(', ') || 'N/A'}</span></div>
          <div class="compare-row"><span class="compare-label">Tipo</span><span class="compare-value">${d.type || 'Scripted'}</span></div>
        </div>
      </div>
    </div>`;
}


function renderSeasons(show, seasons) {
  const cards = seasons.map(s => {
    const poster = s.poster_path
      ? `<img src="${IMG_W342}${s.poster_path}" alt="${s.name}" loading="lazy" style="width:100%;display:block" />`
      : `<div style="height:200px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:36px">🌊</div>`;

    const epList = s.episodes?.slice(0, 5).map(e =>
      `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.75rem">
        <span style="color:var(--text-dim)">E${e.episode_number}:</span>
        <span style="color:var(--air);margin-left:6px">${e.name}</span>
      </div>`
    ).join('') || '';

    return `
      <div style="background:var(--surface2);border-radius:var(--radius);overflow:hidden;border:1px solid rgba(255,255,255,0.07)">
        ${poster}
        <div style="padding:16px">
          <h3 style="font-family:'Cinzel Decorative',serif;font-size:0.9rem;margin-bottom:8px;color:var(--earth-light)">${s.name}</h3>
          <p style="font-size:0.75rem;color:var(--text-dim);margin-bottom:10px">${s.episodes?.length || 0} episodios · ${s.air_date?.split('-')[0] || 'N/A'}</p>
          <p style="font-size:0.78rem;color:var(--text-dim);line-height:1.5;margin-bottom:12px">
            ${s.overview ? s.overview.substring(0, 120) + '...' : 'Sin descripción.'}
          </p>
          <p style="font-size:0.72rem;color:var(--water-light);letter-spacing:1px;margin-bottom:6px">PRIMEROS EPISODIOS</p>
          ${epList}
        </div>
      </div>`;
  }).join('');

  document.getElementById('results').innerHTML = `
    <div class="section-title">🌊 Temporadas — Los Tres Libros</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px">${cards}</div>`;
}


function renderCast(data) {
  const cast = data.cast?.slice(0, 20) || [];
  const crew = data.crew?.filter(c => ['Creator','Director','Producer','Writer'].includes(c.job)).slice(0, 10) || [];

  const castCards = cast.map(p => {
    const photo = p.profile_path
      ? `<img src="${IMG_W185}${p.profile_path}" alt="${p.name}" loading="lazy" />`
      : `<div class="cast-avatar">🎭</div>`;
    return `
      <div class="cast-card">
        ${photo}
        <div class="cast-info">
          <div class="name">${p.name}</div>
          <div class="character">${p.character || 'N/A'}</div>
        </div>
      </div>`;
  }).join('');

  const crewRows = crew.map(c => `
    <div class="compare-row">
      <span class="compare-label">${c.job}</span>
      <span class="compare-value">${c.name}</span>
    </div>`).join('');

  document.getElementById('results').innerHTML = `
    <div class="section-title">🔥 Reparto Principal</div>
    <div class="cast-grid">${castCards}</div>
    ${crew.length ? `
    <div class="section-title" style="margin-top:28px">🎬 Equipo de Producción</div>
    <div style="background:var(--surface2);border-radius:var(--radius);padding:20px;border:1px solid rgba(255,255,255,0.07)">${crewRows}</div>` : ''}`;
}


function renderGenres(genres) {
  const colors = [
    { bg: 'rgba(79,179,232,0.15)',  color: 'var(--water-light)', border: 'rgba(79,179,232,0.4)' },
    { bg: 'rgba(74,124,63,0.2)',    color: 'var(--earth-light)', border: 'rgba(74,124,63,0.4)' },
    { bg: 'rgba(192,57,43,0.15)',   color: 'var(--fire-light)',  border: 'rgba(192,57,43,0.4)' },
    { bg: 'rgba(201,169,110,0.15)', color: 'var(--air-dark)',    border: 'rgba(201,169,110,0.4)' },
  ];
  const tags = genres.map((g, i) => {
    const c = colors[i % 4];
    return `<button class="genre-tag"
      style="background:${c.bg};color:${c.color};border-color:${c.border}"
      onclick="filterByGenre(${g.id}, '${g.name}')">${g.name}</button>`;
  }).join('');

  document.getElementById('results').innerHTML = `
    <div class="section-title">🌿 Géneros de Series TV</div>
    <p style="color:var(--text-dim);font-size:0.85rem;margin-bottom:16px">
      Avatar pertenece a: <strong style="color:var(--water-light)">Acción y Aventura, Animación, Familia</strong>.
      Haz clic en un género para explorar series similares.
    </p>
    <div class="genres-cloud">${tags}</div>
    <div id="genre-results"></div>`;
}


async function filterByGenre(genreId, genreName) {
  const container = document.getElementById('genre-results');
  if (!container) return;
  container.innerHTML = `<div class="loading-indicator" style="padding:30px"><div class="spinner"></div><p>Buscando series de ${genreName}...</p></div>`;
  try {
    const data = await apiGet('/discover/tv', {
      with_genres: genreId,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 200
    });
    const cards = data.results.slice(0, 12).map(show => {
      const poster = show.poster_path
        ? `<img src="${IMG_W185}${show.poster_path}" alt="${show.name}" loading="lazy" />`
        : `<div style="aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;font-size:32px;background:var(--surface)">📺</div>`;
      return `<div class="show-card">${poster}<div class="show-card-info"><h4>${show.name}</h4><p>⭐ ${show.vote_average?.toFixed(1)} · ${show.first_air_date?.split('-')[0] || 'N/A'}</p></div></div>`;
    }).join('');
    container.innerHTML = `
      <div class="section-title" style="margin-top:20px">📺 Series de: ${genreName}</div>
      <div class="discover-results">${cards}</div>`;
  } catch (err) {
    container.innerHTML = `<div class="error-box"><p>${err.message}</p></div>`;
  }
}


function renderVideos(videos) {
  if (!videos || videos.length === 0) {
    document.getElementById('results').innerHTML = `
      <div class="section-title">🎬 Videos y Trailers</div>
      <div class="welcome"><span class="welcome-icon">🎬</span><p>No se encontraron videos.</p></div>`;
    return;
  }
  const cards = videos.map(v => {
    const thumb = `https://img.youtube.com/vi/${v.key}/hqdefault.jpg`;
    const type  = v.type === 'Trailer' ? '🎬 Trailer' : v.type === 'Teaser' ? '✨ Teaser' : v.type === 'Clip' ? '🎞️ Clip' : '📹 ' + v.type;
    return `
      <div class="video-card" onclick="window.open('https://www.youtube.com/watch?v=${v.key}','_blank')">
        <div class="video-thumb">
          <img src="${thumb}" alt="${v.name}" loading="lazy" />
          <div class="play-btn">▶</div>
        </div>
        <div class="video-info">
          <h3>${v.name}</h3>
          <p>${type} · ${v.site} · ${v.official ? '✓ Oficial' : 'No oficial'}</p>
        </div>
      </div>`;
  }).join('');
  document.getElementById('results').innerHTML = `
    <div class="section-title">🎬 Videos y Trailers (${videos.length})</div>
    <div class="videos-grid">${cards}</div>`;
}


function renderSimilar(shows) {
  if (!shows || shows.length === 0) {
    document.getElementById('results').innerHTML = `
      <div class="section-title">💨 Series Similares</div>
      <div class="welcome"><span class="welcome-icon">💨</span><p>No se encontraron series similares.</p></div>`;
    return;
  }
  const cards = shows.slice(0, 16).map(show => {
    const poster = show.poster_path
      ? `<img src="${IMG_W185}${show.poster_path}" alt="${show.name}" loading="lazy" />`
      : `<div style="aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;font-size:32px;background:var(--surface)">📺</div>`;
    return `<div class="show-card">${poster}<div class="show-card-info"><h4>${show.name}</h4><p>⭐ ${show.vote_average?.toFixed(1)} · ${show.first_air_date?.split('-')[0] || 'N/A'}</p></div></div>`;
  }).join('');
  document.getElementById('results').innerHTML = `
    <div class="section-title">💨 Series Similares a Avatar</div>
    <div class="discover-results">${cards}</div>`;
}

async function renderDiscover(shows, selectedGenre, selectedYear) {
  let genreOptions = '<option value="">Todos los géneros</option>';
  try {
    const gData = await apiGet('/genre/tv/list');
    genreOptions += gData.genres.map(g =>
      `<option value="${g.id}" ${String(g.id) === String(selectedGenre) ? 'selected' : ''}>${g.name}</option>`
    ).join('');
  } catch (_) {}

  const cards = (shows || []).slice(0, 20).map(show => {
    const poster = show.poster_path
      ? `<img src="${IMG_W185}${show.poster_path}" alt="${show.name}" loading="lazy" />`
      : `<div style="aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;font-size:32px;background:var(--surface)">📺</div>`;
    return `<div class="show-card">${poster}<div class="show-card-info"><h4>${show.name}</h4><p>⭐ ${show.vote_average?.toFixed(1)} · ${show.first_air_date?.split('-')[0] || 'N/A'}</p></div></div>`;
  }).join('');

  document.getElementById('results').innerHTML = `
    <div class="section-title">🔍 Descubrimiento de Series</div>
    <div class="discover-controls">
      <div class="control-group">
        <label>Género</label>
        <select id="filter-genre" onchange="applyDiscoverFilters()">${genreOptions}</select>
      </div>
      <div class="control-group">
        <label>Año de estreno</label>
        <input type="number" id="filter-year" min="1950" max="2026" value="${selectedYear || ''}" placeholder="Ej: 2005" onchange="applyDiscoverFilters()" />
      </div>
      <button class="btn btn-primary" onclick="applyDiscoverFilters()">Filtrar</button>
    </div>
    <div class="discover-results">${cards}</div>`;
}


function applyDiscoverFilters() {
  const genre = document.getElementById('filter-genre')?.value || '';
  const year  = document.getElementById('filter-year')?.value || '';
  loadDiscover(genre, year);
}


function initParticles() {
  const canvas = document.getElementById('bgCanvas');
  const colors = ['#1a6fa8','#4fb3e8','#4a7c3f','#8bc34a','#c0392b','#e67e22','#f5e6c8','#c9a96e'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'chi';
    const size = Math.random() * 6 + 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    Object.assign(el.style, {
      width: size + 'px',
      height: size + 'px',
      left: (Math.random() * 100) + '%',
      background: color,
      animationDelay: (Math.random() * 15) + 's',
      animationDuration: (Math.random() * 12 + 8) + 's',
      boxShadow: `0 0 ${size * 2}px ${color}`,
    });
    canvas.appendChild(el);
  }
}


initParticles();

document.getElementById('api-key-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') setApiKey();
});
