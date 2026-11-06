export type PairStatus = 'inventario' | 'salida' | 'prioridad';
export type LabelState = 'por_confirmar' | 'activa' | 'reimpresion';
export type Channel = 'paginas' | 'dropi';

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
  warehouseValue: number;
  incidentsOpen: number;
  entriesToday: number;
  exitsToday: number;
  returnsToday: number;
  paginasBalance: number;
  dropiBalance: number;
  paginasOwed: number;
  dropiOwed: number;
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
  payments: Payment[];
}
