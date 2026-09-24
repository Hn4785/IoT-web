import { useEffect, useState } from "react";

import Button from "../../components/common/Button.tsx";
import { stationBrowserService, type BrowserFarm, type BrowserStation } from "../../services/stationBrowserService.ts";
import { userScopeService } from "../../services/userScopeService.ts";
import { userService } from "../../services/userService.ts";
import type { User } from "../../types/user.ts";
import { normalizeApiError } from "../../utils/apiError.ts";
import styles from "./UserScopeEditor.module.css";

interface Props {
  user: User;
  onChange(user: User): void;
}

export default function UserScopeEditor({ user, onChange }: Props) {
  const [farms, setFarms] = useState<BrowserFarm[]>([]);
  const [stations, setStations] = useState<BrowserStation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inventoryLimited, setInventoryLimited] = useState(false);

  useEffect(() => {
    if (user.role === "ADMIN") return;
    let active = true;
    async function load() {
      try {
        const farmPage = await stationBrowserService.listFarms();
        let stationItems: BrowserStation[] = [];
        let limited = Boolean(farmPage.nextCursor);
        if (user.role === "CLIENT_DEVELOPER") {
          const plots = await Promise.all(farmPage.items.map((farm) => stationBrowserService.listPlots(farm.id)));
          limited ||= plots.some((page) => Boolean(page.nextCursor));
          const stationPages = await Promise.all(plots.flatMap((page) => page.items).map((plot) => stationBrowserService.listStations(plot.id)));
          limited ||= stationPages.some((page) => Boolean(page.nextCursor));
          stationItems = stationPages.flatMap((page) => page.items);
        }
        if (!active) return;
        setFarms(farmPage.items);
        setStations(stationItems);
        setInventoryLimited(limited);
      } catch (reason) {
        if (active) setError(normalizeApiError(reason).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [user.role]);

  if (user.role === "ADMIN") {
    return <p className={styles.note}>Admin access is determined by role; no Farm or Station grants are required.</p>;
  }

  const isFarmer = user.role === "FARMER";
  const assigned = isFarmer ? user.assignedFarmIds : user.assignedStationIds;
  const options = isFarmer
    ? farms.map((farm) => ({ id: farm.id, label: farm.name }))
    : stations.map((station) => ({ id: station.id, label: `${station.code} — ${station.name}` }));

  async function update(id: string, grant: boolean) {
    setSaving(true);
    setError("");
    try {
      if (isFarmer) await userScopeService.setFarmMembership(user.id, id, grant);
      else await userScopeService.setStationGrant(user.id, id, grant);
      onChange(await userService.getUserById(user.id));
      setSelectedId("");
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.editor} aria-label={isFarmer ? "Farm memberships" : "Station grants"}>
      <h3>{isFarmer ? "Farm memberships" : "Developer Station grants"}</h3>
      <p className={styles.note}>{isFarmer ? "A Farmer can access assigned Farms." : "A Client Developer can access only granted Stations through API keys."}</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {loading ? <p>Loading available resources…</p> : (
        <>
          {inventoryLimited && <p className={styles.error}>The resource list is incomplete. Contact an administrator to assign resources outside this page.</p>}
          <div className={styles.controls}>
            <select aria-label={isFarmer ? "Choose Farm" : "Choose Station"} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={saving}>
              <option value="">Choose {isFarmer ? "Farm" : "Station"}</option>
              {options.filter((option) => !assigned.includes(option.id)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <Button type="button" disabled={!selectedId || saving} onClick={() => void update(selectedId, true)}>Grant access</Button>
          </div>
          <ul className={styles.list}>
            {assigned.length === 0 && <li>No assignments yet.</li>}
            {assigned.map((id) => (
              <li key={id}>
                <span>{options.find((option) => option.id === id)?.label ?? id}</span>
                <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void update(id, false)}>Remove</Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
