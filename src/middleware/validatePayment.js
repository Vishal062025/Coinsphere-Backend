export const validatePayment = (req, res, next) => {
  const { amount, cryptoType, transactionHash } = req.body;

  if (!amount || !cryptoType || !transactionHash) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!['USDT', 'BNB'].includes(cryptoType)) {
    return res.status(400).json({ error: 'Unsupported crypto type' });
  }

  next();
};
