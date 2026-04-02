import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
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

export const downloadProductionPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const rowIndex = parseInt(req.params.row);
    const sheets = new GoogleSheetsService();
    const orders = await sheets.readProductionOrders();

    const order = orders.find((o) => o._rowIndex === String(rowIndex));
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Flexible column lookup (handles newlines, case, spaces)
    const getVal = (key: string): string => {
      if (order[key] !== undefined) return order[key];
      const norm = key.replace(/\n/g, ' ').toLowerCase().trim();
      const match = Object.keys(order).find(
        (k) => k.replace(/\n/g, ' ').toLowerCase().trim() === norm
      );
      return match ? order[match] : '';
    };

    const commande   = getVal('COMMANDE');
    const date       = getVal('DATE \nCOMMANDE') || getVal('DATE COMMANDE') || getVal('DATE\nCOMMANDE');
    const client     = getVal('CLIENT');

    const specs: [string, string][] = [
      ['MODELE',        getVal('MODELE')],
      ['CENTRE',        getVal('CENTRE')],
      ['OFFSET',        getVal('OFFSET')],
      ['MAIN',          getVal('MAIN')],
      ['SHAFT',         getVal('SHAFT')],
      ['TAILLE',        getVal('TAILLE')],
      ['GRIP',          getVal('GRIP')],
      ['COULEUR',       getVal('COULEUR')],
      ['MIRE',          getVal('MIRE')],
      ['COULEUR POIDS', getVal('COULEUR\nPOIDS') || getVal('COULEUR POIDS')],
      ['FACE',          getVal('FACE')],
      ['POIDS',         getVal('POIDS')],
      ['REGLAGE',       getVal('REGLAGE')],
      ['ADRESSE',       getVal('ADRESSE')],
    ].filter(([, v]) => v !== '') as [string, string][];

    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="fiche-production-${commande || rowIndex}.pdf"`);
    doc.pipe(res);

    const pageW  = doc.page.width;
    const margin = 60;
    const contentW = pageW - margin * 2;

    // Helper: draw "LABEL : value" centered on one line, label bold, value normal
    const fieldLine = (label: string, value: string) => {
      if (!value) return;
      const labelText = label + ' : ';
      doc.font('Helvetica-Bold').fontSize(10);
      const lw = doc.widthOfString(labelText);
      doc.font('Helvetica').fontSize(10);
      const vw = doc.widthOfString(value);
      const startX = margin + (contentW - lw - vw) / 2;
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
        .text(labelText, startX, y, { lineBreak: false });
      doc.font('Helvetica').fontSize(10).fillColor('#000')
        .text(value, startX + lw, y, { lineBreak: false });
      doc.y = y + 16;
    };

    // ── Logo ──
    const logoPath = path.join(__dirname, '../../assets/runner-logo.png');
    const logoW = 200;
    if (fs.existsSync(logoPath)) {
      const logoH = logoW * (1249 / 4724);
      doc.image(logoPath, (pageW - logoW) / 2, margin, { width: logoW });
      doc.y = margin + logoH + 28;
    } else {
      doc.font('Helvetica-Bold').fontSize(32).fillColor('#000')
        .text('RUNNER', margin, margin, { align: 'center', width: contentW });
      doc.y = margin + 56;
    }

    // ── Titre ──
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
      .text('FICHE DE PRODUCTION', margin, doc.y, { align: 'center', width: contentW });
    doc.moveDown(2);

    // ── Référence ──
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#000')
      .text(`COMMANDE : ${commande || '—'}`, margin, doc.y, { align: 'center', width: contentW });
    doc.moveDown(2);

    // ── Séparateur ──
    doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y)
      .lineWidth(0.5).strokeColor('#aaa').stroke();
    doc.moveDown(1.5);

    // ── Date + Client ──
    fieldLine('DATE COMMANDE', date);
    fieldLine('CLIENT', client);

    doc.moveDown(1.5);
    doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y)
      .lineWidth(0.3).strokeColor('#ccc').stroke();
    doc.moveDown(1.5);

    // ── Specs ──
    for (const [label, value] of specs) {
      fieldLine(label, value);
    }

    doc.end();
  } catch (error) {
    logger.error('downloadProductionPdf error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};
