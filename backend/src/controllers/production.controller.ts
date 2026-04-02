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
    const modele     = getVal('MODELE');
    const centre     = getVal('CENTRE');
    const offset     = getVal('OFFSET');
    const main       = getVal('MAIN');
    const shaft      = getVal('SHAFT');
    const taille     = getVal('TAILLE');
    const grip       = getVal('GRIP');
    const couleur    = getVal('COULEUR');
    const mire       = getVal('MIRE');
    const couleurPoids = getVal('COULEUR\nPOIDS') || getVal('COULEUR POIDS');
    const face       = getVal('FACE');
    const poids      = getVal('POIDS');
    const reglage    = getVal('REGLAGE');
    const adresse    = getVal('ADRESSE');

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="fiche-production-${commande || rowIndex}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;   // 595
    const pageH = doc.page.height;  // 842
    const pad = 36;

    // ── Fond blanc + bande noire en haut ──
    doc.rect(0, 0, pageW, 110).fill('#000000');

    // ── Logo ──
    const logoPath = path.join(__dirname, '../../assets/runner-logo.png');
    const logoW = 160;
    if (fs.existsSync(logoPath)) {
      const logoH = logoW * (1249 / 4724);
      doc.image(logoPath, (pageW - logoW) / 2, (110 - logoH) / 2, {
        width: logoW,
      });
    } else {
      doc.font('Helvetica-Bold').fontSize(28).fillColor('#fff')
        .text('RUNNER', 0, 38, { align: 'center', width: pageW });
    }

    // ── Sous-titre ──
    doc.font('Helvetica').fontSize(8).fillColor('#aaa')
      .text('FICHE DE PRODUCTION', 0, 95, { align: 'center', width: pageW, characterSpacing: 2 });

    // ── Grande case COMMANDE ──
    const refY = 122;
    const refH = 52;
    doc.roundedRect(pad, refY, pageW - pad * 2, refH, 6)
      .lineWidth(1.5).strokeColor('#000').stroke();
    doc.font('Helvetica').fontSize(7).fillColor('#888')
      .text('RÉFÉRENCE COMMANDE', pad + 12, refY + 8, { characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#000')
      .text(commande || '—', pad + 12, refY + 18);

    // ── 2 cases : Date + Client ──
    const infoY = refY + refH + 10;
    const infoH = 46;
    const halfW = (pageW - pad * 2 - 8) / 2;

    const infoBox = (x: number, label: string, value: string) => {
      doc.roundedRect(x, infoY, halfW, infoH, 5).fillAndStroke('#f7f7f7', '#e0e0e0');
      doc.font('Helvetica').fontSize(7).fillColor('#999')
        .text(label, x + 10, infoY + 8, { characterSpacing: 1 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
        .text(value || '—', x + 10, infoY + 19, { width: halfW - 20 });
    };
    infoBox(pad, 'DATE COMMANDE', date);
    infoBox(pad + halfW + 8, 'CLIENT', client);

    // ── Modèle (case pleine largeur) ──
    const modY = infoY + infoH + 10;
    const modH = 44;
    doc.roundedRect(pad, modY, pageW - pad * 2, modH, 5).fillAndStroke('#111', '#111');
    doc.font('Helvetica').fontSize(7).fillColor('#aaa')
      .text('MODÈLE', pad + 12, modY + 8, { characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#fff')
      .text(modele || '—', pad + 12, modY + 18);

    // ── Grille specs (2 colonnes) ──
    const specs: [string, string][] = [
      ['CENTRE',       centre],
      ['OFFSET',       offset],
      ['MAIN',         main],
      ['SHAFT',        shaft],
      ['TAILLE',       taille],
      ['GRIP',         grip],
      ['COULEUR',      couleur],
      ['MIRE',         mire],
      ['COULEUR POIDS', couleurPoids],
      ['FACE',         face],
      ['POIDS',        poids],
      ['RÉGLAGE',      reglage],
    ].filter(([, v]) => v !== '') as [string, string][];

    const gridY = modY + modH + 10;
    const colW = (pageW - pad * 2 - 8) / 2;
    const cellH = 38;
    const cellGap = 6;

    specs.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = pad + col * (colW + 8);
      const cy = gridY + row * (cellH + cellGap);

      doc.roundedRect(cx, cy, colW, cellH, 4).fillAndStroke('#fafafa', '#e8e8e8');
      doc.font('Helvetica').fontSize(7).fillColor('#999')
        .text(label, cx + 8, cy + 7, { characterSpacing: 0.5 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
        .text(value, cx + 8, cy + 18, { width: colW - 16 });
    });

    // ── Adresse (si présente) ──
    if (adresse) {
      const addrY = gridY + Math.ceil(specs.length / 2) * (cellH + cellGap) + 4;
      const addrH = 42;
      doc.roundedRect(pad, addrY, pageW - pad * 2, addrH, 4).fillAndStroke('#fafafa', '#e8e8e8');
      doc.font('Helvetica').fontSize(7).fillColor('#999')
        .text('ADRESSE', pad + 8, addrY + 7, { characterSpacing: 0.5 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111')
        .text(adresse, pad + 8, addrY + 18, { width: pageW - pad * 2 - 16 });
    }

    // ── Pied de page ──
    doc.font('Helvetica').fontSize(7).fillColor('#bbb')
      .text(`Runner SAS — Fiche générée le ${new Date().toLocaleDateString('fr-FR')}`,
        0, pageH - 24, { align: 'center', width: pageW });

    doc.end();
  } catch (error) {
    logger.error('downloadProductionPdf error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};
