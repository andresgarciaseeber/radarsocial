import axios from 'axios';

export async function login(email, password) {
  const { data } = await axios.post('/api/auth/login', { email, password });
  return data;
}
