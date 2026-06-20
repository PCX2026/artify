// api/get-photos.js
export default async function handler(req, res) {
    // 1. Set standard CORS headers so your frontend can read the response safely
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // 2. Extract query strings directly from Vercel's incoming request object
    const { query = 'abstract art', page = 1 } = req.query;
    const pexelsKey = process.env.PEXELS_API_KEY;

    if (!pexelsKey) {
        return res.status(500).json({ error: "Missing PEXELS_API_KEY environment variable on server." });
    }

    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&page=${page}`, {
            headers: { 'Authorization': pexelsKey }
        });
        
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Failed fetching data from Pexels core engine." });
    }
}