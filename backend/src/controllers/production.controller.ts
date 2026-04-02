import { Request, Response } from 'express';
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

    const get = (key: string) => {
      if (order[key] !== undefined) return order[key];
      const norm = key.replace(/\n/g, ' ').toLowerCase();
      const match = Object.keys(order).find(
        (k) => k.replace(/\n/g, ' ').toLowerCase() === norm
      );
      return match ? order[match] : '';
    };

    const commande = get('COMMANDE');
    const date = get('DATE \nCOMMANDE') || get('DATE COMMANDE') || get('DATE\nCOMMANDE');
    const client = get('CLIENT');
    const modele = get('MODELE');
    const centre = get('CENTRE');
    const offset = get('OFFSET');
    const main = get('MAIN');
    const shaft = get('SHAFT');
    const taille = get('TAILLE');
    const grip = get('GRIP');
    const couleur = get('COULEUR');
    const mire = get('MIRE');
    const couleurPoids = get('COULEUR\nPOIDS') || get('COULEUR POIDS');
    const face = get('FACE');
    const poids = get('POIDS');
    const reglage = get('REGLAGE');
    const adresse = get('ADRESSE');

    const doc = new PDFDocument({ size: 'A4', margin: 60 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fiche-production-${commande || rowIndex}.pdf"`
    );
    doc.pipe(res);

    // ── Logo RUNNER ──
    const logoX = doc.page.width / 2;
    const logoY = 60;
    const fontSize = 38;

    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#000000');
    const runW = doc.widthOfString('RUN');
    const erW = doc.widthOfString('ER');
    const barW = 8;
    const gap = 3;
    const totalW = runW + gap + barW + gap + barW + gap + erW;
    let x = logoX - totalW / 2;

    doc.text('RUN', x, logoY, { continued: false, lineBreak: false });
    x += runW + gap;

    // Double barre verticale
    doc.moveTo(x, logoY - 4).lineTo(x, logoY + fontSize - 2).lineWidth(3).strokeColor('#000').stroke();
    x += barW;
    doc.moveTo(x, logoY - 4).lineTo(x, logoY + fontSize - 2).lineWidth(1.5).strokeColor('#CC0000').stroke();
    x += barW + gap;

    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#000000')
      .text('ER', x, logoY, { lineBreak: false });

    // ── Titre ──
    doc.moveDown(2.5);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000')
      .text('FICHE DE PRODUCTION', { align: 'center' });

    // ── Référence commande ──
    doc.moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#000')
      .text(`COMMANDE : ${commande}`, { align: 'center' });

    // ── Séparateur ──
    doc.moveDown(1);
    doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).lineWidth(1).strokeColor('#ccc').stroke();
    doc.moveDown(1);

    // ── Date + Client ──
    const labelFont = 'Helvetica-Bold';
    const valueFont = 'Helvetica';
    const labelSize = 10;
    const valueSize = 10;

    const field = (label: string, value: string) => {
      if (!value) return;
      doc.font(labelFont).fontSize(labelSize).fillColor('#000').text(`${label}: `, { continued: true });
      doc.font(valueFont).fontSize(valueSize).text(value);
    };

    field('DATE COMMANDE', date);
    field('CLIENT', client);

    doc.moveDown(1);
    doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).lineWidth(0.5).strokeColor('#eee').stroke();
    doc.moveDown(1);

    // ── Specs techniques ──
    const specs: [string, string][] = [
      ['MODELE', modele],
      ['CENTRE', centre],
      ['OFFSET', offset],
      ['MAIN', main],
      ['SHAFT', shaft],
      ['TAILLE', taille],
      ['GRIP', grip],
      ['COULEUR', couleur],
      ['MIRE', mire],
      ['COULEUR POIDS', couleurPoids],
      ['FACE', face],
      ['POIDS', poids],
      ['REGLAGE', reglage],
      ['ADRESSE', adresse],
    ];

    for (const [label, value] of specs) {
      field(label, value);
    }

    doc.end();
  } catch (error) {
    logger.error('downloadProductionPdf error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

