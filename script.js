// 1. SUPABASE CONFIGURATION
const SUPABASE_URL = "https://lyrafeikpatjvifhavho.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cmFmZWlrcGF0anZpZmhhdmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTY0MTcsImV4cCI6MjA5NzM5MjQxN30.PQFoPOBh1zGlq3_FOvqmcZKlGDIw8AzLpiu96rAQu9A"; // Paste your long Anon token key string here

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. DOM ELEMENT HOOKS
const photoGrid = document.getElementById('photo-grid');
const dashboardGrid = document.getElementById('dashboard-grid');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const showMoreBtn = document.getElementById('show-more-btn');

// View Containers
const galleryView = document.getElementById('gallery-view');
const dashboardView = document.getElementById('dashboard-view');
const brandLogo = document.getElementById('brand-logo');

// Navigation Interface Triggers
const navDashBtn = document.getElementById('nav-dash-btn');
const navGalleryBtn = document.getElementById('nav-gallery-btn');
const loginNavLink = document.getElementById('login-nav-link');
const signupNavLink = document.getElementById('signup-nav-link');
const logoutBtn = document.getElementById('logout-btn');

// Application States
let currentPage = 1;
let currentQuery = 'abstract art';
let currentUser = null;

// 3. SECURE AUTHENTICATION STATE SYNC CONTROLLERS
function updateNavigationUI() {
    if (currentUser) {
        if(loginNavLink) loginNavLink.style.display = 'none';
        if(signupNavLink) signupNavLink.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        if(navDashBtn) navDashBtn.style.display = 'inline-block';
    } else {
        if(loginNavLink) loginNavLink.style.display = 'inline-block';
        if(signupNavLink) signupNavLink.style.display = 'inline-block';
        if(logoutBtn) logoutBtn.style.display = 'none';
        if(navDashBtn) navDashBtn.style.display = 'none';
        switchToGallery();
    }
}

// Check local storage immediately upon file execution
async function checkInitialSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    updateNavigationUI();
}
checkInitialSession();

// Continuous backend state hook observer
supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateNavigationUI();
    if (event === 'SIGNED_OUT' && dashboardGrid) {
        dashboardGrid.innerHTML = '';
    }
});

// 4. PEXELS GALLERY FETCHING ENGINE
async function loadPhotos(query = 'abstract art', isNewSearch = true) {
    if (isNewSearch) {
        currentPage = 1;
        // Sanitizes query strings to lower case to eliminate routing mismatch blocks
        currentQuery = query.trim().toLowerCase(); 
        
        photoGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af;">Loading inspiration...</p>';
        showMoreBtn.style.display = 'none';
    }
    try {
        const response = await fetch(`/.netlify/functions/get-photos?query=${encodeURIComponent(currentQuery)}&page=${currentPage}`);
        const data = await response.json();
        if (isNewSearch) photoGrid.innerHTML = ''; 

        if (!data.photos || data.photos.length === 0) {
            if (isNewSearch) photoGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af;">No assets discovered matching terms.</p>';
            showMoreBtn.style.display = 'none';
            return;
        }

        data.photos.forEach(photo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            card.innerHTML = `
                <img src="${photo.src.large}" alt="${photo.alt || 'Artify Photo'}" loading="lazy">
                <div class="card-overlay">
                    <span class="photo-author block mb-2 text-sm font-medium text-white">By ${photo.photographer}</span>
                    <button class="download-btn w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 text-xs rounded transition" onclick="handleDownloadAction('${photo.src.original}', 'Artify-${photo.id}.jpg', '${photo.id}', '${photo.photographer.replace(/'/g, "\\'")}')">Download</button>
                </div>
            `;
            photoGrid.appendChild(card);
        });

        showMoreBtn.style.display = (data.total_results > currentPage * 20) ? 'inline-block' : 'none';
    } catch (error) {
        photoGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#ef4444;">Error fetching data arrays from Netlify function pipeline.</p>';
    }
}

// 5. SECURE DOWNLOAD HANDLER (Pushes tracking to DB, then triggers safe browser blob download)
async function handleDownloadAction(imageSrc, fileName, photoId, photographer) {
    if (currentUser) {
        // Safe database record creation
        const { error } = await supabaseClient.from('downloads').insert([{
            user_id: currentUser.id,
            photo_id: photoId,
            photographer: photographer,
            image_url: imageSrc
        }]);
        
        if (error) console.error("Database insert blocked: ", error.message);
    }
    
    // Convert source directly to blob element to download file through system streams
    try {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(blobUrl);
    } catch (e) {
        window.open(imageSrc, '_blank');
    }
}

// 6. DASHBOARD USER COLLECTION ENGINE
async function loadUserDashboard() {
    if (!currentUser) {
        dashboardGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#ef4444;">Please sign in to view database history.</p>';
        return;
    }

    dashboardGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af;">Syncing collection stream...</p>';
    
    const { data, error } = await supabaseClient
        .from('downloads')
        .select('*')
        .order('downloaded_at', { ascending: false });
    
    dashboardGrid.innerHTML = '';
    if (error || !data || data.length === 0) {
        dashboardGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af;">No download tracks logged for this account yet.</p>';
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.innerHTML = `
            <img src="${item.image_url}" alt="Downloaded Art" loading="lazy">
            <div class="card-overlay">
                <span class="photo-author block mb-2 text-sm font-medium text-white">By ${item.photographer}</span>
                <button class="download-btn w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1.5 text-xs rounded transition" onclick="handleDownloadAction('${item.image_url}', 'Artify-Re-${item.photo_id}.jpg', '${item.photo_id}', '${item.photographer.replace(/'/g, "\\'")}')">Re-Download</button>
            </div>
        `;
        dashboardGrid.appendChild(card);
    });
}

// 7. WINDOW VIEWPORT ROUTING
function switchToDashboard() {
    if (galleryView) galleryView.style.display = 'none';
    if (brandLogo) brandLogo.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'block';
    if (navDashBtn) navDashBtn.style.display = 'none';
    if (navGalleryBtn) navGalleryBtn.style.display = 'inline-block';
    loadUserDashboard();
}

function switchToGallery() {
    if (galleryView) galleryView.style.display = 'block';
    if (brandLogo) brandLogo.style.display = 'inline-block';
    if (dashboardView) dashboardView.style.display = 'none';
    if (navGalleryBtn) navGalleryBtn.style.display = 'none';
    if (navDashBtn) navDashBtn.style.display = currentUser ? 'inline-block' : 'none';
}

// 8. FORM & CLICKS LISTENERS
if(searchForm) {
    searchForm.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const val = searchInput.value.trim(); 
        if(val) loadPhotos(val, true); 
    });
}
if(showMoreBtn) {
    showMoreBtn.addEventListener('click', () => { 
        currentPage++; 
        loadPhotos(currentQuery, false); 
    });
}

if(navDashBtn) navDashBtn.addEventListener('click', switchToDashboard);
if(navGalleryBtn) navGalleryBtn.addEventListener('click', switchToGallery);
if(logoutBtn) logoutBtn.addEventListener('click', () => supabaseClient.auth.signOut());

// 9. AUTOMATIC RUN
loadPhotos();