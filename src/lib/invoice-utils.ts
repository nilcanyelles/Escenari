// Càlcul d'una factura espanyola: base + IVA − retenció d'IRPF.
export function computeInvoiceTotals(base: number, ivaRate: number, irpfRate: number) {
  const iva = Math.round((base * ivaRate) / 100);
  const irpf = Math.round((base * irpfRate) / 100);
  return { iva, irpf, total: base + iva - irpf };
}
