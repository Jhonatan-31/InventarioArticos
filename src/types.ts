export type PairStatus = 'inventario' | 'salida' | 'prioridad';
export type LabelState = 'por_confirmar' | 'activa' | 'reimpresion';
export type Channel = 'paginas' | 'dropi' | 'fabrica';

export interface Reference {
  id: string;
  code: string;
  name: string;
  color: string;
  size: string;
  line: string;
  notes: string;
  silhouette: string;
  material: string;
  location: string;
  price: number;
  image: string;
  createdAt: string;
  inStock: number;
  priority: number;
  out: number;
  total: number;
  exits: number;
  returns: number;
}

export interface ReferenceInput {
  code: string;
  name: string;
  color: string;
  line: string;
  notes: string;
  silhouette: string;
  material: string;
  location: string;
  price: number;
  image?: string;
}

export interface Pair {
  id: string;
  qrNumber: number;
  qrCode: string;
  payload: string;
  referenceId: string;
  referenceCode: string;
  name: string;
  color: string;
  size: string;
  line: string;
  channel: Channel | null;
  price: number;
  status: PairStatus;
  createdAt: string;
  exitedAt: string | null;
  returnedAt: string | null;
  printedAt: string | null;
  exitCount: number;
  returnCount: number;
  canPrint: boolean;
  reprintAuthorized: boolean;
  labelState: LabelState;
}

export interface Movement {
  id: string;
  pairId: string;
  type: 'entrada' | 'salida' | 'devolucion' | 'novedad' | 'reimpresion';
  note: string;
  createdAt: string;
  amount: number;
  channel: Channel | null;
  size: string;
  qrCode: string;
  referenceCode: string;
  name: string;
}

export interface Incident {
  id: string;
  pairId: string;
  description: string;
  createdAt: string;
  reprintedAt: string | null;
  qrCode: string;
  referenceCode: string;
  name: string;
  color: string;
  size: string;
}

export interface DashboardTotals {
  references: number;
  inStock: number;
  priority: number;
  out: number;
  outPaginas: number;
  outDropi: number;
  outFabrica: number;
  warehouseValue: number;
  incidentsOpen: number;
  entriesToday: number;
  exitsToday: number;
  returnsToday: number;
  paginasBalance: number;
  dropiBalance: number;
  fabricaBalance: number;
  paginasOwed: number;
  dropiOwed: number;
  fabricaOwed: number;
}

export interface DashboardData {
  totals: DashboardTotals;
  nextQr: string;
  byReference: Reference[];
  priorityPairs: Pair[];
  recentMovements: Movement[];
}

export interface PairPage {
  items: Pair[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LabelCheck {
  printable: Pair[];
  blocked: Array<{ id?: string; qrCode: string; reason: string }>;
}

export interface PairBatch {
  quantity: number;
  from: string;
  to: string;
  bySize: Record<string, number>;
  pairs: Pair[];
}

export interface BodegaRow extends Reference {
  stockBySize: Record<string, number>;
  priorityBySize: Record<string, number>;
  lastEntry: string | null;
  lastExit: string | null;
  stockValue: number;
}

export interface BodegaData {
  sizes: string[];
  rows: BodegaRow[];
  totals: {
    bySize: Record<string, number>;
    pairs: number;
    priority: number;
    value: number;
  };
}

export interface ChannelAccount {
  channel: Channel;
  exitedValue: number;
  returnedValue: number;
  owed: number;
  paid: number;
  balance: number;
  exits: number;
  returns: number;
  outNow: number;
}

export interface Payment {
  id: string;
  channel: Channel;
  amount: number;
  note: string;
  createdAt: string;
}

export interface AccountingData {
  paginas: ChannelAccount;
  dropi: ChannelAccount;
  fabrica: ChannelAccount;
  payments: Payment[];
}

export type ExcelSheet = 'Dropi' | 'Articos' | 'Evalook' | 'Luci Bot';
export type ExcelShipStatus = 'Enviado' | 'Problema' | 'Devolución' | 'Entregado';

export interface ExcelPerson {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  transport: string;
  advisor: string;
  updatedAt: string;
}

export interface ExcelRefLine {
  referenceId: string;
  code: string;
  name: string;
  color: string;
  price: number;
  pairs: number;
  lineTotal: number;
}

export interface ExcelOrder {
  id: string;
  sheet: ExcelSheet;
  guideNumber: string;
  firstName: string;
  lastName: string;
  transport: string;
  advisor: string;
  shipStatus: ExcelShipStatus;
  costPrice: number;
  salePrice: number;
  shippingPrice: number;
  profit: number;
  orderDate: string;
  city: string;
  department: string;
  refs: ExcelRefLine[];
  pairId: string | null;
  personId: string | null;
  qrCode: string | null;
  referenceCode: string | null;
  pairName: string | null;
  pairColor: string | null;
  pairSize: string | null;
  pairChannel: Channel | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExcelModuleData {
  sheets: ExcelSheet[];
  shipStatuses: ExcelShipStatus[];
  sheetChannel: Record<ExcelSheet, Channel>;
  currentSheet: ExcelSheet;
  summary: {
    sheet: ExcelSheet;
    channel: Channel;
    count: number;
    totalProfit: number;
    byStatus: Record<ExcelShipStatus, number>;
    orders: ExcelOrder[];
  };
  people: ExcelPerson[];
  references: Reference[];
}

export interface ExcelScanResult {
  pair: Pair;
  person: ExcelPerson | null;
  suggested: {
    sheet: ExcelSheet;
    guideNumber: string;
    firstName: string;
    lastName: string;
    transport: string;
    advisor: string;
    shipStatus: ExcelShipStatus;
    costPrice: number;
    salePrice: number;
    shippingPrice: number;
    orderDate: string;
    pairId: string;
    channelHint: Channel;
    channelMatch: boolean;
    message: string;
  };
}

export interface ExcelOrderInput {
  sheet: ExcelSheet;
  guideNumber?: string;
  firstName: string;
  lastName: string;
  transport?: string;
  advisor?: string;
  shipStatus: ExcelShipStatus;
  costPrice: number;
  salePrice: number;
  shippingPrice: number;
  orderDate: string;
  city?: string;
  department?: string;
  refs?: Array<{ referenceId: string; pairs: number }>;
  pairId?: string | null;
  code?: string;
  phone?: string;
}
