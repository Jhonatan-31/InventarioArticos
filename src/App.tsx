import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AccessGate } from './components/AccessGate';
import { Layout } from './components/Layout';
import { Bodega } from './pages/Bodega';
import { Contabilidad } from './pages/Contabilidad';
import { Dashboard } from './pages/Dashboard';
import { Entrada } from './pages/Entrada';
import { Exel } from './pages/Exel';
import { Incidents } from './pages/Incidents';
import { Inventory } from './pages/Inventory';
import { Labels } from './pages/Labels';
import { ReferenceDetail } from './pages/ReferenceDetail';
import { References } from './pages/References';
import { Reports } from './pages/Reports';
import { Scanner } from './pages/Scanner';
import { UiProvider } from './ui';

export function App() {
  return (
    <UiProvider>
      <BrowserRouter>
        <AccessGate>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="referencias" element={<References />} />
            <Route path="referencias/:id" element={<ReferenceDetail />} />
            <Route path="inventario" element={<Bodega />} />
            <Route path="entrada" element={<Entrada />} />
            <Route path="pares" element={<Inventory />} />
            <Route path="salida-paginas" element={<Scanner mode="salida" channel="paginas" />} />
            <Route path="salida-dropi" element={<Scanner mode="salida" channel="dropi" />} />
            <Route path="salida-fabrica" element={<Scanner mode="salida" channel="fabrica" />} />
            <Route path="devolucion" element={<Scanner mode="devolucion" />} />
            <Route path="escaner" element={<Navigate to="/salida-paginas" replace />} />
            <Route path="contabilidad" element={<Contabilidad />} />
            <Route path="exel" element={<Exel />} />
            <Route path="etiquetas" element={<Labels />} />
            <Route path="novedades" element={<Incidents />} />
            <Route path="informes" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </AccessGate>
      </BrowserRouter>
    </UiProvider>
  );
}
