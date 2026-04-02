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

    const commande     = getVal('COMMANDE');
    const date         = getVal('DATE \nCOMMANDE') || getVal('DATE COMMANDE') || getVal('DATE\nCOMMANDE');
    const client       = getVal('CLIENT');
    const modele       = getVal('MODELE');
    const centre       = getVal('CENTRE');
    const offset       = getVal('OFFSET');
    const main         = getVal('MAIN');
    const shaft        = getVal('SHAFT');
    const taille       = getVal('TAILLE');
    const grip         = getVal('GRIP');
    const couleur      = getVal('COULEUR');
    const mire         = getVal('MIRE');
    const couleurPoids = getVal('COULEUR\nPOIDS') || getVal('COULEUR POIDS');
    const face         = getVal('FACE');
    const poids        = getVal('POIDS');
    const reglage      = getVal('REGLAGE');
    const adresse      = getVal('ADRESSE');

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="fiche-production-${commande || rowIndex}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;   // 595
    const pageH = doc.page.height;  // 842
    const pad = 40;
    const innerW = pageW - pad * 2;

    // ── Logo centré ──
    const logoPath = path.join(__dirname, '../../assets/runner-logo.png');
    const logoW = 180;
    const logoY = 36;
    if (fs.existsSync(logoPath)) {
      const logoH = logoW * (1249 / 4724);
      doc.image(logoPath, (pageW - logoW) / 2, logoY, { width: logoW });
      doc.y = logoY + logoH + 10;
    } else {
      doc.font('Helvetica-Bold').fontSize(30).fillColor('#000')
        .text('RUNNER', 0, logoY, { align: 'center', width: pageW });
      doc.y = logoY + 42;
    }

    // ── Titre ──
    doc.font('Helvetica').fontSize(8).fillColor('#888')
      .text('FICHE DE PRODUCTION', 0, doc.y, { align: 'center', width: pageW, characterSpacing: 3 });

    // ── Séparateur fin ──
    doc.moveDown(0.8);
    doc.moveTo(pad, doc.y).lineTo(pageW - pad, doc.y).lineWidth(0.5).strokeColor('#ccc').stroke();
    doc.moveDown(0.8);

    // ── Référence commande (grande case) ──
    const refY = doc.y;
    const refH = 58;
    doc.roundedRect(pad, refY, innerW, refH, 6).lineWidth(1.5).strokeColor('#000').stroke();
    doc.font('Helvetica').fontSize(7).fillColor('#999')
      .text('RÉFÉRENCE COMMANDE', pad + 14, refY + 10, { characterSpacing: 1.5 });
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#000')
      .text(commande || '—', pad + 14, refY + 22);
    doc.y = refY + refH + 10;

    // ── Date + Client (2 colonnes) ──
    const halfW = (innerW - 8) / 2;
    const infoH = 52;
    const infoY = doc.y;

    const infoBox = (x: number, label: string, value: string) => {
      doc.roundedRect(x, infoY, halfW, infoH, 5).fillAndStroke('#f5f5f5', '#ddd');
      doc.font('Helvetica').fontSize(7).fillColor('#999')
        .text(label, x + 10, infoY + 10, { characterSpacing: 1 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111')
        .text(value || '—', x + 10, infoY + 22, { width: halfW - 20 });
    };
    infoBox(pad, 'DATE COMMANDE', date);
    infoBox(pad + halfW + 8, 'CLIENT', client);
    doc.y = infoY + infoH + 10;

    // ── Modèle (pleine largeur) ──
    const modH = 50;
    const modY = doc.y;
    doc.roundedRect(pad, modY, innerW, modH, 5).fillAndStroke('#f0f0f0', '#ccc');
    doc.font('Helvetica').fontSize(7).fillColor('#999')
      .text('MODÈLE', pad + 14, modY + 10, { characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111')
      .text(modele || '—', pad + 14, modY + 22);
    doc.y = modY + modH + 12;

    // ── Grille specs 2 colonnes ──
    const specs: [string, string][] = [
      ['CENTRE',        centre],
      ['OFFSET',        offset],
      ['MAIN',          main],
      ['SHAFT',         shaft],
      ['TAILLE',        taille],
      ['GRIP',          grip],
      ['COULEUR',       couleur],
      ['MIRE',          mire],
      ['COULEUR POIDS', couleurPoids],
      ['FACE',          face],
      ['POIDS',         poids],
      ['RÉGLAGE',       reglage],
    ].filter(([, v]) => v !== '') as [string, string][];

    // Calcule la hauteur disponible pour la grille + adresse
    const footerH = 30;
    const adresseH = adresse ? 52 + 10 : 0;
    const gridAvail = pageH - doc.y - adresseH - footerH - 10;
    const rows = Math.ceil(specs.length / 2);
    const cellH = Math.min(52, Math.floor(gridAvail / rows) - 6);
    const cellGap = Math.min(8, Math.floor((gridAvail - rows * cellH) / rows));

    const gridY = doc.y;
    specs.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = pad + col * (halfW + 8);
      const cy = gridY + row * (cellH + cellGap);

      doc.roundedRect(cx, cy, halfW, cellH, 4).fillAndStroke('#fafafa', '#e0e0e0');
      doc.font('Helvetica').fontSize(7).fillColor('#999')
        .text(label, cx + 10, cy + 9, { characterSpacing: 0.8 });
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#111')
        .text(value, cx + 10, cy + 21, { width: halfW - 20 });
    });

    // ── Adresse ──
    if (adresse) {
      const addrY = pageH - footerH - adresseH + 4;
      doc.roundedRect(pad, addrY, innerW, adresseH - 10, 4).fillAndStroke('#fafafa', '#e0e0e0');
      doc.font('Helvetica').fontSize(7).fillColor('#999')
        .text('ADRESSE', pad + 10, addrY + 9, { characterSpacing: 0.8 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
        .text(adresse, pad + 10, addrY + 21, { width: innerW - 20 });
    }

    // ── Pied de page ──
    doc.font('Helvetica').fontSize(7).fillColor('#bbb')
      .text(
        `Runner SAS  •  Fiche générée le ${new Date().toLocaleDateString('fr-FR')}`,
        0, pageH - 20, { align: 'center', width: pageW }
      );

    doc.end();
  } catch (error) {
    logger.error('downloadProductionPdf error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};
