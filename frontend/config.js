// Backend URL. Local runs use the local backend; the deployed screen uses Render.
window.API_BASE = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:3000"
  : "https://cold-call-guide.onrender.com";
