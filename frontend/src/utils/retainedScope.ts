interface ViewPrincipal {
  id: string;
  role: string;
  status: string;
  isSuperAdmin: boolean;
  assignedFarmIds?: readonly string[];
  assignedPlotIds?: readonly string[];
  assignedStationIds?: readonly string[];
  sharedSources?: readonly { id: string; stations: readonly { id: string }[] }[];
}

// Identity only, not a reading cache. Weak keys do not keep logged-out users alive.
const sessionIdentities = new WeakMap<object, number>();
let nextIdentity = 0;

export function retainedViewKey(user: ViewPrincipal | null, environment: string): string {
  if (!user) return JSON.stringify([environment, "signed-out"]);
  let identity = sessionIdentities.get(user);
  if (identity === undefined) {
    identity = ++nextIdentity;
    sessionIdentities.set(user, identity);
  }
  return JSON.stringify([environment, identity, user.id, user.role, user.status,
    user.isSuperAdmin, [...(user.assignedFarmIds ?? [])].sort(),
    [...(user.assignedPlotIds ?? [])].sort(), [...(user.assignedStationIds ?? [])].sort(),
    (user.sharedSources ?? []).map(source => [source.id, source.stations.map(station => station.id).sort()]).sort(),
  ]);
}
