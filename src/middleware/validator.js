import { parse, isValid } from 'date-fns';

export const validatePayment = (req, res, next) => {
  const { amount, cryptoType } = req.body;

  if (!amount || !cryptoType) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!['USDT', 'BNB'].includes(cryptoType)) {
    return res.status(400).json({ error: 'Unsupported crypto type' });
  }

  next();
};


export const validateExecutePayment = (req, res, next) => {
  const { paymentId, transactionHash } = req.body;

  if (!paymentId || !transactionHash) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  next();
};

export const validateSignupInput = (data) => {
  const requiredFields = [
    'email', 'password', 'confirmPassword',
    'firstName', 'lastName', 'dob', 'address',
    'city', 'state', 'zipCode', 'country'
  ];

  for (const field of requiredFields) {
    if (!data[field]) {
      return { valid: false, error: `${field} is required` };
    }
  }

  if (data.password !== data.confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }

 const dobString = data.dob; // e.g., "06-12-2025"
const parsedDob = parse(dobString, 'MM-dd-yyyy', new Date());

if (!isValid(parsedDob)) {
  return { valid: false, error: 'Invalid date of birth format (MM-DD-YYYY expected)' };
}

  return { valid: true };
};

