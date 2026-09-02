import type { Concert, CompanyInfo, ContractData } from "./types";
import { formatCurrency, formatDateLong, capitalize } from "./format";

// Contracte d'actuació: text de sèrie amb les dades del concert, que el
// gestor pot retocar. Cada paràgraf (separat per una línia en blanc) és
// una clàusula.

export type ContractClient = { name: string; nom: string; cif: string; address: string };

export function defaultContractClauses(concert: Concert, companyInfo: CompanyInfo): string {
  const artist = companyInfo.nom || "l'agència";
  const when = `${capitalize(formatDateLong(concert.date))}${concert.time ? `, a les ${concert.time} h` : ""}`;
  const where = [concert.venue, concert.city].filter(Boolean).join(", ") || "el lloc acordat";
  const event = concert.festaEntitat ? ` amb motiu de ${concert.festaEntitat}` : "";
  return [
    `1. Objecte. L'ORGANITZADOR contracta l'actuació en directe del grup ${concert.bandName}, representat per ${artist} (en endavant, l'ARTISTA), que tindrà lloc el ${when} a ${where}${event}.`,
    `2. Caixet. Per aquesta actuació, l'ORGANITZADOR abonarà a l'ARTISTA la quantitat de ${formatCurrency(concert.amount)} més l'IVA vigent (${companyInfo.ivaRate}%), mitjançant transferència bancària${companyInfo.iban ? ` al compte ${companyInfo.iban}` : ""}, en els 30 dies següents a l'actuació i prèvia presentació de la factura corresponent.`,
    `3. Condicions tècniques. L'ORGANITZADOR facilitarà l'escenari, el sistema de so i d'il·luminació i el personal tècnic necessaris, d'acord amb el rider tècnic de l'ARTISTA, que forma part d'aquest contracte. Qualsevol canvi s'haurà d'acordar per escrit abans de l'actuació.`,
    `4. Hospitalitat i logística. L'ORGANITZADOR proporcionarà camerino, aigua i les dietes o el càtering, així com l'accés i l'aparcament per als vehicles de l'ARTISTA, segons el full de ruta del concert.`,
    `5. Cancel·lació. Si l'ORGANITZADOR cancel·la l'actuació amb menys de 30 dies d'antelació abonarà el 50% del caixet; amb menys de 7 dies, la totalitat. Les causes de força major degudament justificades eximeixen ambdues parts, que hauran d'intentar fixar una nova data.`,
    `6. Promoció i imatge. L'ORGANITZADOR podrà fer servir el nom, el logotip i les imatges promocionals que li faciliti l'ARTISTA únicament per a la promoció d'aquest esdeveniment. L'enregistrament o retransmissió de l'actuació requereix l'autorització prèvia de l'ARTISTA.`,
    `7. Drets d'autor. Les obligacions davant les entitats de gestió de drets d'autor (SGAE o equivalent) derivades de l'esdeveniment corresponen a l'ORGANITZADOR.`,
    `8. Legislació. Per a qualsevol qüestió derivada d'aquest contracte, les parts se sotmeten a la legislació vigent i als jutjats i tribunals del domicili de l'ARTISTA.`,
  ].join("\n\n");
}

export function emptyContract(concert: Concert, companyInfo: CompanyInfo): ContractData {
  return { clauses: defaultContractClauses(concert, companyInfo), extra: "", signerName: companyInfo.nom || "", signerRole: "Representant de l'artista" };
}

// Divideix el text en clàusules (paràgrafs) per pintar-les numerades.
export function contractParagraphs(text: string): string[] {
  return (text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
