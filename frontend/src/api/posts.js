import axios from 'axios';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// opciones: { cuentaId, pagina, limite, desde, hasta }
export async function obtenerPosts(opciones = {}) {
  const { data } = await axios.get('/api/posts', {
    headers: headers(),
    params: opciones,
  });
  return data; // { posts, total, pagina, paginas }
}
