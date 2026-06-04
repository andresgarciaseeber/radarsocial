import axios from 'axios';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// opciones: { pagina, limite }
export async function obtenerComentarios(postId, opciones = {}) {
  const { data } = await axios.get('/api/comentarios', {
    headers: headers(),
    params: { postId, ...opciones },
  });
  return data; // { comentarios, total, pagina, paginas }
}
