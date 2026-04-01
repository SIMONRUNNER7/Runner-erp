import { Request, Response } from 'express';
import { GoogleSheetsService } from '../services/google-sheets.service';
import logger from '../lib/logger';

export const getProductionOrders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sheets = new GoogleSheetsService();
    const orders = await sheets.readProductionOrders();
    res.json(orders);
  } catch (error) {
    logger.error('getProductionOrders error:', error);
    res.status(500).json({ error: 'Failed to read production orders from Google Sheets' });
  }
};

export const updateProductionOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const rowIndex = parseInt(req.params.row);
    const { field, value } = req.body;

    if (!rowIndex || !field || value === undefined) {
      res.status(400).json({ error: 'row, field and value are required' });
      return;
    }

    const sheets = new GoogleSheetsService();
    await sheets.updateProductionRow(rowIndex, field, value);
    res.json({ success: true });
  } catch (error) {
    logger.error('updateProductionOrder error:', error);
    res.status(500).json({ error: 'Failed to update production row' });
  }
};
