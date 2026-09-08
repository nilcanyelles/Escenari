import { db } from "./db";
import { today } from "./format";

// Un enllaç de confirmació d'assistència (/conf/[token]) pot ser d'un sol
// concert (concerts.att_token, els de sempre) o de més d'un alhora
// (attendance_links): una llista concreta de concerts propers del grup, o
// bé "tots els propers", que inclou també els que es creïn després de fer
// l'enllaç. Tant la pàgina com les seves accions passen per aquí per saber
// de quin grup és i quins concerts hi entren — mai s'ha de confiar en un
// id de concert que vingui del client sense comprovar que és d'aquesta
// llista (vegeu respondConfAction).
export type ResolvedAttendanceLink = {
  token: string;
  workspaceId: string;
  bandId: string;
  // Concerts inclosos, ja resolts i ordenats per data. Els enllaços de més
  // d'un concert només mostren els que encara han de passar (a partir
  // d'avui) — un concert ja fet no necessita confirmació.
  concertIds: string[];
  allFuture: boolean;
  // true per als enllaços d'un sol concert (concerts.att_token) — la pàgina
  // hi mostra el pòster i els detalls del dia, com fins ara.
  single: boolean;
};

export async function resolveAttendanceLink(token: string): Promise<ResolvedAttendanceLink | null> {
  const pool = db();
  const multi = (await pool.query("select * from attendance_links where id=$1", [token])).rows[0];
  if (multi) {
    let ids: string[] = [];
    if (multi.all_future) {
      ids = (await pool.query(
        `select id from concerts where band_id=$1 and workspace_id=$2 and status <> 'cancel·lat' and date >= $3
         order by date, time`,
        [multi.band_id, multi.workspace_id, today()]
      )).rows.map((r) => r.id as string);
    } else {
      const wanted: string[] = Array.isArray(multi.concert_ids) ? multi.concert_ids : [];
      if (wanted.length) {
        ids = (await pool.query(
          `select id from concerts where id = any($1::text[]) and band_id=$2 and status <> 'cancel·lat' and date >= $3
           order by date, time`,
          [wanted, multi.band_id, today()]
        )).rows.map((r) => r.id as string);
      }
    }
    return { token, workspaceId: multi.workspace_id, bandId: multi.band_id, concertIds: ids, allFuture: !!multi.all_future, single: false };
  }
  const single = (await pool.query(
    "select id, band_id, workspace_id from concerts where att_token=$1 and status <> 'cancel·lat'",
    [token]
  )).rows[0];
  if (!single) return null;
  return { token, workspaceId: single.workspace_id, bandId: single.band_id, concertIds: [single.id], allFuture: false, single: true };
}
