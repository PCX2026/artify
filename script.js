// 1. SUPABASE CONFIGURATION (Replace with your actual keys)
const SUPABASE_URL = "https://lyrafeikpatjvifhavho.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cmFmZWlrcGF0anZpZmhhdmhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTY0MTcsImV4cCI6MjA5NzM5MjQxN30";

// Initializing with a unique variable name to prevent browser naming collisions
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. DOM ELEMENTS
const photoGrid = document.getElementById('photo-grid');
const dashboardGrid = document.getElementById('dashboard-grid');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const showMoreBtn = document.getElementById('show-more-btn');

// Navigation Hooks
const galleryView = document.getElementById('gallery-view');
const dashboardView = document.getElementById('dashboard-view');
const navDashBtn = document.getElementById('nav-dash-btn');
const navGalleryBtn = document.getElementById('nav-gallery-btn');
const loginNavLink = document.getElementById('login-nav-link');
const signupNavLink = document.getElementById('signup-nav-link');
const logoutBtn = document.getElementById('logout-btn');

// Application States
let currentPage = 1;
let currentQuery = 'abstract art';
let currentUser = null;

// 3. AUTH STATE LISTENER
supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
        if(loginNavLink) loginNavLink.style.display = 'none';
        if(signupNavLink) signupNavLink.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        navDashBtn.style.display = 'inline-block';
    } else {
        if(loginNavLink) loginNavLink.style.display = 'inline-block';
        if(signupNavLink) signupNavLink.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        navDashBtn.style.display = 'none';
        switchToGallery();
    }
});

// 4. PEXELS GALLERY FETCHING LOGIC
async function loadPhotos(query = 'abstract art', isNewSearch = true) {
    if (isNewSearch) {
        currentPage = 1;
        // Forces query to lowercase so uppercase inputs don't break the backend API routing
        currentQuery = query.trim().toLowerCase(); 
        
        photoGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af;">Loading inspiration...</p>';
        showMoreBtn.style.display = 'none';
    }
    try {
        const response = await fetch(`/.netlify/functions/get-photos?query=${encodeURIComponent(currentQuery)}&page=${currentPage}`);
        const data = await response.json();
        if (isNewSearch) photoGrid.innerHTML = ''; 

        if (!data.photos || data.photos.length === 0) {
            if (isNewSearch) photoGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af;">No images found.</p>';
            showMoreBtn.style.display = 'none';
            return;
        }

        data.photos.forEach(photo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            card.innerHTML = `
                <img src="${photo.src.large}" alt="${photo.alt || 'Artify Photo'}" loading="lazy">
                <div class="card-overlay">
                    <span class="photo-author">By ${photo.photographer}</span>
                    <button class="download-btn" onclick="handleDownloadAction('${photo.src.original}', 'Artify-${photo.id}.jpg', '${photo.id}', '${photo.photographer.replace(/'/g, "\\'")}')">Download</button>
                </div>
            `;
            photoGrid.appendChild(card);
        });

        showMoreBtn.style.display = (data.total_results > currentPage * 20) ? 'inline-block' : 'none';
    } catch (error) {
        photoGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#ef4444;">Error fetching images.</p>';
    }
}

// 5. DOWNLOAD MANAGER (Tracks & downloads image)
async function handleDownloadAction(imageSrc, fileName, photoId, photographer) {
    if (currentUser) {
        // Record download history into Supabase database table
        await supabaseClient.from('downloads').insert([{
            user_id: currentUser.id,
            photo_id: photoId,
            photographer: photographer,
            image_url: imageSrc
        }]);
    }
    
    // Force browser to save file directly instead of opening a tab
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

// 6. DASHBOARD MANAGER (Loads user download history)
async function loadUserDashboard() {
    dashboardGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af;">Loading your collection...</p>';
    const { data, error } = await supabaseClient.from('downloads').select('*').order('downloaded_at', { ascending: false });
    
    dashboardGrid.innerHTML = '';
    if (error || !data || data.length === 0) {
        dashboardGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#9ca3af;">You haven\'t downloaded any photos yet.</p>';
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.innerHTML = `
            <img src="${item.image_url}" alt="Downloaded Art" loading="lazy">
            <div class="card-overlay">
                <span class="photo-author">By ${item.photographer}</span>
                <button class="download-btn" onclick="handleDownloadAction('${item.image_url}', 'Artify-Re-${item.photo_id}.jpg', '${item.photo_id}', '${item.photographer.replace(/'/g, "\\'")}')">Re-Download</button>
            </div>
        `;
        dashboardGrid.appendChild(card);
    });
}

// 7. NAVIGATION CONTROLS
function switchToDashboard() {
    galleryView.style.display = 'none';
    dashboardView.style.display = 'block';
    navDashBtn.style.display = 'none';
    navGalleryBtn.style.display = 'inline-block';
    loadUserDashboard();
}

function switchToGallery() {
    galleryView.style.display = 'block';
    dashboardView.style.display = 'none';
    navGalleryBtn.style.display = 'none';
    navDashBtn.style.display = currentUser ? 'inline-block' : 'none';
}

// 8. EVENT LISTENERS
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

navDashBtn.addEventListener('click', switchToDashboard);
navGalleryBtn.addEventListener('click', switchToGallery);
logoutBtn.addEventListener('click', () => supabaseClient.auth.signOut());

// 9. INITIAL EXECUTION
loadPhotos();