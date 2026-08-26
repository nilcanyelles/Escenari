"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Checklist, ChecklistItem } from "@/lib/checklists";
import {
  createChecklistAction, deleteChecklistAction, addChecklistItemAction,
  updateChecklistItemAction, deleteChecklistItemAction, copyChecklistAction, listChecklistTemplatesAction,
} from "@/app/(app)/concerts/checklist-actions";

const STATUS_CYCLE: ChecklistItem["status"][] = ["pendent", "en curs", "fet"];
const STATUS_ICON: Record<string, string> = { pendent: "○", "en curs": "◐", fet: "●" };

function ItemRow({ checklist, item, depth, memberNames, onRefresh }: {
  checklist: Checklist; item: ChecklistItem; depth: number; memberNames: string[]; onRefresh: () => void;
}) {
  const [subText, setSubText] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const children = checklist.items.filter((it) => it.parentId === item.id);
  const overdue = item.due && item.status !== "fet" && item.due < new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className={"ck-item" + (item.status === "fet" ? " done" : "")} style={{ paddingLeft: depth * 26 }}>
        <button
          type="button" className={"ck-status s-" + item.status.replace(" ", "-")}
          title={item.status}
          onClick={async () => {
            const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % 3];
            await updateChecklistItemAction(checklist.id, item.id, { status: next });
            onRefresh();
          }}
        >{STATUS_ICON[item.status]}</button>
        <span className="ck-text">{item.text}</span>
        <select
          className="ck-assignee" value={item.assignee}
          onChange={async (e) => { await updateChecklistItemAction(checklist.id, item.id, { assignee: e.target.value }); onRefresh(); }}
        >
          <option value="">— ningú —</option>
          {memberNames.map((n) => <option key={n}>{n}</option>)}
        </select>
        <input
          type="date" className={"ck-due" + (overdue ? " overdue" : "")} value={item.due || ""}
          onChange={async (e) => { await updateChecklistItemAction(checklist.id, item.id, { due: e.target.value || null }); onRefresh(); }}
        />
        {depth === 0 && (
          <button type="button" className="ck-mini" title="Afegeix subtasca" onClick={() => setAddingSub((v) => !v)}>+</button>
        )}
        <button type="button" className="row-delete-btn" onClick={async () => { await deleteChecklistItemAction(checklist.id, item.id); onRefresh(); }}>✕</button>
      </div>
      {addingSub && (
        <form
          className="ck-add" style={{ paddingLeft: (depth + 1) * 26 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!subText.trim()) return;
            await addChecklistItemAction(checklist.id, item.id, subText);
            setSubText(""); setAddingSub(false); onRefresh();
          }}
        >
          <input className="field-input compact-field" autoFocus placeholder="Subtasca…" value={subText} onChange={(e) => setSubText(e.target.value)} />
          <button type="submit" className="btn-outline">Afegeix</button>
        </form>
      )}
      {children.map((ch) => <ItemRow key={ch.id} checklist={checklist} item={ch} depth={depth + 1} memberNames={memberNames} onRefresh={onRefresh} />)}
    </>
  );
}

export default function ChecklistSection({ concertId, checklists, memberNames }: { concertId: string; checklists: Checklist[]; memberNames: string[] }) {
  const router = useRouter();
  const [newText, setNewText] = useState("");
  const [templates, setTemplates] = useState<{ id: string; name: string; concertLabel: string }[] | null>(null);
  const cl = checklists[0] || null;

  const refresh = () => router.refresh();

  if (!cl) {
    return (
      <div className="panel cd-section">
        <div className="panel-title cd-section-title">Checklist</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn-save" onClick={async () => { await createChecklistAction(concertId, "Checklist del bolo"); refresh(); }}>
            + Crea una checklist
          </button>
          <button type="button" className="btn-outline" onClick={async () => setTemplates(await listChecklistTemplatesAction(concertId))}>
            Copia d&apos;un altre concert
          </button>
        </div>
        {templates && (
          <div className="ck-templates">
            {templates.length === 0 ? <div className="t-dim" style={{ fontSize: 12 }}>Cap checklist per copiar encara.</div> :
              templates.map((t) => (
                <button key={t.id} type="button" className="year-option" onClick={async () => { await copyChecklistAction(t.id, concertId); setTemplates(null); refresh(); }}>
                  {t.name} <span className="t-dim" style={{ fontSize: 11, marginLeft: 8 }}>{t.concertLabel}</span>
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  const roots = cl.items.filter((it) => !it.parentId);
  const doneCount = cl.items.filter((it) => it.status === "fet").length;

  return (
    <div className="panel cd-section">
      <div className="panel-header-row cd-section-title">
        <div className="panel-title">Checklist — {cl.name}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="t-dim" style={{ fontSize: 12 }}>{doneCount}/{cl.items.length} fetes</span>
          <button type="button" className="row-delete-btn" title="Elimina la checklist"
            onClick={async () => { if (confirm("Eliminar tota la checklist?")) { await deleteChecklistAction(cl.id); refresh(); } }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {cl.items.length > 0 && (
        <div className="ck-progress"><div className="ck-progress-fill" style={{ width: (cl.items.length ? (doneCount / cl.items.length) * 100 : 0) + "%" }}></div></div>
      )}

      <div className="ck-list">
        {roots.map((it) => <ItemRow key={it.id} checklist={cl} item={it} depth={0} memberNames={memberNames} onRefresh={refresh} />)}
      </div>

      <form
        className="ck-add"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newText.trim()) return;
          await addChecklistItemAction(cl.id, null, newText);
          setNewText(""); refresh();
        }}
      >
        <input className="field-input compact-field" placeholder="Nova tasca: confirmar backline, enviar cartell…" value={newText} onChange={(e) => setNewText(e.target.value)} style={{ flex: 1, maxWidth: 420 }} />
        <button type="submit" className="btn-outline">Afegeix</button>
      </form>
    </div>
  );
}
