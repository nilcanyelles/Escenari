import type { Concert, CompanyInfo, ContractData } from "@/lib/types";
import { formatCurrency, formatDateLong, capitalize, formatDate } from "@/lib/format";
import { contractParagraphs, type ContractClient } from "@/lib/contract";

const INK = "oklch(0.15 0.01 258)";
const DIM = "oklch(0.42 0.01 258)";
const LINE = "oklch(0.88 0.005 258)";

function Party({ role, name, cif, address, extra }: { role: string; name: string; cif?: string; address?: string; extra?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "oklch(0.5 0.01 258)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{role}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{name || "—"}</div>
      {cif && <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>CIF/NIF: {cif}</div>}
      {address && <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{address}</div>}
      {extra && <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{extra}</div>}
    </div>
  );
}

// Document del contracte d'actuació (imprimible / PDF): parts, resum del
// concert, condicions econòmiques, clàusules i signatures.
export default function ContractDoc({ concert, contract, companyInfo, client, generatedOn }: {
  concert: Concert;
  contract: ContractData;
  companyInfo: CompanyInfo;
  client: ContractClient;
  generatedOn: string;
}) {
  const vat = Math.round((concert.amount * (companyInfo.ivaRate || 0)) / 100);
  const total = concert.amount + vat;
  const paragraphs = contractParagraphs(contract.clauses);
  const rows: [string, string][] = [
    ["Grup", concert.bandName],
    ["Data", capitalize(formatDateLong(concert.date))],
    ["Hora", concert.time ? `${concert.time} h` : "Per confirmar"],
    ["Lloc", [concert.venue, concert.city].filter(Boolean).join(", ") || "Per confirmar"],
    ...(concert.festaEntitat ? [["Esdeveniment", concert.festaEntitat] as [string, string]] : []),
  ];

  return (
    <div id="contract-doc-print" className="rs-doc" style={{ fontFamily: "Inter,system-ui,sans-serif", color: INK, background: "oklch(0.995 0.002 258)", padding: "0.75in 0.7in", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 18, borderBottom: `2px solid ${INK}`, gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17 }}>{(companyInfo.nom || "Escenari").toUpperCase()}</div>
          {companyInfo.cif && <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>CIF: {companyInfo.cif}</div>}
          {companyInfo.address && <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>{companyInfo.address}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: "0.04em", color: "oklch(0.55 0.19 290)" }}>CONTRACTE D&apos;ACTUACIÓ</div>
          <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>{concert.bandName} · {formatDate(concert.date)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 30 }}>
        <Party role="L'organitzador" name={client.nom || client.name} cif={client.cif} address={client.address} extra={client.nom && client.name && client.nom !== client.name ? client.name : undefined} />
        <Party role="L'artista" name={companyInfo.nom || concert.bandName} cif={companyInfo.cif} address={companyInfo.address} extra={`En representació de ${concert.bandName}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "oklch(0.97 0.004 258)", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>L&apos;actuació</div>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, minWidth: 90 }}>{k}</span><span style={{ color: DIM }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "oklch(0.97 0.004 258)", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Condicions econòmiques</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>Caixet (base)</span><span>{formatCurrency(concert.amount)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>IVA {companyInfo.ivaRate}%</span><span>{formatCurrency(vat)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, borderTop: `1px solid ${LINE}`, paddingTop: 6, marginTop: 6 }}><span>Total</span><span>{formatCurrency(total)}</span></div>
          {companyInfo.iban && <div style={{ fontSize: 10.5, color: DIM, marginTop: 6 }}>Pagament per transferència: {companyInfo.iban}</div>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Clàusules</div>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: 11.5, lineHeight: 1.55, color: INK, margin: "0 0 8px", textAlign: "justify" }}>{p}</p>
        ))}
        {contract.extra && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, margin: "12px 0 6px" }}>Condicions particulars</div>
            {contractParagraphs(contract.extra).map((p, i) => (
              <p key={i} style={{ fontSize: 11.5, lineHeight: 1.55, color: INK, margin: "0 0 8px", textAlign: "justify" }}>{p}</p>
            ))}
          </>
        )}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 20 }}>
        <div style={{ fontSize: 11.5, color: DIM, marginBottom: 26 }}>
          I perquè així consti, ambdues parts signen aquest contracte per duplicat, a {concert.city ? concert.city.split(",")[0] : "____________"}, el dia ____ de __________ de {concert.date.slice(0, 4)}.
        </div>
        <div style={{ display: "flex", gap: 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: 56, borderBottom: `1px solid ${INK}` }}></div>
            <div style={{ fontSize: 11, marginTop: 6, fontWeight: 600 }}>Per l&apos;ORGANITZADOR</div>
            <div style={{ fontSize: 10.5, color: DIM }}>{client.nom || client.name || ""}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 56, borderBottom: `1px solid ${INK}` }}></div>
            <div style={{ fontSize: 11, marginTop: 6, fontWeight: 600 }}>Per l&apos;ARTISTA</div>
            <div style={{ fontSize: 10.5, color: DIM }}>{[contract.signerName, contract.signerRole].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div style={{ marginTop: 20, paddingTop: 10, borderTop: `1px solid ${LINE}`, fontSize: 9.5, color: "oklch(0.5 0.01 258)", textAlign: "center" }}>
          Escenari · contracte generat el {formatDate(generatedOn)}
        </div>
      </div>
    </div>
  );
}
