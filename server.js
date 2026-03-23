const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store uploaded files in memory temporarily
const upload = multer({ storage: multer.memoryStorage() });

// AniList GraphQL Query to get full anime details
const anilistQuery = `
  query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id
      title { romaji english native }
      description
      coverImage { large }
      episodes
      genres
      averageScore
    }
  }
`;

app.post('/api/search-anime', upload.single('image'), async (req, res) => {
  try {
    const traceMoeUrl = 'https://api.trace.moe/search';
    let response;

    // 1. Check if user uploaded a file OR pasted a URL
    if (req.file) {
      const formData = new FormData();
      formData.append('image', req.file.buffer, req.file.originalname);
      response = await axios.post(traceMoeUrl, formData, {
        headers: formData.getHeaders(),
      });
    } else if (req.body.imageUrl) {
      response = await axios.get(`${traceMoeUrl}?url=${encodeURIComponent(req.body.imageUrl)}`);
    } else {
      return res.status(400).json({ error: 'Please provide an image file or URL' });
    }

    const topResult = response.data.result[0];
    if (!topResult) return res.status(404).json({ error: 'No anime found for this image' });

    // 2. Fetch full details from AniList using the ID from trace.moe
    const anilistResponse = await axios.post('https://graphql.anilist.co', {
      query: anilistQuery,
      variables: { id: topResult.anilist }
    });

    const animeDetails = anilistResponse.data.data.Media;

    // 3. Send combined data back to the frontend
    res.json({
      match: {
        episode: topResult.episode,
        similarity: topResult.similarity,
        video: topResult.video // The video preview URL
      },
      details: animeDetails
    });

  } catch (error) {
    console.error("Error fetching anime:", error.message);
    res.status(500).json({ error: 'Something went wrong during the search.' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});