import { Injectable, inject } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { StockRulesDomainService } from '../../domain/services/stock-rules.domain.service';
import {
  Brand, ProductLine, ProductVariant, Product, Warehouse, StockLevel,
  Supplier, Receipt, ReceiptItem, ProductionBatch, InternalOrder,
  Commercial, InfoProduits, StockMovement,
  DashboardStatsResponse, StockAlert, MovementType
} from '../../domain/models';

/** Repository mock — données camerounaises NTFoods pour développement offline. */
@Injectable({ providedIn: 'root' })
export class StockMockRepository {
  private rules = inject(StockRulesDomainService);

  // ── ENTREPÔTS ──────────────────────────────────────────────
  readonly warehouses: Warehouse[] = [
    { id:1, name:'Magasin Matières Premières',       type:'CENTRAL', isBuffer:false },
    { id:2, name:'Magasin Consommables & Emballages',type:'CENTRAL', isBuffer:false },
    { id:3, name:'Magasin Produits Finis',           type:'CENTRAL', isBuffer:false },
    { id:4, name:'Magasin Tampon Production',        type:'BUFFER',  isBuffer:true  },
  ];

  // ── CATALOGUE ──────────────────────────────────────────────
  readonly brands: Brand[] = [
    { id:1, name:'TANTY', code:'TAN', active:true },
    { id:2, name:'REINE', code:'REI', active:true },
  ];
  readonly lines: ProductLine[] = [
    { id:1, brandId:1, name:'Bouillies Enfants & Adultes', code:'BOUI', active:true },
    { id:2, brandId:1, name:'Snacks & Grignotage',         code:'SNCK', active:true },
    { id:3, brandId:1, name:"Pâtes à Tartiner",            code:'PATE', active:true },
    { id:4, brandId:2, name:'Bouillies Infantiles',         code:'BINI', active:true },
  ];
  readonly variants: ProductVariant[] = [
    { id:1, productLineId:1, name:'TBSA (Vitamine A — Vision)',    code:'TBSA' },
    { id:2, productLineId:1, name:'TBSN (Fibres — Transit)',       code:'TBSN' },
    { id:3, productLineId:1, name:'TBSP (Calcium — Croissance)',   code:'TBSP' },
    { id:4, productLineId:1, name:'Multifruits (Équilibre)',       code:'MULT' },
    { id:5, productLineId:3, name:'TANTY CHOCO',                   code:'CHOC' },
    { id:6, productLineId:3, name:'Classic Arachide',              code:'ARACH'},
  ];
  readonly products: Product[] = [
    { id:1,  sku:'MP-MAIS-001',  designation:'Maïs jaune (grain)',        category:'RAW_MATERIAL',  unit:'KG',        unitPriceAmount:350, leadTimeDays:7,   active:true },
    { id:2,  sku:'MP-SOJA-001',  designation:'Soja décortiqué',          category:'RAW_MATERIAL',  unit:'KG',        unitPriceAmount:600, leadTimeDays:7,   active:true },
    { id:3,  sku:'MP-ARACH-001', designation:"Poudre d'arachide",        category:'RAW_MATERIAL',  unit:'KG',        unitPriceAmount:900, leadTimeDays:5,   active:true },
    { id:4,  sku:'MP-SUCRE-001', designation:'Sucre cristallisé',        category:'RAW_MATERIAL',  unit:'KG',        unitPriceAmount:550, leadTimeDays:3,   active:true },
    { id:5,  sku:'MP-ANCHO-001', designation:'Anchois de Guinée séché',  category:'RAW_MATERIAL',  unit:'KG',        unitPriceAmount:2500,leadTimeDays:14,  active:true },
    { id:6,  sku:'CONS-SACH-001',designation:'Sachets 42g TANTY',        category:'CONSUMABLE',    unit:'SACHET_42G',unitPriceAmount:25,  leadTimeDays:150, active:true },
    { id:7,  sku:'CONS-SEAU-1L', designation:'Seaux 1L TANTY',           category:'CONSUMABLE',    unit:'SEAU_1L',   unitPriceAmount:180, leadTimeDays:150, active:true },
    { id:8,  sku:'CONS-CART-001',designation:'Cartons 24 sachets',       category:'CONSUMABLE',    unit:'CARTON',    unitPriceAmount:450, leadTimeDays:150, active:true },
    { id:9,  sku:'PF-TBSA-042',  designation:'TBSA 42g — Bouillie Vit. A',category:'FINISHED_PRODUCT',unit:'SACHET_42G',unitPriceAmount:250,leadTimeDays:0, active:true, variantId:1 },
    { id:10, sku:'PF-TBSN-042',  designation:'TBSN 42g — Bouillie Fibres',category:'FINISHED_PRODUCT',unit:'SACHET_42G',unitPriceAmount:250,leadTimeDays:0, active:true, variantId:2 },
    { id:11, sku:'PF-TBSP-042',  designation:'TBSP 42g — Calcium',       category:'FINISHED_PRODUCT',unit:'SACHET_42G',unitPriceAmount:250,leadTimeDays:0, active:true, variantId:3 },
    { id:12, sku:'PF-SEAU-1L',   designation:'TANTY Seau 1L Classique',  category:'FINISHED_PRODUCT',unit:'SEAU_1L',   unitPriceAmount:3500,leadTimeDays:0, active:true },
    { id:13, sku:'PF-CHOCO-500', designation:'TANTY CHOCO Pâte 500g',    category:'FINISHED_PRODUCT',unit:'SEAU_1L',   unitPriceAmount:4200,leadTimeDays:0, active:true, variantId:5 },
  ];

  // ── STOCK LEVELS ───────────────────────────────────────────
  private _stockLevels: StockLevel[] = [
    { id:1,  productId:1,  warehouseId:1, quantity:850,  reservedQty:0,   reorderPoint:300, safetyStock:150, lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
    { id:2,  productId:2,  warehouseId:1, quantity:120,  reservedQty:0,   reorderPoint:200, safetyStock:100, lastUpdated:new Date().toISOString(), alertLevel:'CRITIQUE'},
    { id:3,  productId:3,  warehouseId:1, quantity:280,  reservedQty:0,   reorderPoint:150, safetyStock:80,  lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
    { id:4,  productId:4,  warehouseId:1, quantity:95,   reservedQty:0,   reorderPoint:100, safetyStock:50,  lastUpdated:new Date().toISOString(), alertLevel:'FAIBLE'  },
    { id:5,  productId:5,  warehouseId:1, quantity:45,   reservedQty:0,   reorderPoint:80,  safetyStock:40,  lastUpdated:new Date().toISOString(), alertLevel:'CRITIQUE'},
    { id:6,  productId:6,  warehouseId:2, quantity:12500,reservedQty:0,   reorderPoint:5000,safetyStock:3000,lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
    { id:7,  productId:7,  warehouseId:2, quantity:2800, reservedQty:0,   reorderPoint:1000,safetyStock:500, lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
    { id:8,  productId:8,  warehouseId:2, quantity:650,  reservedQty:0,   reorderPoint:300, safetyStock:150, lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
    { id:9,  productId:9,  warehouseId:3, quantity:3200, reservedQty:240, reorderPoint:500, safetyStock:250, lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
    { id:10, productId:10, warehouseId:3, quantity:1850, reservedQty:180, reorderPoint:500, safetyStock:250, lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
    { id:11, productId:11, warehouseId:3, quantity:420,  reservedQty:0,   reorderPoint:500, safetyStock:250, lastUpdated:new Date().toISOString(), alertLevel:'FAIBLE'  },
    { id:12, productId:12, warehouseId:3, quantity:240,  reservedQty:0,   reorderPoint:100, safetyStock:50,  lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
    { id:13, productId:13, warehouseId:3, quantity:85,   reservedQty:0,   reorderPoint:50,  safetyStock:25,  lastUpdated:new Date().toISOString(), alertLevel:'NORMAL'  },
  ];

  // ── SUPPLIERS ──────────────────────────────────────────────
  readonly suppliers: Supplier[] = [
    { id:1, name:'Agri-Cam SARL',          leadTimeDays:7,   pays:'Cameroun',       telephone:'237-690-123-456' },
    { id:2, name:'Sinopack Ltd',            leadTimeDays:150, pays:'Chine',          telephone:'+86-21-5555-0100',email:'orders@sinopack.cn' },
    { id:3, name:'PackagingCo Shenzhen',    leadTimeDays:150, pays:'Chine',          telephone:'+86-755-8888-9999' },
    { id:4, name:'Marché de Mfoundi',       leadTimeDays:1,   pays:'Cameroun',       telephone:'237-677-889-900' },
    { id:5, name:'Cereal Distribution CI',  leadTimeDays:14,  pays:"Côte d'Ivoire",  telephone:'225-27-20-330-000' },
  ];

  // ── COMMERCIALS ────────────────────────────────────────────
  readonly commercials: Commercial[] = [
    { id:1, name:'Nguetsop Bertrand', phone:'237-699-001-001', vehicle:'LT-001-YA', active:true },
    { id:2, name:'Abena Pascaline',   phone:'237-699-002-002', vehicle:'LT-002-YA', active:true },
    { id:3, name:'Fouda Emmanuel',    phone:'237-699-003-003', vehicle:'MOTO-003',  active:true },
  ];

  // ── RECEIPTS ───────────────────────────────────────────────
  // Simplifié : la page Réceptions utilise désormais exclusivement StockApiRepository
  // (backend réel). Ce tableau ne sert plus qu'à alimenter le compteur du dashboard
  // mock ci-dessous, avec la forme du nouveau contrat Receipt (receptionType /
  // destinationLocationId), plus aucune des anciennes méthodes CRUD factices.
  private _receipts: Receipt[] = [
    {
      id: 1, receiptNumber: 'REC-MP-2026-0042', receptionType: 'MATIERE_PREMIERE',
      sourceLabel: 'Fournisseur Maïs SARL', receiptDate: '2026-05-07',
      destinationLocationId: 'mock-central', status: 'PENDING_FIRST_VALIDATION',
      items: [
        { productId: 1, productName: 'Maïs jaune (grain)', productSku: 'MP-MAIS-001', productUnit: 'KG', orderedQty: 500, receivedQty: 490, deviation: -10, deviationReason: 'Sacs sous-remplis', lotNumber: 'LOT-MAI-2605' },
      ]
    },
    {
      id: 2, receiptNumber: 'REC-CONS-2026-0041', receptionType: 'CONSOMMABLE',
      sourceLabel: 'Fournisseur Emballages CM', receiptDate: '2026-05-06',
      destinationLocationId: 'mock-central', status: 'PENDING_SECOND_VALIDATION',
      firstValidator: 'GEST001', firstValidatedAt: '2026-05-06',
      items: [
        { productId: 6, productName: 'Sachets 42g TANTY', productSku: 'CONS-SACH-001', productUnit: 'SACHET', orderedQty: 10000, receivedQty: 10000, deviation: 0 },
      ]
    },
  ];

  // ── PRODUCTION BATCHES ─────────────────────────────────────
  private _batches: ProductionBatch[] = [
    { id:1, productId:9,  productName:'TBSA 42g',  productSku:'PF-TBSA-042',  productUnit:'SACHET_42G', declaredQuantityKg:55, equivalentUnits:1309, productionDate:'2026-05-09', batchDate:'2026-05-01', status:'DECLARED_BY_PRODUCTION', declaredBy:2, declaredByName:'M. Clive Nkomo', createdAt:'2026-05-09T06:00:00', notes:'Production journée normale' },
    { id:2, productId:10, productName:'TBSN 42g',  productSku:'PF-TBSN-042',  productUnit:'SACHET_42G', declaredQuantityKg:48, equivalentUnits:1143, productionDate:'2026-05-08', batchDate:'2026-05-01', status:'DECLARED_BY_PRODUCTION', declaredBy:2, declaredByName:'M. Clive Nkomo', createdAt:'2026-05-08T07:00:00', notes:'OK' },
    { id:3, productId:11, productName:'TBSP 42g',  productSku:'PF-TBSP-042',  productUnit:'SACHET_42G', declaredQuantityKg:42, equivalentUnits:1000, productionDate:'2026-05-07', batchDate:'2026-05-01', status:'VALIDATED_BY_STOCK',    declaredBy:2, declaredByName:'M. Clive Nkomo', stockValidator:1, stockValidatorName:'Mvondo Jean-Baptiste', createdAt:'2026-05-07T07:00:00', validatedAt:'2026-05-07T11:00:00', notes:'Validé OK' },
  ];

  // ── INTERNAL ORDERS ────────────────────────────────────────
  private _orders: InternalOrder[] = [
    {
      id:1, orderNumber:'CMD-INT-0100', orderDate:'2026-05-08', status:'APPROVED',
      requestedBy:1, requestedByName:'Mvondo Jean-Baptiste',
      approvedBy:2, approvedByName:'M. Clive Nkomo',
      createdAt:'2026-05-08T09:00:00', approvedAt:'2026-05-08T10:30:00',
      notes:'Production semaine du 11 mai',
      items:[
        { id:1, productId:9, productName:'TBSA 42g', productSku:'PF-TBSA-042', productUnit:'SACHET_42G', requestedQty:2000, deliveredQty:1309, fullyDelivered:false },
        { id:2, productId:10,productName:'TBSN 42g', productSku:'PF-TBSN-042', productUnit:'SACHET_42G', requestedQty:1500, deliveredQty:1143, fullyDelivered:false },
      ]
    },
    {
      id:2, orderNumber:'CMD-INT-0099', orderDate:'2026-05-06', status:'DRAFT',
      requestedBy:1, requestedByName:'Mvondo Jean-Baptiste',
      createdAt:'2026-05-06T14:00:00', notes:'Préparation stock salon',
      items:[
        { id:3, productId:12, productName:'TANTY Seau 1L', productSku:'PF-SEAU-1L', productUnit:'SEAU_1L', requestedQty:500, deliveredQty:0, fullyDelivered:false },
      ]
    },
  ];

  // ── MOVEMENTS ──────────────────────────────────────────────
  private _movements: StockMovement[] = [
    { id:1, type:'ENTRY_FROM_SUPPLIER', productId:1, warehouseId:1, quantity:490, previousStock:360, newStock:850, reference:'REC-2026-0042', createdBy:1, createdAt:'2026-05-07T08:30:00', notes:'Réception validée' },
    { id:2, type:'ENTRY_FROM_PRODUCTION', productId:9, warehouseId:3, quantity:1309, previousStock:1891, newStock:3200, reference:'PROD-0301', createdBy:1, createdAt:'2026-05-04T11:30:00', notes:'Lot TBSA validé' },
    { id:3, type:'EXIT_TO_COMMERCIAL', productId:9, warehouseId:3, quantity:60, previousStock:3260, newStock:3200, reference:'INFO-001', createdBy:1, createdAt:new Date().toISOString(), notes:'Dotation Nguetsop Bertrand' },
    { id:4, type:'EXIT_TO_COMMERCIAL', productId:10, warehouseId:3, quantity:80, previousStock:1930, newStock:1850, reference:'INFO-002', createdBy:1, createdAt:new Date().toISOString(), notes:'Dotation Abena Pascaline' },
    { id:5, type:'ENTRY_FROM_SUPPLIER', productId:6, warehouseId:2, quantity:10000, previousStock:2500, newStock:12500, reference:'REC-2026-0041', createdBy:1, createdAt:'2026-05-06T14:00:00' },
    { id:6, type:'ADJUSTMENT', productId:4, warehouseId:1, quantity:5, previousStock:90, newStock:95, reference:'ADJ-2026-012', createdBy:1, createdAt:'2026-05-06T17:00:00', notes:'Correction inventaire' },
    { id:7, type:'TRANSFER', productId:1, warehouseId:1, quantity:60, previousStock:910, newStock:850, reference:'TAMP-088', createdBy:1, createdAt:'2026-05-06T08:00:00', notes:'Tampon production hebdo' },
    { id:8, type:'ENTRY_FROM_PRODUCTION', productId:10, warehouseId:3, quantity:1143, previousStock:707, newStock:1850, reference:'PROD-0300', createdBy:2, createdAt:'2026-05-06T12:00:00', notes:'Lot TBSN validé' },
  ];

  // ── INFO PRODUITS ──────────────────────────────────────────
  private _infoProduits: InfoProduits[] = [
    {
      id:1, commercialId:1, commercial:this.commercials[0], date:new Date().toISOString().split('T')[0],
      status:'DRAFT', preparedBy:1, createdAt:new Date().toISOString(),
      lines:[
        { id:1, productId:9,  product:this.products[8],  takenQty:60, soldQty:45, returnedQty:15, unitPrice:250 },
        { id:2, productId:12, product:this.products[11], takenQty:10, soldQty:7,  returnedQty:3,  unitPrice:3500 },
      ],
      montantTotal: 45*250+7*3500
    },
    {
      id:2, commercialId:2, commercial:this.commercials[1], date:new Date().toISOString().split('T')[0],
      status:'PENDING_CASH', preparedBy:1, createdAt:new Date().toISOString(),
      lines:[
        { id:3, productId:10, product:this.products[9],  takenQty:80, soldQty:80, returnedQty:0, unitPrice:250 },
        { id:4, productId:11, product:this.products[10], takenQty:40, soldQty:32, returnedQty:8, unitPrice:250 },
      ],
      montantTotal: 80*250+32*250
    },
  ];

  // ── ENRICHMENT HELPERS ─────────────────────────────────────
  private enrichSL(sl: StockLevel): StockLevel {
    const p  = this.products.find(x => x.id === sl.productId);
    const w  = this.warehouses.find(x => x.id === sl.warehouseId);
    const v  = p?.variantId ? this.variants.find(x => x.id === p.variantId) : undefined;
    const l  = v ? this.lines.find(x => x.id === v.productLineId) : undefined;
    const b  = l ? this.brands.find(x => x.id === l.brandId) : undefined;
    return {
      ...sl,
      product: p, warehouse: w,
      productName: p?.designation || p?.sku || '—',
      productSku: p?.sku || '—',
      productUnit: p?.unit || '—',
      productCategory: p?.category || '—',
      unitPrice: p?.unitPriceAmount || 0,
      leadTimeDays: p?.leadTimeDays,
      warehouseName: w?.name || '—',
      warehouseType: w?.type || '—',
      variantName: v?.name,
      productLineName: l?.name,
      brandName: b?.name,
      availableQty: sl.quantity - sl.reservedQty,
      stockValue: (p?.unitPriceAmount || 0) * sl.quantity,
      alertLevel: this.rules.calcAlertLevel(sl),
    };
  }

  // ── PUBLIC API ─────────────────────────────────────────────
  getWarehouses():  Observable<Warehouse[]>         { return of(this.warehouses).pipe(delay(60)); }
  getBrands():      Observable<Brand[]>             { return of(this.brands).pipe(delay(60)); }
  getLines():       Observable<ProductLine[]>       { return of(this.lines).pipe(delay(60)); }
  getVariants():    Observable<ProductVariant[]>    { return of(this.variants).pipe(delay(60)); }
  getProducts():    Observable<Product[]>           { return of(this.products).pipe(delay(80)); }
  getSuppliers():   Observable<Supplier[]>          { return of(this.suppliers).pipe(delay(80)); }
  getCommercials(): Observable<Commercial[]>        { return of(this.commercials).pipe(delay(80)); }
  getInfoProduits():Observable<InfoProduits[]>      { return of(this._infoProduits).pipe(delay(150)); }

  getStockLevels(): Observable<StockLevel[]> {
    return of(this._stockLevels.map(sl => this.enrichSL(sl))).pipe(delay(180));
  }

  getStockLevelsByWarehouse(wid: number): Observable<StockLevel[]> {
    return of(this._stockLevels.filter(sl => sl.warehouseId === wid).map(sl => this.enrichSL(sl))).pipe(delay(120));
  }

  getAlerts(): Observable<StockLevel[]> {
    return of(this._stockLevels.filter(sl => sl.alertLevel === 'CRITIQUE' || sl.alertLevel === 'FAIBLE').map(sl => this.enrichSL(sl))).pipe(delay(100));
  }

  getDashboard(): Observable<DashboardStatsResponse> {
    const levels = this._stockLevels;
    return of({
      totalStockLevels: levels.length,
      totalStockValue: levels.reduce((a, sl) => { const p = this.products.find(x => x.id === sl.productId); return a + (p?.unitPriceAmount || 0) * sl.quantity; }, 0),
      criticalAlerts: levels.filter(sl => sl.alertLevel === 'CRITIQUE').length,
      lowAlerts: levels.filter(sl => sl.alertLevel === 'FAIBLE').length,
      pendingReceipts: this._receipts.filter(r => r.status === 'PENDING_FIRST_VALIDATION' || r.status === 'PENDING_SECOND_VALIDATION').length,
      todayReceipts: 2,
      todayMovements: this._movements.filter(m => m.createdAt.startsWith(new Date().toISOString().split('T')[0])).length,
      pendingBatches: this._batches.filter(b => b.status === 'DECLARED_BY_PRODUCTION').length,
      activeInternalOrders: this._orders.filter(o => o.status === 'DRAFT' || o.status === 'APPROVED').length,
      todaySales: 74250,
    }).pipe(delay(200));
  }

  getBatches(): Observable<ProductionBatch[]> {
    return of([...this._batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).pipe(delay(150));
  }
  getPendingBatches(): Observable<ProductionBatch[]> {
    return of(this._batches.filter(b => b.status === 'DECLARED_BY_PRODUCTION')).pipe(delay(120));
  }

  declareBatch(data: Partial<ProductionBatch>): Observable<ProductionBatch> {
    const batchDate = this.rules.calcBatchDate(new Date(data.productionDate!));
    const p = this.products.find(x => x.id === data.productId);
    const units = p ? this.rules.kgToUnits(data.declaredQuantityKg!, p.unit) : 0;
    const b: ProductionBatch = {
      id: Date.now(), productId: data.productId!, productName: p?.designation || p?.sku,
      productSku: p?.sku, productUnit: p?.unit,
      declaredQuantityKg: data.declaredQuantityKg!, equivalentUnits: units,
      productionDate: data.productionDate!, batchDate: batchDate.toISOString().split('T')[0],
      status: 'DECLARED_BY_PRODUCTION', declaredBy: 2, declaredByName: 'M. Clive Nkomo',
      createdAt: new Date().toISOString(), notes: data.notes,
    };
    this._batches.unshift(b); return of(b).pipe(delay(400));
  }

  validateBatch(id: number, notes: string): Observable<ProductionBatch> {
    const b = this._batches.find(x => x.id === id);
    if (b) {
      b.status = 'VALIDATED_BY_STOCK'; b.stockValidator = 1;
      b.stockValidatorName = 'Mvondo Jean-Baptiste';
      b.validatedAt = new Date().toISOString();
      const units = b.equivalentUnits || 0;
      const sl = this._stockLevels.find(s => s.productId === b.productId && s.warehouseId === 3);
      if (sl) {
        const prev = sl.quantity;
        sl.quantity += units;
        sl.alertLevel = this.rules.calcAlertLevel(sl);
        this._movements.unshift({ id: Date.now(), type: 'ENTRY_FROM_PRODUCTION', productId: b.productId, warehouseId: 3, quantity: units, previousStock: prev, newStock: sl.quantity, reference: 'PROD-' + String(id).padStart(4,'0'), createdBy: 1, createdAt: new Date().toISOString(), notes: 'Lot validé: ' + units + ' unités' });
      }
    }
    return of(b!).pipe(delay(300));
  }

  rejectBatch(id: number, reason: string): Observable<ProductionBatch> {
    const b = this._batches.find(x => x.id === id);
    if (b) { b.status = 'REJECTED'; b.notes = (b.notes || '') + ' | REJETÉ: ' + reason; }
    return of(b!).pipe(delay(200));
  }

  getOrders(): Observable<InternalOrder[]> {
    return of([...this._orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).pipe(delay(150));
  }
  getActiveOrders(): Observable<InternalOrder[]> {
    return of(this._orders.filter(o => ['DRAFT','APPROVED','PARTIALLY_DELIVERED'].includes(o.status))).pipe(delay(120));
  }
  createOrder(data: Partial<InternalOrder>): Observable<InternalOrder> {
    const o: InternalOrder = { id: Date.now(), orderNumber: 'CMD-INT-' + String(this._orders.length + 100).padStart(4,'0'), orderDate: new Date().toISOString().split('T')[0], status: 'DRAFT', requestedBy: 1, requestedByName: 'Mvondo Jean-Baptiste', createdAt: new Date().toISOString(), notes: data.notes, items: data.items || [] };
    this._orders.unshift(o); return of(o).pipe(delay(400));
  }
  approveOrder(id: number): Observable<InternalOrder> {
    const o = this._orders.find(x => x.id === id);
    if (o) { o.status = 'APPROVED'; o.approvedBy = 2; o.approvedByName = 'M. Clive Nkomo'; o.approvedAt = new Date().toISOString(); }
    return of(o!).pipe(delay(200));
  }

  getMovements(): Observable<StockMovement[]> {
    return of([...this._movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(m => ({ ...m, product: this.products.find(p => p.id === m.productId), warehouse: this.warehouses.find(w => w.id === m.warehouseId) }))).pipe(delay(150));
  }

  adjustStock(slId: number, newQty: number, reason: string): Observable<StockLevel> {
    const sl = this._stockLevels.find(x => x.id === slId);
    if (sl) {
      const prev = sl.quantity;
      sl.quantity = newQty; sl.alertLevel = this.rules.calcAlertLevel(sl);
      this._movements.unshift({ id: Date.now(), type: 'ADJUSTMENT', productId: sl.productId, warehouseId: sl.warehouseId, quantity: Math.abs(newQty - prev), previousStock: prev, newStock: newQty, reference: 'ADJ-' + Date.now(), createdBy: 1, createdAt: new Date().toISOString(), notes: reason });
    }
    return of(sl ? this.enrichSL(sl) : sl!).pipe(delay(300));
  }
}
