exports.handler = async function (event, context) {
  const apiKey = process.env.PHOTO_API_KEY; 
  const searchTerm = event.queryStringParameters.query || 'abstract art';
  const page = event.queryStringParameters.page || 1;
  
  const apiUrl = `https://api.pexels.com/v1/search?query=${searchTerm}&per_page=20&page=${page}`;

  try {
    const response = await fetch(apiUrl, {
      headers: { Authorization: apiKey }
    });
    const data = await response.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch photos" }),
    };
  }
};