import { ethers } from 'ethers';
import {CHAINSPHERE_ABI} from './utils/chainsphereabi.js';
const PROVIDER_URL = process.env.BSC_RPC_URL;
const CONTRACT_ADDRESS = process.env.CPS_ICO_TOKEN_ADDRESS;
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export function getContractInstance(){
    try {
        const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CHAINSPHERE_ABI, wallet);
        return contract;
    } catch (error) {
        console.error("Error getting contract instance:", error);
        throw new Error("Failed to get contract instance");
        
    }
}