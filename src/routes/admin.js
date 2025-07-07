import express from 'express';
import { getAllUsersForAdmin } from '../controllers/admin/adminController.js';


const router = express.Router();

router.get('/users-list',getAllUsersForAdmin);


export default router;