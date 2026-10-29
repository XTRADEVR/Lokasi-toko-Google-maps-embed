const state = {
  stores: [],
  selectedStoreId: null,
  searchQuery: '',
  maxDistanceKm: 'all',
  userLocation: {
    lat: -6.1944,
    lng: 106.8229,
    label: 'Jakarta Pusat (Default)',
  },
  deferredPrompt: null,
};

// Rumus Haversine untuk menghitung jarak (km) antara posisi pengguna & toko
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Buat URL Google Maps Embed dari koordinat & nama toko
function buildEmbedUrl(store) {
  const query = encodeURIComponent(store.name + ', ' + store.address);
  return `https://maps.google.com/maps?q=${query}&ll=${store.lat},${store.lng}&z=16&output=embed&hl=id`;
}

// Buat URL Google Maps Directions untuk navigasi rute
function buildDirectionsUrl(store) {
  const origin = `${state.userLocation.lat},${state.userLocation.lng}`;
  const dest = `${store.lat},${store.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}

// Perbarui jarak semua toko terhadap titik pengguna
function recalculateDistances() {
  state.stores = state.stores.map((store) => ({
    ...store,
    distanceKm: calculateDistanceKm(
      state.userLocation.lat,
      state.userLocation.lng,
      store.lat,
      store.lng
    ),
  })).sort((a, b) => a.distanceKm - b.distanceKm);
}

// Filter toko berdasarkan kata kunci dan jarak maksimum
function getFilteredStores() {
  return state.stores.filter((store) => {
    const q = state.searchQuery.trim().toLowerCase();
    const matchQuery =
      !q ||
      store.name.toLowerCase().includes(q) ||
      store.address.toLowerCase().includes(q) ||
      store.city.toLowerCase().includes(q);

    const matchDist =
      state.maxDistanceKm === 'all' ||
      store.distanceKm <= Number(state.maxDistanceKm);

    return matchQuery && matchDist;
  });
}

// Pilih toko dan geser titik lokasi pada iframe Google Maps
function selectStore(storeId, shouldScrollMap = false) {
  state.selectedStoreId = storeId;
  const activeStore = state.stores.find((s) => s.id === storeId);
  if (!activeStore) return;

  // Perbarui panel informasi peta
  document.getElementById('active-store-meta').textContent =
    `${activeStore.city} · ${activeStore.category} · ${activeStore.distanceKm.toFixed(1)} km`;
  document.getElementById('active-store-name').textContent = activeStore.name;
  document.getElementById('active-store-address').textContent = activeStore.address;
  document.getElementById('active-store-hours').textContent =
    `Jam Operasional: ${activeStore.hours}`;
  document.getElementById('active-store-coords').textContent =
    `Koordinat: ${activeStore.lat.toFixed(4)}, ${activeStore.lng.toFixed(4)}`;

  // Perbarui iframe Google Maps & tombol Directions
  const iframe = document.getElementById('google-map-iframe');
  iframe.src = buildEmbedUrl(activeStore);

  const dirBtn = document.getElementById('btn-directions');
  dirBtn.href = buildDirectionsUrl(activeStore);

  renderStoreList();

  if (shouldScrollMap && window.innerWidth < 1024) {
    document.getElementById('peta').scrollIntoView({ behavior: 'smooth' });
  }
}

// Render daftar toko di sidebar
function renderStoreList() {
  const container = document.getElementById('store-list');
  const countLabel = document.getElementById('store-count-label');
  const filtered = getFilteredStores();

  countLabel.textContent = `${filtered.length} gerai ditemukan`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-sm text-slate-500">
        Tidak ada gerai yang sesuai dengan filter jarak atau pencarian Anda.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((store) => {
      const isSelected = store.id === state.selectedStoreId;
      return `
        <article
          class="p-4 sm:p-5 transition-colors cursor-pointer ${
            isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
          }"
          onclick="selectStore('${store.id}', true)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-slate-500">
                <span>${store.city}</span>
                <span aria-hidden="true"> · </span>
                <span>${store.category}</span>
                <span aria-hidden="true"> · </span>
                <span class="font-mono tabular-nums font-medium text-emerald-700">${store.distanceKm.toFixed(1)} km</span>
              </p>
              <h3 class="mt-1 text-sm font-bold text-slate-900">${store.name}</h3>
            </div>
          </div>
          <p class="mt-1.5 text-xs leading-relaxed text-slate-600">${store.address}</p>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <span class="text-xs text-slate-500 font-mono tabular-nums">Jam: ${store.hours}</span>
            <div class="flex items-center gap-2">
              <a
                href="${buildDirectionsUrl(store)}"
                target="_blank"
                rel="noopener noreferrer"
                onclick="event.stopPropagation()"
                class="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4"
              >
                Rute
              </a>
              <button
                type="button"
                onclick="event.stopPropagation(); selectStore('${store.id}', true)"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }"
              >
                Lihat Lokasi
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

// Deteksi posisi pengguna menggunakan Geolocation API
function detectUserLocation() {
  const statusEl = document.getElementById('gps-status-text');
  if (!('geolocation' in navigator)) {
    statusEl.textContent = 'GPS tidak didukung browser';
    return;
  }

  statusEl.textContent = 'Mendeteksi GPS...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: 'Lokasi GPS Aktif',
      };
      statusEl.textContent = `GPS (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`;
      recalculateDistances();
      if (state.stores.length > 0) {
        selectStore(state.stores[0].id, false);
      }
    },
    () => {
      statusEl.textContent = 'Izin GPS ditolak · Default Jakarta';
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Inisialisasi aplikasi & muat app-data.json
async function initApp() {
  try {
    const response = await fetch('app-data.json');
    const data = await response.json();
    state.stores = data.stores || [];
    recalculateDistances();
    if (state.stores.length > 0) {
      selectStore(state.stores[0].id, false);
    }
  } catch (error) {
    console.error('Gagal memuat data toko:', error);
  }

  // Event Pencarian
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderStoreList();
  });

  // Event Filter Jarak
  document.querySelectorAll('.dist-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.maxDistanceKm = btn.getAttribute('data-distance');
      document.querySelectorAll('.dist-btn').forEach((b) => {
        b.className = 'dist-btn rounded-lg py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors';
      });
      btn.className = 'dist-btn rounded-lg bg-white py-1.5 text-xs font-semibold text-slate-900 shadow-xs transition-colors';
      renderStoreList();
    });
  });

  // Event Tombol GPS
  document.getElementById('btn-use-gps').addEventListener('click', detectUserLocation);

  // Registrasi Service Worker PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.error('Registrasi SW gagal:', err);
    });
  }

  // Event Install Prompt PWA
  const installBtn = document.getElementById('btn-install-pwa');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    installBtn.classList.add('hidden');
  });
}

document.addEventListener('DOMContentLoaded', initApp);
