"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";

export type BackupPerson = { name: string; instruments: string[]; phone: string; email: string };

// Desa la llista de suplents de confiança d'un grup.
export async function saveBandBackupsAction(bandId: string, backups: BackupPerson[]) {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update bands set backups=$1 where id=$2 and workspace_id=$3",
    [JSON.stringify(backups || []), bandId, workspaceId]
  );
  revalidatePath("/grup");
}

// Publica una cerca de suplent per a un concert (visible a la borsa de músics).
export async function publishBackupRequestAction(input: {
  bandId: string;
  concertId: string;
  memberName: string;
  instruments: string[];
  note: string;
}) {
  const { workspaceId } = await requireManagerAction();
  const id = "br" + Date.now();
  await db().query(
    `insert into backup_requests (id, workspace_id, band_id, concert_id, member_name, instruments, note)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, workspaceId, input.bandId, input.concertId, input.memberName, JSON.stringify(input.instruments || []), input.note || ""]
  );
  revalidatePath("/grup");
  revalidatePath("/suplencies");
  return id;
}

export async function setBackupRequestStatusAction(id: string, status: "oberta" | "coberta" | "cancel·lada") {
  const { workspaceId } = await requireManagerAction();
  await db().query(
    "update backup_requests set status=$1 where id=$2 and workspace_id=$3",
    [status, id, workspaceId]
  );
  revalidatePath("/grup");
  revalidatePath("/suplencies");
}

export async function respondBackupApplicationAction(requestId: string, clerkUserId: string, status: "acceptada" | "rebutjada") {
  const { workspaceId } = await requireManagerAction();
  const owns = await db().query("select 1 from backup_requests where id=$1 and workspace_id=$2", [requestId, workspaceId]);
  if (!owns.rows.length) throw new Error("Cerca no trobada");
  await db().query(
    "update backup_applications set status=$1 where request_id=$2 and clerk_user_id=$3",
    [status, requestId, clerkUserId]
  );
  if (status === "acceptada") {
    await db().query("update backup_requests set status='coberta' where id=$1", [requestId]);
  }
  revalidatePath("/grup");
  revalidatePath("/suplencies");
}
