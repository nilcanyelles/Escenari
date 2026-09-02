import { db } from "@/lib/db";
import { getConcerts, getCompanyInfo, getClientDetails } from "@/lib/data";
import { emptyContract } from "@/lib/contract";
import { today } from "@/lib/format";
import ContractDoc from "@/components/ContractDoc";
import PrintBar from "./PrintBar";

export const dynamic = "force-dynamic";

// Contracte d'actuació públic (enllaç enviat al client): només lectura,
// imprimible en PDF.
export default async function ContractPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = (await db().query("select id, workspace_id from concerts where contract_token=$1", [token])).rows[0];
  const concert = row ? (await getConcerts(row.workspace_id)).find((c) => c.id === row.id) : null;
  if (!row || !concert) {
    return (
      <div className="pf-screen">
        <div className="pf-dead">
          <div className="pf-brand">ESCENARI</div>
          <div className="pf-dead-icon">📄</div>
          <h1>Aquest contracte no existeix</h1>
          <p>L&apos;enllaç no és vàlid o el contracte s&apos;ha retirat.</p>
        </div>
      </div>
    );
  }
  const [companyInfo, clients] = await Promise.all([getCompanyInfo(row.workspace_id), getClientDetails(row.workspace_id)]);
  const cd = clients[concert.venue];
  const client = { name: concert.venue, nom: cd?.nom || "", cif: cd?.cif || "", address: cd?.address || "" };
  const contract = concert.contract || emptyContract(concert, companyInfo);

  return (
    <div className="ct-public">
      <PrintBar bandName={concert.bandName} />
      <div className="ct-public-doc">
        <ContractDoc concert={concert} contract={contract} companyInfo={companyInfo} client={client} generatedOn={contract.updatedAt ? contract.updatedAt.slice(0, 10) : today()} />
      </div>
    </div>
  );
}
