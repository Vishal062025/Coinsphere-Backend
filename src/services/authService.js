import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

export const _registerUser = async ({ email, password, confirmPassword }) => {
  if (!email || !password || !confirmPassword) {
    return {
      statusCode: 400,
      error: 'All fields are required'
    };
  }

  if (password !== confirmPassword) {
    return {
      statusCode: 400,
      error: 'Passwords do not match'
    };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      statusCode: 400,
      error: 'User already exists'
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
  });

  return {
    statusCode: 201,
    message: 'User created successfully',
    data: { userId: user.id }
  };
};

export const _loginUser = async ({ email, password }) => {
  if (!email || !password) {
    return {
      statusCode: 400,
      error: 'Email and password are required'
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {
      statusCode: 400,
      error: 'Invalid credentials'
    };
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return {
      statusCode: 400,
      error: 'Invalid credentials'
    };
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

  return {
    statusCode: 200,
    message: 'Login successful',
    data: { token }
  };
};
