export default async function handler(req, res) {
  // 1. Handle preflight CORS requests from browsers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Extract the movie ID from the URL parameters
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing movie ID parameter' });
  }

  try {
    const targetUrl = `https://max.popembed.net/movie-tv/neon/movie/${id}`;

    // 3. Fetch the data from the target API server-side
    const apiResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({ error: 'Failed fetching target API' });
    }

    // 4. Return the data to your frontend
    const data = await apiResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
