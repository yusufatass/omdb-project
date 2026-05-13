# CineSearch 🎬

> A modern, cinematic web application for searching and exploring millions of movies, series, and episodes.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://yusufatass.github.io/omdb-project/)

![CineSearch Screenshot](<img width="1870" height="936" alt="image" src="https://github.com/user-attachments/assets/aa944b50-c4e7-47da-93b4-e79c3a65b543" />) 

CineSearch is a professional-grade, framework-free web application built to interact seamlessly with the OMDb API. It boasts a stunning dual-theme interface, advanced local sorting capabilities, and meticulously crafted UI/UX features to provide an outstanding movie discovery experience.

## ✨ Features

- **🔍 Intelligent Search:** Instantly search for any movie, series, or episode by title.
- **🎛️ Advanced Filtering & Sorting:** Narrow down results by **Year** and **Type**. Sort the dynamically loaded results by **Release Year** or even **IMDb Rating** (via our background enrichment engine).
- **🌓 Dual Cinematic Themes:** Ships with a gorgeous default **Dark Theme** and a warm, elegant **Light Theme (Coffee/Cream)**. Preferences are automatically saved.
- **⚡ Optimized API Calls:** Uses **Debouncing** to prevent unnecessary network requests while typing.
- **🎬 Detailed Modals:** Click on any movie card to reveal a comprehensive detail modal featuring the poster, plot, genre, director, actors, runtime, language, box office, and full ratings (IMDb, Rotten Tomatoes, Metacritic).
- **🕰️ Search History Management:** Displays your most recent searches as clickable chips. You can easily remove individual searches with the "×" button.
- **🔗 URL & State Persistence:** Search parameters are synced to the URL, meaning you can refresh the page or share the link without losing your search. `localStorage` is also utilized to retain UI states.
- **📱 Fully Responsive:** Carefully crafted to look perfect on mobile devices, tablets, and massive desktop monitors.
- **🚀 Seamless Pagination:** A custom "Load More" system flawlessly merges incoming API pages, allowing local sorting to apply globally to all loaded items.
- **⬆️ Easy Navigation:** Includes a dynamic "Scroll to Top" floating button and a clickable logo to quickly return to the search bar.
- **🛡️ Robust Error Handling:** Graceful, user-friendly error messages for missing movies, network failures, or invalid API keys.

## 🛠️ Built With

- **HTML5** - Semantic markup
- **CSS3** - Vanilla CSS, Custom Properties (Variables), Glassmorphism, CSS Grid & Flexbox
- **JavaScript (ES6+)** - Vanilla JS, Async/Await, DOM manipulation (Zero dependencies/frameworks)
- **[OMDb API](https://www.omdbapi.com/)** - The Open Movie Database
- **Fonts:** [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) & [DM Sans](https://fonts.google.com/specimen/DM+Sans)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

1. Get a free API key from [OMDb API](http://www.omdbapi.com/apikey.aspx).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yusufatass/omdb-movie-search.git
   cd omdb-movie-search
   ```

2. **Configure your API Key:**
   Create a new file named `config.js` in the root directory and add your API key like this:
   ```javascript
   // config.js
   const API_KEY = 'your_api_key_here'; // e.g., '1dff84d8'
   ```
   *Note: `config.js` is ignored by git to keep your key secure.*
     BASE_URL: 'https://www.omdbapi.com/'
   };
   ```

3. **Run the project:**
   Since this is a vanilla project, you can simply open `index.html` in your browser. Alternatively, use a local server for a better development experience:
   ```bash
   npx serve .
   ```
   Navigate to `http://localhost:3000`.

## 📂 File Structure

```text
omdb-movie-search/
├── index.html        # Main HTML structure
├── style.css         # All UI styling, themes, and animations
├── app.js            # Application logic, state management, and API calls
└── README.md         # Project documentation
```

## 🧠 Technical Decisions & Architecture

- **Vanilla JS over Frameworks:** Built entirely with Vanilla JS to demonstrate mastery of the DOM, Event Listeners, and API integration without relying on React or Vue.
- **Debouncing:** Implemented a custom `debounce` function on the search input to delay the API request by 500ms after the user stops typing, saving network bandwidth and avoiding API rate limits.
- **URL Synchronization (`window.history.replaceState`):** We sync the active query, year, and type to the URL parameters. This ensures that users can bookmark or share their exact search results easily.
- **Background Data Enrichment:** The OMDb API search endpoint (`?s=`) does not return IMDb ratings. To solve this, `app.js` uses `Promise.all()` to asynchronously fetch the detail endpoint (`?i=`) for all 10 results concurrently. This enables the beautiful UI rating badges and allows client-side sorting by IMDb score without noticeable latency.
- **Local Sorting on Appended State:** When users click "Load More", the newly fetched page of movies is appended to the local state array. The application then completely re-renders the grid based on the active Sort Filter, ensuring that newer pages are properly interleaved with older ones.

## 🔮 Future Enhancements

- **Favorites / Watchlist:** Allow users to save movies to a personal watchlist utilizing `localStorage`.
- **Advanced Filtering UI:** Transition the standard dropdowns into custom-styled, fully accessible select components.
- **Trailers:** Integrate the YouTube Data API to fetch and play trailers directly inside the movie modal.

---

<p align="center">
  <b>Created with ❤️ by <a href="https://github.com/yusufatass">Yusuf Ataş</a></b>
</p>
