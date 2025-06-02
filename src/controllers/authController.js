import { registerUser, loginUser } from '../services/authService.js';

export const signup = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await registerUser(req.body);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const login = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await loginUser(req.body);
    res.status(statusCode).json({ data, message, error });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
