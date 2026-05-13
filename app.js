/* ============================================================
   CINESEARCH — APP.JS
   OMDB API entegrasyonu · Vanilla JS
   ============================================================ */

'use strict';

/* ── Yapılandırma ── */
const CONFIG = {
  API_KEY: typeof API_KEY !== 'undefined' ? API_KEY : 'YOUR_API_KEY_HERE',
  BASE_URL: 'https://www.omdbapi.com/',
  DEBOUNCE_MS: 400,
  STORAGE_KEY: 'cinesearch_last',
  HISTORY_KEY: 'cinesearch_history',
};

/* ── DOM Referansları ── */
const DOM = {
  searchInput:    document.getElementById('searchInput'),
  yearFilter:     document.getElementById('yearFilter'),
  typeFilter:     document.getElementById('typeFilter'),
  sortFilter:     document.getElementById('sortFilter'),
  searchBtn:      document.getElementById('searchBtn'),
  themeToggle:    document.getElementById('themeToggle'),
  searchHistory:  document.getElementById('searchHistory'),
  loadingState:   document.getElementById('loadingState'),
  errorState:     document.getElementById('errorState'),
  emptyState:     document.getElementById('emptyState'),
  errorMessage:   document.getElementById('errorMessage'),
  retryBtn:       document.getElementById('retryBtn'),
  resultsSection: document.getElementById('resultsSection'),
  resultsGrid:    document.getElementById('resultsGrid'),
  resultsCount:   document.getElementById('resultsCount'),
  resultsQuery:   document.getElementById('resultsQuery'),
  loadMoreContainer: document.getElementById('loadMoreContainer'),
  loadMoreBtn:    document.getElementById('loadMoreBtn'),
  modalOverlay:   document.getElementById('modalOverlay'),
  modalClose:     document.getElementById('modalClose'),
  modalPoster:    document.getElementById('modalPoster'),
  modalTitle:     document.getElementById('modalTitle'),
  modalGenre:     document.getElementById('modalGenre'),
  modalMeta:      document.getElementById('modalMeta'),
  modalPlot:      document.getElementById('modalPlot'),
  modalDetails:   document.getElementById('modalDetails'),
  modalRatings:   document.getElementById('modalRatings'),
};

/* ── Uygulama Durumu ── */
let state = {
  lastQuery:  '',
  lastYear:   '',
  lastType:   '',
  isLoading:  false,
  currentPage: 1,
  totalResults: 0,
  history:    [],
};

/* ============================================================
   YARDIMCI FONKSİYONLAR
   ============================================================ */

/**
 * Belirli bir süre bekleyip ardından çağrı yapan debounce fonksiyonu.
 * Gereksiz API isteklerini engeller.
 * @param {Function} fn   - Çalıştırılacak fonksiyon
 * @param {number}   ms   - Bekleme süresi (milisaniye)
 */
function debounce(fn, ms) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/**
 * URL parametrelerinden arama durumunu geri yükler.
 * Sayfa yenilendiğinde son aramayı korur.
 */
function restoreFromURL() {
  const params = new URLSearchParams(window.location.search);
  const q    = params.get('q')    || '';
  const year = params.get('year') || '';
  const type = params.get('type') || '';

  if (q) {
    DOM.searchInput.value = q;
    DOM.yearFilter.value  = year;
    DOM.typeFilter.value  = type;
    search(q, year, type);
  }
}

/**
 * Mevcut arama durumunu URL'e ve localStorage'a kaydeder.
 * @param {string} q    - Arama terimi
 * @param {string} year - Yıl filtresi
 * @param {string} type - Tür filtresi
 */
function persistState(q, year, type) {
  const params = new URLSearchParams();
  if (q)    params.set('q', q);
  if (year) params.set('year', year);
  if (type) params.set('type', type);

  const newURL = params.toString()
    ? `${window.location.pathname}?${params}`
    : window.location.pathname;

  window.history.replaceState({}, '', newURL);

  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ q, year, type }));
}

/**
 * Arama geçmişini günceller ve localStorage'a kaydeder.
 * @param {string} q - Arama terimi
 */
function addToHistory(q) {
  if (!q) return;
  // Varsa eskiden çıkar, başa ekle
  state.history = state.history.filter(item => item.toLowerCase() !== q.toLowerCase());
  state.history.unshift(q);
  // Max 5 eleman tut
  if (state.history.length > 5) {
    state.history.pop();
  }
  localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(state.history));
  renderHistory();
}

/**
 * Arama geçmişini yükler.
 */
function loadHistory() {
  try {
    const saved = localStorage.getItem(CONFIG.HISTORY_KEY);
    if (saved) {
      state.history = JSON.parse(saved);
      renderHistory();
    }
  } catch (e) {
    console.error("Geçmiş yüklenemedi", e);
  }
}

/**
 * Arama geçmişini render eder.
 */
function renderHistory() {
  DOM.searchHistory.innerHTML = '';
  state.history.forEach((query, index) => {
    const chip = document.createElement('div');
    chip.className = 'history-chip';
    
    const textSpan = document.createElement('span');
    textSpan.className = 'history-chip-text';
    textSpan.textContent = query;
    textSpan.addEventListener('click', () => {
      DOM.searchInput.value = query;
      search(query, DOM.yearFilter.value, DOM.typeFilter.value, true);
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'history-chip-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.setAttribute('aria-label', `Remove ${query}`);
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.history.splice(index, 1);
      localStorage.setItem('cinesearch_history', JSON.stringify(state.history));
      renderHistory();
    });

    chip.appendChild(textSpan);
    chip.appendChild(removeBtn);
    DOM.searchHistory.appendChild(chip);
  });
}

/**
 * Yıl filtresi dropdown'ını mevcut yıldan 1900'e kadar doldurur.
 */
function populateYearFilter() {
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 1900; y--) {
    const opt = document.createElement('option');
    opt.value       = y;
    opt.textContent = y;
    DOM.yearFilter.appendChild(opt);
  }
}

/**
 * Poster URL'i geçerli mi kontrol eder.
 * @param {string} url - Poster URL'i
 * @returns {boolean}
 */
function isPosterValid(url) {
  return url && url !== 'N/A';
}

/* ============================================================
   DURUM YÖNETİMİ (UI State)
   ============================================================ */

/** Tüm durumları gizler */
function hideAllStates() {
  DOM.loadingState.hidden   = true;
  DOM.errorState.hidden     = true;
  DOM.emptyState.hidden     = true;
  DOM.resultsSection.hidden = true;
}

function showLoading() {
  hideAllStates();
  DOM.loadingState.hidden = false;
}

function showError(msg) {
  hideAllStates();
  DOM.errorMessage.textContent = msg;
  DOM.errorState.hidden = false;
}

function showEmpty() {
  hideAllStates();
  DOM.emptyState.hidden = false;
}

function showResults() {
  hideAllStates();
  DOM.resultsSection.hidden = false;
}



/* ============================================================
   API KATMANI
   ============================================================ */

/**
 * OMDB API'sine istek atar.
 * @param {Object} params - URL parametreleri
 * @returns {Promise<Object>} - API yanıtı
 */
async function fetchOMDB(params) {
  const url = new URL(CONFIG.BASE_URL);
  url.searchParams.set('apikey', CONFIG.API_KEY);

  Object.entries(params).forEach(([key, val]) => {
    if (val) url.searchParams.set(key, val);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Sunucu hatası: ${response.status}`);
  }

  const data = await response.json();

  if (data.Response === 'False') {
    throw new Error(data.Error || 'Bilinmeyen bir hata oluştu.');
  }

  return data;
}

/**
 * Film listesi arar (s parametresi).
 * @param {string} query - Arama terimi
 * @param {string} year  - Yıl filtresi
 * @param {string} type  - Tür filtresi
 * @param {number} page  - Sayfa numarası
 * @returns {Promise<Object>} - Film listesi ve toplam sonuç sayısı
 */
async function searchMovies(query, year, type, page = 1) {
  const data = await fetchOMDB({ s: query, y: year, type, page });
  
  /* Filmleri IMDb puanlarıyla zenginleştir (Sıralama için arka planda detayları çek) */
  const enrichedMovies = await Promise.all(
    data.Search.map(async (movie) => {
      try {
        const detail = await fetchOMDB({ i: movie.imdbID });
        return {
          ...movie,
          imdbRating: detail.imdbRating && detail.imdbRating !== 'N/A' ? parseFloat(detail.imdbRating) : 0
        };
      } catch {
        return { ...movie, imdbRating: 0 };
      }
    })
  );

  return { 
    movies: enrichedMovies, 
    totalResults: parseInt(data.totalResults, 10) || 0 
  };
}

/**
 * Tek bir filmin detaylarını getirir (i parametresi).
 * @param {string} imdbID - IMDb ID
 * @returns {Promise<Object>} - Film detayları
 */
async function fetchMovieDetail(imdbID) {
  return await fetchOMDB({ i: imdbID, plot: 'full' });
}

/* ============================================================
   RENDER KATMANI
   ============================================================ */

/**
 * Tek bir film kartı HTML elementi oluşturur.
 * @param {Object} movie - Film verisi
 * @returns {HTMLElement}
 */
function createMovieCard(movie) {
  const card = document.createElement('article');
  card.className = 'movie-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `${movie.Title} (${movie.Year})`);

  const typeLabel = {
    movie:   'Movie',
    series:  'Series',
    episode: 'Episode',
  }[movie.Type] || movie.Type;

  card.innerHTML = `
    <div class="card-poster-wrap">
      ${isPosterValid(movie.Poster)
        ? `<img class="card-poster" src="${movie.Poster}" alt="${movie.Title} poster" loading="lazy" />`
        : `<div class="card-poster-placeholder">🎬</div>`
      }
      ${typeLabel ? `<span class="card-type-badge">${typeLabel}</span>` : ''}
      ${movie.imdbRating ? `<span class="card-rating-badge">★ ${movie.imdbRating}</span>` : ''}
    </div>
    <div class="card-body">
      <h3 class="card-title">${movie.Title}</h3>
      <p  class="card-year">${movie.Year}</p>
    </div>
  `;

  /* Poster yüklenemezse placeholder emoji ile değiştir */
  const posterImg = card.querySelector('.card-poster');
  if (posterImg) {
    posterImg.addEventListener('error', () => {
      const placeholder = document.createElement('div');
      placeholder.className = 'card-poster-placeholder';
      placeholder.textContent = '🎬';
      posterImg.replaceWith(placeholder);
    });
  }

  /* Karta tıklama ve klavye desteği */
  const openDetail = () => openModal(movie.imdbID);
  card.addEventListener('click', openDetail);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); }
  });

  return card;
}

/**
 * OMDb sonuçlarını UI'da gösterir.
 * Eğer append true ise, var olanların sonuna ekler (Pagination için).
 * @param {Array} movies 
 * @param {number} totalResults 
 * @param {boolean} append 
 */
function renderResults(movies, totalResults, append = false) {
  if (!append) {
    DOM.resultsGrid.innerHTML = '';
  }

  DOM.resultsCount.textContent = `${totalResults} results`;
  DOM.resultsQuery.textContent = `for "${state.lastQuery}"`;

  // Sort local movies array if a sort filter is selected
  const sortedMovies = [...movies];
  const sortVal = DOM.sortFilter.value;
  if (sortVal) {
    sortedMovies.sort((a, b) => {
      if (sortVal === 'year_desc') {
        return parseInt(b.Year) - parseInt(a.Year);
      }
      if (sortVal === 'year_asc') {
        return parseInt(a.Year) - parseInt(b.Year);
      }
      if (sortVal === 'title_asc') {
        return a.Title.localeCompare(b.Title);
      }
      if (sortVal === 'imdb_desc') {
        return (b.imdbRating || 0) - (a.imdbRating || 0);
      }
      if (sortVal === 'imdb_asc') {
        return (a.imdbRating || 0) - (b.imdbRating || 0);
      }
      return 0;
    });
  }

  const fragment = document.createDocumentFragment();
  sortedMovies.forEach(movie => fragment.appendChild(createMovieCard(movie)));
  DOM.resultsGrid.appendChild(fragment);

  // Pagination butonu görünürlüğü
  const currentCount = DOM.resultsGrid.querySelectorAll('.movie-card').length;
  if (currentCount < totalResults) {
    DOM.loadMoreContainer.hidden = false;
  } else {
    DOM.loadMoreContainer.hidden = true;
  }

  showResults();
}

/* ============================================================
   MODAL
   ============================================================ */

/**
 * Film detay modalını açar ve içeriği doldurur.
 * @param {string} imdbID - IMDb ID
 */
async function openModal(imdbID) {
  /* Önce modalı aç, sonra veri yükle */
  DOM.modalTitle.textContent   = 'Yükleniyor…';
  DOM.modalGenre.textContent   = '';
  DOM.modalMeta.textContent    = '';
  DOM.modalPlot.textContent    = '';
  DOM.modalDetails.innerHTML   = '';
  DOM.modalRatings.innerHTML   = '';
  DOM.modalPoster.src          = '';
  DOM.modalPoster.alt          = '';
  DOM.modalOverlay.hidden      = false;
  document.body.style.overflow = 'hidden';

  try {
    const movie = await fetchMovieDetail(imdbID);
    populateModal(movie);
  } catch (err) {
    DOM.modalTitle.textContent = 'Detay yüklenemedi.';
    DOM.modalPlot.textContent  = err.message;
  }
}

/**
 * Modal içeriğini film verisiyle doldurur.
 * @param {Object} movie - Detaylı film verisi
 */
function populateModal(movie) {
  /* Poster */
  if (isPosterValid(movie.Poster)) {
    DOM.modalPoster.src = movie.Poster;
    DOM.modalPoster.alt = `${movie.Title} poster`;
  } else {
    DOM.modalPoster.src = '';
    DOM.modalPoster.alt = 'Poster not found';
  }

  /* Başlık & meta */
  DOM.modalTitle.textContent = movie.Title;
  DOM.modalGenre.textContent = movie.Genre !== 'N/A' ? movie.Genre : '';
  DOM.modalMeta.textContent  = [movie.Year, movie.Rated, movie.Runtime]
    .filter(v => v && v !== 'N/A')
    .join(' · ');

  /* Özet */
  DOM.modalPlot.textContent = movie.Plot !== 'N/A'
    ? movie.Plot
    : 'No plot information available.';

  /* Detay grid'i */
  const details = [
    { label: 'Director',  value: movie.Director },
    { label: 'Actors',    value: movie.Actors },
    { label: 'Language',  value: movie.Language },
    { label: 'Country',   value: movie.Country },
    { label: 'Awards',    value: movie.Awards },
    { label: 'Box Office',value: movie.BoxOffice },
  ];

  DOM.modalDetails.innerHTML = details
    .filter(d => d.value && d.value !== 'N/A')
    .map(d => `
      <div class="detail-item">
        <p class="detail-label">${d.label}</p>
        <p class="detail-value">${d.value}</p>
      </div>
    `)
    .join('');

  /* Puanlar */
  if (movie.Ratings && movie.Ratings.length > 0) {
    DOM.modalRatings.innerHTML = movie.Ratings
      .map(r => `
        <div class="rating-item">
          <span class="rating-source">${r.Source}</span>
          <span class="rating-value">${r.Value}</span>
        </div>
      `)
      .join('');
  }
}

/** Modalı kapatır */
function closeModal() {
  DOM.modalOverlay.hidden      = true;
  document.body.style.overflow = '';
}

/* ============================================================
   ANA ARAMA FONKSİYONU
   ============================================================ */

/**
 * Arama yapar, durumu günceller ve sonuçları render eder.
 * @param {string} query - Arama terimi
 * @param {string} year  - Yıl filtresi
 * @param {string} type  - Tür filtresi
 * @param {boolean} shouldScroll - Sonuçlara scroll yapılıp yapılmayacağı
 */
async function search(query, year = '', type = '', shouldScroll = false) {
  const trimmed = query.trim();

  if (!trimmed) {
    showEmpty();
    return;
  }

  /* Aynı parametrelerle tekrar arama yapılmasını engelle */
  if (
    state.isLoading ||
    (trimmed === state.lastQuery && year === state.lastYear && type === state.lastType)
  ) return;

  state.isLoading  = true;
  state.lastQuery  = trimmed;
  state.lastYear   = year;
  state.lastType   = type;
  state.currentPage = 1;

  showLoading();
  persistState(trimmed, year, type);
  addToHistory(trimmed);

  try {
    const { movies, totalResults } = await searchMovies(trimmed, year, type, state.currentPage);
    
    if (movies.length > 0) {
        state.movies = movies;
        state.totalResults = totalResults;
        renderResults(state.movies, state.totalResults, false);
        
        if (shouldScroll) {
          setTimeout(() => {
            document.getElementById('mainContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
    }
  } catch (err) {
    /* Loading bitti — hata göster (loading'i gizle) */
    const msg = translateError(err.message);
    showError(msg);
  } finally {
    state.isLoading = false;
  }
}

/**
 * Sonraki sayfayı yükler.
 */
async function loadMore() {
  if (state.isLoading) return;
  state.isLoading = true;
  state.currentPage++;
  
  const originalText = DOM.loadMoreBtn.textContent;
  DOM.loadMoreBtn.textContent = 'Loading...';
  DOM.loadMoreBtn.disabled = true;

  try {
    const { movies } = await searchMovies(state.lastQuery, state.lastYear, state.lastType, state.currentPage);
    
    // Add new movies to the state
    state.movies = [...state.movies, ...movies];
    
    // Re-render everything with the new complete list so sorting applies correctly
    renderResults(state.movies, state.totalResults, false);
  } catch (err) {
    state.currentPage--; // Hata durumunda sayfayı geri al
    console.error("Daha fazla yüklenirken hata:", err);
  } finally {
    state.isLoading = false;
    DOM.loadMoreBtn.textContent = originalText;
    DOM.loadMoreBtn.disabled = false;
  }
}

/**
 * OMDB hata mesajlarını Türkçeye çevirir. (Artık İngilizce dönüyor)
 * @param {string} msg - Orijinal hata mesajı
 * @returns {string}   - İngilizce hata mesajı
 */
function translateError(msg) {
  if (msg.includes('Movie not found') || msg.includes('not found')) {
    return 'Movie not found. Please try a different search term.';
  }
  if (msg.includes('Invalid API key')) {
    return 'Invalid API key. Please check your config.';
  }
  if (msg.includes('Too many results')) {
    return 'Too many results found. Please narrow down your search.';
  }
  if (msg.includes('Sunucu hatası') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return `Server unreachable. Please check your internet connection.`;
  }
  return msg || 'An unexpected error occurred. Please try again.';
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

/** Arama butonuna tıklama */
DOM.searchBtn.addEventListener('click', () => {
  debouncedSearch.cancel(); // Bekleyen debounce'u iptal et
  state.lastQuery = ''; // Aynı sorgu tekrar çalışsın diye sıfırla
  search(DOM.searchInput.value, DOM.yearFilter.value, DOM.typeFilter.value, true);
});

/** Enter tuşuyla arama */
DOM.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    debouncedSearch.cancel(); // Bekleyen debounce'u iptal et
    state.lastQuery = '';
    search(DOM.searchInput.value, DOM.yearFilter.value, DOM.typeFilter.value, true);
  }
});

/** Debounce ile otomatik arama (yazarken) */
const debouncedSearch = debounce(() => {
  search(DOM.searchInput.value, DOM.yearFilter.value, DOM.typeFilter.value);
}, CONFIG.DEBOUNCE_MS);

DOM.searchInput.addEventListener('input', debouncedSearch);

/** Daha fazla göster butonu */
DOM.loadMoreBtn.addEventListener('click', loadMore);

/** Filtre değişiminde yeniden ara */
DOM.yearFilter.addEventListener('change', () => {
  state.lastYear = ''; // Güncelleme için sıfırla
  search(DOM.searchInput.value, DOM.yearFilter.value, DOM.typeFilter.value);
});

DOM.typeFilter.addEventListener('change', () => {
  state.lastType = '';
  search(DOM.searchInput.value, DOM.yearFilter.value, DOM.typeFilter.value);
});

/** Tekrar dene butonu */
DOM.retryBtn.addEventListener('click', () => {
  debouncedSearch.cancel();
  state.lastQuery = '';
  search(DOM.searchInput.value, DOM.yearFilter.value, DOM.typeFilter.value);
});

/** Modal kapatma — buton */
DOM.modalClose.addEventListener('click', closeModal);

/** Modal kapatma — overlay tıklaması */
DOM.modalOverlay.addEventListener('click', (e) => {
  if (e.target === DOM.modalOverlay) closeModal();
});

/** Modal kapatma — Escape tuşu */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !DOM.modalOverlay.hidden) closeModal();
});

/* ── Scroll Butonları ── */
const scrollTopBtn = document.getElementById('scrollTopBtn');
const logoBtn = document.getElementById('logoBtn');

/** Tema (Dark/Light) Değiştirme */
function initTheme() {
  const savedTheme = localStorage.getItem('cinesearch_theme');
  if (savedTheme === 'light') {
    document.body.setAttribute('data-theme', 'light');
  } else {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('cinesearch_theme', 'dark');
  }
}

DOM.themeToggle.addEventListener('click', () => {
  const currentTheme = document.body.getAttribute('data-theme');
  if (currentTheme === 'light') {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('cinesearch_theme', 'dark');
  } else {
    document.body.setAttribute('data-theme', 'light');
    localStorage.setItem('cinesearch_theme', 'light');
  }
});

/** Sort filtresi değiştiğinde local sonuçları yeniden sırala */
DOM.sortFilter.addEventListener('change', () => {
  if (state.movies.length > 0) {
    renderResults(state.movies, state.totalResults, false);
  }
});

/** Sayfa kaydırıldığında butonu göster/gizle */
window.addEventListener('scroll', () => {
  const heroHeight = document.querySelector('.hero').offsetHeight;
  scrollTopBtn.hidden = window.scrollY < heroHeight * 0.6;
});

/** Butonlara tıklanınca hero/search alanına smooth scroll */
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

scrollTopBtn.addEventListener('click', scrollToTop);
if (logoBtn) {
  logoBtn.addEventListener('click', scrollToTop);
}

/* ============================================================
   BAŞLATMA
   ============================================================ */
(function init() {
  initTheme();           // Temayı (Dark/Light) yükle
  populateYearFilter();  // Yıl dropdown'ını doldur
  loadHistory();         // Arama geçmişini yükle
  restoreFromURL();      // URL'den son aramayı geri yükle
})();