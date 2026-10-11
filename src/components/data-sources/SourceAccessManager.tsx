import { useEffect, useRef, useState } from "react";
import Button from "@/components/common/Button";
import Loading from "@/components/common/Loading";
import { dataSourceService, type DataSourceGrant, type DataSourceGrantCandidate, type DataSourceStation } from "@/services/dataSourceService";
import { normalizeApiError } from "@/utils/apiError";
import styles from "./SourceAccessManager.module.css";

interface Props { sourceId: string; onSaved: () => void }
const roleLabel = (role: string) => role === "FARMER" ? "Farmer" : "Client Developer";

export default function SourceAccessManager({ sourceId, onSaved }: Props) {
  const active = useRef(false);
  const searchGeneration = useRef(0);
  const [grants, setGrants] = useState<DataSourceGrant[]>([]);
  const [grantCursor, setGrantCursor] = useState<string | null>(null);
  const [stations, setStations] = useState<DataSourceStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [candidates, setCandidates] = useState<DataSourceGrantCandidate[]>([]);
  const [candidateCursor, setCandidateCursor] = useState<string | null>(null);
  const [searchedEmail, setSearchedEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recipient, setRecipient] = useState<DataSourceGrantCandidate | null>(null);
  const [stationIds, setStationIds] = useState<string[]>([]);
  const [existingIds, setExistingIds] = useState<string[]>([]);

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    void Promise.all([dataSourceService.listGrants(sourceId), dataSourceService.listStations(sourceId)])
      .then(([page, inventory]) => {
        if (cancelled) return;
        setGrants(page.items);
        setGrantCursor(page.nextCursor);
        setStations(inventory.items);
      }).catch(reason => { if (!cancelled) { setError(normalizeApiError(reason).message); setLoadFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; active.current = false; };
  }, [sourceId]);

  const search = async (cursor?: string) => {
    const query = email.trim();
    if (query.length < 3 || query.length > 254 || busy) return;
    const generation = ++searchGeneration.current;
    setSearching(true);
    setError("");
    try {
      const page = await dataSourceService.listGrantCandidates(sourceId, cursor, query);
      if (!active.current || generation !== searchGeneration.current) return;
      setCandidates(current => cursor ? [...current, ...page.items] : page.items);
      setCandidateCursor(page.nextCursor);
      setSearchedEmail(query);
    } catch (reason) {
      if (active.current && generation === searchGeneration.current) setError(normalizeApiError(reason).message);
    } finally {
      if (active.current && generation === searchGeneration.current) setSearching(false);
    }
  };

  const selectRecipient = async (account: DataSourceGrantCandidate) => {
    if (busy) return;
    searchGeneration.current++;
    setSearching(false);
    setBusy(true);
    setError("");
    let known = grants;
    let cursor = grantCursor;
    const seen = new Set<string>();
    try {
      // Resolve existing access beyond the first page before editing a recipient.
      while (!known.some(grant => grant.user.id === account.id) && cursor) {
        if (seen.has(cursor)) throw new Error("Unable to load shared accounts. Close and reopen Manage Access.");
        seen.add(cursor);
        const page = await dataSourceService.listGrants(sourceId, cursor);
        if (!active.current) return;
        known = [...known, ...page.items.filter(item => !known.some(grant => grant.user.id === item.user.id))];
        cursor = page.nextCursor;
      }
    } catch (reason) {
      if (active.current) setError(normalizeApiError(reason).message);
      return;
    } finally { if (active.current) setBusy(false); }
    if (!active.current) return;
    setGrants(known);
    setGrantCursor(cursor);
    const ids = known.find(grant => grant.user.id === account.id)?.stationIds ?? [];
    setRecipient(account);
    setCandidates([]);
    setCandidateCursor(null);
    setSearchedEmail("");
    setStationIds([...ids]);
    setExistingIds([...ids]);
    setNotice("");
    setError("");
  };

  const save = async (revoke = false) => {
    if (!recipient || busy || (stationIds.length === 0 && !revoke)) return;
    const account = recipient;
    setBusy(true);
    setError("");
    let updated = false;
    try {
      if (revoke) await dataSourceService.revoke(sourceId, account.id);
      else await dataSourceService.setGrantStations(sourceId, account.id, stationIds);
      updated = true;
      if (!active.current) return;
      setRecipient(null);
      setNotice(revoke ? `Access revoked for ${account.email}.` : `Access saved for ${account.email}.`);
      onSaved();
      const page = await dataSourceService.listGrants(sourceId);
      if (!active.current) return;
      setGrants(page.items);
      setGrantCursor(page.nextCursor);
    } catch (reason) {
      if (active.current) {
        setError(updated ? "Access was updated, but the shared-account list could not be reloaded. Close and reopen Manage Access." : normalizeApiError(reason).message);
        if (updated) setLoadFailed(true);
      }
    } finally { if (active.current) setBusy(false); }
  };

  const loadMoreGrants = async () => {
    if (!grantCursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const page = await dataSourceService.listGrants(sourceId, grantCursor);
      if (!active.current) return;
      setGrants(current => [...current, ...page.items.filter(item => !current.some(grant => grant.user.id === item.user.id))]);
      setGrantCursor(page.nextCursor);
    } catch (reason) { if (active.current) setError(normalizeApiError(reason).message); }
    finally { if (active.current) setBusy(false); }
  };

  if (loading) return <Loading label="Loading shared accounts..." />;
  // Failed initialization must not present an empty, editable grant state.
  if (loadFailed) return <p role="alert">{error} Close and reopen Manage Access to retry.</p>;
  const changed = stationIds.length !== existingIds.length || existingIds.some(id => !stationIds.includes(id));
  return <div className={styles.manager}>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <form className={styles.search} onSubmit={event => { event.preventDefault(); void search(); }}>
      <label htmlFor="source-recipient-email">Recipient email</label>
      <div className={styles.searchRow}>
        <input id="source-recipient-email" type="search" inputMode="email" autoComplete="off" maxLength={254} value={email} disabled={busy} placeholder="Enter at least 3 characters" onChange={event => {
          searchGeneration.current++;
          setEmail(event.target.value);
          setCandidates([]);
          setCandidateCursor(null);
          setSearchedEmail("");
          setSearching(false);
        }} />
        <Button type="submit" variant="outline" loading={searching} disabled={busy || email.trim().length < 3}>Search accounts</Button>
      </div>
      <p className={styles.help}>Choose an active Farmer or Client Developer, then select stations and save.</p>
    </form>
    {searchedEmail && <div className={styles.results} aria-label="Matching accounts">
      {candidates.length === 0 && <p role="status">No matching active accounts.</p>}
      {candidates.map(account => <button key={account.id} type="button" className={styles.result} disabled={busy} onClick={() => { void selectRecipient(account); }}>
        <strong>{account.displayName}</strong><span>{account.email}</span><small>{roleLabel(account.role)}{grants.some(grant => grant.user.id === account.id) ? " · Already shared" : ""}</small>
      </button>)}
      {candidateCursor && <Button variant="outline" size="sm" loading={searching} disabled={busy} onClick={() => void search(candidateCursor)}>More matching accounts</Button>}
    </div>}
    {recipient && <fieldset className={styles.editor} disabled={busy} aria-label="Station access">
      <legend>Station access</legend>
      <strong>{recipient.displayName}</strong><span className={styles.email}>{recipient.email}</span><small>{roleLabel(recipient.role)}</small>
      <p className={styles.help}>{stationIds.length} selected · Changes apply only after saving.</p>
      {stations.length === 0 && <p>No soil stations were found for this source.</p>}
      <div className={styles.stationChecks}>{stations.map(station => <label key={station.id}>
        <input type="checkbox" checked={stationIds.includes(station.id)} onChange={() => setStationIds(current => current.includes(station.id) ? current.filter(id => id !== station.id) : [...current, station.id])} />
        <span><strong>{station.name}</strong><small>{station.code}</small></span>
      </label>)}</div>
      <div className={styles.actions}>
        {existingIds.length > 0 && <Button size="sm" variant="danger" loading={busy} onClick={() => void save(true)}>Revoke Access</Button>}
        <Button size="sm" variant="outline" onClick={() => setRecipient(null)}>Cancel</Button>
        <Button size="sm" loading={busy} disabled={!changed || stationIds.length === 0} onClick={() => void save()}>Save Access</Button>
      </div>
    </fieldset>}
    <section className={styles.shared} aria-label="Shared accounts">
      <h3>Shared accounts <span>({grants.length}{grantCursor ? "+" : ""})</span></h3>
      {grants.length === 0 && <p className={styles.help}>No accounts have been shared yet.</p>}
      {grants.map(grant => <div className={styles.sharedRow} key={grant.user.id}>
        <div><strong>{grant.user.displayName}</strong><span className={styles.email}>{grant.user.email}</span><small>{roleLabel(grant.user.role)} · {grant.stationIds.length} station{grant.stationIds.length === 1 ? "" : "s"}</small></div>
        <Button size="sm" variant="outline" disabled={busy} aria-label={`Edit access for ${grant.user.email}`} onClick={() => { void selectRecipient(grant.user); }}>Edit access</Button>
      </div>)}
      {grantCursor && <Button variant="outline" size="sm" loading={busy} onClick={() => void loadMoreGrants()}>More shared accounts</Button>}
    </section>
  </div>;
}
