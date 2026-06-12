import axios from 'axios';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export async function buscarHashtag(q) {
  const { data } = await axios.get('/api/hashtags/buscar', {
    headers: headers(),
    params: { q },
  });
  return data;
}
