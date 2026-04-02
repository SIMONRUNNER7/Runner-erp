export interface BOMItem {
  sku: string;
  name: string;
  qty: number;
  category: string;
}

interface OrderAttrs {
  modele: string;
  couleur: string;
  face: string;
  mire: string;
  centre: string;
  offset: string;
  shaft: string;
  grip: string;
  poids: string;
}

function norm(s: string) {
  return (s || '').toUpperCase().trim();
}

export function resolveComponents(attrs: OrderAttrs): BOMItem[] {
  const items: BOMItem[] = [];

  const modele  = norm(attrs.modele);
  const couleur = norm(attrs.couleur);  // GREY | BLACK | ROUGE
  const isPro   = modele === 'PRO BLADE' || modele === 'PRO MALLET';
  const modKey  = modele.replace(/ /g, '-');

  // ── 1. Pièce arrière ──────────────────────────────────────────────
  items.push({
    sku:      `ARRIERE-${modKey}-${couleur}`,
    name:     `Pièce arrière ${attrs.modele} ${couleur}`,
    qty:      1,
    category: 'arriere',
  });

  // ── 2. Centre ─────────────────────────────────────────────────────
  const centreKey = norm(attrs.centre).replace(/\s/g, '');
  items.push({
    sku:      `CENTRE-${centreKey}`,
    name:     `Centre ${attrs.centre}`,
    qty:      1,
    category: 'centre',
  });

  // ── 3. Face ───────────────────────────────────────────────────────
  const faceAngle   = norm(attrs.face).replace('°', 'D').replace('C', 'CD').replace('DDD', 'CD'); // 3°→3D, 4°→4D, C°→CD, 2°→2D
  const faceAngleFix = norm(attrs.face).replace('°', 'D'); // simpler
  let faceCouleur: string;
  if (couleur === 'ROUGE') {
    faceCouleur = 'ROUGE';
  } else {
    faceCouleur = (couleur === 'GREY' || couleur === 'GRIS') ? 'GRIS' : 'NOIR';
  }
  const facePfx = isPro ? 'FACE-PRO' : 'FACE';
  items.push({
    sku:      `${facePfx}-${faceAngleFix}-${faceCouleur}`,
    name:     `Face ${isPro ? 'PRO ' : ''}${attrs.face} ${faceCouleur}`,
    qty:      1,
    category: 'face',
  });

  // ── 4. Mire ───────────────────────────────────────────────────────
  // Normalize accents: BLÉU→BLEU, ROSÉ→ROSE etc.
  const mireKey = norm(attrs.mire)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  items.push({
    sku:      `MIRE-${mireKey}`,
    name:     `Mire ${attrs.mire}`,
    qty:      1,
    category: 'mire',
  });

  // ── 5. Poids ×2 ───────────────────────────────────────────────────
  const poidsKey = norm(attrs.poids).replace(/\s/g, ''); // 18G, 30G, 48G, 5G, 15G
  const poidsSku = isPro ? `POIDS-PRO-${poidsKey}` : `POIDS-${poidsKey}`;
  items.push({
    sku:      poidsSku,
    name:     `Poids ${isPro ? 'PRO ' : ''}${attrs.poids}`,
    qty:      2,
    category: 'poids',
  });

  // ── 6. Shaft ──────────────────────────────────────────────────────
  const shaft     = norm(attrs.shaft);
  const hasOffset = norm(attrs.offset) === 'OUI';
  const isGPS     = shaft.includes('GPS');

  if (isGPS) {
    const gpsColor = shaft.includes('ROUGE') ? 'ROUGE' : 'NOIR';
    items.push({
      sku:      `SHAFT-GPS-${gpsColor}`,
      name:     `Shaft GPS ${gpsColor}`,
      qty:      1,
      category: 'shaft',
    });
    if (hasOffset) {
      items.push({
        sku:      'PIECE-OFFSET-GRAPHITE',
        name:     'Pièce offset graphite',
        qty:      1,
        category: 'shaft',
      });
    }
  } else {
    items.push({
      sku:      hasOffset ? 'SHAFT-STEEL-OFFSET' : 'SHAFT-STEEL-DROIT',
      name:     hasOffset ? 'Shaft steel offset' : 'Shaft steel droit',
      qty:      1,
      category: 'shaft',
    });
  }

  // ── 7. Grip ───────────────────────────────────────────────────────
  const grip = norm(attrs.grip);
  if (grip && grip !== 'UNGRIP') {
    const isMidsize = grip.includes('MIDSIZE') || grip.includes('PISTOL');
    items.push({
      sku:      isMidsize ? 'GRIP-MIDSIZE-PISTOL' : 'GRIP-STD',
      name:     isMidsize ? 'Grip Midsize Pistol' : 'Grip Standard',
      qty:      1,
      category: 'grip',
    });
  }

  // ── 8. Cover ──────────────────────────────────────────────────────
  const isMallet = modele.includes('MALLET');
  let coverSku: string;
  let coverName: string;
  if (isPro && isMallet)       { coverSku = 'COVER-MALLET-PRO';  coverName = 'Cover Mallet PRO'; }
  else if (isPro)              { coverSku = 'COVER-BLADE-PRO';   coverName = 'Cover Blade PRO'; }
  else if (isMallet)           { coverSku = 'COVER-MALLET-STD';  coverName = 'Cover Mallet STD'; }
  else                         { coverSku = 'COVER-BLADE-STD';   coverName = 'Cover Blade STD'; } // BLADE + ORIGINAL
  items.push({ sku: coverSku, name: coverName, qty: 1, category: 'cover' });

  // ── 9. Clé de réglage ─────────────────────────────────────────────
  items.push({
    sku:      isPro ? 'WRENCH-PRO' : 'WRENCH-STD',
    name:     isPro ? 'Clé PRO' : 'Clé STD',
    qty:      1,
    category: 'hardware',
  });

  // ── 10. Visserie ──────────────────────────────────────────────────
  items.push({ sku: 'TORX-5X16',  name: 'Vis Torx 5×16',       qty: 2, category: 'visserie' });
  items.push({ sku: 'ECROU-M4',   name: 'Écrou 10×10×2 M4',    qty: 2, category: 'visserie' });
  if (isPro) {
    items.push({ sku: 'TORX-4X8',  name: 'Vis Torx 4×8',  qty: 2, category: 'visserie' });
  } else {
    items.push({ sku: 'TORX-4X18', name: 'Vis Torx 4×18', qty: 2, category: 'visserie' });
  }

  // ── 11. Poids laiton 10g (shaft non-GPS seulement) ────────────────
  if (!isGPS) {
    items.push({ sku: 'POIDS-LAITON-10G', name: 'Poids laiton 10g', qty: 1, category: 'hardware' });
  }

  // ── 12. Consommables ──────────────────────────────────────────────
  items.push({ sku: 'DOUBLE-FACE-25CM', name: 'Double face 25cm',  qty: 1, category: 'consommable' });
  items.push({ sku: 'EPOXY-3M-2G',      name: 'Colle époxy 3M 2g', qty: 1, category: 'consommable' });

  // ── 13. Emballage ─────────────────────────────────────────────────
  items.push({ sku: 'PAPIER-BULLE',    name: 'Papier bulle 100×50cm', qty: 1, category: 'emballage' });
  items.push({ sku: 'GAINE-15X100',    name: 'Gaine 15×100',          qty: 1, category: 'emballage' });
  items.push({ sku: 'CARTON-15X15X100',name: 'Carton 15×15×100',      qty: 1, category: 'emballage' });

  return items;
}

// Canonical list of all 43 components
export const ALL_COMPONENTS: Omit<BOMItem, 'qty'>[] = [
  // Pièces arrière (11)
  { sku: 'ARRIERE-ORIGINAL-GREY',      name: 'Arrière Original Grey',      category: 'arriere' },
  { sku: 'ARRIERE-ORIGINAL-BLACK',     name: 'Arrière Original Black',     category: 'arriere' },
  { sku: 'ARRIERE-BLADE-GREY',         name: 'Arrière Blade Grey',         category: 'arriere' },
  { sku: 'ARRIERE-BLADE-BLACK',        name: 'Arrière Blade Black',        category: 'arriere' },
  { sku: 'ARRIERE-BLADE-ROUGE',        name: 'Arrière Blade Rouge',        category: 'arriere' },
  { sku: 'ARRIERE-MALLET-GREY',        name: 'Arrière Mallet Grey',        category: 'arriere' },
  { sku: 'ARRIERE-MALLET-BLACK',       name: 'Arrière Mallet Black',       category: 'arriere' },
  { sku: 'ARRIERE-PRO-BLADE-GREY',     name: 'Arrière Pro Blade Grey',     category: 'arriere' },
  { sku: 'ARRIERE-PRO-BLADE-BLACK',    name: 'Arrière Pro Blade Black',    category: 'arriere' },
  { sku: 'ARRIERE-PRO-MALLET-GREY',    name: 'Arrière Pro Mallet Grey',    category: 'arriere' },
  { sku: 'ARRIERE-PRO-MALLET-BLACK',   name: 'Arrière Pro Mallet Black',   category: 'arriere' },

  // Centres (6)
  { sku: 'CENTRE-H70',    name: 'Centre H70',    category: 'centre' },
  { sku: 'CENTRE-H72',    name: 'Centre H72',    category: 'centre' },
  { sku: 'CENTRE-C71',    name: 'Centre C71',    category: 'centre' },
  { sku: 'CENTRE-C74',    name: 'Centre C74',    category: 'centre' },
  { sku: 'CENTRE-C79',    name: 'Centre C79',    category: 'centre' },
  { sku: 'CENTRE-VIERGE', name: 'Centre Vierge', category: 'centre' },

  // Faces standard (8)
  { sku: 'FACE-3D-NOIR',  name: 'Face 3° Noir',  category: 'face' },
  { sku: 'FACE-3D-GRIS',  name: 'Face 3° Gris',  category: 'face' },
  { sku: 'FACE-3D-ROUGE', name: 'Face 3° Rouge', category: 'face' },
  { sku: 'FACE-4D-NOIR',  name: 'Face 4° Noir',  category: 'face' },
  { sku: 'FACE-4D-GRIS',  name: 'Face 4° Gris',  category: 'face' },
  { sku: 'FACE-4D-ROUGE', name: 'Face 4° Rouge', category: 'face' },
  { sku: 'FACE-CD-NOIR',  name: 'Face C° Noir',  category: 'face' },
  { sku: 'FACE-CD-GRIS',  name: 'Face C° Gris',  category: 'face' },

  // Faces PRO (4)
  { sku: 'FACE-PRO-2D-NOIR', name: 'Face PRO 2° Noir', category: 'face' },
  { sku: 'FACE-PRO-2D-GRIS', name: 'Face PRO 2° Gris', category: 'face' },
  { sku: 'FACE-PRO-4D-NOIR', name: 'Face PRO 4° Noir', category: 'face' },
  { sku: 'FACE-PRO-4D-GRIS', name: 'Face PRO 4° Gris', category: 'face' },

  // Mires (7)
  { sku: 'MIRE-NOIR',  name: 'Mire Noir',  category: 'mire' },
  { sku: 'MIRE-ROUGE', name: 'Mire Rouge', category: 'mire' },
  { sku: 'MIRE-BLANC', name: 'Mire Blanc', category: 'mire' },
  { sku: 'MIRE-GRIS',  name: 'Mire Gris',  category: 'mire' },
  { sku: 'MIRE-BLEU',  name: 'Mire Bleu',  category: 'mire' },
  { sku: 'MIRE-JAUNE', name: 'Mire Jaune', category: 'mire' },
  { sku: 'MIRE-ROSE',  name: 'Mire Rose',  category: 'mire' },

  // Poids (5)
  { sku: 'POIDS-18G',     name: 'Poids 18g',     category: 'poids' },
  { sku: 'POIDS-30G',     name: 'Poids 30g',     category: 'poids' },
  { sku: 'POIDS-48G',     name: 'Poids 48g',     category: 'poids' },
  { sku: 'POIDS-PRO-5G',  name: 'Poids PRO 5g',  category: 'poids' },
  { sku: 'POIDS-PRO-15G', name: 'Poids PRO 15g', category: 'poids' },

  // Shafts (5)
  { sku: 'SHAFT-STEEL-DROIT',    name: 'Shaft Steel Droit',    category: 'shaft' },
  { sku: 'SHAFT-STEEL-OFFSET',   name: 'Shaft Steel Offset',   category: 'shaft' },
  { sku: 'SHAFT-GPS-NOIR',       name: 'Shaft GPS Noir',       category: 'shaft' },
  { sku: 'SHAFT-GPS-ROUGE',      name: 'Shaft GPS Rouge',      category: 'shaft' },
  { sku: 'PIECE-OFFSET-GRAPHITE',name: 'Pièce Offset Graphite',category: 'shaft' },

  // Grips (2)
  { sku: 'GRIP-STD',           name: 'Grip Standard',      category: 'grip' },
  { sku: 'GRIP-MIDSIZE-PISTOL',name: 'Grip Midsize Pistol', category: 'grip' },

  // Covers (4)
  { sku: 'COVER-BLADE-STD',  name: 'Cover Blade STD',  category: 'cover' },
  { sku: 'COVER-MALLET-STD', name: 'Cover Mallet STD', category: 'cover' },
  { sku: 'COVER-BLADE-PRO',  name: 'Cover Blade PRO',  category: 'cover' },
  { sku: 'COVER-MALLET-PRO', name: 'Cover Mallet PRO', category: 'cover' },

  // Hardware (3)
  { sku: 'WRENCH-STD',       name: 'Clé STD',          category: 'hardware' },
  { sku: 'WRENCH-PRO',       name: 'Clé PRO',          category: 'hardware' },
  { sku: 'POIDS-LAITON-10G', name: 'Poids laiton 10g', category: 'hardware' },

  // Visserie (4)
  { sku: 'TORX-5X16',  name: 'Vis Torx 5×16',    category: 'visserie' },
  { sku: 'TORX-4X18',  name: 'Vis Torx 4×18',    category: 'visserie' },
  { sku: 'TORX-4X8',   name: 'Vis Torx 4×8',     category: 'visserie' },
  { sku: 'ECROU-M4',   name: 'Écrou 10×10×2 M4', category: 'visserie' },

  // Consommables (2)
  { sku: 'DOUBLE-FACE-25CM', name: 'Double face 25cm',  category: 'consommable' },
  { sku: 'EPOXY-3M-2G',      name: 'Colle époxy 3M 2g', category: 'consommable' },

  // Emballage (3)
  { sku: 'PAPIER-BULLE',     name: 'Papier bulle 100×50cm', category: 'emballage' },
  { sku: 'GAINE-15X100',     name: 'Gaine 15×100',          category: 'emballage' },
  { sku: 'CARTON-15X15X100', name: 'Carton 15×15×100',      category: 'emballage' },
];
