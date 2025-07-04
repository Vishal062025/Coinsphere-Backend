
import { _createPaymentService, _getUserTransactions , _getTransactionDetail, _executePaymentService} from '../services/paymentService.js';

export const handleCreatePayment = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _createPaymentService(req.body, req.user.id);
    return res.status(statusCode).json({ data, message, error });
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};


export const handleExecutePayment = async (req, res) => {
  try {
    const { statusCode, data, message, error } = await _executePaymentService(req.body, req.user.id);
    return res.status(statusCode).json({ data, message, error });
  } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};


export const listTransactions = async (req, res) => {
    try {
  const { statusCode, data, message, error } = await _getUserTransactions(req.user.id);
  res.status(statusCode).json({ data, message, error });
   } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

export const transactionDetail = async (req, res) => {
    try {
  const { statusCode, data, message, error } = await _getTransactionDetail(req.user.id, parseInt(req.params.id));
  res.status(statusCode).json({ data, message, error });
   } catch (err) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

