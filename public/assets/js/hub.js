(function () {
  const listEl = document.getElementById('centreList');
  if (!listEl) return;

  // Details are compiled from organisation websites and public listings.
  // Map coordinates are approximate area markers, not exact premises.
  const centres = [
    {
      id: 'acarp',
      name: 'Accra Compost and Recycling Plant (ACARP)',
      region: 'Greater Accra',
      area: 'Kotoku, Accra',
      lat: 5.66,
      lng: -0.16,
      materials: ['Plastics', 'Paper & cardboard', 'Metals', 'Organic/garden'],
      address: 'Kotoku, Accra · GPS GW-0794-4074',
      phone: '024 347 3158 / 024 116 3777',
      website: 'https://acarpghana.com/',
      note: 'Large sorting and composting facility. Call before taking household quantities.',
      source: 'Official website',
      query: 'Accra Compost and Recycling Plant Kotoku Ghana'
    },
    {
      id: 'coliba',
      name: 'Coliba Ghana',
      region: 'Greater Accra',
      area: 'Dome Faase, Adjen Kotoku, Accra',
      lat: 5.68,
      lng: -0.25,
      materials: ['Plastics', 'Paper & cardboard', 'Metals'],
      address: 'Street 1, Dome Faase, Adjen Kotoku District, Accra',
      phone: '020 002 8851',
      email: 'info@coliba.com.gh',
      website: 'https://www.coliba.com.gh/',
      note: 'Plastic recovery service with app, web and SMS collection requests. Ask about current drop-off points.',
      source: 'Official website',
      query: 'Coliba Ghana Dome Faase Adjen Kotoku Accra'
    },
    {
      id: 'sesa',
      name: 'SESA Recycling',
      region: 'Greater Accra',
      area: 'Teshie and other Accra collection points',
      lat: 5.62,
      lng: -0.11,
      materials: ['Plastics', 'Metals', 'Paper & cardboard'],
      address: 'Lascala Market, Teshie, Accra · other collection points available',
      phone: '054 030 4865',
      website: 'https://www.sesa-recycling.com/',
      note: 'Reward-for-recycling scheme. Accepts clean, dry water bottles, pure water sachets, hard plastics, crates, broken chairs and beverage cans.',
      source: 'Official website',
      query: 'SESA Recycling Lascala Market Teshie Accra'
    },
    {
      id: 'mckingtorch',
      name: 'Mckingtorch Africa',
      region: 'Greater Accra',
      area: 'Adenta, Accra',
      lat: 5.73,
      lng: -0.14,
      materials: ['Plastics'],
      address: 'New Legon Road, Adenta, Accra',
      website: 'https://mckingtorchafrica.org/',
      note: 'Upcycles pure water sachets and plastic waste into useful products. Contact or book a tour before dropping items.',
      source: 'Official website / public map listing',
      query: 'Mckingtorch Africa New Legon Road Adenta Accra'
    },
    {
      id: 'zoomPak',
      name: 'National Material Recovery Ltd (ZoomPak)',
      region: 'Greater Accra',
      area: 'Achimota, Accra',
      lat: 5.62,
      lng: -0.23,
      materials: ['Plastics', 'Paper & cardboard', 'Metals'],
      address: 'Achimota, Accra',
      note: 'Material recovery facility listed in public recycling directories. Confirm accepted materials and hours before visiting.',
      source: 'Public directory listing',
      query: 'National Material Recovery ZoomPak Achimota Accra'
    },
    {
      id: 'kcarp',
      name: 'Kumasi Compost & Recycling Plant (KCARP)',
      region: 'Ashanti',
      area: 'Adagya / Essereso-Adagya, Kumasi',
      lat: 6.62,
      lng: -1.6,
      materials: ['Plastics', 'Paper & cardboard', 'Metals', 'Organic/garden'],
      address: 'Adagya, Kumasi, Ashanti Region',
      phone: '032 249 5112 / 032 249 5115',
      email: 'info@kcarpltd.com',
      website: 'https://kcarpltd.com/',
      note: 'Sorting, composting and materials recovery plant. Call before bringing household quantities.',
      source: 'Official website',
      query: 'Kumasi Compost and Recycling Plant Adagya Ghana'
    },
    {
      id: 'b4a',
      name: 'B4A Recycling Enterprise',
      region: 'Western',
      area: 'Anaji, Sekondi-Takoradi',
      lat: 4.91,
      lng: -1.76,
      materials: ['Tyres/rubber', 'Plastics', 'Metals'],
      address: 'De-Graft Afful Avenue, Anaji, Sekondi-Takoradi',
      note: 'Recycling enterprise known for tyre and rubber recovery. Confirm current drop-off acceptance before visiting.',
      source: 'Public directory listing',
      query: 'B4A Recycling Enterprise De-Graft Afful Avenue Takoradi'
    },
    {
      id: 'zeal',
      name: 'Zeal Environ Technologies',
      region: 'Western',
      area: 'Shama Junction, Sekondi-Takoradi',
      lat: 4.94,
      lng: -1.79,
      materials: ['Plastics', 'Metals', 'Paper & cardboard'],
      address: 'Shama Junction, Sekondi-Takoradi, Western Region',
      note: 'Recycling facility listed in public directories. Call ahead to confirm materials and opening hours.',
      source: 'Public directory listing',
      query: 'Zeal Environ Technologies Shama Junction Takoradi'
    },
    {
      id: 'tamale',
      name: 'Tamale plastic buy-back centres',
      region: 'Northern',
      area: 'Sakasaka and Salamba, Tamale',
      lat: 9.42,
      lng: -0.86,
      materials: ['Plastics'],
      address: 'Sakasaka and Salamba communities, Tamale',
      note: 'Community plastic collection and buy-back points set up with the Tamale Metropolitan Assembly and Caritas Ghana. Confirm they are still operating before visiting.',
      source: 'Tamale Metropolitan Assembly / GNA',
      website: 'https://tamalemetro.gov.gh/2024/10/15/waste-management-dept-lunches-community-plastic-collection-point/',
      query: 'Sakasaka Tamale plastic buy back centre'
    }
  ];

  const REGION_COLOURS = {
    'Greater Accra': '#176b45',
    'Ashanti': '#d97706',
    'Western': '#2563eb',
    'Northern': '#7c3aed'
  };

  const searchEl = document.getElementById('centreSearch');
  const regionEl = document.getElementById('centreRegion');
  const materialEl = document.getElementById('centreMaterial');
  const resetEl = document.getElementById('resetCentreFilters');
  const countEl = document.getElementById('centreCount');
  const mapEl = document.getElementById('hubMap');

  let hubMap = null;
  let markerLayer = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function telHref(phone) {
    const first = String(phone || '').split(/[\/,]/)[0].trim();
    return 'tel:' + first.replace(/[^+\d]/g, '');
  }

  function contactLinks(centre) {
    const links = [];
    if (centre.phone) links.push(`<a href="${telHref(centre.phone)}"><i class="fa-solid fa-phone"></i> ${esc(centre.phone)}</a>`);
    if (centre.email) links.push(`<a href="mailto:${esc(centre.email)}"><i class="fa-solid fa-envelope"></i> ${esc(centre.email)}</a>`);
    if (centre.website) links.push(`<a href="${esc(centre.website)}" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> Website <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`);
    return links.length ? `<div class="centre-contact">${links.join('')}</div>` : '';
  }

  function card(centre) {
    const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(centre.query)}`;
    const materials = centre.materials.map((item) => `<span>${esc(item)}</span>`).join('');
    return `<article class="centre-card">
      <div class="centre-top">
        <div><h3>${esc(centre.name)}</h3><p><i class="fa-solid fa-location-dot"></i> ${esc(centre.area)}</p></div>
        <span class="centre-region" style="--pin:${REGION_COLOURS[centre.region] || '#176b45'}">${esc(centre.region)}</span>
      </div>
      <div class="centre-materials">${materials}</div>
      <p class="centre-address"><i class="fa-solid fa-map-pin"></i> ${esc(centre.address)}</p>
      ${contactLinks(centre)}
      <p class="centre-note"><i class="fa-solid fa-circle-info"></i> ${esc(centre.note)}</p>
      <div class="centre-actions">
        <a class="btn btn-outline btn-small" href="${directions}" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right"></i> Directions</a>
        ${centre.source ? `<span class="centre-source">Source: ${esc(centre.source)}</span>` : ''}
      </div>
    </article>`;
  }

  function initMap() {
    if (!mapEl || typeof L === 'undefined') return;
    hubMap = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView([7.8, -1.1], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(hubMap);
    markerLayer = L.layerGroup().addTo(hubMap);
  }

  function updateMarkers(visible) {
    if (!hubMap || !markerLayer) return;
    markerLayer.clearLayers();
    if (!visible.length) return;

    const bounds = [];
    visible.forEach((centre) => {
      const marker = L.circleMarker([centre.lat, centre.lng], {
        radius: 8,
        weight: 2,
        color: '#ffffff',
        fillColor: REGION_COLOURS[centre.region] || '#176b45',
        fillOpacity: 0.95
      }).addTo(markerLayer);
      marker.bindPopup(`<strong>${esc(centre.name)}</strong><br><small>${esc(centre.area)}</small><br>${esc(centre.materials.join(' · '))}`);
      bounds.push([centre.lat, centre.lng]);
    });

    if (bounds.length === 1) hubMap.setView(bounds[0], 12);
    else hubMap.fitBounds(bounds, { padding: [35, 35], maxZoom: 11 });
  }

  function render() {
    const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
    const region = regionEl ? regionEl.value : '';
    const material = materialEl ? materialEl.value : '';

    const visible = centres.filter((centre) => {
      const haystack = [centre.name, centre.region, centre.area, centre.address, centre.materials.join(' ')].join(' ').toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesRegion = !region || centre.region === region;
      const matchesMaterial = !material || centre.materials.includes(material);
      return matchesQuery && matchesRegion && matchesMaterial;
    });

    if (countEl) {
      countEl.textContent = visible.length === centres.length
        ? `Showing all ${centres.length} recycling options across Ghana.`
        : `Showing ${visible.length} of ${centres.length} recycling options.`;
    }

    listEl.innerHTML = visible.length
      ? visible.map(card).join('')
      : '<div class="centre-empty"><i class="fa-solid fa-magnifying-glass"></i><h3>No matching centres</h3><p>Try another material, region or search term. You can also request a GreenLoop pickup.</p></div>';

    updateMarkers(visible);
  }

  searchEl?.addEventListener('input', render);
  regionEl?.addEventListener('change', render);
  materialEl?.addEventListener('change', render);
  resetEl?.addEventListener('click', () => {
    if (searchEl) searchEl.value = '';
    if (regionEl) regionEl.value = '';
    if (materialEl) materialEl.value = '';
    render();
  });

  initMap();
  render();
})();
