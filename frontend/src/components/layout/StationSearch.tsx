import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { searchAccessibleStations, type BrowserStation } from "../../services/stationBrowserService.ts";
import { normalizeApiError } from "../../utils/apiError.ts";
import type { UserRole } from "../../types/user.ts";
import { stationDetailPath } from "../../routes/stationNavigation.ts";
import styles from "./StationSearch.module.css";

export default function StationSearch({ role }: { role: UserRole }) {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BrowserStation[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      requestId.current += 1;
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = query.trim();
    if (!search) return;
    const request = ++requestId.current;
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const matches = await searchAccessibleStations(search);
      if (request !== requestId.current) return;
      setTotal(matches.length);
      setResults(matches.slice(0, 20));
    } catch (reason) {
      if (request !== requestId.current) return;
      setResults([]);
      setTotal(0);
      setError(normalizeApiError(reason).message);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  return (
    <div className={styles.root} ref={root} onKeyDown={(event) => {
      if (event.key === "Escape") setOpen(false);
    }}>
      <form className={styles.form} role="search" onSubmit={(event) => { void submit(event); }}>
        <input
          className={styles.input}
          aria-label="Search authorized stations"
          placeholder="Search stations"
          value={query}
          onChange={(event) => {
            requestId.current += 1;
            setQuery(event.target.value);
            setOpen(false);
          }}
        />
        <button className={styles.submit} type="submit" aria-label="Search stations">
          <Search size={17} aria-hidden="true" />
        </button>
      </form>
      {open && (
        <section className={styles.results} aria-label="Station search results" aria-live="polite">
          {loading ? <p>Searching authorized stations…</p>
            : error ? <p role="alert">{error}</p>
              : total === 0 ? <p>No matching stations in your scope.</p>
                : <>
                  {results.map((station) => (
                    <button key={station.id} type="button" className={styles.result} onClick={() => {
                      const path = stationDetailPath(role, station.id);
                      if (path) navigate(path);
                      setOpen(false);
                    }}>
                      <strong>{station.code}</strong><span>{station.name}</span>
                    </button>
                  ))}
                  {total > results.length && <p>Showing the first {results.length} of {total} matches.</p>}
                </>}
        </section>
      )}
    </div>
  );
}
